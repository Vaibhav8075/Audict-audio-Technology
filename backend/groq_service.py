import os, json, asyncio, math
from pathlib import Path
from typing import Optional
from groq import AsyncGroq
from dotenv import load_dotenv
load_dotenv()


class AIServiceError(Exception):
    """The AI provider failed; callers record the failure instead of passing placeholder results off as real."""


SENTIMENT_LABELS = ('positive', 'neutral', 'negative')


def _score(value, low, high):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return min(max(value, low), high) if math.isfinite(value) else None


def _texts(value) -> list:
    """Non-empty strings from whatever the model sent: one string, a list of strings, or objects like {"issue": "..."}."""
    if isinstance(value, str):
        value = [value]
    texts = []
    for item in value if isinstance(value, list) else []:
        if isinstance(item, dict):
            item = next((v for v in item.values() if isinstance(v, str)), None)
        if isinstance(item, (str, int, float)) and str(item).strip():
            texts.append(str(item).strip())
    return texts


def normalize_analysis(data) -> dict:
    """Coerce the model's JSON into the shape the database and dashboards expect, or raise if it is unusable."""
    if not isinstance(data, dict):
        raise ValueError('the model reply was not a JSON object')
    sentiment = data.get('sentiment') if isinstance(data.get('sentiment'), dict) else {}
    label = str(sentiment.get('label') or '').strip().lower()
    result = {'summary': str(data.get('summary') or '').strip(), 'key_points': _texts(data.get('key_points')),
              'sentiment': {'label': label if label in SENTIMENT_LABELS else 'neutral', 'score': _score(sentiment.get('score'), -1.0, 1.0) or 0.0, 'reasoning': str(sentiment.get('reasoning') or '')},
              'keywords': _texts(data.get('keywords')), 'topics': _texts(data.get('topics')),
              'call_quality_score': _score(data.get('call_quality_score'), 0.0, 100.0), 'customer_satisfaction_score': _score(data.get('customer_satisfaction_score'), 0.0, 100.0),
              'identified_issues': _texts(data.get('identified_issues')), 'suggestions': _texts(data.get('suggestions'))}
    if not result['summary'] or result['call_quality_score'] is None or result['customer_satisfaction_score'] is None:
        raise ValueError('the model reply was missing the summary or scores')
    return result


def segment_confidence(segments):
    """Duration-weighted mean token probability, exp(avg_logprob), over Whisper's segments; None without segments."""
    total = weighted = 0.0
    for seg in segments or []:
        if not isinstance(seg, dict) or seg.get('avg_logprob') is None:
            continue
        span = max(float(seg.get('end') or 0) - float(seg.get('start') or 0), 0.01)
        weighted += math.exp(float(seg['avg_logprob'])) * span
        total += span
    return round(weighted / total, 3) if total else None


