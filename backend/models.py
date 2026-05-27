"""
DCM Audit System - Database Models
Complete ORM schema with relationships and indexes
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, 
    ForeignKey, Enum, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base
import enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"

class AuditStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    expired = "expired"

class FeedbackQuestionType(str, enum.Enum):
    rating = "rating"
    text = "text"
    multiple_choice = "multiple_choice"
    yes_no = "yes_no"

class SentimentLabel(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


# ─── User Model ───────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.employee, nullable=False)
    department = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    audits = relationship("Audit", back_populates="employee", foreign_keys="Audit.employee_id")
    feedback_submissions = relationship("FeedbackAnswer", back_populates="submitted_by")
    access_logs = relationship("AuditAccessLog", back_populates="user")

    __table_args__ = (
        Index("idx_users_email_role", "email", "role"),
    )


# ─── Audit Model ──────────────────────────────────────────────────────────────

class Audit(Base):
    __tablename__ = "audits"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(String(50), unique=True, nullable=False, index=True)  # e.g. AUD-2024-001
    client_name = Column(String(255), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    call_date = Column(DateTime, nullable=False)
    call_duration = Column(Integer, nullable=True)  # seconds
    status = Column(Enum(AuditStatus), default=AuditStatus.pending)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    employee = relationship("User", back_populates="audits", foreign_keys=[employee_id])
    recording = relationship("Recording", back_populates="audit", uselist=False)
    feedback_answers = relationship("FeedbackAnswer", back_populates="audit")
    ai_analysis = relationship("AIAnalysis", back_populates="audit", uselist=False)
    access_logs = relationship("AuditAccessLog", back_populates="audit")

    __table_args__ = (
        Index("idx_audits_employee_date", "employee_id", "call_date"),
        Index("idx_audits_status", "status"),
    )


# ─── Recording Model ──────────────────────────────────────────────────────────

class Recording(Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(Integer, ForeignKey("audits.id"), unique=True, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)   # null when expired
    file_size = Column(Integer, nullable=True)        # bytes
    mime_type = Column(String(50), default="audio/mpeg")
    duration = Column(Float, nullable=True)            # seconds
    is_expired = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    audit = relationship("Audit", back_populates="recording")

    __table_args__ = (
        Index("idx_recordings_expires_at", "expires_at"),
        Index("idx_recordings_expired", "is_expired"),
    )


# ─── Feedback Form Model ──────────────────────────────────────────────────────

class FeedbackForm(Base):
    __tablename__ = "feedback_forms"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    questions = relationship("FeedbackQuestion", back_populates="form", cascade="all, delete-orphan")
    answers = relationship("FeedbackAnswer", back_populates="form")


# ─── Feedback Question Model ──────────────────────────────────────────────────

class FeedbackQuestion(Base):
    __tablename__ = "feedback_questions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("feedback_forms.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(FeedbackQuestionType), nullable=False)
    options = Column(JSON, nullable=True)       # For multiple_choice questions
    is_required = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)

    # Relationships
    form = relationship("FeedbackForm", back_populates="questions")
    answers = relationship("FeedbackQuestionAnswer", back_populates="question")

    __table_args__ = (
        Index("idx_questions_form_order", "form_id", "order_index"),
    )


# ─── Feedback Answer (Submission) Model ───────────────────────────────────────

class FeedbackAnswer(Base):
    __tablename__ = "feedback_answers"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(Integer, ForeignKey("audits.id"), nullable=False)
    form_id = Column(Integer, ForeignKey("feedback_forms.id"), nullable=False)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submitted_at = Column(DateTime, server_default=func.now())
    overall_rating = Column(Float, nullable=True)
    comments = Column(Text, nullable=True)

    # Relationships
    audit = relationship("Audit", back_populates="feedback_answers")
    form = relationship("FeedbackForm", back_populates="answers")
    submitted_by = relationship("User", back_populates="feedback_submissions")
    question_answers = relationship("FeedbackQuestionAnswer", back_populates="submission", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_feedback_audit_user", "audit_id", "submitted_by_id"),
    )


# ─── Individual Question Answer ───────────────────────────────────────────────

class FeedbackQuestionAnswer(Base):
    __tablename__ = "feedback_question_answers"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("feedback_answers.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("feedback_questions.id"), nullable=False)
    answer_value = Column(Text, nullable=True)   # Stored as string, parsed by type

    # Relationships
    submission = relationship("FeedbackAnswer", back_populates="question_answers")
    question = relationship("FeedbackQuestion", back_populates="answers")


# ─── AI Analysis Model ────────────────────────────────────────────────────────

class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(Integer, ForeignKey("audits.id"), unique=True, nullable=False)
    
    # Transcription
    transcription = Column(Text, nullable=True)
    transcription_confidence = Column(Float, nullable=True)
    
    # Summary
    call_summary = Column(Text, nullable=True)
    key_points = Column(JSON, nullable=True)    # List of strings
    
    # Sentiment
    sentiment_label = Column(Enum(SentimentLabel), nullable=True)
    sentiment_score = Column(Float, nullable=True)   # -1.0 to 1.0
    sentiment_details = Column(JSON, nullable=True)  # Breakdown
    
    # Keywords & Topics
    keywords = Column(JSON, nullable=True)           # List of strings
    topics = Column(JSON, nullable=True)             # List of strings
    
    # Quality Scores
    call_quality_score = Column(Float, nullable=True)     # 0-100
    customer_satisfaction_score = Column(Float, nullable=True)  # 0-100
    
    # Issues & Suggestions
    identified_issues = Column(JSON, nullable=True)
    ai_suggestions = Column(JSON, nullable=True)
    
    processing_time = Column(Float, nullable=True)   # seconds
    processed_at = Column(DateTime, server_default=func.now())
    model_used = Column(String(100), nullable=True)

    # Relationships
    audit = relationship("Audit", back_populates="ai_analysis")


# ─── Audit Access Log ─────────────────────────────────────────────────────────

class AuditAccessLog(Base):
    __tablename__ = "audit_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(Integer, ForeignKey("audits.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # "view", "play", "download_attempt"
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

    # Relationships
    audit = relationship("Audit", back_populates="access_logs")
    user = relationship("User", back_populates="access_logs")

    __table_args__ = (
        Index("idx_access_logs_audit_user", "audit_id", "user_id"),
        Index("idx_access_logs_timestamp", "timestamp"),
    )
