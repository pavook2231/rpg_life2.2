import asyncio

import pytest

from app import auth
from app.api import social_routes
from app.api.social_routes import router
from app.schemas.social_schema import FriendRequestRespondSchema
from tests.route_test_utils import build_request, dependency_calls_for

def test_search_users_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/social/friends/search")


def test_friends_alias_endpoint_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/social/friends")


def test_social_global_leaderboard_route_applies_rate_limit_and_period(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/social/leaderboard/global")
    current_user = type("DemoUser", (), {"id": 77})()

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket
        captured["limit"] = limit
        captured["window_seconds"] = window_seconds

    def fake_service(db, metric, page, page_size, period, current_user_id=None):
        captured["service"] = {
            "db": db,
            "metric": metric,
            "page": page,
            "page_size": page_size,
            "period": period,
            "current_user_id": current_user_id,
        }
        return {"metric": metric, "period": period, "items": []}

    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "get_global_leaderboard", fake_service)

    payload = asyncio.run(
        social_routes.get_global_leaderboard(
            request=request,
            metric="steps",
            period="season",
            page=3,
            page_size=25,
            db="demo-db",
            current_user=current_user,
        )
    )

    assert captured["bucket"] == "social-leaderboard"
    assert captured["limit"] == 60
    assert captured["window_seconds"] == 60
    assert captured["service"] == {
        "db": "demo-db",
        "metric": "steps",
        "page": 3,
        "page_size": 25,
        "period": "season",
        "current_user_id": 77,
    }
    assert payload["period"] == "season"


def test_social_friends_leaderboard_route_applies_rate_limit_and_period(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/social/leaderboard/friends")

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket
        captured["limit"] = limit
        captured["window_seconds"] = window_seconds

    def fake_service(db, current_user, metric, page, page_size, period):
        captured["service"] = {
            "db": db,
            "current_user": current_user,
            "metric": metric,
            "page": page,
            "page_size": page_size,
            "period": period,
        }
        return {"metric": metric, "period": period, "items": []}

    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "get_friends_leaderboard", fake_service)

    payload = asyncio.run(
        social_routes.get_friends_leaderboard(
            request=request,
            metric="challenge_wins",
            period="weekly",
            page=2,
            page_size=10,
            db="demo-db",
            current_user="demo-user",
        )
    )

    assert captured["bucket"] == "social-leaderboard"
    assert captured["limit"] == 60
    assert captured["window_seconds"] == 60
    assert captured["service"] == {
        "db": "demo-db",
        "current_user": "demo-user",
        "metric": "challenge_wins",
        "page": 2,
        "page_size": 10,
        "period": "weekly",
    }
    assert payload["period"] == "weekly"


def test_search_users_route_applies_friend_search_bucket(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/social/friends/search")

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket
        captured["limit"] = limit
        captured["window_seconds"] = window_seconds

    def fake_service(db, current_user, query, page, page_size):
        captured["service"] = {
            "db": db,
            "current_user": current_user,
            "query": query,
            "page": page,
            "page_size": page_size,
        }
        return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_items": 0, "total_pages": 1}}

    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "search_users", fake_service)

    payload = asyncio.run(
        social_routes.search_users(
            request=request,
            q="hero",
            page=4,
            page_size=12,
            db="demo-db",
            current_user="demo-user",
        )
    )

    assert captured["bucket"] == "social-friend-search"
    assert captured["limit"] == 20
    assert captured["window_seconds"] == 60
    assert captured["service"] == {
        "db": "demo-db",
        "current_user": "demo-user",
        "query": "hero",
        "page": 4,
        "page_size": 12,
    }
    assert payload["pagination"]["page"] == 4


def test_add_friend_route_uses_friend_request_bucket(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/social/friends/add")

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket
        captured["limit"] = limit
        captured["window_seconds"] = window_seconds

    def fake_service(db, current_user, receiver_id):
        captured["service"] = {
            "db": db,
            "current_user": current_user,
            "receiver_id": receiver_id,
        }
        return {"ok": True}

    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "send_friend_request", fake_service)

    payload = asyncio.run(
        social_routes.add_friend(
            request=request,
            payload=type("Payload", (), {"receiver_id": 77})(),
            db="demo-db",
            current_user="demo-user",
        )
    )

    assert captured["bucket"] == "social-friend-request"
    assert captured["service"] == {
        "db": "demo-db",
        "current_user": "demo-user",
        "receiver_id": 77,
    }
    assert payload["ok"] is True


