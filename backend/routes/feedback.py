from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from database.connection import get_db
from models import User, Audit, FeedbackForm, FeedbackQuestion, FeedbackAnswer, FeedbackQuestionAnswer, FeedbackQuestionType, UserRole
from dependencies import get_current_user, get_current_admin
router = APIRouter()

class QuestionCreate(BaseModel):
    question_text: str
    question_type: FeedbackQuestionType
    options: Optional[List[str]] = None
    is_required: bool = True
    order_index: int = 0

class FormCreate(BaseModel):
    title: str
    description: Optional[str] = None
    questions: List[QuestionCreate] = []

class QuestionAnswerSubmit(BaseModel):
    question_id: int
    answer_value: Any

class FeedbackSubmit(BaseModel):
    form_id: int
    audit_id: int
    overall_rating: Optional[float] = None
    comments: Optional[str] = None
    answers: List[QuestionAnswerSubmit] = []

@router.post('/forms', status_code=status.HTTP_201_CREATED)
async def create_form(data: FormCreate, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Create a new feedback form with questions (admin only)"""
    form = FeedbackForm(title=data.title, description=data.description, created_by=current_user.id)
    db.add(form)
    db.flush()
    for i, q_data in enumerate(data.questions):
        question = FeedbackQuestion(form_id=form.id, question_text=q_data.question_text, question_type=q_data.question_type, options=q_data.options, is_required=q_data.is_required, order_index=q_data.order_index or i)
        db.add(question)
    db.commit()
    db.refresh(form)
    return {'message': 'Feedback form created', 'form_id': form.id}

@router.get('/forms')
async def get_forms(current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Get all active feedback forms"""
    forms = db.query(FeedbackForm).options(joinedload(FeedbackForm.questions)).filter(FeedbackForm.is_active == True).all()
    result = []
    for form in forms:
        result.append({'id': form.id, 'title': form.title, 'description': form.description, 'question_count': len(form.questions), 'created_at': form.created_at.isoformat() if form.created_at else None, 'questions': [{'id': q.id, 'question_text': q.question_text, 'question_type': q.question_type.value, 'options': q.options, 'is_required': q.is_required, 'order_index': q.order_index} for q in sorted(form.questions, key=lambda x: x.order_index)]})
    return {'forms': result}

@router.get('/forms/{form_id}')
async def get_form_detail(form_id: int, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Get a specific feedback form with all questions"""
    form = db.query(FeedbackForm).options(joinedload(FeedbackForm.questions)).filter(FeedbackForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail='Form not found')
    return {'id': form.id, 'title': form.title, 'description': form.description, 'questions': [{'id': q.id, 'question_text': q.question_text, 'question_type': q.question_type.value, 'options': q.options, 'is_required': q.is_required, 'order_index': q.order_index} for q in sorted(form.questions, key=lambda x: x.order_index)]}

@router.post('/submit')
async def submit_feedback(data: FeedbackSubmit, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """
    Submit feedback for an audit.
    One submission per user per audit-form combination.
    IMPORTANT: Feedback is NEVER deleted.
    """
    audit = db.query(Audit).filter(Audit.id == data.audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    if current_user.role == UserRole.employee and audit.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail='Access denied')
    existing = db.query(FeedbackAnswer).filter(FeedbackAnswer.audit_id == data.audit_id, FeedbackAnswer.form_id == data.form_id, FeedbackAnswer.submitted_by_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail='You have already submitted feedback for this audit and form')
    form = db.query(FeedbackForm).filter(FeedbackForm.id == data.form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail='Feedback form not found')
    submission = FeedbackAnswer(audit_id=data.audit_id, form_id=data.form_id, submitted_by_id=current_user.id, overall_rating=data.overall_rating, comments=data.comments)
    db.add(submission)
    db.flush()
    for answer in data.answers:
        qa = FeedbackQuestionAnswer(submission_id=submission.id, question_id=answer.question_id, answer_value=str(answer.answer_value) if answer.answer_value is not None else None)
        db.add(qa)
    db.commit()
    return {'message': 'Feedback submitted successfully', 'submission_id': submission.id}

@router.get('/my-submissions')
async def get_my_submissions(current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Get all feedback submissions by the current user"""
    submissions = db.query(FeedbackAnswer).options(joinedload(FeedbackAnswer.audit), joinedload(FeedbackAnswer.form), joinedload(FeedbackAnswer.question_answers).joinedload(FeedbackQuestionAnswer.question)).filter(FeedbackAnswer.submitted_by_id == current_user.id).order_by(desc(FeedbackAnswer.submitted_at)).all()
    result = []
    for s in submissions:
        result.append({'id': s.id, 'audit': {'id': s.audit.id, 'audit_id': s.audit.audit_id, 'client_name': s.audit.client_name} if s.audit else None, 'form_title': s.form.title if s.form else None, 'overall_rating': s.overall_rating, 'comments': s.comments, 'submitted_at': s.submitted_at.isoformat() if s.submitted_at else None, 'answers': [{'question_id': qa.question_id, 'question_text': qa.question.question_text if qa.question else None, 'question_type': qa.question.question_type.value if qa.question else None, 'answer_value': qa.answer_value} for qa in s.question_answers]})
    return {'submissions': result}

@router.get('/all-submissions')
async def get_all_submissions(page: int=Query(1, ge=1), per_page: int=Query(20), audit_id: Optional[int]=None, form_id: Optional[int]=None, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Get all feedback submissions (admin only) with filtering"""
    query = db.query(FeedbackAnswer).options(joinedload(FeedbackAnswer.audit), joinedload(FeedbackAnswer.form), joinedload(FeedbackAnswer.submitted_by), joinedload(FeedbackAnswer.question_answers).joinedload(FeedbackQuestionAnswer.question))
    if audit_id:
        query = query.filter(FeedbackAnswer.audit_id == audit_id)
    if form_id:
        query = query.filter(FeedbackAnswer.form_id == form_id)
    total = query.count()
    submissions = query.order_by(desc(FeedbackAnswer.submitted_at)).offset((page - 1) * per_page).limit(per_page).all()
    result = []
    for s in submissions:
        result.append({'id': s.id, 'audit': {'id': s.audit.id, 'audit_id': s.audit.audit_id, 'client_name': s.audit.client_name} if s.audit else None, 'form_title': s.form.title if s.form else None, 'submitted_by': {'id': s.submitted_by.id, 'full_name': s.submitted_by.full_name, 'email': s.submitted_by.email} if s.submitted_by else None, 'overall_rating': s.overall_rating, 'comments': s.comments, 'submitted_at': s.submitted_at.isoformat() if s.submitted_at else None, 'answer_count': len(s.question_answers), 'answers': [{'question_id': qa.question_id, 'question_text': qa.question.question_text if qa.question else None, 'question_type': qa.question.question_type.value if qa.question else None, 'answer_value': qa.answer_value} for qa in s.question_answers]})
    return {'submissions': result, 'total': total, 'page': page, 'per_page': per_page}

@router.get('/check/{audit_id}/{form_id}')
async def check_submission(audit_id: int, form_id: int, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Check if current user has already submitted feedback for this audit+form"""
    existing = db.query(FeedbackAnswer).filter(FeedbackAnswer.audit_id == audit_id, FeedbackAnswer.form_id == form_id, FeedbackAnswer.submitted_by_id == current_user.id).first()
    return {'has_submitted': existing is not None, 'submission_id': existing.id if existing else None}