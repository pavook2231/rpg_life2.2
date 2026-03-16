import secrets
from collections import defaultdict, deque
from datetime import datetime
from threading import Lock

from fastapi import HTTPException, Request
from app.core.config import ACCESS_COOKIE_NAME, ADMIN_EMAILS, CSRF_COOKIE_NAME
from app.models import User
_RATE_LIMIT_STORAGE: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT_LOCK = Lock()


async def verify_csrf_token(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header and auth_header.startswith("Bearer "):
        return True

    access_cookie = request.cookies.get(ACCESS_COOKIE_NAME)
    if not access_cookie:
        return True

    csrf_token = request.headers.get("X-CSRF-Token")
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    if not csrf_token or not csrf_cookie:
        raise HTTPException(status_code=403, detail="Отсутствует CSRF-токен")
    if not secrets.compare_digest(csrf_token, csrf_cookie):
        raise HTTPException(status_code=403, detail="CSRF-токен не совпадает")
    return True


def require_admin_user(current_user: User) -> None:
    if current_user.email and current_user.email.lower() in ADMIN_EMAILS:
        return
    raise HTTPException(status_code=403, detail="Требуются права администратора")


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def enforce_rate_limit(
    request: Request,
    *,
    bucket: str,
    limit: int,
    window_seconds: int,
) -> None:
    now_ts = datetime.now().timestamp()
    key = f"{bucket}:{_client_ip(request)}"

    with _RATE_LIMIT_LOCK:
        attempts = _RATE_LIMIT_STORAGE[key]
        while attempts and now_ts - attempts[0] >= window_seconds:
            attempts.popleft()
        if len(attempts) >= limit:
            retry_after = max(1, int(window_seconds - (now_ts - attempts[0])))
            raise HTTPException(
                status_code=429,
                detail=f"Слишком много запросов. Повторите через {retry_after} сек.",
                headers={"Retry-After": str(retry_after)},
            )
        attempts.append(now_ts)
