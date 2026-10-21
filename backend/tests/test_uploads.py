"""Uploads accept the audio types browsers actually report, and nothing else."""
import pytest


@pytest.fixture
def target(make_user, make_audit):
    return make_user('admin'), make_audit(make_user())


@pytest.mark.parametrize('name,mime', [
    ('call.mp3', 'audio/mpeg'),
    ('call.wav', 'audio/x-wav'),      # Firefox and Safari
    ('call.wav', 'audio/wav'),
    ('call.m4a', 'audio/x-m4a'),      # Chrome on Windows and macOS
    ('call.ogg', 'audio/ogg'),
    ('call.webm', 'audio/webm'),
    ('call.flac', 'audio/flac'),
    ('call.mp3', 'application/octet-stream'),  # browser could not tell
])
def test_supported_audio_is_accepted(client, auth, target, name, mime):
    admin, audit = target
    res = client.post(f'/api/recordings/upload/{audit.id}', files={'file': (name, b'audio bytes', mime)}, headers=auth(admin))
    assert res.status_code == 200, res.json()


@pytest.mark.parametrize('name,mime', [('notes.txt', 'text/plain'), ('page.mp3', 'text/html'), ('tool.exe', 'audio/mpeg'), ('call', 'audio/mpeg')])
def test_other_files_are_rejected(client, auth, target, name, mime):
    admin, audit = target
    res = client.post(f'/api/recordings/upload/{audit.id}', files={'file': (name, b'data', mime)}, headers=auth(admin))
    assert res.status_code == 400