class GroqService:

    def __init__(self):
        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            print('[WARNING] GROQ_API_KEY not set. AI features will use mock data.')
            self.client = None
        else:
            # async client: a sync call inside these coroutines froze the whole API until Groq answered
            self.client = AsyncGroq(api_key=api_key)
        self.stt_model = 'whisper-large-v3'
        # llama-3.3-70b-versatile was retired by Groq; override with GROQ_LLM_MODEL when models change again
        self.llm_model = os.getenv('GROQ_LLM_MODEL', 'openai/gpt-oss-120b')
        # gpt-oss models reason before answering; keep that short so the JSON fits in max_tokens
        self.llm_extra = {'reasoning_effort': 'low'} if 'gpt-oss' in self.llm_model else {}

    async def transcribe_audio(self, file_path: str) -> dict:
        if not self.client:
            return self._mock_transcription()
        try:
            audio = await asyncio.to_thread(Path(file_path).read_bytes)
            response = await self.client.audio.transcriptions.create(model=self.stt_model, file=(os.path.basename(file_path), audio), response_format='verbose_json')
            # Whisper reports no confidence score; derive one from the segments instead of assuming 0.95
            return {'text': response.text, 'confidence': segment_confidence(getattr(response, 'segments', None)), 'language': getattr(response, 'language', None), 'duration': getattr(response, 'duration', None)}
        except Exception as e:
            raise AIServiceError(f'Transcription failed: {e}') from e

    async def analyze_call(self, transcript: str) -> dict:
        if not self.client:
            return self._mock_analysis()
        prompt = f'You are an expert call center quality analyst for DCM. Analyze the following call transcript and provide a comprehensive JSON analysis.\n\nTRANSCRIPT:\n{transcript[:4000]}  \n\nReturn ONLY valid JSON with this exact structure (no markdown, no extra text):\n{{\n  "summary": "2-3 sentence summary of the call",\n  "key_points": ["point 1", "point 2", "point 3"],\n  "sentiment": {{\n    "label": "positive|neutral|negative",\n    "score": 0.0,\n    "reasoning": "brief explanation"\n  }},\n  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],\n  "topics": ["topic1", "topic2"],\n  "call_quality_score": 75.0,\n  "customer_satisfaction_score": 70.0,\n  "identified_issues": ["issue 1", "issue 2"],\n  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]\n}}\n\nScoring guidelines:\n- sentiment score: -1.0 (very negative) to 1.0 (very positive)\n- customer_satisfaction_score: 0-100 based on customer tone, sentiment, and outcomes.\n- call_quality_score: 0-100. Calculate this score based on how well the agent performed across these DCM Quality Audit rubrics:\n  1. Caller Identification: Welcoming the customer warmly, confirming name/code/village/mobile.\n  2. Professionalism: Active listening, appropriate tone/empathy, clear communication, and prompt replies.\n  3. Delivery: Providing accurate and right information.\n  4. Ticket Raising: Raising genuine tickets correctly when required.\n  5. Outcome: Achieving a successful call resolution/outcome.\n'
        try:
            response = await self.client.chat.completions.create(model=self.llm_model, messages=[{'role': 'user', 'content': prompt}], temperature=0.3, max_tokens=4000, response_format={'type': 'json_object'}, extra_body=self.llm_extra)
            raw = (response.choices[0].message.content or '').strip()
            raw = raw.replace('```json', '').replace('```', '').strip()
            return normalize_analysis(json.loads(raw))
        except json.JSONDecodeError as e:
            raise AIServiceError(f'Analysis failed: the model did not return valid JSON ({e})') from e
        except Exception as e:
            raise AIServiceError(f'Analysis failed: {e}') from e

    async def generate_feedback_suggestions(self, summary: str, issues: list, sentiment: str) -> list:
        if not self.client:
            return self._mock_suggestions()
        prompt = f"""Based on this customer call analysis, generate 5 specific, actionable feedback suggestions for the agent.\n\nCall Summary: {summary}\nIdentified Issues: {(', '.join(_texts(issues)) or 'None identified')}\nOverall Sentiment: {sentiment}\n\nReturn ONLY a JSON object (no markdown) in this form:\n{{"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"]}}\n"""
        try:
            response = await self.client.chat.completions.create(model=self.llm_model, messages=[{'role': 'user', 'content': prompt}], temperature=0.5, max_tokens=2000, response_format={'type': 'json_object'}, extra_body=self.llm_extra)
            raw = (response.choices[0].message.content or '').strip()
            raw = raw.replace('```json', '').replace('```', '').strip()
            data = json.loads(raw)
            suggestions = _texts(data.get('suggestions') if isinstance(data, dict) else data)
        except Exception as e:
            raise AIServiceError(f'Suggestions failed: {e}') from e
        if not suggestions:
            raise AIServiceError('Suggestions failed: the model returned none')
        return suggestions

    def _mock_transcription(self) -> dict:
        return {'text': "Hello, thank you for calling DCM support. My name is Sarah. How can I help you today? Yes, I understand your concern about the billing issue. Let me look into that for you right away. I can see here that there was a duplicate charge on your account from last month. I'll process a refund for you immediately. The refund should appear within 3-5 business days. Is there anything else I can help you with today? Great, have a wonderful day!", 'confidence': None, 'language': 'en', 'duration': None}

    def _mock_analysis(self) -> dict:
        return {'_mock': True, 'summary': 'Customer called regarding a duplicate billing charge on their account. Agent Sarah identified the issue quickly and processed a refund. The interaction was professional and resolved satisfactorily.', 'key_points': ['Customer reported duplicate billing charge', 'Agent verified the issue in the system', 'Refund processed - 3-5 business days', 'Customer satisfied with resolution'], 'sentiment': {'label': 'positive', 'score': 0.72, 'reasoning': 'Customer issue was resolved promptly with a professional response'}, 'keywords': ['billing', 'refund', 'duplicate charge', 'account', 'resolution'], 'topics': ['billing support', 'refund processing'], 'call_quality_score': 85.0, 'customer_satisfaction_score': 82.0, 'identified_issues': ['Duplicate charge on account'], 'suggestions': ['Proactively mention refund timeline at the start', 'Offer to send a confirmation email for the refund', 'Check for other potential billing discrepancies before ending call']}

    def _mock_suggestions(self) -> list:
        return ["Acknowledge the customer's concern more empathetically at the start", 'Provide estimated resolution time upfront', 'Offer follow-up contact information', 'Summarize actions taken before ending the call', 'Ask if any other assistance is needed']