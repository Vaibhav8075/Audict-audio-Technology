from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database.connection import get_db
from models import User
from dependencies import get_current_user
from auth_utils import verify_password, get_password_hash
router = APIRouter()

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.get('/profile')
async def get_profile(current_user: User=Depends(get_current_user)):
    return {'id': current_user.id, 'email': current_user.email, 'full_name': current_user.full_name, 'role': current_user.role.value, 'department': current_user.department, 'avatar_url': current_user.avatar_url, 'last_login': current_user.last_login.isoformat() if current_user.last_login else None, 'created_at': current_user.created_at.isoformat() if current_user.created_at else None}

@router.put('/profile')
async def update_profile(data: ProfileUpdate, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    for field, value in data.dict(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    return {'message': 'Profile updated'}

@router.post('/change-password')
async def change_password(data: PasswordChange, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail='Current password is incorrect')
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters')
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {'message': 'Password changed successfully'}