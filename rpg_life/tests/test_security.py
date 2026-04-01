import asyncio
import json
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import auth
from app import crud
from app.api import dependencies
from app.core import config
from app.services import auth_service


class _FakeUrlopenResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def _request(*, headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request({"type": "http", "method": "POST", "headers": headers or []})


def test_verify_csrf_token_accepts_matching_cookie_and_header() -> None:
    request = _request(
        headers=[
            (b"cookie", b"access_token=demo; csrf_token=abc"),
            (b"x-csrf-token", b"abc"),
        ]
    )

    assert asyncio.run(dependencies.verify_csrf_token(request)) is True


def test_verify_csrf_token_rejects_cookie_auth_without_csrf_header() -> None:
    request = _request(headers=[(b"cookie", b"access_token=demo; csrf_token=abc")])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dependencies.verify_csrf_token(request))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Отсутствует CSRF-токен"


def test_verify_csrf_token_allows_bearer_auth_without_cookie_csrf() -> None:
    request = _request(headers=[(b"authorization", b"Bearer test-token")])

    assert asyncio.run(dependencies.verify_csrf_token(request)) is True


def test_require_admin_user_checks_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dependencies, "ADMIN_EMAILS", {"admin@example.com"})

    dependencies.require_admin_user(SimpleNamespace(email="admin@example.com"))

    with pytest.raises(HTTPException) as exc:
        dependencies.require_admin_user(SimpleNamespace(email="user@example.com"))

    assert exc.value.status_code == 403


def test_enforce_rate_limit_blocks_after_limit() -> None:
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
    )

    bucket = f"test-login-{uuid4().hex}"

    asyncio.run(dependencies.enforce_rate_limit(request, bucket=bucket, limit=2, window_seconds=60))
    asyncio.run(dependencies.enforce_rate_limit(request, bucket=bucket, limit=2, window_seconds=60))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dependencies.enforce_rate_limit(request, bucket=bucket, limit=2, window_seconds=60))

    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_recover_account_does_not_expose_user_existence(db_session) -> None:
    payload = auth_service.recover_account(db_session, "missing@example.com")

    assert payload["ok"] is True
    assert "email_sent" not in payload


def test_validate_runtime_config_rejects_auto_create_tables_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "AUTO_CREATE_TABLES", True)
    monkeypatch.setattr(config, "ALLOW_SQLITE_FALLBACK", False)
    monkeypatch.setattr(config, "SECRET_KEY", "x" * 32)
    monkeypatch.setattr(config, "COOKIE_SAMESITE", "lax")
    monkeypatch.setattr(config, "COOKIE_SECURE", True)

    with pytest.raises(RuntimeError, match="AUTO_CREATE_TABLES"):
        config.validate_runtime_config()


def test_validate_runtime_config_rejects_sqlite_fallback_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "AUTO_CREATE_TABLES", False)
    monkeypatch.setattr(config, "ALLOW_SQLITE_FALLBACK", True)
    monkeypatch.setattr(config, "SECRET_KEY", "x" * 32)
    monkeypatch.setattr(config, "COOKIE_SAMESITE", "lax")
    monkeypatch.setattr(config, "COOKIE_SECURE", True)

    with pytest.raises(RuntimeError, match="ALLOW_SQLITE_FALLBACK"):
        config.validate_runtime_config()


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("", ""),
        ("rpglife_auth_bot", "rpglife_auth_bot"),
        ("@rpglife_auth_bot", "rpglife_auth_bot"),
        ("https://t.me/rpglife_auth_bot", "rpglife_auth_bot"),
        ("telegram.me/RpgLifeAuthBot", "RpgLifeAuthBot"),
        ("rpglife", ""),
        ("https://example.com/rpglife_auth_bot", ""),
        ("bad-name-bot", ""),
    ],
)
def test_normalize_telegram_bot_username(raw_value: str, expected: str) -> None:
    assert config.normalize_telegram_bot_username(raw_value) == expected


def test_verify_google_id_token_accepts_any_configured_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_service, "GOOGLE_AUTH_ACCEPTED_CLIENT_IDS", ("android-client-id", "web-client-id"))
    monkeypatch.setattr(
        auth_service,
        "urlopen",
        lambda url, timeout=10: _FakeUrlopenResponse(
            {
                "aud": "android-client-id",
                "iss": "https://accounts.google.com",
                "email_verified": "true",
                "exp": "4102444800",
                "sub": "google-user-1",
            }
        ),
    )

    payload = auth_service._verify_google_id_token("demo-token")

    assert payload["aud"] == "android-client-id"


def test_verify_google_id_token_rejects_unconfigured_audience(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_service, "GOOGLE_AUTH_ACCEPTED_CLIENT_IDS", ("android-client-id",))
    monkeypatch.setattr(
        auth_service,
        "urlopen",
        lambda url, timeout=10: _FakeUrlopenResponse(
            {
                "aud": "unexpected-client-id",
                "iss": "https://accounts.google.com",
                "email_verified": "true",
                "exp": "4102444800",
                "sub": "google-user-2",
            }
        ),
    )

    with pytest.raises(HTTPException, match="audience mismatch"):
        auth_service._verify_google_id_token("demo-token")


