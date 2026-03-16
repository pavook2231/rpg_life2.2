from app.core.celery_app import celery_app
from app.services import notification_service
from app.tasks._base import run_db_task


@celery_app.task(name="app.tasks.notification_dispatch_task.notification_dispatch_task")
def notification_dispatch_task():
    return run_db_task(notification_service.dispatch_pending_notifications)
