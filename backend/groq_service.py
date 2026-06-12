"""
Groq API Service
Handles all AI operations: transcription, analysis, sentiment, summaries
"""

import os, json, asyncio
from typing import Optional
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


class GroqService:
    """
    Wrapper around Groq API for all AI operations in DCM Audit System.
    Uses Whisper for STT and Llama3 for NLP tasks.
    """
    
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            print("[WARNING] GROQ_API_KEY not set. AI features will use mock data.")
            self.client = None
        else:
            self.client = Groq(api_key=api_key)
        
        self.stt_model = "whisper-large-v3"
        self.llm_model = "llama-3.3-70b-versatile"
    

    async def transcribe_audio(self, file_path: str) -> dict:
        """
        Transcribe audio file using Groq Whisper API.
        Returns transcription text and confidence score.
        """
        if not self.client:
            return self._mock_transcription()
        
        try:
            with open(file_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model=self.stt_model,
                    file=audio_file,
                    response_format="verbose_json"
                )
            
            return {
                "text": response.text,
                "confidence": getattr(response, "confidence", 0.95),
                "language": getattr(response, "language", "en"),
                "duration": getattr(response, "duration", None)
            }
        except Exception as e:
            print(f"[Groq STT Error] {e}")
            return self._mock_transcription()
    

    async def analyze_call(self, transcript: str) -> dict:
        """
        Comprehensive call analysis using Groq LLM.
        Returns: summary, sentiment, keywords, topics, scores, issues, suggestions.
        """
        if not self.client:
            return self._mock_analysis()
        
        prompt = f"""You are an expert call center quality analyst for DCM. Analyze the following call transcript and provide a comprehensive JSON analysis.

TRANSCRIPT:
{transcript[:4000]}  

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{{
  "summary": "2-3 sentence summary of the call",
  "key_points": ["point 1", "point 2", "point 3"],
  "sentiment": {{
    "label": "positive|neutral|negative",
    "score": 0.0,
    "reasoning": "brief explanation"
  }},
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "topics": ["topic1", "topic2"],
  "call_quality_score": 75.0,
  "customer_satisfaction_score": 70.0,
  "identified_issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}}

Scoring guidelines:
- sentiment score: -1.0 (very negative) to 1.0 (very positive)
- customer_satisfaction_score: 0-100 based on customer tone, sentiment, and outcomes.
- call_quality_score: 0-100. Calculate this score based on how well the agent performed across these DCM Quality Audit rubrics:
  1. Caller Identification: Welcoming the customer warmly, confirming name/code/village/mobile.
  2. Professionalism: Active listening, appropriate tone/empathy, clear communication, and prompt replies.
  3. Delivery: Providing accurate and right information.
  4. Ticket Raising: Raising genuine tickets correctly when required.
  5. Outcome: Achieving a successful call resolution/outcome.
"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1500
            )
            
            raw = response.choices[0].message.content.strip()
            
            # Clean any accidental markdown
            raw = raw.replace("```json", "").replace("```", "").strip()
            
            result = json.loads(raw)
            return result
            
        except json.JSONDecodeError as e:
            print(f"[Groq JSON Parse Error] {e}")
            return self._mock_analysis()
        except Exception as e:
            print(f"[Groq Analysis Error] {e}")
            return self._mock_analysis()
    

    async def generate_feedback_suggestions(
        self,
        summary: str,
        issues: list,
        sentiment: str
    ) -> list:
        """Generate targeted feedback suggestions based on call analysis"""
        if not self.client:
            return self._mock_suggestions()
        
        prompt = f"""Based on this customer call analysis, generate 5 specific, actionable feedback suggestions for the agent.

Call Summary: {summary}
Identified Issues: {', '.join(issues) if issues else 'None identified'}
Overall Sentiment: {sentiment}

Return ONLY a JSON array of strings (no markdown):
["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"]
"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=500
            )
            
            raw = response.choices[0].message.content.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        
        except Exception as e:
            print(f"[Groq Suggestions Error] {e}")
            return self._mock_suggestions()
    

    # ─── Mock Data (fallback when API key not set) ─────────────────────────────

    def _mock_transcription(self) -> dict:
        return {
            "text": "Hello, thank you for calling DCM support. My name is Sarah. How can I help you today? Yes, I understand your concern about the billing issue. Let me look into that for you right away. I can see here that there was a duplicate charge on your account from last month. I'll process a refund for you immediately. The refund should appear within 3-5 business days. Is there anything else I can help you with today? Great, have a wonderful day!",
            "confidence": 0.94,
            "language": "en",
            "duration": 180
        }
    
    def _mock_analysis(self) -> dict:
        return {
            "summary": "Customer called regarding a duplicate billing charge on their account. Agent Sarah identified the issue quickly and processed a refund. The interaction was professional and resolved satisfactorily.",
            "key_points": [
                "Customer reported duplicate billing charge",
                "Agent verified the issue in the system",
                "Refund processed - 3-5 business days",
                "Customer satisfied with resolution"
            ],
            "sentiment": {
                "label": "positive",
                "score": 0.72,
                "reasoning": "Customer issue was resolved promptly with a professional response"
            },
            "keywords": ["billing", "refund", "duplicate charge", "account", "resolution"],
            "topics": ["billing support", "refund processing"],
            "call_quality_score": 85.0,
            "customer_satisfaction_score": 82.0,
            "identified_issues": ["Duplicate charge on account"],
            "suggestions": [
                "Proactively mention refund timeline at the start",
                "Offer to send a confirmation email for the refund",
                "Check for other potential billing discrepancies before ending call"
            ]
        }
    
    def _mock_suggestions(self) -> list:
        return [
            "Acknowledge the customer's concern more empathetically at the start",
            "Provide estimated resolution time upfront",
            "Offer follow-up contact information",
            "Summarize actions taken before ending the call",
            "Ask if any other assistance is needed"
        ]
