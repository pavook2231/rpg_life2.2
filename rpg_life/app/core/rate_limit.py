import math
import time
from collections import defaultdict, deque
from threading import Lock
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware

from app.core.cache import cache_client, redis_enabled
from app.core.request_ip import get_client_ip
from app.core.responses import error_payload

_LOCAL_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_LOCAL_RATE_LIMIT_LOCK = Lock()
_LOCAL_CLEANUP_COUNTER = 0
_LOCAL_CLEANUP_INTERVAL = 256
_RATE_LIMIT_KEY_PREFIX = "rate-limit"
_REDIS_RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local now_value = tonumber(ARGV[1])
local window_value = tonumber(ARGV[2])
local limit_value = tonumber(ARGV[3])
local member = ARGV[4]
local window_start = now_value - window_value

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

local current_count = redis.call('ZCARD', key)
if current_count >= limit_value then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_score = now_value
    if oldest[2] then
        oldest_score = tonumber(oldest[2])
    end
    redis.call('EXPIRE', key, math.max(1, math.ceil(window_value)))
    return {0, oldest_score}
end

redis.call('ZADD', key, now_value, member)
redis.call('EXPIRE', key, math.max(1, math.ceil(window_value)))
return {1, now_value}
"""


def _cleanup_local_stale_buckets(window_start: float) -> None:
    stale_keys = [
        bucket_key
        for bucket_key, bucket in _LOCAL_RATE_LIMIT_BUCKETS.items()
        if not bucket or bucket[-1] <= window_start
    ]
    for bucket_key in stale_keys:
        _LOCAL_RATE_LIMIT_BUCKETS.pop(bucket_key, None)


def _consume_local_rate_limit(
    bucket_key: str,
    *,
    limit: int,
    window_seconds: int,
    now_ts: float,
) -> tuple[bool, int]:
    global _LOCAL_CLEANUP_COUNTER

    window_start = now_ts - window_seconds
    with _LOCAL_RATE_LIMIT_LOCK:
        _LOCAL_CLEANUP_COUNTER += 1
        if _LOCAL_CLEANUP_COUNTER >= _LOCAL_CLEANUP_INTERVAL:
            _cleanup_local_stale_buckets(window_start)
            _LOCAL_CLEANUP_COUNTER = 0

        attempts = _LOCAL_RATE_LIMIT_BUCKETS[bucket_key]
        while attempts and attempts[0] <= window_start:
            attempts.popleft()

        if len(attempts) >= limit:
            retry_after = max(1, math.ceil(window_seconds - (now_ts - attempts[0])))
            return False, retry_after

        attempts.append(now_ts)
        return True, 0


def consume_rate_limit(
    bucket_key: str,
    *,
    limit: int,
    window_seconds: int,
    now_ts: float | None = None,
) -> tuple[bool, int]:
    effective_now = time.time() if now_ts is None else now_ts
    namespaced_key = f"{_RATE_LIMIT_KEY_PREFIX}:{bucket_key}"

    if redis_enabled:
        try:
            result = cache_client.eval(
                _REDIS_RATE_LIMIT_SCRIPT,
                1,
                namespaced_key,
                str(effective_now),
                str(window_seconds),
                str(limit),
                f"{effective_now:.6f}:{uuid4().hex}",
            )
            allowed = bool(int(result[0]))
            if allowed:
                return True, 0
            oldest_score = float(result[1])
            retry_after = max(1, math.ceil(window_seconds - (effective_now - oldest_score)))
            return False, retry_after
        except Exception:
            pass

    return _consume_local_rate_limit(
        namespaced_key,
        limit=limit,
        window_seconds=window_seconds,
        now_ts=effective_now,
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute

    async def dispatch(self, request, call_next):
        client_host = get_client_ip(request)
        allowed, retry_after = consume_rate_limit(
            f"middleware:{client_host}",
            limit=self.requests_per_minute,
            window_seconds=60,
        )
        if not allowed:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=429,
                content=error_payload("РџСЂРµРІС‹С€РµРЅ Р»РёРјРёС‚ Р·Р°РїСЂРѕСЃРѕРІ"),
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
