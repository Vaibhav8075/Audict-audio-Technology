"""
Scheduler Service
APScheduler tasks for automated recording expiry and cleanup.
Runs daily to delete expired audio files while preserving database records.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import os
import logging

logger = logging.getLogger("dcm.scheduler")

scheduler = BackgroundScheduler()


def expire_old_recordings():
    """
    Daily job: Expire recordings older than RECORDING_EXPIRY_DAYS.
    IMPORTANT:
    - Deletes the physical audio FILE from disk
    - Sets is_expired = True in database
    - Database record is PRESERVED (for audit trail)
    - Feedback forms linked to audits are NEVER deleted
    """
    from database.connection import SessionLocal
    from models import Recording
    
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        
        # Find all non-expired recordings past expiry date
        expired = db.query(Recording).filter(
            Recording.expires_at <= now,
            Recording.is_expired == False
        ).all()
        
        count = 0
        for recording in expired:
            # Delete physical file
            if recording.file_path and os.path.exists(recording.file_path):
                try:
                    os.remove(recording.file_path)
                    logger.info(f"[Scheduler] Deleted expired file: {recording.file_path}")
                    
                    # Try to remove empty audit directory
                    dir_path = os.path.dirname(recording.file_path)
                    if os.path.isdir(dir_path) and not os.listdir(dir_path):
                        os.rmdir(dir_path)
                        
                except Exception as e:
                    logger.error(f"[Scheduler] Failed to delete file {recording.file_path}: {e}")
            
            # Mark as expired in DB (preserve record)
            recording.is_expired = True
            recording.file_path = None  # Clear path reference
            count += 1
        
        db.commit()
        logger.info(f"[Scheduler] Expiry job completed. Expired {count} recordings at {now}")
        
    except Exception as e:
        logger.error(f"[Scheduler] Expiry job failed: {e}")
        db.rollback()
    finally:
        db.close()


def cleanup_orphaned_files():
    """
    Weekly job: Clean up any orphaned files not referenced in DB.
    Safety net for disk cleanup.
    """
    from database.connection import SessionLocal
    from models import Recording
    
    storage_path = os.getenv("STORAGE_PATH", "storage/recordings")
    
    if not os.path.exists(storage_path):
        return
    
    db = SessionLocal()
    try:
        # Get all valid file paths from DB
        valid_paths = set(
            r.file_path for r in db.query(Recording.file_path)
            .filter(Recording.file_path.isnot(None))
            .all()
            if r.file_path
        )
        
        # Walk storage directory
        deleted = 0
        for root, dirs, files in os.walk(storage_path):
            for fname in files:
                full_path = os.path.join(root, fname)
                if full_path not in valid_paths:
                    try:
                        os.remove(full_path)
                        deleted += 1
                        logger.info(f"[Scheduler] Removed orphaned file: {full_path}")
                    except Exception as e:
                        logger.error(f"[Scheduler] Could not remove {full_path}: {e}")
        
        logger.info(f"[Scheduler] Cleanup completed. Removed {deleted} orphaned files.")
        
    except Exception as e:
        logger.error(f"[Scheduler] Cleanup job failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Initialize and start the scheduler"""
    # Run expiry check daily at 2 AM
    scheduler.add_job(
        expire_old_recordings,
        CronTrigger(hour=2, minute=0),
        id="expire_recordings",
        name="Expire Old Recordings",
        replace_existing=True
    )
    
    # Run orphan cleanup weekly on Sundays at 3 AM
    scheduler.add_job(
        cleanup_orphaned_files,
        CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="cleanup_orphans",
        name="Cleanup Orphaned Files",
        replace_existing=True
    )
    
    # Also run expiry check on startup (catch any missed during downtime)
    scheduler.add_job(
        expire_old_recordings,
        "date",  # Run once immediately
        id="startup_expiry",
        name="Startup Expiry Check"
    )
    
    scheduler.start()
    logger.info("[Scheduler] Started - expiry check daily at 2 AM")


def shutdown_scheduler():
    """Gracefully shutdown the scheduler"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Shutdown complete")
