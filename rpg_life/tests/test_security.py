import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import crud
from app.api import dependencies
from app.core import config
from app.services import auth_service


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

    asyncio.run(dependencies.enforce_rate_limit(request, bucket="test-login", limit=2, window_seconds=60))
    asyncio.run(dependencies.enforce_rate_limit(request, bucket="test-login", limit=2, window_seconds=60))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dependencies.enforce_rate_limit(request, bucket="test-login", limit=2, window_seconds=60))

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
