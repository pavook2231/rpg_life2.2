import asyncio
import json

import pytest

from app import auth
from app.api import mobile_routes
from app.api.mobile_routes import router
from app.core import request_ip
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


def test_leaderboard_me_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/leaderboard/me")


def test_public_user_profile_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/users/{user_id}/profile")


def test_items_catalog_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/items")


def test_current_user_items_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/users/me/items")


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


def test_leaderboard_friends_alias_forwards_scope_to_service(monkeypatch) -> None:
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
        mobile_routes.get_friends_leaderboard(
            metric="power",
            period="all_time",
            page=3,
            limit=12,
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
        "metric": "power",
        "page": 3,
        "limit": 12,
        "period": "all_time",
    }
    assert body["status"] == "success"


def test_leaderboard_me_route_forwards_scope_to_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get_leaderboard_me(db, current_user, scope, metric, period):
        captured.update({
            "db": db,
            "current_user": current_user,
            "scope": scope,
            "metric": metric,
            "period": period,
        })
        return {"scope": scope, "metric": metric, "item": {"user_id": 4, "rank": 9, "score": 1200}}

    monkeypatch.setattr(mobile_routes.mobile_service, "get_leaderboard_me", fake_get_leaderboard_me)

    response = asyncio.run(
        mobile_routes.get_leaderboard_me(
            scope="friends",
            metric="power",
            period="all_time",
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
        "metric": "power",
        "period": "all_time",
    }
    assert body["data"]["item"]["rank"] == 9


def test_public_user_profile_route_forwards_user_id_to_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get_public_user_profile(db, current_user, user_id):
        captured.update({
            "db": db,
            "current_user": current_user,
            "user_id": user_id,
        })
        return {"user": {"id": user_id}, "has_character": True}

    monkeypatch.setattr(mobile_routes.mobile_service, "get_public_user_profile", fake_get_public_user_profile)

    response = asyncio.run(
        mobile_routes.get_public_user_profile(
            user_id=42,
            db="demo-db",
            current_user="demo-user",
        )
    )
    body = json.loads(response.body.decode("utf-8"))

    assert response.status_code == 200
    assert captured == {
        "db": "demo-db",
        "current_user": "demo-user",
        "user_id": 42,
    }
    assert body["data"]["user"]["id"] == 42


def test_items_catalog_route_forwards_to_mobile_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get_items_catalog(db, current_user):
        captured["db"] = db
        captured["current_user"] = current_user
        return {"items": [], "character_level": 1}

    monkeypatch.setattr(mobile_routes.mobile_service, "get_items_catalog", fake_get_items_catalog)

    response = asyncio.run(mobile_routes.get_items_catalog(db="demo-db", current_user="demo-user"))
    body = json.loads(response.body.decode("utf-8"))

    assert captured == {"db": "demo-db", "current_user": "demo-user"}
    assert response.status_code == 200
    assert body["status"] == "success"


def test_current_user_items_route_forwards_pagination_to_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_get_user_items(db, current_user, page, limit, sort):
        captured.update({
            "db": db,
            "current_user": current_user,
            "page": page,
            "limit": limit,
            "sort": sort,
        })
        return {"items": [], "pagination": {"page": page, "limit": limit, "total_items": 0, "total_pages": 1}}

    monkeypatch.setattr(mobile_routes.mobile_service, "get_user_items", fake_get_user_items)

    response = asyncio.run(
        mobile_routes.get_current_user_items(page=2, limit=15, sort="id", db="demo-db", current_user="demo-user")
    )
    body = json.loads(response.body.decode("utf-8"))

    assert captured == {
        "db": "demo-db",
        "current_user": "demo-user",
        "page": 2,
        "limit": 15,
        "sort": "id",
    }
    assert response.status_code == 200
    assert body["data"]["pagination"]["page"] == 2


def test_items_buy_alias_forwards_item_id_to_mobile_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_buy_catalog_item(db, current_user, item_id, target_inventory_id, client_request_id):
        captured.update({
            "db": db,
            "current_user": current_user,
            "item_id": item_id,
            "target_inventory_id": target_inventory_id,
            "client_request_id": client_request_id,
        })
        return {"ok": True, "kind": "item"}

    monkeypatch.setattr(mobile_routes.mobile_service, "buy_catalog_item", fake_buy_catalog_item)

    response = asyncio.run(
        mobile_routes.buy_item_alias(
            payload=mobile_routes.ShopPurchaseSchema(item_id=205),
            db="demo-db",
            current_user="demo-user",
        )
    )
    body = json.loads(response.body.decode("utf-8"))

    assert captured == {
        "db": "demo-db",
        "current_user": "demo-user",
        "item_id": 205,
        "target_inventory_id": None,
        "client_request_id": None,
    }
    assert response.status_code == 200
    assert body["data"]["ok"] is True


def test_shop_buy_rate_limit_uses_separate_buckets_for_special_catalogs() -> None:
    assert mobile_routes._resolve_shop_buy_rate_limit(-9201)[0] == "mobile-shop-buy-scroll"
    assert mobile_routes._resolve_shop_buy_rate_limit(-9301)[0] == "mobile-shop-buy-contract"
    assert mobile_routes._resolve_shop_buy_rate_limit(-9401)[0] == "mobile-shop-buy-enchant"
    assert mobile_routes._resolve_shop_buy_rate_limit(205)[0] == "mobile-shop-buy"


def test_items_equip_alias_forwards_payload_to_mobile_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_equip_user_item(db, current_user, inventory_id, slot, class_progress_id):
        captured.update({
            "db": db,
            "current_user": current_user,
            "inventory_id": inventory_id,
            "slot": slot,
            "class_progress_id": class_progress_id,
        })
        return {"ok": True}

    monkeypatch.setattr(mobile_routes.mobile_service, "equip_user_item", fake_equip_user_item)

    response = asyncio.run(
        mobile_routes.equip_item_alias(
            payload=mobile_routes.InventoryActionSchema(inventory_id=12, slot="main_hand", class_progress_id=7),
            db="demo-db",
            current_user="demo-user",
        )
    )
    body = json.loads(response.body.decode("utf-8"))

    assert captured == {
        "db": "demo-db",
        "current_user": "demo-user",
        "inventory_id": 12,
        "slot": "main_hand",
        "class_progress_id": 7,
    }
    assert response.status_code == 200
    assert body["data"]["ok"] is True


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


@pytest.mark.parametrize(
    ("path", "route_key"),
    [
        ("/api/v1/steps/sync", "steps"),
        ("/api/v1/program/anamnesis", "anamnesis"),
        ("/api/v1/items/buy", "buy_item"),
        ("/api/v1/rewards/daily-bonus/claim", "daily_bonus"),
        ("/api/v1/profile/update", "profile_update"),
    ],
)
def test_mobile_write_routes_verify_csrf(monkeypatch, path: str, route_key: str) -> None:
    request = build_request(router, path, method="POST")
    captured = {"csrf": 0}

    async def fake_verify_csrf(request_obj):
        captured["csrf"] += 1

    async def fake_enforce_rate_limit(request_obj, bucket, limit, window_seconds):
        return None

    monkeypatch.setattr(mobile_routes, "verify_csrf_token", fake_verify_csrf)
    monkeypatch.setattr(mobile_routes, "enforce_rate_limit", fake_enforce_rate_limit)

    if route_key == "steps":
        monkeypatch.setattr(mobile_routes.mobile_service, "sync_today_steps", lambda db, current_user, steps, day_started_at, source: {"ok": True})
        asyncio.run(
            mobile_routes.sync_steps(
                payload=mobile_routes.StepsSyncSchema(steps=6000, source="manual"),
                db="demo-db",
                current_user="demo-user",
                request=request,
            )
        )
    elif route_key == "anamnesis":
        monkeypatch.setattr(mobile_routes.weight_management_service, "submit_anamnesis", lambda db, current_user, **kwargs: {"ok": True})
        asyncio.run(
            mobile_routes.submit_program_anamnesis(
                payload=mobile_routes.WeightAnamnesisSchema(
                    sex="male",
                    height_cm=180,
                    weight_kg=85,
                    goal_type="lose",
                    daily_activity_level="light",
                    timezone_name="Europe/Moscow",
                ),
                db="demo-db",
                current_user="demo-user",
                request=request,
            )
        )
    elif route_key == "buy_item":
        monkeypatch.setattr(mobile_routes.mobile_service, "buy_catalog_item", lambda db, current_user, item_id, target_inventory_id, client_request_id: {"ok": True, "kind": "item"})
        asyncio.run(
            mobile_routes.buy_item_alias(
                payload=mobile_routes.ShopPurchaseSchema(item_id=205),
                db="demo-db",
                current_user="demo-user",
                request=request,
            )
        )
    elif route_key == "daily_bonus":
        monkeypatch.setattr(mobile_routes.quest_service, "claim_daily_bonus", lambda db, user_id: {"ok": True})
        asyncio.run(
            mobile_routes.claim_daily_bonus(
                db="demo-db",
                current_user=type("DemoUser", (), {"id": 7})(),
                request=request,
            )
        )
    else:
        monkeypatch.setattr(mobile_routes.character_service, "update_profile", lambda db, user_id, payload: {"ok": True})
        asyncio.run(
            mobile_routes.update_profile(
                payload=mobile_routes.ProfileUpdateSchema(name="Updated Hero"),
                db="demo-db",
                current_user=type("DemoUser", (), {"id": 7})(),
                request=request,
            )
        )

    assert captured["csrf"] == 1


@pytest.mark.parametrize(
    ("path", "route_key"),
    [
        ("/api/v1/profile", "profile"),
        ("/api/v1/bootstrap", "bootstrap"),
        ("/api/v1/quests/daily", "daily_quests"),
        ("/api/v1/goals/current", "current_goal"),
    ],
)
def test_mobile_stateful_get_routes_verify_csrf(monkeypatch, path: str, route_key: str) -> None:
    request = build_request(router, path, method="GET")
    captured = {"csrf": 0}

    async def fake_verify_csrf(request_obj):
        captured["csrf"] += 1

    monkeypatch.setattr(mobile_routes, "verify_csrf_token", fake_verify_csrf)

    if route_key == "profile":
        monkeypatch.setattr(mobile_routes.mobile_service, "get_profile", lambda db, current_user: {"ok": True})
        asyncio.run(
            mobile_routes.get_profile(
                request=request,
                db="demo-db",
                current_user="demo-user",
            )
        )
    elif route_key == "bootstrap":
        monkeypatch.setattr(mobile_routes.mobile_service, "get_bootstrap_payload", lambda db, current_user: {"ok": True})
        asyncio.run(
            mobile_routes.get_bootstrap(
                request=request,
                db="demo-db",
                current_user="demo-user",
            )
        )
    elif route_key == "daily_quests":
        monkeypatch.setattr(mobile_routes.mobile_service, "get_daily_quests", lambda db, current_user, page, limit, sort, bucket: {"items": []})
        asyncio.run(
            mobile_routes.get_daily_quests(
                request=request,
                db="demo-db",
                current_user="demo-user",
            )
        )
    else:
        monkeypatch.setattr(mobile_routes.quest_service, "get_goal_state", lambda db, current_user: {"ok": True})
        asyncio.run(
            mobile_routes.get_current_goal(
                request=request,
                db="demo-db",
                current_user="demo-user",
            )
        )

    assert captured["csrf"] == 1


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


def test_external_url_for_ignores_forwarded_proto_and_host_from_untrusted_peer(monkeypatch) -> None:
    monkeypatch.setattr(request_ip, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(request_ip, "TRUSTED_PROXY_IPS", {"10.0.0.1"})
    request = build_request(
        router,
        "/api/v1/auth/vk/login",
        headers=[
            (b"x-forwarded-proto", b"https"),
            (b"x-forwarded-host", b"rpglife.online"),
            (b"host", b"backend:8000"),
        ],
        client=("198.51.100.7", 12345),
    )

    assert mobile_routes._external_url_for(request, "auth_vk_callback") == "https://backend:8000/api/v1/auth/vk/callback"


def test_external_url_for_prefers_forwarded_proto_and_host_from_trusted_proxy(monkeypatch) -> None:
    monkeypatch.setattr(request_ip, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(request_ip, "TRUSTED_PROXY_IPS", {"10.0.0.1"})
    request = build_request(
        router,
        "/api/v1/auth/vk/login",
        headers=[
            (b"x-forwarded-proto", b"https"),
            (b"x-forwarded-host", b"rpglife.online"),
            (b"host", b"backend:8000"),
        ],
        client=("10.0.0.1", 12345),
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
