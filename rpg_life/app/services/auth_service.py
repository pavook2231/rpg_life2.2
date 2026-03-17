import json
import hashlib
import hmac
from datetime import datetime, timezone
from secrets import token_urlsafe
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import auth, crud
from app.core.config import (
    ACCESS_TOKEN_EXPIRE_DELTA,
    ENABLE_ACCOUNT_RECOVERY,
    GOOGLE_AUTH_CLIENT_SECRET,
    GOOGLE_AUTH_ENABLED,
    GOOGLE_AUTH_MOBILE_CLIENT_ID,
    TELEGRAM_AUTH_MAX_AGE_SECONDS,
    TELEGRAM_AUTH_ENABLED,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME,
    YANDEX_AUTH_CLIENT_SECRET,
    YANDEX_AUTH_ENABLED,
    YANDEX_AUTH_MOBILE_CLIENT_ID,
)
from app.core.dates import utc_now
from app.core.security import get_password_hash, verify_password
from app.models import RefreshTokenSession, User, UserSocialAccount
from app.schemas import UserCreate
import app.services.goal_service as goal_service


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


def _build_auth_payload_for_user(db: Session, user: User) -> dict:
    access_token = auth.create_access_token(data={"sub": user.email}, expires_delta=ACCESS_TOKEN_EXPIRE_DELTA)
    refresh_token = _issue_refresh_token(db, user)
    db.commit()
    return {
        "user": {"id": user.id, "email": user.email, "name": user.name},
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
        },
    }


def _normalize_email_for_social(provider: str, provider_user_id: str, email: str | None) -> str:
    if email:
        return email.strip().lower()
    return f"{provider}_{provider_user_id}@social.rpglife.local"


def _resolve_or_create_social_user(
    db: Session,
    provider: str,
    provider_user_id: str,
    email: str | None,
    display_name: str | None,
    username: str | None = None,
    avatar_url: str | None = None,
) -> User:
    link = (
        db.query(UserSocialAccount)
        .filter(UserSocialAccount.provider == provider, UserSocialAccount.provider_user_id == provider_user_id)
        .first()
    )
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
                goal_type="personal_development",
                goal_term_months=6,
            )

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
    return user


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
    if GOOGLE_AUTH_MOBILE_CLIENT_ID and audience != GOOGLE_AUTH_MOBILE_CLIENT_ID:
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
        birth_year=user_data.birth_year,
        gender=user_data.gender,
        goal_type=user_data.goal_type,
        goal_term_months=user_data.goal_term_months,
    )
    _ensure_user_quest_content(db, user.id)
    return _build_auth_payload_for_user(db, user)


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    payload = auth.decode_token(refresh_token)
    if not auth.validate_token_type(payload, "refresh"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    email = payload.get("sub") if payload else None
    token_id = payload.get("jti") if payload else None
    if not email or not token_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

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
            "configured": bool(GOOGLE_AUTH_MOBILE_CLIENT_ID),
            "mobile_client_id": GOOGLE_AUTH_MOBILE_CLIENT_ID or None,
        },
        {
            "id": "telegram",
            "label": "Telegram",
            "kind": "telegram",
            "enabled": TELEGRAM_AUTH_ENABLED,
            "configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME),
            "mobile_client_id": TELEGRAM_BOT_USERNAME or None,
        },
    ]


def authenticate_social_mobile(
    db: Session,
    provider: str,
    id_token: str | None = None,
    access_token: str | None = None,
    authorization_code: str | None = None,
    init_data: str | None = None,
) -> dict:
    _ = access_token
    _ = authorization_code
    _ = init_data

    provider_config = next((entry for entry in get_social_auth_providers() if entry["id"] == provider), None)
    if not provider_config:
        raise HTTPException(status_code=400, detail="Unsupported social auth provider")
    if not provider_config["enabled"]:
        raise HTTPException(status_code=400, detail=f"{provider_config['label']} sign-in is disabled")
    if not provider_config["configured"]:
        raise HTTPException(status_code=503, detail=f"{provider_config['label']} sign-in is not configured yet")

    if provider == "google":
        if not id_token:
            raise HTTPException(status_code=400, detail="Google sign-in requires id_token")

        verified = _verify_google_id_token(id_token)
        user = _resolve_or_create_social_user(
            db,
            provider="google",
            provider_user_id=str(verified["sub"]),
            email=verified.get("email"),
            display_name=verified.get("name"),
            username=verified.get("given_name"),
            avatar_url=verified.get("picture"),
        )
        _ensure_user_quest_content(db, user.id)
        return _build_auth_payload_for_user(db, user)

    if provider == "telegram":
        if not init_data:
            raise HTTPException(status_code=400, detail="Telegram sign-in requires init_data")

        verified = _verify_telegram_init_data(init_data)
        user = _resolve_or_create_social_user(
            db,
            provider="telegram",
            provider_user_id=verified["telegram_user_id"],
            email=None,
            display_name=verified["display_name"],
            username=verified["username"],
            avatar_url=verified["avatar_url"],
        )
        _ensure_user_quest_content(db, user.id)
        return _build_auth_payload_for_user(db, user)

    raise HTTPException(status_code=501, detail=f"{provider_config['label']} sign-in will be connected next.")

