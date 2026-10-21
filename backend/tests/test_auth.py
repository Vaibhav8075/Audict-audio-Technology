from conftest import PASSWORD


def test_login_returns_tokens_and_profile(client, make_user):
    user = make_user('admin', email='lead@dcm-demo.com')
    res = client.post('/api/auth/login', json={'email': 'lead@dcm-demo.com', 'password': PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert body['access_token'] and body['refresh_token']
    assert body['user'] == {'id': user.id, 'email': 'lead@dcm-demo.com', 'full_name': user.full_name, 'role': 'admin', 'department': None, 'avatar_url': None}


def test_login_rejects_wrong_password_and_inactive_users(client, make_user):
    make_user(email='agent@dcm-demo.com')
    make_user(email='gone@dcm-demo.com', is_active=False)
    assert client.post('/api/auth/login', json={'email': 'agent@dcm-demo.com', 'password': 'not-it'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': 'gone@dcm-demo.com', 'password': PASSWORD}).status_code == 401


def test_only_admins_can_register_users(client, make_user, auth):
    new_user = {'email': 'new@dcm-demo.com', 'full_name': 'New Agent', 'password': 'password123', 'role': 'admin'}
    assert client.post('/api/auth/register', json=new_user).status_code in (401, 403)
    assert client.post('/api/auth/register', json=new_user, headers=auth(make_user('employee'))).status_code == 403
    assert client.post('/api/auth/register', json=new_user, headers=auth(make_user('hod'))).status_code == 403
    assert client.post('/api/auth/register', json=new_user, headers=auth(make_user('admin'))).status_code == 201


def test_refresh_token_issues_new_tokens(client, make_user):
    make_user(email='agent@dcm-demo.com')
    tokens = client.post('/api/auth/login', json={'email': 'agent@dcm-demo.com', 'password': PASSWORD}).json()
    res = client.post('/api/auth/refresh', json={'refresh_token': tokens['refresh_token']})
    assert res.status_code == 200 and res.json()['access_token']
    # an access token is not accepted where a refresh token is required
    assert client.post('/api/auth/refresh', json={'refresh_token': tokens['access_token']}).status_code == 401


def test_invalid_or_foreign_tokens_are_rejected(client, make_user):
    from jose import jwt
    user = make_user()
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer not-a-jwt'}).status_code == 401
    forged = jwt.encode({'sub': str(user.id), 'type': 'access'}, 'dcm-super-secret-key-change-in-production', algorithm='HS256')
    assert client.get('/api/auth/me', headers={'Authorization': f'Bearer {forged}'}).status_code == 401


def test_refresh_token_cannot_be_used_as_an_access_token(client, make_user):
    make_user(email='agent@dcm-demo.com')
    tokens = client.post('/api/auth/login', json={'email': 'agent@dcm-demo.com', 'password': PASSWORD}).json()
    # refresh tokens live 7 days instead of 8 hours, so they must only work at /api/auth/refresh
    assert client.get('/api/auth/me', headers={'Authorization': f"Bearer {tokens['refresh_token']}"}).status_code == 401
    assert client.get('/api/auth/me', headers={'Authorization': f"Bearer {tokens['access_token']}"}).status_code == 200


def test_token_with_a_malformed_subject_is_rejected(client):
    from auth_utils import create_access_token
    token = create_access_token({'sub': 'not-a-number'})
    assert client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'}).status_code == 401
