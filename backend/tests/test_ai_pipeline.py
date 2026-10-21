"""The AI pipeline stores real results or a clear failure, never placeholder data presented as real."""
import pytest
import routes.ai_analysis as ai
from groq_service import AIServiceError
from models import AIAnalysis, AuditStatus

GOOD_ANALYSIS = {'summary': 'Customer asked for a refund of a duplicate charge.', 'key_points': ['duplicate charge', 'refund issued'],
                 'sentiment': {'label': 'positive', 'score': 0.6, 'reasoning': 'resolved quickly'}, 'keywords': ['refund'], 'topics': ['billing'],
                 'call_quality_score': 82, 'customer_satisfaction_score': 77, 'identified_issues': [], 'suggestions': ['Confirm the refund date']}


class FakeAI:
    """Stands in for GroqService. Set fail_at to 'transcribe', 'analyze' or 'suggest' to simulate a provider error."""
    llm_model = 'fake-llm'

    def __init__(self, transcript='Agent: thanks for calling. Customer: I was charged twice.', analysis=None, fail_at=None, duration=125.4):
        self.transcript, self.analysis, self.fail_at, self.duration = transcript, analysis or GOOD_ANALYSIS, fail_at, duration

    async def transcribe_audio(self, file_path):
        if self.fail_at == 'transcribe':
            raise AIServiceError('Transcription failed: Error code: 413 - request entity too large')
        return {'text': self.transcript, 'confidence': 0.91, 'duration': self.duration}

    async def analyze_call(self, transcript):
        if self.fail_at == 'analyze':
            raise AIServiceError('Analysis failed: Error code: 429 - rate limit reached')
        return dict(self.analysis)

    async def generate_feedback_suggestions(self, summary, issues, sentiment):
        if self.fail_at == 'suggest':
            raise AIServiceError('Suggestions failed: Request timed out.')
        return ['Confirm the refund date']


@pytest.fixture
def use_ai(monkeypatch):
    def _use(fake):
        monkeypatch.setattr(ai, 'groq_service', fake)
        return fake
    return _use


@pytest.fixture
def call(make_user, make_audit):
    admin, agent = make_user('admin'), make_user()
    return admin, agent, make_audit(agent)


def upload(client, headers, audit, name='call.mp3', mime='audio/mpeg'):
    # TestClient runs the background analysis before returning, so results are ready afterwards
    return client.post(f'/api/recordings/upload/{audit.id}', files={'file': (name, b'ID3 fake audio', mime)}, headers=headers)


def audit_state(client, headers, audit):
    detail = client.get(f'/api/audits/{audit.id}', headers=headers).json()
    return detail['status'], detail['ai_error']


def test_upload_analyses_the_call_and_completes_the_audit(client, auth, use_ai, call):
    use_ai(FakeAI())
    admin, agent, audit = call
    assert upload(client, auth(admin), audit).status_code == 200
    assert audit_state(client, auth(agent), audit) == ('completed', None)
    analysis = client.get(f'/api/ai/analysis/{audit.id}', headers=auth(agent)).json()['analysis']
    assert (analysis['call_quality_score'], analysis['model_used']) == (82, 'fake-llm')


@pytest.mark.parametrize('fail_at,reason', [('transcribe', 'Transcription failed: Error code: 413'), ('analyze', 'Analysis failed: Error code: 429')])
def test_provider_error_marks_the_audit_failed_and_stores_no_results(client, auth, use_ai, call, fail_at, reason):
    use_ai(FakeAI(fail_at=fail_at))
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    status, error = audit_state(client, auth(admin), audit)
    assert status == 'failed' and error.startswith(reason)
    assert client.get(f'/api/ai/analysis/{audit.id}', headers=auth(admin)).json()['analysis'] is None


def test_silent_recording_is_reported_as_a_failure(client, auth, use_ai, call):
    use_ai(FakeAI(transcript='   '))
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    assert audit_state(client, auth(admin), audit) == ('failed', 'No speech was found in the recording')


def test_failed_analysis_can_be_retried(client, auth, use_ai, call):
    fake = use_ai(FakeAI(fail_at='analyze'))
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    fake.fail_at = None
    res = client.post(f'/api/ai/analyze/{audit.id}', headers=auth(admin))
    assert res.status_code == 200 and res.json()['message'] == 'AI analysis queued'
    assert audit_state(client, auth(admin), audit) == ('completed', None)


def test_retry_is_refused_while_an_analysis_is_running(client, auth, db, make_recording, call):
    admin, agent, audit = call
    make_recording(audit)
    audit.status = AuditStatus.processing
    db.commit()
    assert client.post(f'/api/ai/analyze/{audit.id}', headers=auth(admin)).status_code == 409


def test_suggestion_failure_returns_502_instead_of_generic_tips(client, auth, db, use_ai, call):
    use_ai(FakeAI(fail_at='suggest'))
    admin, agent, audit = call
    db.add(AIAnalysis(audit_id=audit.id, transcription='hello', call_summary='summary', identified_issues=['long hold']))
    db.commit()
    res = client.post(f'/api/ai/generate-suggestions/{audit.id}', headers=auth(agent))
    assert res.status_code == 502 and res.json()['detail'].startswith('Suggestions failed')


def test_demo_mode_without_api_key_labels_its_results(client, auth, call):
    # conftest leaves GROQ_API_KEY empty, so the real service runs in demo mode
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    analysis = client.get(f'/api/ai/analysis/{audit.id}', headers=auth(admin)).json()['analysis']
    assert analysis['model_used'] == 'mock-fallback'


def test_reuploading_a_recording_replaces_the_previous_analysis(client, auth, use_ai, call):
    fake = use_ai(FakeAI())
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    fake.analysis = {**GOOD_ANALYSIS, 'summary': 'Second recording.', 'call_quality_score': 55}
    upload(client, auth(admin), audit, name='call-v2.mp3')
    assert audit_state(client, auth(admin), audit) == ('completed', None)
    analysis = client.get(f'/api/ai/analysis/{audit.id}', headers=auth(admin)).json()['analysis']
    assert (analysis['call_summary'], analysis['call_quality_score']) == ('Second recording.', 55)
