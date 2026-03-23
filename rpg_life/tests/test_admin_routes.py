import asyncio

from app import auth
from app.api import admin_routes
from app.api.admin_routes import router
from tests.route_test_utils import build_request, dependency_calls_for


def test_admin_audit_route_requires_authenticated_user() -> None:
    assert auth.get_current_user in dependency_calls_for(router, "/api/v1/admin/audit/events")


def test_admin_audit_route_applies_admin_guard_and_rate_limit(monkeypatch) -> None:
    captured: dict[str, object] = {}
    request = build_request(router, "/api/v1/admin/audit/events")
    current_user = type("DemoUser", (), {"email": "admin@example.com"})()

    def fake_require_admin(user):
        captured["admin"] = user.email

    async def fake_rate_limit(request_obj, bucket, limit, window_seconds):
        captured["bucket"] = bucket
        captured["limit"] = limit
        captured["window_seconds"] = window_seconds

    def fake_list(db, **kwargs):
        captured["service"] = {"db": db, **kwargs}
        return {"items": [], "pagination": {"page": kwargs["page"], "page_size": kwargs["page_size"], "total_items": 0, "total_pages": 1}}

    monkeypatch.setattr(admin_routes, "require_admin_user", fake_require_admin)
    monkeypatch.setattr(admin_routes, "enforce_rate_limit", fake_rate_limit)
    monkeypatch.setattr(admin_routes.audit_service, "list_audit_events", fake_list)

    payload = asyncio.run(
        admin_routes.list_audit_events(
            request=request,
            page=2,
            page_size=25,
            path="/api/v1/items",
            severity="warning",
            db="demo-db",
            current_user=current_user,
        )
    )

    assert captured["admin"] == "admin@example.com"
    assert captured["bucket"] == "admin-audit-read"
    assert captured["limit"] == 60
    assert captured["window_seconds"] == 60
    assert captured["service"]["db"] == "demo-db"
    assert captured["service"]["page"] == 2
    assert captured["service"]["page_size"] == 25
    assert captured["service"]["path"] == "/api/v1/items"
    assert captured["service"]["severity"] == "warning"
    assert payload["pagination"]["page"] == 2
