from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import csv, io
from database.connection import get_db
from models import User, Audit, Recording, FeedbackAnswer, AIAnalysis, AuditAccessLog, UserRole, AuditStatus, SentimentLabel, SystemSetting
from dependencies import get_current_admin
from auth_utils import get_password_hash
router = APIRouter()

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.employee
    department: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

@router.get('/users')
async def list_users(page: int=Query(1, ge=1), per_page: int=Query(20), search: Optional[str]=None, role: Optional[str]=None, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """List all users with pagination"""
    query = db.query(User)
    if search:
        query = query.filter(User.full_name.ilike(f'%{search}%') | User.email.ilike(f'%{search}%'))
    if role:
        query = query.filter(User.role == role)
    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()
    return {'users': [{'id': u.id, 'email': u.email, 'full_name': u.full_name, 'role': u.role.value, 'department': u.department, 'is_active': u.is_active, 'last_login': u.last_login.isoformat() if u.last_login else None, 'created_at': u.created_at.isoformat() if u.created_at else None, 'audit_count': db.query(Audit).filter(Audit.employee_id == u.id).count()} for u in users], 'total': total}

@router.post('/users')
async def create_user(data: UserCreate, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Create a new user (admin only)"""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail='Email already exists')
    user = User(email=data.email, full_name=data.full_name, hashed_password=get_password_hash(data.password), role=data.role, department=data.department)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {'message': 'User created', 'user_id': user.id}

@router.put('/users/{user_id}')
async def update_user(user_id: int, data: UserUpdate, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Update user details"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    for field, value in data.dict(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return {'message': 'User updated'}

@router.delete('/users/{user_id}')
async def deactivate_user(user_id: int, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Deactivate a user (soft delete)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail='Cannot deactivate your own account')
    user.is_active = False
    db.commit()
    return {'message': 'User deactivated'}

@router.get('/analytics/overview')
async def get_analytics_overview(current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Comprehensive analytics overview for admin dashboard"""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    total_users = db.query(User).filter(User.role == UserRole.employee).count()
    total_audits = db.query(Audit).count()
    total_recordings = db.query(Recording).filter(Recording.is_expired == False).count()
    total_feedback = db.query(FeedbackAnswer).count()
    weekly_uploads = db.query(Recording).filter(Recording.uploaded_at >= week_ago).count()
    weekly_audits = db.query(Audit).filter(Audit.call_date >= week_ago).count()
    status_counts = {}
    for s in AuditStatus:
        status_counts[s.value] = db.query(Audit).filter(Audit.status == s).count()
    sentiment_counts = {}
    for s in SentimentLabel:
        sentiment_counts[s.value] = db.query(AIAnalysis).filter(AIAnalysis.sentiment_label == s).count()
    avg_quality = db.query(func.avg(AIAnalysis.call_quality_score)).scalar() or 0
    avg_satisfaction = db.query(func.avg(AIAnalysis.customer_satisfaction_score)).scalar() or 0
    avg_rating = db.query(func.avg(FeedbackAnswer.overall_rating)).scalar() or 0
    daily_audits = []
    for i in range(7):
        day = now - timedelta(days=6 - i)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        count = db.query(Audit).filter(Audit.call_date.between(day_start, day_end)).count()
        daily_audits.append({'date': day.strftime('%a'), 'count': count})
    return {'summary': {'total_users': total_users, 'total_audits': total_audits, 'active_recordings': total_recordings, 'total_feedback': total_feedback, 'weekly_uploads': weekly_uploads, 'weekly_audits': weekly_audits}, 'status_breakdown': status_counts, 'sentiment_breakdown': sentiment_counts, 'scores': {'avg_quality': round(avg_quality, 1), 'avg_satisfaction': round(avg_satisfaction, 1), 'avg_feedback_rating': round(avg_rating, 2)}, 'daily_trend': daily_audits}

@router.get('/logs')
async def get_access_logs(page: int=Query(1, ge=1), per_page: int=Query(50), audit_id: Optional[int]=None, user_id: Optional[int]=None, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Get audit access logs"""
    query = db.query(AuditAccessLog).options(joinedload(AuditAccessLog.user), joinedload(AuditAccessLog.audit))
    if audit_id:
        query = query.filter(AuditAccessLog.audit_id == audit_id)
    if user_id:
        query = query.filter(AuditAccessLog.user_id == user_id)
    total = query.count()
    logs = query.order_by(desc(AuditAccessLog.timestamp)).offset((page - 1) * per_page).limit(per_page).all()
    return {'logs': [{'id': l.id, 'audit_id': l.audit.audit_id if l.audit else None, 'user': l.user.full_name if l.user else None, 'action': l.action, 'ip_address': l.ip_address, 'timestamp': l.timestamp.isoformat() if l.timestamp else None} for l in logs], 'total': total}

@router.get('/export/feedback-csv')
async def export_feedback_csv(current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Export all feedback submissions as CSV"""
    submissions = db.query(FeedbackAnswer).options(joinedload(FeedbackAnswer.audit), joinedload(FeedbackAnswer.submitted_by), joinedload(FeedbackAnswer.form)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Submission ID', 'Audit ID', 'Client Name', 'Employee', 'Form', 'Overall Rating', 'Comments', 'Submitted At'])
    for s in submissions:
        writer.writerow([s.id, s.audit.audit_id if s.audit else '', s.audit.client_name if s.audit else '', s.submitted_by.full_name if s.submitted_by else '', s.form.title if s.form else '', s.overall_rating or '', s.comments or '', s.submitted_at.isoformat() if s.submitted_at else ''])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename=feedback_export.csv'})

class RetentionSettings(BaseModel):
    retention_days: int

@router.get('/settings/retention')
async def get_retention_setting(current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    import os
    setting = db.query(SystemSetting).filter(SystemSetting.key == 'retention_days').first()
    days = int(setting.value) if setting else int(os.getenv('RECORDING_EXPIRY_DAYS', '7'))
    return {'retention_days': days}

@router.post('/settings/retention')
async def update_retention_setting(data: RetentionSettings, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    import os
    if data.retention_days < 1:
        raise HTTPException(status_code=400, detail='Retention period must be at least 1 day')
    
    setting = db.query(SystemSetting).filter(SystemSetting.key == 'retention_days').first()
    if not setting:
        setting = SystemSetting(key='retention_days', value=str(data.retention_days))
        db.add(setting)
    else:
        setting.value = str(data.retention_days)
    
    active_recordings = db.query(Recording).filter(Recording.is_expired == False).all()
    for rec in active_recordings:
        if rec.uploaded_at:
            rec.expires_at = rec.uploaded_at + timedelta(days=data.retention_days)
            if rec.expires_at <= datetime.utcnow():
                rec.is_expired = True
                if rec.file_path and os.path.exists(rec.file_path):
                    try:
                        os.remove(rec.file_path)
                    except:
                        pass
    db.commit()
    return {'message': 'Retention settings updated successfully', 'retention_days': data.retention_days}