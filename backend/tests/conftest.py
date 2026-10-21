"""Shared fixtures: a throwaway SQLite database, users of each role, audits and auth headers.

The environment is set before the app is imported because the database engine, the JWT secret
and the AI client are all created at import time.
"""
import os
import tempfile
from datetime import datetime, timedelta

_TMP = tempfile.mkdtemp(prefix='dcm-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + os.path.join(_TMP, 'test.db').replace('\\', '/')
os.environ['STORAGE_PATH'] = os.path.join(_TMP, 'recordings')
os.environ['GROQ_API_KEY'] = ''
os.environ['JWT_SECRET_KEY'] = 'test-secret'

import pytest
from fastapi.testclient import TestClient
from database.connection import Base, SessionLocal, engine
from main import app
from models import User, UserRole, Audit, Recording
from auth_utils import create_access_token, get_password_hash

PASSWORD = 'password123'
_PASSWORD_HASH = get_password_hash(PASSWORD)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def make_user(db):
    def _make(role='employee', **fields):
        n = db.query(User).count() + 1
        fields.setdefault('email', f'{role}{n}@dcm-demo.com')
        fields.setdefault('full_name', f'{role.title()} {n}')
        user = User(hashed_password=_PASSWORD_HASH, role=UserRole(role), **fields)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    return _make


@pytest.fixture
def make_audit(db):
    def _make(employee, **fields):
        n = db.query(Audit).count() + 1
        fields.setdefault('audit_id', f'TEST-{n:03d}')
        fields.setdefault('campaign_name', 'Test campaign')
        fields.setdefault('call_date', datetime(2026, 10, 1, 10, 0))
        audit = Audit(employee_id=employee.id, **fields)
        db.add(audit)
        db.commit()
        db.refresh(audit)
        return audit
    return _make


@pytest.fixture
def make_recording(db):
    def _make(audit, content=b'ID3 fake audio'):
        folder = os.path.join(os.environ['STORAGE_PATH'], str(audit.id))
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, f'test-{audit.id}.mp3')
        with open(path, 'wb') as f:
            f.write(content)
        recording = Recording(audit_id=audit.id, file_name='call.mp3', file_path=path, file_size=len(content), mime_type='audio/mpeg', expires_at=datetime.utcnow() + timedelta(days=7))
        db.add(recording)
        db.commit()
        db.refresh(recording)
        return recording
    return _make


@pytest.fixture
def auth():
    def _headers(user):
        token = create_access_token({'sub': str(user.id), 'email': user.email, 'role': user.role.value})
        return {'Authorization': f'Bearer {token}'}
    return _headers
