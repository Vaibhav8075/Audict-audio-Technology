"""GroqService against a stand-in for groq.AsyncGroq: what it sends, how it reads replies, how it fails."""
import asyncio
import json
from types import SimpleNamespace
import pytest
from groq_service import GroqService, AIServiceError

REPLY = {'summary': 'Customer reported an outage; agent raised a ticket.', 'key_points': ['outage'], 'sentiment': {'label': 'negative', 'score': -0.4, 'reasoning': 'frustrated'},
         'keywords': ['outage'], 'topics': ['network'], 'call_quality_score': 64, 'customer_satisfaction_score': 41, 'identified_issues': ['no ETA given'], 'suggestions': ['Give an ETA']}


class FakeAsyncGroq:
    """Mimics the parts of AsyncGroq the service uses. Each reply is a string, or an exception to raise."""

    def __init__(self, replies=(), transcription=None, delay=0.0):
        self.calls, self.replies, self.delay = [], list(replies), delay
        self.transcription = transcription or {'text': 'Agent: hello. Customer: my internet is down.', 'duration': 42.0}
        self.audio = SimpleNamespace(transcriptions=SimpleNamespace(create=self._transcribe))
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._complete))

    async def _transcribe(self, **kwargs):
        self.calls.append(kwargs)
        await asyncio.sleep(self.delay)
        return SimpleNamespace(**self.transcription)

    async def _complete(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=reply))])


def service_with(client):
    service = GroqService()
    service.client = client
    return service


@pytest.fixture
def audio_file(tmp_path):
    path = tmp_path / 'call.mp3'
    path.write_bytes(b'ID3 audio bytes')
    return str(path)


def test_transcription_sends_the_file_to_whisper(audio_file):
    service = service_with(FakeAsyncGroq())
    result = asyncio.run(service.transcribe_audio(audio_file))
    assert service.client.calls[0]['file'] == ('call.mp3', b'ID3 audio bytes')
    assert service.client.calls[0]['response_format'] == 'verbose_json'
    assert result['text'] == 'Agent: hello. Customer: my internet is down.'


def test_slow_provider_call_leaves_the_event_loop_free(audio_file):
    service = service_with(FakeAsyncGroq(delay=0.3))

    async def scenario():
        ticks = 0

        async def ticker():
            nonlocal ticks
            while True:
                await asyncio.sleep(0.01)
                ticks += 1
        task = asyncio.create_task(ticker())
        await service.transcribe_audio(audio_file)
        task.cancel()
        return ticks
    # other requests keep being served while Groq is working
    assert asyncio.run(scenario()) >= 10


def test_analysis_parses_the_model_reply():
    service = service_with(FakeAsyncGroq(replies=['```json\n' + json.dumps(REPLY) + '\n```']))
    result = asyncio.run(service.analyze_call('Agent: hello.'))
    assert result['call_quality_score'] == 64 and result['sentiment']['label'] == 'negative'


@pytest.mark.parametrize('reply,message', [(RuntimeError('Error code: 429 - rate limited'), 'Analysis failed: Error code: 429'), ('not json at all', 'Analysis failed: the model did not return valid JSON')])
def test_analysis_errors_raise_instead_of_returning_placeholders(reply, message):
    service = service_with(FakeAsyncGroq(replies=[reply]))
    with pytest.raises(AIServiceError, match=message):
        asyncio.run(service.analyze_call('Agent: hello.'))


def test_transcription_error_raises(tmp_path):
    service = service_with(FakeAsyncGroq())
    with pytest.raises(AIServiceError, match='Transcription failed'):
        asyncio.run(service.transcribe_audio(str(tmp_path / 'missing.mp3')))
