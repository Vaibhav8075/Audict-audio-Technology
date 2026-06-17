from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database.connection import get_db
from models import User, Audit, Recording, AIAnalysis, AuditAccessLog, AuditStatus, UserRole, QAAuditReview
from dependencies import get_current_user, get_current_admin
router = APIRouter()

class AuditCreate(BaseModel):
    audit_id: str
    client_name: str
    employee_id: int
    call_date: datetime
    call_duration: Optional[int] = None
    notes: Optional[str] = None

class AuditUpdate(BaseModel):
    client_name: Optional[str] = None
    status: Optional[AuditStatus] = None
    notes: Optional[str] = None
    call_duration: Optional[int] = None

def audit_to_dict(audit: Audit, include_recording: bool=True) -> dict:
    data = {'id': audit.id, 'audit_id': audit.audit_id, 'client_name': audit.client_name, 'employee_id': audit.employee_id, 'employee_name': audit.employee.full_name if audit.employee else None, 'call_date': audit.call_date.isoformat() if audit.call_date else None, 'call_duration': audit.call_duration, 'status': audit.status.value, 'notes': audit.notes, 'created_at': audit.created_at.isoformat() if audit.created_at else None}
    if include_recording and audit.recording:
        rec = audit.recording
        uploaded_week = None
        uploaded_year = None
        if rec.uploaded_at:
            uploaded_week = rec.uploaded_at.isocalendar()[1]
            uploaded_year = rec.uploaded_at.year
        data['recording'] = {
            'id': rec.id,
            'duration': rec.duration,
            'is_expired': rec.is_expired,
            'expires_at': rec.expires_at.isoformat() if rec.expires_at else None,
            'uploaded_at': rec.uploaded_at.isoformat() if rec.uploaded_at else None,
            'uploaded_week': uploaded_week,
            'uploaded_year': uploaded_year,
            'has_file': rec.file_path is not None and (not rec.is_expired)
        }
    else:
        data['recording'] = None
    if audit.ai_analysis:
        ai = audit.ai_analysis
        data['ai_summary'] = {'sentiment_label': ai.sentiment_label.value if ai.sentiment_label else None, 'sentiment_score': ai.sentiment_score, 'call_quality_score': ai.call_quality_score, 'customer_satisfaction_score': ai.customer_satisfaction_score, 'call_summary': ai.call_summary, 'keywords': ai.keywords, 'processed_at': ai.processed_at.isoformat() if ai.processed_at else None}
    else:
        data['ai_summary'] = None
    data['feedback_count'] = len(audit.feedback_answers) if audit.feedback_answers else 0
    if audit.qa_review:
        data['qa_review'] = {
            'id': audit.qa_review.id,
            'reviewer_name': audit.qa_review.reviewer.full_name,
            'reviewer_email': audit.qa_review.reviewer.email,
            'rating': audit.qa_review.rating,
            'comments': audit.qa_review.comments,
            'created_at': audit.qa_review.created_at.isoformat() if audit.qa_review.created_at else None
        }
    else:
        data['qa_review'] = None
    return data

@router.get('/')
async def get_audits(page: int=Query(1, ge=1), per_page: int=Query(20, ge=1, le=100), search: Optional[str]=None, status: Optional[str]=None, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """
    Get audits list.
    - Employees: only their own audits
    - Admins: all audits
    """
    query = db.query(Audit).options(
        joinedload(Audit.employee), 
        joinedload(Audit.recording), 
        joinedload(Audit.ai_analysis), 
        joinedload(Audit.feedback_answers),
        joinedload(Audit.qa_review).joinedload(QAAuditReview.reviewer)
    )
    if current_user.role == UserRole.employee:
        query = query.filter(Audit.employee_id == current_user.id)
    if search:
        query = query.filter(or_(Audit.client_name.ilike(f'%{search}%'), Audit.audit_id.ilike(f'%{search}%')))
    if status:
        query = query.filter(Audit.status == status)
    total = query.count()
    audits = query.order_by(desc(Audit.call_date)).offset((page - 1) * per_page).limit(per_page).all()
    return {'audits': [audit_to_dict(a) for a in audits], 'total': total, 'page': page, 'per_page': per_page, 'pages': (total + per_page - 1) // per_page}

@router.get('/public-list')
async def get_public_audit_list(current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """
    Returns ALL audit names/clients (for listing purposes only).
    Employees can see names but CANNOT access other people's recordings.
    """
    audits = db.query(Audit).options(joinedload(Audit.employee), joinedload(Audit.recording)).order_by(desc(Audit.call_date)).limit(100).all()
    result = []
    for a in audits:
        rec = a.recording
        has_file = rec.file_path is not None and (not rec.is_expired) if rec else False
        result.append({
            'id': a.id,
            'audit_id': a.audit_id,
            'client_name': a.client_name,
            'employee_id': a.employee_id,
            'call_date': a.call_date.isoformat() if a.call_date else None,
            'status': a.status.value,
            'employee_name': a.employee.full_name if a.employee else None,
            'is_own_audit': a.employee_id == current_user.id,
            'recording': {'has_file': has_file} if rec else None
        })
    return {'audits': result}

@router.get('/{audit_id}')
async def get_audit_detail(audit_id: int, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """
    Get full audit details.
    SECURITY: Employees can only access their own audits.
    """
    audit = db.query(Audit).options(
        joinedload(Audit.employee), 
        joinedload(Audit.recording), 
        joinedload(Audit.ai_analysis), 
        joinedload(Audit.feedback_answers),
        joinedload(Audit.qa_review).joinedload(QAAuditReview.reviewer)
    ).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    if current_user.role == UserRole.employee and audit.employee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='You do not have permission to access this audit')
    log = AuditAccessLog(audit_id=audit.id, user_id=current_user.id, action='view')
    db.add(log)
    db.commit()
    return audit_to_dict(audit)

@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_audit(data: AuditCreate, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Create a new audit record (admin only)"""
    existing = db.query(Audit).filter(Audit.audit_id == data.audit_id).first()
    if existing:
        raise HTTPException(status_code=400, detail='Audit ID already exists')
    employee = db.query(User).filter(User.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail='Employee not found')
    audit = Audit(**data.dict())
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return {'message': 'Audit created', 'id': audit.id, 'audit_id': audit.audit_id}

@router.put('/{audit_id}')
async def update_audit(audit_id: int, data: AuditUpdate, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Update audit details (admin only)"""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    for field, value in data.dict(exclude_none=True).items():
        setattr(audit, field, value)
    db.commit()
    return {'message': 'Audit updated'}

@router.delete('/{audit_id}')
async def delete_audit(audit_id: int, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Delete an audit (admin only) - DOES NOT delete feedback"""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    db.delete(audit)
    db.commit()
    return {'message': 'Audit deleted'}

@router.get('/stats/summary')
async def get_audit_stats(current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Get audit statistics for dashboard"""
    base_query = db.query(Audit)
    if current_user.role == UserRole.employee:
        base_query = base_query.filter(Audit.employee_id == current_user.id)
    total = base_query.count()
    completed = base_query.filter(Audit.status == AuditStatus.completed).count()
    pending = base_query.filter(Audit.status == AuditStatus.pending).count()
    from datetime import timedelta
    recent = base_query.filter(Audit.call_date >= datetime.utcnow() - timedelta(days=30)).count()
    return {'total': total, 'completed': completed, 'pending': pending, 'recent_30_days': recent}