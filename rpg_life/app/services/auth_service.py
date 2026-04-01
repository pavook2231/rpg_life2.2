import json
import base64
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from secrets import token_urlsafe
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import auth, crud
from app.core.config import (
    ACCESS_TOKEN_EXPIRE_DELTA,
    ENABLE_ACCOUNT_RECOVERY,
    GOOGLE_AUTH_ACCEPTED_CLIENT_IDS,
    GOOGLE_AUTH_CLIENT_SECRET,
    GOOGLE_AUTH_ANDROID_CLIENT_ID,
    GOOGLE_AUTH_ENABLED,
    GOOGLE_AUTH_IOS_CLIENT_ID,
    GOOGLE_AUTH_MOBILE_CLIENT_ID,
    GOOGLE_AUTH_WEB_CLIENT_ID,
    SOCIAL_BRIDGE_TICKET_MAX_AGE_SECONDS,
    TELEGRAM_AUTH_MAX_AGE_SECONDS,
    TELEGRAM_AUTH_ENABLED,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME,
    VK_AUTH_APP_ID,
    VK_AUTH_DOMAIN,
    VK_AUTH_ENABLED,
    VK_AUTH_MAX_AGE_SECONDS,
    VK_AUTH_SCOPE,
    YANDEX_AUTH_CLIENT_SECRET,
    YANDEX_AUTH_ENABLED,
    YANDEX_AUTH_MOBILE_CLIENT_ID,
)
from app.core.cache import cache_acquire_lock, cache_delete, cache_get_json, cache_release_lock, cache_set_json
from app.core.dates import utc_now
from app.core.security import get_password_hash, verify_password
from app.models import RefreshTokenSession, User, UserSocialAccount
from app.schemas import UserCreate
import app.services.goal_service as goal_service


_SOCIAL_BRIDGE_TICKET_KEY_PREFIX = "social-bridge-ticket:"
_SOCIAL_BRIDGE_TICKET_LOCK_PREFIX = "social-bridge-ticket-lock:"
logger = logging.getLogger(__name__)


def _ensure_user_quest_content(db: Session, user_id: int) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    goal_service.generate_goal_quests_for_user(db, user, source="ai", force_regenerate=False)


def _issue_refresh_token(db: Session, user: User) -> str:
    token_id = token_urlsafe(32)
    encoded_refresh, payload = auth.create_refresh_token(
        data={"sub": user.email},
        token_id=token_id,
        return_payload=True,
    )
    expires_at = payload["exp"]
    if isinstance(expires_at, (int, float)):
        expires_at = datetime.fromtimestamp(expires_at, tz=timezone.utc).replace(tzinfo=None)
    elif isinstance(expires_at, datetime) and expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    db.add(
        RefreshTokenSession(
            user_id=user.id,
            jti_hash=auth.hash_token_id(token_id),
            expires_at=expires_at,
            is_revoked=False,
        )
    )
    return encoded_refresh


def _build_auth_payload_for_user(db: Session, user: User, *, needs_goal_setup: bool = False) -> dict:
    user = crud.ensure_user_identity(db, user, commit=True)
    access_token = auth.create_access_token(data={"sub": user.email}, expires_delta=ACCESS_TOKEN_EXPIRE_DELTA)
    refresh_token = _issue_refresh_token(db, user)
    db.commit()
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "username": user.username,
            "friend_id": crud.user_friend_id(user),
        },
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
        },
        "needs_goal_setup": needs_goal_setup,
    }


def _normalize_email_for_social(provider: str, provider_user_id: str, email: str | None) -> str:
    if email:
        return email.strip().lower()
    return f"{provider}_{provider_user_id}@social.rpglife.local"


def _social_bridge_ticket_key(ticket: str) -> str:
    return f"{_SOCIAL_BRIDGE_TICKET_KEY_PREFIX}{ticket}"


def _social_bridge_ticket_lock_key(ticket: str) -> str:
    return f"{_SOCIAL_BRIDGE_TICKET_LOCK_PREFIX}{ticket}"


