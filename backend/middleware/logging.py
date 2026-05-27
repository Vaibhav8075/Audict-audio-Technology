"""
Request logging middleware for audit trail and debugging
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time
import logging

logger = logging.getLogger("dcm.requests")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = (time.time() - start_time) * 1000
        
        # Log request details
        logger.info(
            f"{request.method} {request.url.path} "
            f"| Status: {response.status_code} "
            f"| Time: {process_time:.2f}ms "
            f"| IP: {request.client.host if request.client else 'unknown'}"
        )
        
        # Add processing time to response headers
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
        return response