def test_accept_friend_request_route_defaults_to_accept(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/social/friends/accept")

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket

    def fake_service(db, current_user, request_id, action):
        captured["service"] = {
            "db": db,
            "current_user": current_user,
            "request_id": request_id,
            "action": action,
        }
        return {"ok": True, "status": "accepted"}

    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "respond_friend_request", fake_service)

    payload = asyncio.run(
        social_routes.respond_friend_request(
            request=request,
            payload=FriendRequestRespondSchema(request_id=15),
            db="demo-db",
            current_user="demo-user",
        )
    )

    assert captured["bucket"] == "social-friend-response"
    assert captured["service"] == {
        "db": "demo-db",
        "current_user": "demo-user",
        "request_id": 15,
        "action": "accept",
    }
    assert payload["status"] == "accepted"


def test_decline_friend_request_route_forces_decline_action(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/social/friends/decline")

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket

    def fake_service(db, current_user, request_id, action):
        captured["service"] = {
            "db": db,
            "current_user": current_user,
            "request_id": request_id,
            "action": action,
        }
        return {"ok": True, "status": "declined"}

    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "respond_friend_request", fake_service)

    payload = asyncio.run(
        social_routes.decline_friend_request(
            request=request,
            payload=FriendRequestRespondSchema(request_id=21),
            db="demo-db",
            current_user="demo-user",
        )
    )

    assert captured["bucket"] == "social-friend-response"
    assert captured["service"] == {
        "db": "demo-db",
        "current_user": "demo-user",
        "request_id": 21,
        "action": "decline",
    }
    assert payload["status"] == "declined"


@pytest.mark.parametrize(
    ("path", "caller"),
    [
        (
            "/api/v1/social/friends/request",
            lambda request: social_routes.send_friend_request(
                request=request,
                payload=type("Payload", (), {"receiver_id": 9})(),
                db="demo-db",
                current_user="demo-user",
            ),
        ),
        (
            "/api/v1/social/challenge/create",
            lambda request: social_routes.create_pvp_challenge(
                request=request,
                payload=type("Payload", (), {})(),
                db="demo-db",
                current_user="demo-user",
            ),
        ),
        (
            "/api/v1/social/coop-quests/create",
            lambda request: social_routes.create_coop_quest(
                request=request,
                payload=type("Payload", (), {})(),
                db="demo-db",
                current_user="demo-user",
            ),
        ),
        (
            "/api/v1/social/challenges/invitations/respond",
            lambda request: social_routes.respond_challenge_invitation(
                request=request,
                payload=type("Payload", (), {"invitation_id": 4, "action": "accept"})(),
                db="demo-db",
                current_user="demo-user",
            ),
        ),
    ],
)
def test_social_write_routes_verify_csrf(monkeypatch, path, caller) -> None:
    captured: dict[str, int] = {"csrf": 0}
    request = build_request(router, path, method="POST")

    async def fake_verify_csrf(request_obj):
        captured["csrf"] += 1
        return True

    async def fake_rate_limit(*args, **kwargs):
        return None

    monkeypatch.setattr(social_routes, "verify_csrf_token", fake_verify_csrf)
    monkeypatch.setattr(social_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(social_routes.social_service, "send_friend_request", lambda *args, **kwargs: {"ok": True})
    monkeypatch.setattr(social_routes.beta_service, "create_challenge", lambda *args, **kwargs: {"ok": True})
    monkeypatch.setattr(social_routes.social_service, "create_coop_quest", lambda *args, **kwargs: {"ok": True})
    monkeypatch.setattr(
        social_routes.social_service,
        "respond_challenge_invitation",
        lambda *args, **kwargs: {"ok": True, "status": "accepted"},
    )

    payload = asyncio.run(caller(request))

    assert captured["csrf"] == 1
    assert payload["ok"] is True