def issue_social_bridge_ticket(payload: dict) -> str:
    ticket = token_urlsafe(24)
    cache_set_json(_social_bridge_ticket_key(ticket), payload, ttl=SOCIAL_BRIDGE_TICKET_MAX_AGE_SECONDS)
    return ticket


def consume_social_bridge_ticket(ticket: str) -> dict | None:
    cache_key = _social_bridge_ticket_key(ticket)
    lock_key = _social_bridge_ticket_lock_key(ticket)
    owner_token = token_urlsafe(16)
    if not cache_acquire_lock(lock_key, owner_token, ttl_seconds=5):
        return None
    try:
        payload = cache_get_json(cache_key)
        if not isinstance(payload, dict):
            return None
        cache_delete(cache_key)
        return payload
    finally:
        cache_release_lock(lock_key, owner_token)


def _resolve_or_create_social_user(
    db: Session,
    provider: str,
    provider_user_id: str,
    email: str | None,
    display_name: str | None,
    username: str | None = None,
    avatar_url: str | None = None,
) -> tuple[User, bool]:
    link = (
        db.query(UserSocialAccount)
        .filter(UserSocialAccount.provider == provider, UserSocialAccount.provider_user_id == provider_user_id)
        .first()
    )
    is_new_user = False
    if link:
        user = db.query(User).filter(User.id == link.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Linked user not found")
    else:
        normalized_email = _normalize_email_for_social(provider, provider_user_id, email)
        user = db.query(User).filter(User.email == normalized_email).first()
        if not user:
            fallback_name = (display_name or username or normalized_email.split("@")[0] or "Hero").strip()
            user = crud.create_user(
                db,
                normalized_email,
                token_urlsafe(24),
                "mage",
                name=fallback_name,
                birth_year=None,
                gender="unspecified",
                goal_type="lose",
                goal_term_months=6,
            )
            is_new_user = True

        link = UserSocialAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            provider_email=email,
            provider_username=username,
            provider_display_name=display_name,
            provider_avatar_url=avatar_url,
        )
        db.add(link)
        db.commit()
        db.refresh(link)

    link.provider_email = email
    link.provider_username = username
    link.provider_display_name = display_name
    link.provider_avatar_url = avatar_url

    if display_name and not user.name:
        user.name = display_name.strip()

    db.commit()
    db.refresh(user)
    return crud.ensure_user_identity(db, user, preferred_username=username, commit=True), is_new_user


