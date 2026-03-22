import asyncio
import json

from app import auth
from app.api import mobile_routes
from app.api.mobile_routes import router
from tests.route_test_utils import build_request, dependency_calls_for


def test_events_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/events")


def test_regenerate_today_quests_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/quests/regenerate-today")


def test_claim_weekly_goal_reward_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/rewards/weekly-goal/claim")


def test_claim_seasonal_goal_reward_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/rewards/seasonal-goal/claim")


def test_leaderboard_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/leaderboard")


def test_leaderboard_endpoint_forwards_period_to_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get_leaderboard(db, current_user, scope, metric, page, limit, period):
        captured.update({
            "db": db,
            "current_user": current_user,
            "scope": scope,
            "metric": metric,
            "page": page,
            "limit": limit,
            "period": period,
        })
        return {"metric": metric, "period": period, "items": []}

    monkeypatch.setattr(mobile_routes.mobile_service, "get_leaderboard", fake_get_leaderboard)

    response = asyncio.run(
        mobile_routes.get_leaderboard(
            scope="friends",
            metric="steps",
            period="weekly",
            page=2,
            limit=15,
            db="demo-db",
            current_user="demo-user",
        )
    )
    body = json.loads(response.body.decode("utf-8"))

    assert response.status_code == 200
    assert captured == {
        "db": "demo-db",
        "current_user": "demo-user",
        "scope": "friends",
        "metric": "steps",
        "page": 2,
        "limit": 15,
        "period": "weekly",
    }
    assert body["status"] == "success"
    assert body["data"]["period"] == "weekly"


def test_auth_logout_route_uses_rate_limit_and_service(monkeypatch) -> None:
    request = build_request(router, "/api/v1/auth/logout")
    captured: dict[str, object] = {}

    async def fake_enforce_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket
        captured["limit"] = limit
        captured["window_seconds"] = window_seconds

    def fake_logout_mobile_session(db, refresh_token):
        captured["db"] = db
        captured["refresh_token"] = refresh_token
        return {"ok": True}

    monkeypatch.setattr(mobile_routes, "enforce_rate_limit", fake_enforce_rate_limit)
    monkeypatch.setattr(mobile_routes.auth_service, "logout_mobile_session", fake_logout_mobile_session)

    response = asyncio.run(
        mobile_routes.auth_logout(
            request=request,
            payload=mobile_routes.RefreshTokenSchema(refresh_token="refresh-demo"),
            db="demo-db",
        )
    )
    body = json.loads(response.body.decode("utf-8"))

    assert captured == {
        "bucket": "mobile-logout",
        "limit": 20,
        "window_seconds": 300,
        "db": "demo-db",
        "refresh_token": "refresh-demo",
    }
    assert response.status_code == 200
    assert body["status"] == "success"
    assert body["data"]["ok"] is True


def test_telegram_login_page_renders_widget_with_normalized_bot_username(monkeypatch) -> None:
    request = build_request(router, "/api/v1/auth/telegram/login")
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
    request = build_request(router, "/api/v1/auth/telegram/login")
    monkeypatch.setattr(mobile_routes, "TELEGRAM_AUTH_ENABLED", True)
    monkeypatch.setattr(mobile_routes, "TELEGRAM_BOT_USERNAME_RAW", "https://example.com/not-a-bot")
    monkeypatch.setattr(mobile_routes, "TELEGRAM_BOT_USERNAME", "")
    monkeypatch.setattr(mobile_routes, "SOCIAL_AUTH_REDIRECT_SCHEME", "rpglife")

    response = asyncio.run(mobile_routes.auth_telegram_login_page(request))
    body = response.body.decode("utf-8")

    assert response.status_code == 503
    assert "invalid format" in body
    assert "data-telegram-login" not in body


def test_google_login_page_sets_signed_cookie_and_renders_fallback_link(monkeypatch) -> None:
    request = build_request(router, "/api/v1/auth/google/login")
    monkeypatch.setattr(mobile_routes, "GOOGLE_AUTH_ENABLED", True)
    monkeypatch.setattr(mobile_routes, "GOOGLE_AUTH_WEB_CLIENT_ID", "web-client-id")
    monkeypatch.setattr(mobile_routes, "GOOGLE_AUTH_CLIENT_SECRET", "top-secret")
    monkeypatch.setattr(mobile_routes, "GOOGLE_AUTH_MAX_AGE_SECONDS", 900)
    monkeypatch.setattr(mobile_routes, "COOKIE_SECURE", False)
    monkeypatch.setattr(mobile_routes, "COOKIE_SAMESITE", "lax")
    monkeypatch.setattr(
        mobile_routes.auth_service,
        "create_google_browser_login",
        lambda redirect_uri: {
            "state": "demo-state",
            "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=web-client-id",
        },
    )

    response = asyncio.run(mobile_routes.auth_google_login_page(request))
    body = response.body.decode("utf-8")

    assert response.status_code == 200
    assert "Google" in body
    assert "https://accounts.google.com/o/oauth2/v2/auth?client_id=web-client-id" in body
    assert "google_oauth_flow=" in response.headers.get("set-cookie", "")


def test_google_callback_redirects_to_error_when_cookie_is_missing() -> None:
    request = build_request(router, "/api/v1/auth/google/callback")

    response = asyncio.run(
        mobile_routes.auth_google_callback(
            request,
            code="demo-code",
            state="demo-state",
            error=None,
            error_description=None,
            db=None,
        )
    )

    assert response.status_code == 302
    assert response.headers["location"] == "rpglife://auth/google?error=google_auth_cookie_missing"


def test_vk_login_page_sets_signed_cookie_and_renders_fallback_link(monkeypatch) -> None:
    request = build_request(router, "/api/v1/auth/vk/login")
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
    request = build_request(router, "/api/v1/auth/vk/callback")

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


def test_external_url_for_prefers_forwarded_proto_and_host() -> None:
    request = build_request(
        router,
        "/api/v1/auth/vk/login",
        headers=[
            (b"x-forwarded-proto", b"https"),
            (b"x-forwarded-host", b"rpglife.online"),
            (b"host", b"backend:8000"),
        ],
    )

    assert mobile_routes._external_url_for(request, "auth_vk_callback") == "https://rpglife.online/api/v1/auth/vk/callback"


def test_external_url_for_prefers_public_base_url(monkeypatch) -> None:
    request = build_request(
        router,
        "/api/v1/auth/vk/login",
        headers=[
            (b"x-forwarded-proto", b"http"),
            (b"x-forwarded-host", b"backend.local"),
            (b"host", b"backend:8000"),
        ],
    )
    monkeypatch.setattr(mobile_routes, "PUBLIC_BASE_URL", "https://rpglife.online")

    assert mobile_routes._external_url_for(request, "auth_vk_callback") == "https://rpglife.online/api/v1/auth/vk/callback"
