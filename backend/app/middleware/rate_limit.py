import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """IP-based rate limiter for POST /api/arguments."""

    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next) -> Response:
        # Only rate-limit POST to the arguments endpoint
        if request.method != "POST" or request.url.path != "/api/arguments":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0

        # Prune timestamps older than the window
        timestamps = self._requests.get(client_ip, [])
        timestamps = [t for t in timestamps if now - t < window]

        if len(timestamps) >= settings.RATE_LIMIT_PER_MINUTE:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Too many submissions. Try again in 60 seconds.",
                        "retry_after": 60,
                    }
                },
            )

        timestamps.append(now)
        self._requests[client_ip] = timestamps

        return await call_next(request)
