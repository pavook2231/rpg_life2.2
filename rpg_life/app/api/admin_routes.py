from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import auth
from app.api.dependencies import enforce_rate_limit, require_admin_user
from app.core.audit import send_test_telegram_alert
from app.core.config import AUDIT_RETENTION_DAYS_DEFAULT
from app.core.dates import utc_now
from app.core.database import get_db
from app.models import User
from app.services import audit_service

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


@router.get("/audit/events")
async def list_audit_events(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int | None = Query(None, ge=1),
    user_email: str | None = Query(None, min_length=1, max_length=255),
    path: str | None = Query(None, min_length=1, max_length=255),
    method: str | None = Query(None, min_length=3, max_length=10),
    severity: str | None = Query(None, min_length=2, max_length=16),
    status_code: int | None = Query(None, ge=100, le=599),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    require_admin_user(current_user)
    await enforce_rate_limit(request, bucket="admin-audit-read", limit=60, window_seconds=60)
    return audit_service.list_audit_events(
        db,
        page=page,
        page_size=page_size,
        user_id=user_id,
        user_email=user_email,
        path=path,
        method=method,
        severity=severity,
        status_code=status_code,
        created_from=created_from,
        created_to=created_to,
    )


@router.get("/audit/events.csv")
async def export_audit_events_csv(
    request: Request,
    user_id: int | None = Query(None, ge=1),
    user_email: str | None = Query(None, min_length=1, max_length=255),
    path: str | None = Query(None, min_length=1, max_length=255),
    method: str | None = Query(None, min_length=3, max_length=10),
    severity: str | None = Query(None, min_length=2, max_length=16),
    status_code: int | None = Query(None, ge=100, le=599),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = Query(5000, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    require_admin_user(current_user)
    await enforce_rate_limit(request, bucket="admin-audit-read", limit=30, window_seconds=60)
    csv_data = audit_service.export_audit_events_csv(
        db,
        user_id=user_id,
        user_email=user_email,
        path=path,
        method=method,
        severity=severity,
        status_code=status_code,
        created_from=created_from,
        created_to=created_to,
        limit=limit,
    )
    filename = f"audit_events_{utc_now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/audit/events/purge")
async def purge_old_audit_events(
    request: Request,
    retention_days: int = Query(AUDIT_RETENTION_DAYS_DEFAULT, ge=1, le=3650),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    require_admin_user(current_user)
    await enforce_rate_limit(request, bucket="admin-audit-write", limit=10, window_seconds=60)
    older_than = utc_now() - timedelta(days=retention_days)
    return audit_service.purge_audit_events(db, older_than=older_than)


@router.post("/audit/alerts/test")
async def send_audit_test_alert(
    request: Request,
    current_user: User = Depends(auth.get_current_user),
):
    require_admin_user(current_user)
    await enforce_rate_limit(request, bucket="admin-audit-write", limit=10, window_seconds=60)
    return send_test_telegram_alert(requested_by=current_user.email)
