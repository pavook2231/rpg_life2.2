from __future__ import annotations

import json
import logging
import threading
from collections import defaultdict, deque
from datetime import datetime, timedelta
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core import security
from app.core.config import TELEGRAM_AUDIT_ALERTS_ENABLED, TELEGRAM_AUDIT_BOT_TOKEN, TELEGRAM_AUDIT_CHAT_ID
from app.core.dates import utc_now
from app.core.request_ip import get_client_ip
from app.models import ApiAuditEvent, User

logger = logging.getLogger(__name__)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SENSITIVE_PATH_PREFIXES = (
    "/api/v1/steps/",
    "/api/v1/quests/",
    "/api/v1/shop/",
    "/api/v1/items/",
    "/api/v1/inventory/",
    "/api/v1/friends/",
    "/api/v1/social/",
    "/api/v1/challenges/",
)
EXPECTED_VALIDATION_WRITE_PATHS = {
    "/api/v1/items/equip",
    "/api/v1/inventory/equip",
    "/api/v1/inventory/unequip",
}
SUSPICIOUS_WINDOW_SECONDS = 60
SUSPICIOUS_FAILURE_THRESHOLD = 5


class _FailureBurstTracker:
    def __init__(self) -> None:
        self._events: dict[str, deque[datetime]] = defaultdict(deque)
        self._lock = threading.Lock()

    def record_failure(self, key: str, now: datetime, window_seconds: int = SUSPICIOUS_WINDOW_SECONDS) -> int:
        window_start = now - timedelta(seconds=window_seconds)
        with self._lock:
            queue = self._events[key]
            queue.append(now)
            while queue and queue[0] < window_start:
                queue.popleft()
            return len(queue)


_failure_tracker = _FailureBurstTracker()
_alert_sent_at: dict[str, datetime] = {}
_alert_lock = threading.Lock()


def _client_ip(request: Request) -> str | None:
    client_ip = get_client_ip(request)
    return None if client_ip == "unknown" else client_ip


def _resolve_user_identity(db: Session, request: Request) -> tuple[int | None, str | None]:
    token = security.get_token_from_request(request)
    if not token:
        return None, None
    payload = security.decode_token(token)
    if not payload or not security.validate_token_type(payload, "access"):
        return None, None
    email = payload.get("sub")
    if not email:
        return None, None
    user = db.query(User.id, User.email).filter(User.email == email).first()
    if not user:
        return None, str(email)
    return int(user.id), str(user.email)


def _send_telegram_alert(message: str) -> None:
    if not (TELEGRAM_AUDIT_ALERTS_ENABLED and TELEGRAM_AUDIT_BOT_TOKEN and TELEGRAM_AUDIT_CHAT_ID):
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_AUDIT_BOT_TOKEN}/sendMessage"
    payload = urllib_parse.urlencode(
        {
            "chat_id": TELEGRAM_AUDIT_CHAT_ID,
            "text": message[:3900],
            "disable_web_page_preview": "true",
        }
    ).encode("utf-8")
    req = urllib_request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib_request.urlopen(req, timeout=5) as response:
        response.read()


def send_test_telegram_alert(*, requested_by: str | None = None) -> dict:
    if not TELEGRAM_AUDIT_ALERTS_ENABLED:
        return {"ok": False, "message": "Telegram audit alerts are disabled"}
    if not TELEGRAM_AUDIT_BOT_TOKEN or not TELEGRAM_AUDIT_CHAT_ID:
        return {"ok": False, "message": "Telegram audit bot token or chat id is not configured"}

    now = utc_now()
    message = (
        "RPG Life audit test alert\n"
        f"requested_by: {requested_by or '-'}\n"
        f"time: {now.isoformat()}"
    )
    _send_telegram_alert(message)
    return {"ok": True, "message": "Test alert sent", "sent_at": now.isoformat()}


