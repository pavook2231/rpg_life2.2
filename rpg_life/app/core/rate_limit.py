import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware

from app.core.responses import error_payload


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.buckets = defaultdict(deque)

    async def dispatch(self, request, call_next):
        client_host = request.client.host if request.client else "unknown"
        bucket = self.buckets[client_host]
        now = time.time()
        window_start = now - 60
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= self.requests_per_minute:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=429,
                content=error_payload("Превышен лимит запросов"),
            )
        bucket.append(now)
        return await call_next(request)
