"""Idempotent schema upgrades for databases created by older versions of the app.

create_all() only creates missing tables, so columns and enum values added to existing tables are applied
here on every start. Each step checks first, so running it again is harmless.
"""
from sqlalchemy import inspect, text


def upgrade_schema(engine):
    audit_columns = {c['name'] for c in inspect(engine).get_columns('audits')}
    # ALTER TYPE ... ADD VALUE must be committed before the new value can be used, so run outside a transaction
    with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
        if 'ai_error' not in audit_columns:
            conn.execute(text('ALTER TABLE audits ADD COLUMN ai_error TEXT'))
        if engine.dialect.name == 'postgresql':
            conn.execute(text("ALTER TYPE auditstatus ADD VALUE IF NOT EXISTS 'failed'"))