def test_social_bridge_ticket_is_one_time() -> None:
    ticket = auth_service.issue_social_bridge_ticket({"provider": "vk", "ok": True})

    first_consume = auth_service.consume_social_bridge_ticket(ticket)
    second_consume = auth_service.consume_social_bridge_ticket(ticket)

    assert first_consume == {"provider": "vk", "ok": True}
    assert second_consume is None


def test_authenticate_social_mobile_accepts_google_bridge_ticket(db_session) -> None:
    ticket = auth_service.issue_social_bridge_ticket({"provider": "google", "ok": True})

    payload = auth_service.authenticate_social_mobile(db_session, "google", bridge_ticket=ticket)

    assert payload == {"provider": "google", "ok": True}


def test_get_social_auth_providers_includes_vk(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_service, "VK_AUTH_ENABLED", True)
    monkeypatch.setattr(auth_service, "VK_AUTH_APP_ID", "123456")

    providers = auth_service.get_social_auth_providers()
    vk_provider = next(item for item in providers if item["id"] == "vk")

    assert vk_provider["enabled"] is True
    assert vk_provider["configured"] is True
    assert vk_provider["mobile_client_id"] == "123456"


def test_refresh_token_rotation_revokes_previous_token(db_session) -> None:
    email = "refresh-rotate@example.com"
    password = "Password123"
    crud.create_user(
        db_session,
        email,
        password,
        "mage",
        name="Refresh Hero",
        birth_year=1995,
        gender="unspecified",
        goal_type="personal_development",
        goal_term_months=6,
    )

    auth_payload = auth_service.login_user_tokens(db_session, email, password)
    first_refresh = auth_payload["tokens"]["refresh_token"]
    rotated = auth_service.refresh_access_token(db_session, first_refresh)
    second_refresh = rotated["tokens"]["refresh_token"]

    assert second_refresh != first_refresh

    with pytest.raises(HTTPException) as exc:
        auth_service.refresh_access_token(db_session, first_refresh)

    assert exc.value.status_code == 401


def test_register_user_tokens_marks_goal_setup_as_required(db_session) -> None:
    payload = auth_service.register_user_tokens(
        db_session,
        auth_service.UserCreate(
            email="new-user@example.com",
            password="Password123",
            name="New Hero",
        ),
    )

    assert payload["needs_goal_setup"] is True


def test_authenticate_social_mobile_marks_new_google_user_for_goal_setup(
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_service, "GOOGLE_AUTH_ENABLED", True)
    monkeypatch.setattr(auth_service, "GOOGLE_AUTH_ACCEPTED_CLIENT_IDS", ("android-client-id",))
    monkeypatch.setattr(
        auth_service,
        "_verify_google_id_token",
        lambda _: {
            "sub": "google-new-user",
            "email": "social-new@example.com",
            "name": "Social Hero",
            "given_name": "socialhero",
            "picture": None,
        },
    )

    payload = auth_service.authenticate_social_mobile(db_session, "google", id_token="demo-token")

    assert payload["needs_goal_setup"] is True


def test_authenticate_user_rejects_inactive_user(db_session) -> None:
    email = "inactive-login@example.com"
    password = "Password123"
    user = crud.create_user(
        db_session,
        email,
        password,
        "mage",
        name="Inactive Hero",
        birth_year=1995,
        gender="unspecified",
        goal_type="lose",
        goal_term_months=6,
    )
    user.is_active = False
    db_session.commit()

    assert crud.authenticate_user(db_session, email, password) is None


def test_get_current_user_rejects_inactive_account(db_session) -> None:
    user = crud.create_user(
        db_session,
        "inactive-token@example.com",
        "Password123",
        "mage",
        name="Inactive Token Hero",
        birth_year=1993,
        gender="unspecified",
        goal_type="lose",
        goal_term_months=6,
    )
    token = auth.create_access_token({"sub": user.email})
    user.is_active = False
    db_session.commit()

    request = _request(headers=[(b"authorization", f"Bearer {token}".encode("utf-8"))])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.get_current_user(request, db_session))

    assert exc.value.status_code == 401


def test_refresh_access_token_rejects_inactive_user(db_session) -> None:
    email = "inactive-refresh@example.com"
    password = "Password123"
    user = crud.create_user(
        db_session,
        email,
        password,
        "mage",
        name="Inactive Refresh Hero",
        birth_year=1994,
        gender="unspecified",
        goal_type="lose",
        goal_term_months=6,
    )
    auth_payload = auth_service.login_user_tokens(db_session, email, password)
    refresh_token = auth_payload["tokens"]["refresh_token"]
    user.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException, match="Invalid refresh token"):
        auth_service.refresh_access_token(db_session, refresh_token)
