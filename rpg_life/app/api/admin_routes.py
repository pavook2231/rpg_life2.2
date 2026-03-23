from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app import auth
from app.api.dependencies import enforce_rate_limit, require_admin_user
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
