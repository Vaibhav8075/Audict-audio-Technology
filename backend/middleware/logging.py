from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time
import logging
logger = logging.getLogger('dcm.requests')

class LoggingMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(f"{request.method} {request.url.path} | Status: {response.status_code} | Time: {process_time:.2f}ms | IP: {(request.client.host if request.client else 'unknown')}")
        response.headers['X-Process-Time'] = f'{process_time:.2f}ms'
        return response