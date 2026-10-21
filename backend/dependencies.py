from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database.connection import get_db
from models import User, UserRole
from auth_utils import verify_token
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials=Depends(security), db: Session=Depends(get_db)) -> User:
    payload = verify_token(credentials.credentials)
    # refresh tokens last days instead of hours; they are only accepted by /api/auth/refresh
    if payload.get('type') != 'access' or not str(payload.get('sub')).isdigit():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid access token', headers={'WWW-Authenticate': 'Bearer'})
    user = db.query(User).filter(User.id == int(payload['sub']), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found or inactive')
    return user

def get_current_admin(current_user: User=Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin access required')
    return current_user

def get_current_manager(current_user: User=Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.hod):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Manager/HOD access required')
    return current_user

def get_optional_user(credentials: HTTPAuthorizationCredentials=Depends(HTTPBearer(auto_error=False)), db: Session=Depends(get_db)) -> User | None:
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except Exception:
        return None