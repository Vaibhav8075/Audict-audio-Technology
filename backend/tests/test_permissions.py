"""Agents may only see their own calls; HODs and admins see everything; admin-only actions stay admin-only."""
import pytest
from models import AIAnalysis


@pytest.fixture
def two_agents(make_user, make_audit):
    alice, bob = make_user(full_name='Alice'), make_user(full_name='Bob')
    return alice, bob, make_audit(alice), make_audit(bob)


def test_agent_sees_only_own_audits(client, auth, two_agents):
    alice, bob, alice_audit, bob_audit = two_agents
    assert client.get(f'/api/audits/{alice_audit.id}', headers=auth(alice)).status_code == 200
    assert client.get(f'/api/audits/{bob_audit.id}', headers=auth(alice)).status_code == 403
    listed = client.get('/api/audits/', headers=auth(alice)).json()
    assert [a['id'] for a in listed['audits']] == [alice_audit.id]


@pytest.mark.parametrize('role', ['hod', 'admin'])
def test_managers_see_all_audits(client, auth, make_user, two_agents, role):
    manager = make_user(role)
    assert client.get(f'/api/audits/{two_agents[3].id}', headers=auth(manager)).status_code == 200
    assert client.get('/api/audits/', headers=auth(manager)).json()['total'] == 2


def test_agent_cannot_reach_another_agents_recording(client, auth, make_recording, two_agents):
    alice, bob, alice_audit, bob_audit = two_agents
    make_recording(alice_audit)
    make_recording(bob_audit)
    assert client.get(f'/api/recordings/info/{bob_audit.id}', headers=auth(alice)).status_code == 403
    assert client.get(f'/api/recordings/stream/{bob_audit.id}', headers=auth(alice)).status_code == 403
    own = client.get(f'/api/recordings/stream/{alice_audit.id}', headers=auth(alice))
    assert own.status_code == 200 and own.content == b'ID3 fake audio'


def test_recording_supports_range_requests(client, auth, make_recording, two_agents):
    alice, _, alice_audit, _ = two_agents
    make_recording(alice_audit, content=b'0123456789')
    res = client.get(f'/api/recordings/stream/{alice_audit.id}', headers={**auth(alice), 'Range': 'bytes=2-5'})
    assert res.status_code == 206
    assert res.content == b'2345'
    assert res.headers['content-range'] == 'bytes 2-5/10'


def test_agent_cannot_read_another_agents_ai_analysis(client, auth, db, two_agents):
    alice, bob, alice_audit, bob_audit = two_agents
    db.add(AIAnalysis(audit_id=bob_audit.id, transcription='hello', call_summary='summary', call_quality_score=70))
    db.commit()
    assert client.get(f'/api/ai/analysis/{bob_audit.id}', headers=auth(alice)).status_code == 403
    assert client.get(f'/api/ai/analysis/{bob_audit.id}', headers=auth(bob)).json()['analysis']['call_quality_score'] == 70


@pytest.mark.parametrize('method,path', [
    ('post', '/api/audits/'),
    ('post', '/api/recordings/upload/1'),
    ('post', '/api/ai/analyze/1'),
    ('get', '/api/admin/users'),
    ('get', '/api/admin/logs'),
])
def test_admin_only_endpoints_reject_agents_and_hods(client, auth, make_user, method, path):
    for role in ('employee', 'hod'):
        res = getattr(client, method)(path, headers=auth(make_user(role)))
        assert res.status_code == 403, (role, path, res.status_code)
