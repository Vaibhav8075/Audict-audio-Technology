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


def test_whisper_duration_and_confidence_are_stored(client, auth, db, use_ai, call):
    use_ai(FakeAI(duration=125.4))
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    detail = client.get(f'/api/audits/{audit.id}', headers=auth(admin)).json()
    assert detail['call_duration'] == 125 and detail['recording']['duration'] == 125.4
    assert client.get(f'/api/ai/analysis/{audit.id}', headers=auth(admin)).json()['analysis']['transcription_confidence'] == 0.91


def test_a_call_duration_entered_by_an_admin_is_kept(client, auth, use_ai, make_user, make_audit):
    use_ai(FakeAI(duration=125.4))
    admin = make_user('admin')
    audit = make_audit(make_user(), call_duration=300)
    upload(client, auth(admin), audit)
    assert client.get(f'/api/audits/{audit.id}', headers=auth(admin)).json()['call_duration'] == 300


def test_analyses_cut_off_by_a_restart_are_marked_failed_at_startup(db, make_user, make_audit):
    agent = make_user()
    stuck = make_audit(agent, status=AuditStatus.processing)
    done = make_audit(agent, status=AuditStatus.completed)
    ai.fail_interrupted_analyses()
    db.expire_all()
    assert (stuck.status, stuck.ai_error) == (AuditStatus.failed, 'Interrupted by a server restart; retry the analysis')
    assert (done.status, done.ai_error) == (AuditStatus.completed, None)


def test_new_upload_clears_the_previous_failure(client, auth, use_ai, call):
    fake = use_ai(FakeAI(fail_at='transcribe'))
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    fake.fail_at = None
    upload(client, auth(admin), audit, name='call-fixed.mp3')
    assert audit_state(client, auth(admin), audit) == ('completed', None)


def test_upload_is_refused_while_the_call_is_being_analysed(client, auth, db, call):
    admin, agent, audit = call
    audit.status = AuditStatus.processing
    db.commit()
    assert upload(client, auth(admin), audit).status_code == 409


def test_status_endpoint_reports_failures_without_logging_a_view(client, auth, db, use_ai, call):
    from models import AuditAccessLog
    use_ai(FakeAI(fail_at='analyze'))
    admin, agent, audit = call
    upload(client, auth(admin), audit)
    res = client.get(f'/api/ai/status/{audit.id}', headers=auth(agent))
    assert res.status_code == 200
    assert res.json() == {'status': 'failed', 'ai_error': 'Analysis failed: Error code: 429 - rate limit reached'}
    assert db.query(AuditAccessLog).count() == 0


def test_status_endpoint_keeps_agents_to_their_own_calls(client, auth, make_user, call):
    admin, agent, audit = call
    assert client.get(f'/api/ai/status/{audit.id}', headers=auth(make_user())).status_code == 403
