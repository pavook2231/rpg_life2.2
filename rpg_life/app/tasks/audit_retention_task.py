from datetime import timedelta

from app.core.celery_app import celery_app
from app.core.config import AUDIT_RETENTION_DAYS_DEFAULT
from app.core.dates import utc_now
from app.services import audit_service
from app.tasks._base import run_db_task


@celery_app.task(name="app.tasks.audit_retention_task.audit_retention_task")
def audit_retention_task():
    def _run(db):
        older_than = utc_now() - timedelta(days=max(1, int(AUDIT_RETENTION_DAYS_DEFAULT or 90)))
        result = audit_service.purge_audit_events(db, older_than=older_than)
        result["status"] = "audit_retention_purge"
        return result

    return run_db_task(_run)
