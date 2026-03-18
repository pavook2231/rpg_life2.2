import asyncio

from fastapi import FastAPI
from starlette.requests import Request

from app import auth
from app.api import mobile_routes
from app.api.mobile_routes import router


def _request(path: str) -> Request:
    app = FastAPI()
    app.include_router(router)
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": [],
            "app": app,
            "router": app.router,
            "scheme": "https",
            "server": ("example.com", 443),
            "root_path": "",
            "query_string": b"",
        }
    )


def test_events_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/events")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_regenerate_today_quests_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/quests/regenerate-today")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_claim_weekly_goal_reward_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/rewards/weekly-goal/claim")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_claim_seasonal_goal_reward_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/rewards/seasonal-goal/claim")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_telegram_login_page_renders_widget_with_normalized_bot_username(monkeypatch) -> None:
    request = _request("/api/v1/auth/telegram/login")
    monkeypatch.setattr(mobile_routes, "TELEGRAM_AUTH_ENABLED", True)
    monkeypatch.setattr(mobile_routes, "TELEGRAM_BOT_USERNAME_RAW", "@rpglife_auth_bot")
    monkeypatch.setattr(mobile_routes, "TELEGRAM_BOT_USERNAME", "rpglife_auth_bot")
    monkeypatch.setattr(mobile_routes, "SOCIAL_AUTH_REDIRECT_SCHEME", "rpglife")

    response = asyncio.run(mobile_routes.auth_telegram_login_page(request))
    body = response.body.decode("utf-8")

    assert response.status_code == 200
    assert 'data-telegram-login="rpglife_auth_bot"' in body
    assert "rpglife://auth/telegram" in body


def test_telegram_login_page_rejects_invalid_bot_username(monkeypatch) -> None:
    request = _request("/api/v1/auth/telegram/login")
    monkeypatch.setattr(mobile_routes, "TELEGRAM_AUTH_ENABLED", True)
    monkeypatch.setattr(mobile_routes, "TELEGRAM_BOT_USERNAME_RAW", "https://example.com/not-a-bot")
    monkeypatch.setattr(mobile_routes, "TELEGRAM_BOT_USERNAME", "")
    monkeypatch.setattr(mobile_routes, "SOCIAL_AUTH_REDIRECT_SCHEME", "rpglife")

    response = asyncio.run(mobile_routes.auth_telegram_login_page(request))
    body = response.body.decode("utf-8")

    assert response.status_code == 503
    assert "invalid format" in body
    assert "data-telegram-login" not in body


def test_vk_login_page_sets_signed_cookie_and_renders_fallback_link(monkeypatch) -> None:
    request = _request("/api/v1/auth/vk/login")
    monkeypatch.setattr(mobile_routes, "VK_AUTH_ENABLED", True)
    monkeypatch.setattr(mobile_routes, "VK_AUTH_APP_ID", "123456")
    monkeypatch.setattr(mobile_routes, "VK_AUTH_MAX_AGE_SECONDS", 900)
    monkeypatch.setattr(mobile_routes, "COOKIE_SECURE", False)
    monkeypatch.setattr(mobile_routes, "COOKIE_SAMESITE", "lax")
    monkeypatch.setattr(
        mobile_routes.auth_service,
        "create_vk_browser_login",
        lambda redirect_uri: {
            "state": "demo-state",
            "code_verifier": "demo-verifier",
            "authorize_url": "https://id.vk.com/authorize?client_id=123456",
        },
    )

    response = asyncio.run(mobile_routes.auth_vk_login_page(request))
    body = response.body.decode("utf-8")

    assert response.status_code == 200
    assert "Переходим в VK ID" in body
    assert "https://id.vk.com/authorize?client_id=123456" in body
    assert "vk_oauth_flow=" in response.headers.get("set-cookie", "")


def test_vk_callback_redirects_to_error_when_cookie_is_missing() -> None:
    request = _request("/api/v1/auth/vk/callback")

    response = asyncio.run(
        mobile_routes.auth_vk_callback(
            request,
            code="demo-code",
            state="demo-state",
            device_id="demo-device",
            error=None,
            error_description=None,
            db=None,
        )
    )

    assert response.status_code == 302
    assert response.headers["location"] == "rpglife://auth/vk?error=vk_auth_cookie_missing"
