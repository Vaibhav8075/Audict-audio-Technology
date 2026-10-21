"""Databases created before the 'failed' status existed are upgraded in place when the app starts."""
from sqlalchemy import inspect, text
from database.connection import engine
from database.migrations import upgrade_schema
from models import Audit, AuditStatus


def make_legacy_schema():
    """Put the audits table back into the shape older releases created."""
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE audits DROP COLUMN ai_error'))
        if engine.dialect.name == 'postgresql':
            conn.execute(text('ALTER TABLE audits ALTER COLUMN status TYPE VARCHAR(20)'))
            conn.execute(text('DROP TYPE auditstatus'))
            conn.execute(text("CREATE TYPE auditstatus AS ENUM ('pending', 'processing', 'completed', 'expired')"))
            conn.execute(text('ALTER TABLE audits ALTER COLUMN status TYPE auditstatus USING status::auditstatus'))


def restart_app():
    # a real upgrade runs once per process start; pooled SQLite connections cache PRAGMA results across DDL
    engine.dispose()


def test_upgrade_adds_ai_error_column_and_failed_status(db, make_user, make_audit):
    make_legacy_schema()
    restart_app()
    upgrade_schema(engine)
    restart_app()
    upgrade_schema(engine)
    assert 'ai_error' in {c['name'] for c in inspect(engine).get_columns('audits')}
    audit = make_audit(make_user(), status=AuditStatus.failed, ai_error='Transcription failed: 413')
    db.expire_all()
    stored = db.get(Audit, audit.id)
    assert (stored.status, stored.ai_error) == (AuditStatus.failed, 'Transcription failed: 413')


def test_upgrade_is_a_no_op_on_a_current_schema():
    before = {c['name'] for c in inspect(engine).get_columns('audits')}
    upgrade_schema(engine)
    assert {c['name'] for c in inspect(engine).get_columns('audits')} == before
