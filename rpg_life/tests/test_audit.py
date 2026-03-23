from starlette.requests import Request

from app.core import audit, security
from app.models import ApiAuditEvent, User


def _request(method: str, path: str, *, token: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = [(b"user-agent", b"pytest-audit")]
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 5111),
        "server": ("testserver", 80),
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def test_audit_api_write_request_persists_event_with_user(db_session) -> None:
    user = User(email="audit-user@example.com", hashed_password="hashed", is_active=True)
    db_session.add(user)
    db_session.commit()

    token = security.create_access_token({"sub": user.email})
    request = _request("POST", "/api/v1/items/buy", token=token)
    audit.audit_api_write_request(db_session, request=request, status_code=200, duration_ms=27)

    event = db_session.query(ApiAuditEvent).order_by(ApiAuditEvent.id.desc()).first()
    assert event is not None
    assert event.user_id == user.id
    assert event.method == "POST"
    assert event.path == "/api/v1/items/buy"
    assert event.status_code == 200
    assert event.severity == "info"


def test_audit_api_write_request_flags_failure_burst(db_session) -> None:
    request = _request("POST", "/api/v1/steps/sync")
    for _ in range(5):
        audit.audit_api_write_request(db_session, request=request, status_code=400, duration_ms=12)

    event = db_session.query(ApiAuditEvent).order_by(ApiAuditEvent.id.desc()).first()
    assert event is not None
    assert event.severity == "warning"
    assert event.reason == "failure_burst"


def test_audit_api_write_request_ignores_non_write_methods(db_session) -> None:
    request = _request("GET", "/api/v1/items")
    audit.audit_api_write_request(db_session, request=request, status_code=200, duration_ms=5)

    assert db_session.query(ApiAuditEvent).count() == 0


def test_audit_api_write_request_triggers_alert_hook_for_warning(monkeypatch, db_session) -> None:
    request = _request("POST", "/api/v1/items/buy")
    sent: list[str] = []

    monkeypatch.setattr(audit, "_maybe_send_telegram_alert", lambda **kwargs: sent.append(kwargs.get("severity", "")))

    audit.audit_api_write_request(db_session, request=request, status_code=400, duration_ms=11)

    assert sent == ["warning"]


def test_send_test_telegram_alert_reports_disabled(monkeypatch) -> None:
    monkeypatch.setattr(audit, "TELEGRAM_AUDIT_ALERTS_ENABLED", False)

    payload = audit.send_test_telegram_alert(requested_by="admin@example.com")

    assert payload["ok"] is False
    assert payload["message"] == "Telegram audit alerts are disabled"