def _verify_google_id_token(id_token: str) -> dict:
    query = urlencode({"id_token": id_token})
    url = f"https://oauth2.googleapis.com/tokeninfo?{query}"
    try:
        with urlopen(url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise HTTPException(status_code=401, detail=f"Google token rejected: {error.reason}") from error
    except URLError as error:
        raise HTTPException(status_code=503, detail="Could not reach Google token verification service") from error

    audience = payload.get("aud")
    if GOOGLE_AUTH_ACCEPTED_CLIENT_IDS and audience not in GOOGLE_AUTH_ACCEPTED_CLIENT_IDS:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")

    issuer = payload.get("iss")
    if issuer not in {"https://accounts.google.com", "accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Google token issuer mismatch")

    if payload.get("email_verified") not in {True, "true"}:
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    expires_at = payload.get("exp")
    if expires_at:
        try:
            if int(expires_at) <= int(datetime.now(timezone.utc).timestamp()):
                raise HTTPException(status_code=401, detail="Google token has expired")
        except ValueError as error:
            raise HTTPException(status_code=401, detail="Google token expiry is invalid") from error

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Google token has no subject")

    return payload


def _google_post_form(form_params: dict[str, str | int | None]) -> dict:
    request = Request(
        url="https://oauth2.googleapis.com/token",
        data=urlencode({key: value for key, value in form_params.items() if value is not None}).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.reason
        try:
            error_payload = json.loads(error.read().decode("utf-8"))
            detail = error_payload.get("error_description") or error_payload.get("error") or detail
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=f"Google request rejected: {detail}") from error
    except URLError as error:
        raise HTTPException(status_code=503, detail="Could not reach Google sign-in service") from error

    if isinstance(payload, dict) and payload.get("error"):
        detail = payload.get("error_description") or payload.get("error")
        raise HTTPException(status_code=401, detail=f"Google request rejected: {detail}")

    return payload


def create_google_browser_login(redirect_uri: str) -> dict:
    if not GOOGLE_AUTH_WEB_CLIENT_ID or not GOOGLE_AUTH_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured yet")

    state = token_urlsafe(24)
    authorize_url = "https://accounts.google.com/o/oauth2/v2/auth?{query}".format(
        query=urlencode(
            {
                "client_id": GOOGLE_AUTH_WEB_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "prompt": "select_account",
                "access_type": "online",
                "include_granted_scopes": "true",
            }
        ),
    )
    return {
        "state": state,
        "authorize_url": authorize_url,
    }


def _exchange_google_authorization_code(code: str, *, redirect_uri: str) -> dict:
    payload = _google_post_form(
        {
            "client_id": GOOGLE_AUTH_WEB_CLIENT_ID,
            "client_secret": GOOGLE_AUTH_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
    )

    expires_in = payload.get("expires_in")
    if expires_in:
        try:
            if int(expires_in) <= 0:
                raise HTTPException(status_code=401, detail="Google access token is invalid")
        except ValueError as error:
            raise HTTPException(status_code=401, detail="Google token expiry is invalid") from error

    return payload


def complete_google_browser_login(db: Session, *, code: str, redirect_uri: str) -> str:
    if not GOOGLE_AUTH_WEB_CLIENT_ID or not GOOGLE_AUTH_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured yet")

    token_payload = _exchange_google_authorization_code(code, redirect_uri=redirect_uri)
    id_token = str(token_payload.get("id_token") or "").strip()
    if not id_token:
        raise HTTPException(status_code=401, detail="Google response has no id_token")

    verified = _verify_google_id_token(id_token)
    user, is_new_user = _resolve_or_create_social_user(
        db,
        provider="google",
        provider_user_id=str(verified["sub"]),
        email=verified.get("email"),
        display_name=verified.get("name"),
        username=verified.get("given_name"),
        avatar_url=verified.get("picture"),
    )
    _ensure_user_quest_content(db, user.id)
    return issue_social_bridge_ticket(_build_auth_payload_for_user(db, user, needs_goal_setup=is_new_user))


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _generate_vk_code_verifier() -> str:
    return token_urlsafe(64)


def _generate_vk_code_challenge(code_verifier: str) -> str:
    return _base64url_encode(hashlib.sha256(code_verifier.encode("utf-8")).digest())


def _vk_post_form(path: str, *, query_params: dict[str, str | int | None], form_params: dict[str, str | int | None]) -> dict:
    encoded_query = urlencode({key: value for key, value in query_params.items() if value is not None})
    request = Request(
        url=f"https://{VK_AUTH_DOMAIN}/{path}?{encoded_query}",
        data=urlencode({key: value for key, value in form_params.items() if value is not None}).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.reason
        try:
            error_payload = json.loads(error.read().decode("utf-8"))
            detail = error_payload.get("error_description") or error_payload.get("error") or detail
        except Exception:
            pass
        logger.warning("VK ID request rejected: path=%s detail=%s", path, detail)
        raise HTTPException(status_code=401, detail=f"VK ID request rejected: {detail}") from error
    except URLError as error:
        logger.exception("Could not reach VK ID service: path=%s", path)
        raise HTTPException(status_code=503, detail="Could not reach VK ID service") from error

    if isinstance(payload, dict) and payload.get("error"):
        detail = payload.get("error_description") or payload.get("error")
        logger.warning("VK ID payload error: path=%s detail=%s", path, detail)
        raise HTTPException(status_code=401, detail=f"VK ID request rejected: {detail}")

    return payload


def create_vk_browser_login(redirect_uri: str) -> dict:
    if not VK_AUTH_APP_ID:
        raise HTTPException(status_code=503, detail="VK ID sign-in is not configured yet")

    state = token_urlsafe(24)
    code_verifier = _generate_vk_code_verifier()
    authorize_url = "https://{domain}/authorize?{query}".format(
        domain=VK_AUTH_DOMAIN,
        query=urlencode(
            {
                "response_type": "code",
                "client_id": VK_AUTH_APP_ID,
                "scope": VK_AUTH_SCOPE,
                "state": state,
                "code_challenge": _generate_vk_code_challenge(code_verifier),
                "code_challenge_method": "S256",
                "redirect_uri": redirect_uri,
                "sdk_type": "vkid",
                "app_id": VK_AUTH_APP_ID,
            }
        ),
    )
    return {
        "state": state,
        "code_verifier": code_verifier,
        "authorize_url": authorize_url,
    }


def _exchange_vk_authorization_code(code: str, device_id: str, *, state: str, code_verifier: str, redirect_uri: str) -> dict:
    payload = _vk_post_form(
        "oauth2/auth",
        query_params={
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
            "client_id": VK_AUTH_APP_ID,
            "code_verifier": code_verifier,
            "state": state,
            "device_id": device_id,
        },
        form_params={"code": code},
    )

    returned_state = str(payload.get("state") or "").strip()
    if returned_state and returned_state != state:
        raise HTTPException(status_code=401, detail="VK ID state mismatch")

    expires_in = payload.get("expires_in")
    if expires_in:
        try:
            if int(expires_in) <= 0:
                raise HTTPException(status_code=401, detail="VK ID access token is invalid")
        except ValueError as error:
            raise HTTPException(status_code=401, detail="VK ID token expiry is invalid") from error

    return payload


def _fetch_vk_user_info(access_token: str) -> dict:
    payload = _vk_post_form(
        "oauth2/user_info",
        query_params={"client_id": VK_AUTH_APP_ID},
        form_params={"access_token": access_token},
    )
    if not isinstance(payload, dict) or not isinstance(payload.get("user"), dict):
        raise HTTPException(status_code=401, detail="VK ID user payload is invalid")
    return payload


def _normalize_vk_user_payload(access_token: str) -> dict:
    payload = _fetch_vk_user_info(access_token)
    user_payload = payload["user"]
    vk_user_id = user_payload.get("user_id")
    if not vk_user_id:
        raise HTTPException(status_code=401, detail="VK ID user payload has no user id")

    first_name = str(user_payload.get("first_name") or "").strip()
    last_name = str(user_payload.get("last_name") or "").strip()
    email = str(user_payload.get("email") or "").strip().lower() or None
    avatar_url = (
        str(user_payload.get("avatar") or "").strip()
        or str(user_payload.get("avatar_200") or "").strip()
        or str(user_payload.get("avatar_100") or "").strip()
        or str(user_payload.get("avatar_50") or "").strip()
        or None
    )
    username = str(user_payload.get("screen_name") or user_payload.get("domain") or "").strip() or None
    display_name = " ".join(part for part in [first_name, last_name] if part).strip() or username or email or f"VK {vk_user_id}"

    return {
        "vk_user_id": str(vk_user_id),
        "email": email,
        "username": username,
        "display_name": display_name,
        "avatar_url": avatar_url,
    }


def complete_vk_browser_login(
    db: Session,
    *,
    code: str,
    device_id: str,
    state: str,
    code_verifier: str,
    redirect_uri: str,
) -> str:
    if not VK_AUTH_APP_ID:
        raise HTTPException(status_code=503, detail="VK ID sign-in is not configured yet")

    age_limit = VK_AUTH_MAX_AGE_SECONDS
    if age_limit <= 0:
        raise HTTPException(status_code=503, detail="VK ID sign-in lifetime is misconfigured")

    token_payload = _exchange_vk_authorization_code(
        code,
        device_id,
        state=state,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
    )
    access_token = str(token_payload.get("access_token") or "").strip()
    if not access_token:
        raise HTTPException(status_code=401, detail="VK ID response has no access_token")

    verified = _normalize_vk_user_payload(access_token)
    user, is_new_user = _resolve_or_create_social_user(
        db,
        provider="vk",
        provider_user_id=verified["vk_user_id"],
        email=verified["email"],
        display_name=verified["display_name"],
        username=verified["username"],
        avatar_url=verified["avatar_url"],
    )
    _ensure_user_quest_content(db, user.id)
    return issue_social_bridge_ticket(_build_auth_payload_for_user(db, user, needs_goal_setup=is_new_user))


def _verify_telegram_init_data(init_data: str) -> dict:
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram sign-in is not configured yet")

    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=400, detail="Telegram auth payload has no hash")

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(parsed.items()))
    if not data_check_string:
        raise HTTPException(status_code=400, detail="Telegram auth payload is empty")

    login_secret = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode("utf-8")).digest()
    login_hash = hmac.new(login_secret, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    webapp_secret = hmac.new(b"WebAppData", TELEGRAM_BOT_TOKEN.encode("utf-8"), hashlib.sha256).digest()
    webapp_hash = hmac.new(webapp_secret, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not (
        hmac.compare_digest(login_hash, received_hash)
        or hmac.compare_digest(webapp_hash, received_hash)
    ):
        raise HTTPException(status_code=401, detail="Telegram auth signature mismatch")

    auth_date_raw = parsed.get("auth_date")
    if auth_date_raw:
        try:
            auth_timestamp = int(auth_date_raw)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Telegram auth_date is invalid") from error

        age_seconds = int(datetime.now(timezone.utc).timestamp()) - auth_timestamp
        if age_seconds > TELEGRAM_AUTH_MAX_AGE_SECONDS:
            raise HTTPException(status_code=401, detail="Telegram auth payload has expired")

    user_payload: dict[str, object]
    if parsed.get("user"):
        try:
            user_payload = json.loads(parsed["user"])
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=400, detail="Telegram user payload is invalid") from error
    else:
        user_payload = {
            "id": parsed.get("id"),
            "username": parsed.get("username"),
            "first_name": parsed.get("first_name"),
            "last_name": parsed.get("last_name"),
            "photo_url": parsed.get("photo_url"),
        }

    telegram_user_id = user_payload.get("id")
    if not telegram_user_id:
        raise HTTPException(status_code=400, detail="Telegram auth payload has no user id")

    first_name = str(user_payload.get("first_name") or "").strip()
    last_name = str(user_payload.get("last_name") or "").strip()
    username = str(user_payload.get("username") or "").strip() or None
    display_name = " ".join(part for part in [first_name, last_name] if part).strip() or username or f"Telegram {telegram_user_id}"
    avatar_url = str(user_payload.get("photo_url") or "").strip() or None

    return {
        "telegram_user_id": str(telegram_user_id),
        "username": username,
        "display_name": display_name,
        "avatar_url": avatar_url,
    }


def login_user(db: Session, email: str, password: str) -> JSONResponse:
    user = crud.authenticate_user(db, email, password)
    if not user:
        raise HTTPException(status_code=400, detail="Неверный email или пароль")

    _ensure_user_quest_content(db, user.id)
    token = auth.create_access_token(data={"sub": user.email}, expires_delta=ACCESS_TOKEN_EXPIRE_DELTA)
    response = JSONResponse(content={"ok": True, "access_token": token, "token_type": "bearer"})
    auth.set_token_cookie(response, token)
    return response


def register_user(db: Session, user_data: UserCreate) -> JSONResponse:
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    user = crud.create_user(
        db,
        user_data.email,
        user_data.password,
        user_data.character_class,
        name=user_data.name,
        username=user_data.username,
        birth_year=user_data.birth_year,
        gender=user_data.gender,
        goal_type=user_data.goal_type,
        goal_term_months=user_data.goal_term_months,
    )
    _ensure_user_quest_content(db, user.id)

    token = auth.create_access_token(data={"sub": user.email}, expires_delta=ACCESS_TOKEN_EXPIRE_DELTA)
    response = JSONResponse(
        content={
            "ok": True,
            "id": user.id,
            "access_token": token,
            "redirect": f"/dashboard/{user_data.character_class}",
        }
    )
    auth.set_token_cookie(response, token)
    return response


def logout_user() -> JSONResponse:
    response = JSONResponse(content={"ok": True, "message": "Выход выполнен"})
    auth.clear_token_cookie(response)
    return response


def login_user_tokens(db: Session, email: str, password: str) -> dict:
    user = crud.authenticate_user(db, email, password)
    if not user:
        raise HTTPException(status_code=400, detail="Неверный email или пароль")
    _ensure_user_quest_content(db, user.id)
    return _build_auth_payload_for_user(db, user)


def register_user_tokens(db: Session, user_data: UserCreate) -> dict:
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    user = crud.create_user(
        db,
        user_data.email,
        user_data.password,
        user_data.character_class,
        name=user_data.name,
        username=user_data.username,
        birth_year=user_data.birth_year,
        gender=user_data.gender,
        goal_type=user_data.goal_type,
        goal_term_months=user_data.goal_term_months,
    )
    _ensure_user_quest_content(db, user.id)
    return _build_auth_payload_for_user(db, user, needs_goal_setup=True)


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    payload = auth.decode_token(refresh_token)
    if not auth.validate_token_type(payload, "refresh"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    email = payload.get("sub") if payload else None
    token_id = payload.get("jti") if payload else None
    if not email or not token_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.email == email).first()
    if not user or user.is_active != True:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_session = (
        db.query(RefreshTokenSession)
        .filter(
            RefreshTokenSession.user_id == user.id,
            RefreshTokenSession.jti_hash == auth.hash_token_id(token_id),
            RefreshTokenSession.is_revoked == False,
        )
        .first()
    )
    if not token_session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if token_session.expires_at <= utc_now():
        token_session.is_revoked = True
        token_session.revoked_at = utc_now()
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    now = utc_now()
    token_session.is_revoked = True
    token_session.last_used_at = now
    token_session.revoked_at = now

    access_token = auth.create_access_token(data={"sub": user.email}, expires_delta=ACCESS_TOKEN_EXPIRE_DELTA)
    new_refresh_token = _issue_refresh_token(db, user)
    db.commit()
    return {
        "tokens": {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": int(ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
        }
    }


def logout_mobile_session(db: Session, refresh_token: str) -> dict:
    payload = auth.decode_token(refresh_token)
    if not auth.validate_token_type(payload, "refresh"):
        return {"ok": True}

    email = payload.get("sub") if payload else None
    token_id = payload.get("jti") if payload else None
    if not email or not token_id:
        return {"ok": True}

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"ok": True}

    token_session = (
        db.query(RefreshTokenSession)
        .filter(
            RefreshTokenSession.user_id == user.id,
            RefreshTokenSession.jti_hash == auth.hash_token_id(token_id),
            RefreshTokenSession.is_revoked == False,
        )
        .first()
    )
    if not token_session:
        return {"ok": True}

    now = utc_now()
    token_session.is_revoked = True
    token_session.last_used_at = now
    token_session.revoked_at = now
    db.commit()
    return {"ok": True}


