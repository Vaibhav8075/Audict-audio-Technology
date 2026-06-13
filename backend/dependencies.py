from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database.connection import get_db
from models import User, UserRole
from auth_utils import verify_token
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials=Depends(security), db: Session=Depends(get_db)) -> User:
    token = credentials.credentials
    payload = verify_token(token)
    user_id = int(payload.get('sub'))
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found or inactive')
    return user

def get_current_admin(current_user: User=Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin access required')
    return current_user

def get_optional_user(credentials: HTTPAuthorizationCredentials=Depends(HTTPBearer(auto_error=False)), db: Session=Depends(get_db)) -> User | None:
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except Exception:
        return None