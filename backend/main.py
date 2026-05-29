"""
DCM Audit System - FastAPI Backend
Main application entry point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn
import os
from contextlib import asynccontextmanager

from database.connection import engine, Base
from routes import auth, users, audits, recordings, feedback, ai_analysis, admin
from scheduler.tasks import start_scheduler, shutdown_scheduler
from middleware.logging import LoggingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events"""
    # Startup
    print("🚀 DCM Audit System starting up...")
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    print("✅ Database tables created")
    print("✅ Scheduler started")
    
    # Ensure storage directories exist
    os.makedirs("storage/recordings", exist_ok=True)
    os.makedirs("storage/exports", exist_ok=True)
    print("✅ Storage directories ready")
    
    yield
    
    # Shutdown
    print("🛑 DCM Audit System shutting down...")
    shutdown_scheduler()


app = FastAPI(
    title="DCM Audit System API",
    description="AI-powered call audit management platform for DCM",
    version="1.0.0",
    lifespan=lifespan
)
@app.middleware("http")
async def add_root_path_middleware(request: Request, call_next):
    prefix = "/_/backend"
    if request.scope["path"].startswith(prefix):
        request.scope["path"] = request.scope["path"][len(prefix):]
    return await call_next(request)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom logging middleware
app.add_middleware(LoggingMiddleware)

# Mount static files for streaming (not direct access)
# Audio files are served through protected /api/recordings/stream/{id} endpoint
# NOT through direct static file access for security

# Register all routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(audits.router, prefix="/api/audits", tags=["Audits"])
app.include_router(recordings.router, prefix="/api/recordings", tags=["Recordings"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["AI Analysis"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/")
async def root():
    return {"message": "DCM Audit System API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "DCM Audit System"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