def _maybe_send_telegram_alert(
    *,
    method: str,
    path: str,
    status_code: int,
    severity: str,
    reason: str | None,
    user_id: int | None,
    ip_address: str | None,
) -> None:
    if severity not in {"warning", "critical"}:
        return
    alert_key = f"{severity}:{reason or 'none'}:{method}:{path}:{status_code}"
    now = utc_now()
    with _alert_lock:
        last_sent = _alert_sent_at.get(alert_key)
        if last_sent and now - last_sent < timedelta(seconds=60):
            return
        _alert_sent_at[alert_key] = now
    message = (
        "RPG Life audit alert\n"
        f"severity: {severity}\n"
        f"reason: {reason or '-'}\n"
        f"method: {method}\n"
        f"path: {path}\n"
        f"status: {status_code}\n"
        f"user_id: {user_id or '-'}\n"
        f"ip: {ip_address or '-'}\n"
        f"time: {now.isoformat()}"
    )
    try:
        _send_telegram_alert(message)
    except Exception:
        logger.exception("Failed to send Telegram audit alert")


def classify_write_event(
    *,
    method: str,
    path: str,
    status_code: int,
    failure_burst_count: int,
) -> tuple[str, str | None]:
    if status_code >= 500:
        return "critical", "server_error_on_write"
    if status_code >= 400:
        if failure_burst_count >= SUSPICIOUS_FAILURE_THRESHOLD:
            return "warning", "failure_burst"
        if method in WRITE_METHODS and status_code == 400 and path in EXPECTED_VALIDATION_WRITE_PATHS:
            return "info", "validation_rejected"
        if path.startswith(SENSITIVE_PATH_PREFIXES):
            return "warning", "sensitive_write_rejected"
        return "info", "write_rejected"
    if status_code in {200, 201, 202, 204} and method in WRITE_METHODS:
        return "info", None
    return "info", None


def record_api_write_event(
    db: Session,
    *,
    user_id: int | None,
    user_email: str | None,
    method: str,
    path: str,
    status_code: int,
    ip_address: str | None,
    user_agent: str | None,
    duration_ms: int | None,
    severity: str,
    reason: str | None,
    event_type: str = "api_write",
    details: dict | None = None,
) -> ApiAuditEvent:
    event = ApiAuditEvent(
        user_id=user_id,
        user_email=user_email,
        method=method.upper(),
        path=path,
        status_code=int(status_code),
        severity=severity,
        event_type=event_type or "api_write",
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        duration_ms=duration_ms,
        details_json=json.dumps(details or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def audit_api_write_request(
    db: Session,
    *,
    request: Request,
    status_code: int,
    duration_ms: int | None,
) -> None:
    method = request.method.upper()
    path = request.url.path
    if method not in WRITE_METHODS or not path.startswith("/api/"):
        return

    user_id, user_email = _resolve_user_identity(db, request)
    now = utc_now()
    failure_burst_count = 0
    if status_code >= 400:
        marker = str(user_id or user_email or _client_ip(request) or "anonymous")
        failure_burst_count = _failure_tracker.record_failure(f"{marker}:{path}:{method}", now)
    severity, reason = classify_write_event(
        method=method,
        path=path,
        status_code=status_code,
        failure_burst_count=failure_burst_count,
    )

    state_details = getattr(request.state, "audit_details", None)
    details = {}
    if failure_burst_count:
        details["failure_burst_count"] = failure_burst_count
    if isinstance(state_details, dict):
        details.update({key: value for key, value in state_details.items() if key != "event_type"})
    event_type = "api_write"
    if isinstance(state_details, dict):
        candidate_event_type = state_details.get("event_type")
        if isinstance(candidate_event_type, str) and candidate_event_type.strip():
            event_type = candidate_event_type.strip()[:64]

    record_api_write_event(
        db,
        user_id=user_id,
        user_email=user_email,
        method=method,
        path=path,
        status_code=status_code,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        duration_ms=duration_ms,
        severity=severity,
        reason=reason,
        event_type=event_type,
        details=details,
    )

    if severity in {"warning", "critical"}:
        logger.warning(
            "API write audit alert: method=%s path=%s status=%s user_id=%s reason=%s burst=%s",
            method,
            path,
            status_code,
            user_id,
            reason,
            failure_burst_count,
        )
        _maybe_send_telegram_alert(
            method=method,
            path=path,
            status_code=status_code,
            severity=severity,
            reason=reason,
            user_id=user_id,
            ip_address=_client_ip(request),
        )
