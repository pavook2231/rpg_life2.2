from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import ApiAuditEvent

ALLOWED_SEVERITIES = {"info", "warning", "critical"}
ALLOWED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _safe_details(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {"raw": raw}
    return parsed if isinstance(parsed, dict) else {"raw": parsed}


def list_audit_events(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: int | None = None,
    user_email: str | None = None,
    path: str | None = None,
    method: str | None = None,
    severity: str | None = None,
    status_code: int | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> dict:
    query = db.query(ApiAuditEvent)

    if user_id is not None:
        query = query.filter(ApiAuditEvent.user_id == user_id)
    if user_email:
        query = query.filter(ApiAuditEvent.user_email.ilike(f"%{user_email.strip()}%"))
    if path:
        query = query.filter(ApiAuditEvent.path.ilike(f"%{path.strip()}%"))
    if method:
        normalized_method = method.strip().upper()
        if normalized_method in ALLOWED_METHODS:
            query = query.filter(ApiAuditEvent.method == normalized_method)
    if severity:
        normalized_severity = severity.strip().lower()
        if normalized_severity in ALLOWED_SEVERITIES:
            query = query.filter(ApiAuditEvent.severity == normalized_severity)
    if status_code is not None:
        query = query.filter(ApiAuditEvent.status_code == int(status_code))
    if created_from is not None:
        query = query.filter(ApiAuditEvent.created_at >= created_from)
    if created_to is not None:
        query = query.filter(ApiAuditEvent.created_at <= created_to)

    total = query.count()
    rows = (
        query.order_by(ApiAuditEvent.created_at.desc(), ApiAuditEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": row.id,
            "user_id": row.user_id,
            "user_email": row.user_email,
            "method": row.method,
            "path": row.path,
            "status_code": row.status_code,
            "severity": row.severity,
            "event_type": row.event_type,
            "reason": row.reason,
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
            "duration_ms": row.duration_ms,
            "details": _safe_details(row.details_json),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]
    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
    }


def export_audit_events_csv(
    db: Session,
    *,
    user_id: int | None = None,
    user_email: str | None = None,
    path: str | None = None,
    method: str | None = None,
    severity: str | None = None,
    status_code: int | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 5000,
) -> str:
    payload = list_audit_events(
        db,
        page=1,
        page_size=max(1, min(int(limit or 1), 10_000)),
        user_id=user_id,
        user_email=user_email,
        path=path,
        method=method,
        severity=severity,
        status_code=status_code,
        created_from=created_from,
        created_to=created_to,
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "created_at",
            "severity",
            "reason",
            "status_code",
            "method",
            "path",
            "user_id",
            "user_email",
            "ip_address",
            "duration_ms",
        ]
    )
    for row in payload["items"]:
        writer.writerow(
            [
                row["id"],
                row["created_at"],
                row["severity"],
                row["reason"] or "",
                row["status_code"],
                row["method"],
                row["path"],
                row["user_id"] or "",
                row["user_email"] or "",
                row["ip_address"] or "",
                row["duration_ms"] if row["duration_ms"] is not None else "",
            ]
        )
    return output.getvalue()


def purge_audit_events(db: Session, *, older_than: datetime) -> dict:
    deleted = (
        db.query(ApiAuditEvent)
        .filter(ApiAuditEvent.created_at < older_than)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": int(deleted), "older_than": older_than.isoformat()}
