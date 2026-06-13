from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os, shutil, uuid, mimetypes
from database.connection import get_db
from models import User, Audit, Recording, AuditAccessLog, UserRole, AuditStatus, SystemSetting
from dependencies import get_current_user, get_current_admin
router = APIRouter()
STORAGE_PATH = os.getenv('STORAGE_PATH', 'storage/recordings')
RECORDING_EXPIRY_DAYS = int(os.getenv('RECORDING_EXPIRY_DAYS', '7'))
MAX_FILE_SIZE_MB = int(os.getenv('MAX_FILE_SIZE_MB', '100'))
ALLOWED_MIME_TYPES = {'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4'}

@router.post('/upload/{audit_id}')
async def upload_recording(audit_id: int, background_tasks: BackgroundTasks, file: UploadFile=File(...), current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """
    Upload an audio recording for an audit (admin only).
    Files are stored in STORAGE_PATH with UUID names (not guessable).
    """
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    existing = db.query(Recording).filter(Recording.audit_id == audit_id).first()
    content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f'Invalid file type. Allowed: MP3, WAV, OGG, M4A')
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f'File too large. Maximum size: {MAX_FILE_SIZE_MB}MB')
    file_ext = os.path.splitext(file.filename)[1].lower() or '.mp3'
    secure_filename = f'{uuid.uuid4().hex}{file_ext}'
    audit_dir = os.path.join(STORAGE_PATH, str(audit_id))
    os.makedirs(audit_dir, exist_ok=True)
    file_path = os.path.join(audit_dir, secure_filename)
    with open(file_path, 'wb') as f:
        f.write(contents)
    setting = db.query(SystemSetting).filter(SystemSetting.key == 'retention_days').first()
    retention_days = int(setting.value) if setting else RECORDING_EXPIRY_DAYS
    expires_at = datetime.utcnow() + timedelta(days=retention_days)
    if existing:
        if existing.file_path and os.path.exists(existing.file_path):
            os.remove(existing.file_path)
        existing.file_name = file.filename
        existing.file_path = file_path
        existing.file_size = len(contents)
        existing.mime_type = content_type
        existing.is_expired = False
        existing.expires_at = expires_at
        existing.uploaded_by = current_user.id
        recording = existing
    else:
        recording = Recording(audit_id=audit_id, file_name=file.filename, file_path=file_path, file_size=len(contents), mime_type=content_type, is_expired=False, expires_at=expires_at, uploaded_by=current_user.id)
        db.add(recording)
    audit.status = AuditStatus.processing
    db.commit()
    from routes.ai_analysis import process_ai_analysis
    background_tasks.add_task(process_ai_analysis, audit_id=audit_id, recording_path=file_path)
    return {'message': 'Recording uploaded successfully', 'recording_id': recording.id, 'expires_at': expires_at.isoformat(), 'file_size_mb': round(file_size_mb, 2)}

@router.get('/stream/{audit_id}')
async def stream_recording(audit_id: int, request: Request, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """
    Securely stream audio for an audit.
    SECURITY: Validates user has permission before serving any bytes.
    Supports HTTP range requests for audio seeking.
    """
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    if current_user.role == UserRole.employee and audit.employee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Access denied')
    recording = db.query(Recording).filter(Recording.audit_id == audit_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail='No recording found for this audit')
    if recording.is_expired or not recording.file_path:
        raise HTTPException(status_code=410, detail='Recording has expired and been deleted')
    if not os.path.exists(recording.file_path):
        recording.is_expired = True
        db.commit()
        raise HTTPException(status_code=410, detail='Recording file not found')
    log = AuditAccessLog(audit_id=audit_id, user_id=current_user.id, action='play', ip_address=request.client.host if request.client else None, user_agent=request.headers.get('user-agent'))
    db.add(log)
    db.commit()
    file_size = os.path.getsize(recording.file_path)
    range_header = request.headers.get('range')
    if range_header:
        range_match = range_header.replace('bytes=', '').split('-')
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def generate_chunk():
            with open(recording.file_path, 'rb') as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    data = f.read(min(8192, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data
        headers = {'Content-Range': f'bytes {start}-{end}/{file_size}', 'Accept-Ranges': 'bytes', 'Content-Length': str(chunk_size), 'Content-Type': recording.mime_type or 'audio/mpeg', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store, no-cache'}
        return StreamingResponse(generate_chunk(), status_code=206, headers=headers, media_type=recording.mime_type or 'audio/mpeg')

    def generate_full():
        with open(recording.file_path, 'rb') as f:
            while (chunk := f.read(8192)):
                yield chunk
    return StreamingResponse(generate_full(), headers={'Accept-Ranges': 'bytes', 'Content-Length': str(file_size), 'Content-Disposition': 'inline', 'Cache-Control': 'no-store'}, media_type=recording.mime_type or 'audio/mpeg')

@router.delete('/{recording_id}')
async def delete_recording(recording_id: int, current_user: User=Depends(get_current_admin), db: Session=Depends(get_db)):
    """Delete a recording (admin only)"""
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail='Recording not found')
    if recording.file_path and os.path.exists(recording.file_path):
        os.remove(recording.file_path)
    db.delete(recording)
    db.commit()
    return {'message': 'Recording deleted'}

@router.get('/info/{audit_id}')
async def get_recording_info(audit_id: int, current_user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    """Get recording metadata (no audio data)"""
    audit = db.query(Audit).filter(Audit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail='Audit not found')
    if current_user.role == UserRole.employee and audit.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail='Access denied')
    recording = db.query(Recording).filter(Recording.audit_id == audit_id).first()
    if not recording:
        return {'recording': None}
    return {'recording': {'id': recording.id, 'duration': recording.duration, 'is_expired': recording.is_expired, 'expires_at': recording.expires_at.isoformat() if recording.expires_at else None, 'uploaded_at': recording.uploaded_at.isoformat() if recording.uploaded_at else None, 'file_size': recording.file_size, 'has_file': recording.file_path is not None and (not recording.is_expired)}}