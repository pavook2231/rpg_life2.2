from app.core.cache import cache_delete_prefix
from app.core.celery_app import celery_app
from app.services import social_service
from app.tasks._base import run_db_task


@celery_app.task(name="app.tasks.world_events_task.world_events_task")
def world_events_task():
    def _run(db):
        updated = social_service.sync_game_events(db)
        cache_delete_prefix("events:")
        return {"updated_events": updated}

    return run_db_task(_run)
