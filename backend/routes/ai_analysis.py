from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import time
from database.connection import get_db
from models import User, Audit, Recording, AIAnalysis, UserRole, SentimentLabel, AuditStatus
from dependencies import get_current_user, get_current_admin
from groq_service import GroqService
router = APIRouter()
groq_service = GroqService()

def ai_to_dict(ai: AIAnalysis) -> dict:
    return {'id': ai.id, 'audit_id': ai.audit_id, 'transcription': ai.transcription, 'transcription_confidence': ai.transcription_confidence, 'call_summary': ai.call_summary, 'key_points': ai.key_points, 'sentiment_label': ai.sentiment_label.value if ai.sentiment_label else None, 'sentiment_score': ai.sentiment_score, 'sentiment_details': ai.sentiment_details, 'keywords': ai.keywords, 'topics': ai.topics, 'call_quality_score': ai.call_quality_score, 'customer_satisfaction_score': ai.customer_satisfaction_score, 'identified_issues': ai.identified_issues, 'ai_suggestions': ai.ai_suggestions, 'processing_time': ai.processing_time, 'processed_at': ai.processed_at.isoformat() if ai.processed_at else None, 'model_used': ai.model_used}

@router.post('/analyze/{audit_id}')
async def trigger_ai_analysis(audit_id: int, background_tasks: BackgroundTasks, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """
    Trigger AI analysis for an audit's recording.
    Runs asynchronously in background.
    """
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    recording = db.query(Recording).filter(Recording.audit_id == audit_id, Recording.is_expired == False).first()
    if not recording or not recording.file_path:
        raise HTTPException(status_code=400, detail='No valid recording found for this audit')
    existing = db.query(AIAnalysis).filter(AIAnalysis.audit_id == audit_id).first()
    if existing:
        return {'message': 'Analysis already exists', 'analysis_id': existing.id}
    background_tasks.add_task(process_ai_analysis, audit_id=audit_id, recording_path=recording.file_path)
    return {'message': 'AI analysis queued', 'audit_id': audit_id}

async def process_ai_analysis(audit_id: int, recording_path: str):
    """Background task: Run full AI analysis pipeline"""
    from database.connection import SessionLocal
    db = SessionLocal()
    try:
        start_time = time.time()
        transcription_result = await groq_service.transcribe_audio(recording_path)
        if not transcription_result.get('text'):
            print(f'[AI] Transcription failed for audit {audit_id}')
            return
        transcript = transcription_result['text']
        analysis = await groq_service.analyze_call(transcript)
        processing_time = time.time() - start_time
        sentiment_str = analysis.get('sentiment', {}).get('label', 'neutral').lower()
        sentiment_map = {'positive': SentimentLabel.positive, 'neutral': SentimentLabel.neutral, 'negative': SentimentLabel.negative}
        sentiment_label = sentiment_map.get(sentiment_str, SentimentLabel.neutral)
        ai_record = AIAnalysis(audit_id=audit_id, transcription=transcript, transcription_confidence=transcription_result.get('confidence'), call_summary=analysis.get('summary'), key_points=analysis.get('key_points', []), sentiment_label=sentiment_label, sentiment_score=analysis.get('sentiment', {}).get('score', 0.0), sentiment_details=analysis.get('sentiment', {}), keywords=analysis.get('keywords', []), topics=analysis.get('topics', []), call_quality_score=analysis.get('call_quality_score'), customer_satisfaction_score=analysis.get('customer_satisfaction_score'), identified_issues=analysis.get('identified_issues', []), ai_suggestions=analysis.get('suggestions', []), processing_time=processing_time, model_used='groq-llama3')
        db.add(ai_record)
        audit = db.query(Audit).filter(Audit.id == audit_id).first()
        if audit:
            audit.status = AuditStatus.completed
        db.commit()
        print(f'[AI] Analysis completed for audit {audit_id} in {processing_time:.2f}s')
    except Exception as e:
        print(f'[AI] Error processing audit {audit_id}: {e}')
        db.rollback()
    finally:
        db.close()

@router.get('/analysis/{audit_id}')
async def get_ai_analysis(audit_id: int, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Get AI analysis results for an audit"""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    if current_user.role == UserRole.employee and audit.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail='Access denied')
    analysis = db.query(AIAnalysis).filter(AIAnalysis.audit_id == audit_id).first()
    if not analysis:
        return {'analysis': None, 'message': 'No analysis available yet'}
    return {'analysis': ai_to_dict(analysis)}

@router.get('/dashboard-stats')
async def get_ai_dashboard_stats(current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """
    Get AI analytics for the dashboard.
    Employees see their own stats, admins see all.
    """
    from sqlalchemy import func, and_
    from datetime import timedelta, datetime
    if current_user.role == UserRole.employee:
        analyses = db.query(AIAnalysis).join(Audit).filter(Audit.employee_id == current_user.id).all()
    else:
        analyses = db.query(AIAnalysis).all()
    if not analyses:
        return {'total_analyzed': 0, 'avg_sentiment': 0, 'avg_quality': 0, 'avg_satisfaction': 0, 'sentiment_breakdown': {'positive': 0, 'neutral': 0, 'negative': 0}, 'top_issues': [], 'top_keywords': []}
    sentiments = {'positive': 0, 'neutral': 0, 'negative': 0}
    quality_scores = []
    satisfaction_scores = []
    all_issues = []
    all_keywords = []
    sentiment_scores = []
    for a in analyses:
        if a.sentiment_label:
            sentiments[a.sentiment_label.value] += 1
        if a.sentiment_score is not None:
            sentiment_scores.append(a.sentiment_score)
        if a.call_quality_score is not None:
            quality_scores.append(a.call_quality_score)
        if a.customer_satisfaction_score is not None:
            satisfaction_scores.append(a.customer_satisfaction_score)
        if a.identified_issues:
            all_issues.extend(a.identified_issues)
        if a.keywords:
            all_keywords.extend(a.keywords)
    from collections import Counter
    issue_counts = Counter(all_issues).most_common(5)
    keyword_counts = Counter(all_keywords).most_common(10)
    return {'total_analyzed': len(analyses), 'avg_sentiment': round(sum(sentiment_scores) / len(sentiment_scores), 3) if sentiment_scores else 0, 'avg_quality': round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 0, 'avg_satisfaction': round(sum(satisfaction_scores) / len(satisfaction_scores), 1) if satisfaction_scores else 0, 'sentiment_breakdown': sentiments, 'top_issues': [{'issue': i[0], 'count': i[1]} for i in issue_counts], 'top_keywords': [{'keyword': k[0], 'count': k[1]} for k in keyword_counts], 'negative_calls': sentiments['negative'], 'needs_attention': [{'audit_id': a.audit_id, 'sentiment_score': a.sentiment_score, 'quality_score': a.call_quality_score} for a in analyses if a.sentiment_label == SentimentLabel.negative][:5]}

@router.post('/generate-suggestions/{audit_id}')
async def generate_feedback_suggestions(audit_id: int, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Generate AI-powered feedback suggestions based on analysis"""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    if current_user.role == UserRole.employee and audit.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail='Access denied')
    analysis = db.query(AIAnalysis).filter(AIAnalysis.audit_id == audit_id).first()
    if not analysis or not analysis.transcription:
        raise HTTPException(status_code=400, detail='No analysis available for suggestions')
    suggestions = await groq_service.generate_feedback_suggestions(analysis.call_summary or '', analysis.identified_issues or [], analysis.sentiment_label.value if analysis.sentiment_label else 'neutral')
    return {'suggestions': suggestions}