def change_password(db: Session, current_user: User, current_password: str, new_password: str) -> dict:
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if current_password == new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")

    now = utc_now()
    user.hashed_password = get_password_hash(new_password)
    (
        db.query(RefreshTokenSession)
        .filter(RefreshTokenSession.user_id == user.id, RefreshTokenSession.is_revoked == False)
        .update(
            {
                RefreshTokenSession.is_revoked: True,
                RefreshTokenSession.revoked_at: now,
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return {"ok": True}


def recover_account(db: Session, email: str) -> dict:
    if not ENABLE_ACCOUNT_RECOVERY:
        return {
            "ok": True,
            "message": "Account recovery is currently disabled.",
        }
    _ = db.query(User).filter(User.email == email).first()
    return {
        "ok": True,
        "message": "If the account exists, recovery instructions have been prepared.",
    }


def get_social_auth_providers() -> list[dict]:
    return [
        {
            "id": "google",
            "label": "Google",
            "kind": "oauth",
            "enabled": GOOGLE_AUTH_ENABLED,
            "configured": bool(GOOGLE_AUTH_WEB_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET) or bool(GOOGLE_AUTH_ACCEPTED_CLIENT_IDS),
            "mobile_client_id": GOOGLE_AUTH_ANDROID_CLIENT_ID or GOOGLE_AUTH_MOBILE_CLIENT_ID or GOOGLE_AUTH_IOS_CLIENT_ID or GOOGLE_AUTH_WEB_CLIENT_ID or None,
            "browser_login_path": "/auth/google/login" if GOOGLE_AUTH_WEB_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET else None,
        },
        {
            "id": "telegram",
            "label": "Telegram",
            "kind": "telegram",
            "enabled": TELEGRAM_AUTH_ENABLED,
            "configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME),
            "mobile_client_id": TELEGRAM_BOT_USERNAME or None,
            "browser_login_path": "/auth/telegram/login" if TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME else None,
        },
        {
            "id": "vk",
            "label": "VK ID",
            "kind": "oauth",
            "enabled": VK_AUTH_ENABLED,
            "configured": bool(VK_AUTH_APP_ID),
            "mobile_client_id": VK_AUTH_APP_ID or None,
            "browser_login_path": "/auth/vk/login" if VK_AUTH_APP_ID else None,
        },
    ]


def authenticate_social_mobile(
    db: Session,
    provider: str,
    id_token: str | None = None,
    access_token: str | None = None,
    authorization_code: str | None = None,
    init_data: str | None = None,
    bridge_ticket: str | None = None,
) -> dict:
    _ = authorization_code

    provider_config = next((entry for entry in get_social_auth_providers() if entry["id"] == provider), None)
    if not provider_config:
        raise HTTPException(status_code=400, detail="Unsupported social auth provider")

    if bridge_ticket and provider in {"google", "vk"}:
        bridged_payload = consume_social_bridge_ticket(bridge_ticket)
        if not bridged_payload:
            label = "Google" if provider == "google" else "VK ID"
            raise HTTPException(status_code=400, detail=f"{label} sign-in session has expired or was already used")
        return bridged_payload

    if not provider_config["enabled"]:
        raise HTTPException(status_code=400, detail=f"{provider_config['label']} sign-in is disabled")
    if not provider_config["configured"]:
        raise HTTPException(status_code=503, detail=f"{provider_config['label']} sign-in is not configured yet")

    if provider == "google":
        if not id_token:
            raise HTTPException(status_code=400, detail="Google sign-in requires bridge_ticket or id_token")

        verified = _verify_google_id_token(id_token)
        user, is_new_user = _resolve_or_create_social_user(
            db,
            provider="google",
            provider_user_id=str(verified["sub"]),
            email=verified.get("email"),
            display_name=verified.get("name"),
            username=verified.get("given_name"),
            avatar_url=verified.get("picture"),
        )
        _ensure_user_quest_content(db, user.id)
        return _build_auth_payload_for_user(db, user, needs_goal_setup=is_new_user)

    if provider == "telegram":
        if not init_data:
            raise HTTPException(status_code=400, detail="Telegram sign-in requires init_data")

        verified = _verify_telegram_init_data(init_data)
        user, is_new_user = _resolve_or_create_social_user(
            db,
            provider="telegram",
            provider_user_id=verified["telegram_user_id"],
            email=None,
            display_name=verified["display_name"],
            username=verified["username"],
            avatar_url=verified["avatar_url"],
        )
        _ensure_user_quest_content(db, user.id)
        return _build_auth_payload_for_user(db, user, needs_goal_setup=is_new_user)

    if provider == "vk":
        if not access_token:
            raise HTTPException(status_code=400, detail="VK ID sign-in requires bridge_ticket or access_token")

        verified = _normalize_vk_user_payload(access_token)
        user, is_new_user = _resolve_or_create_social_user(
            db,
            provider="vk",
            provider_user_id=verified["vk_user_id"],
            email=verified["email"],
            display_name=verified["display_name"],
            username=verified["username"],
            avatar_url=verified["avatar_url"],
        )
        _ensure_user_quest_content(db, user.id)
        return _build_auth_payload_for_user(db, user, needs_goal_setup=is_new_user)

    raise HTTPException(status_code=501, detail=f"{provider_config['label']} sign-in will be connected next.")

