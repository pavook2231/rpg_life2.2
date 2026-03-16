from app import crud
from app.core.cache import cache_delete_prefix
from app.core.celery_app import celery_app
from app.tasks._base import run_db_task


@celery_app.task(name="app.tasks.daily_quests_task.daily_quests_task")
def daily_quests_task():
    def _run(db):
        crud.reset_daily_quests(db)
        cache_delete_prefix("profile:")
        cache_delete_prefix("leaderboard:")
        return {"status": "queued_daily_reset"}

    return run_db_task(_run)
