import secrets

from fastapi import HTTPException, Request

from app.core.config import ACCESS_COOKIE_NAME, ADMIN_EMAILS, CSRF_COOKIE_NAME
from app.core.rate_limit import consume_rate_limit
from app.core.request_ip import get_client_ip
from app.models import User


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
    return get_client_ip(request)


async def enforce_rate_limit(
    request: Request,
    *,
    bucket: str,
    limit: int,
    window_seconds: int,
) -> None:
    allowed, retry_after = consume_rate_limit(
        f"{bucket}:{_client_ip(request)}",
        limit=limit,
        window_seconds=window_seconds,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком много запросов. Повторите через {retry_after} сек.",
            headers={"Retry-After": str(retry_after)},
        )
