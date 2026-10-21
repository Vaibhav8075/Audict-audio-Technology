"""Admins can delete an audit together with its recording, analysis and access history."""
import os
from models import AIAnalysis, Audit, AuditAccessLog, FeedbackAnswer, FeedbackForm, Recording


def test_viewed_audit_with_recording_and_analysis_can_be_deleted(client, auth, db, make_user, make_audit, make_recording):
    admin, agent = make_user('admin'), make_user()
    audit = make_audit(agent)
    recording = make_recording(audit)
    db.add(AIAnalysis(audit_id=audit.id, transcription='hello', call_summary='summary'))
    db.commit()
    client.get(f'/api/audits/{audit.id}', headers=auth(agent))  # viewing writes an access-log row
    audit_id, path = audit.id, recording.file_path

    res = client.delete(f'/api/audits/{audit_id}', headers=auth(admin))
    assert res.status_code == 200
    db.expire_all()
    assert db.get(Audit, audit_id) is None
    assert db.query(Recording).count() == db.query(AIAnalysis).count() == db.query(AuditAccessLog).count() == 0
    assert not os.path.exists(path)


def test_audit_with_submitted_feedback_is_kept(client, auth, db, make_user, make_audit):
    admin, agent = make_user('admin'), make_user()
    audit = make_audit(agent)
    form = FeedbackForm(title='Self review', created_by=admin.id)
    db.add(form)
    db.commit()
    db.add(FeedbackAnswer(audit_id=audit.id, form_id=form.id, submitted_by_id=agent.id, overall_rating=4))
    db.commit()
    audit_id = audit.id
    res = client.delete(f'/api/audits/{audit_id}', headers=auth(admin))
    assert res.status_code == 409
    db.expire_all()
    assert db.get(Audit, audit_id) is not None
