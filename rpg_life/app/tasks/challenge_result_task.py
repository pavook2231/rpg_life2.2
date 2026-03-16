from app import crud
from app.core.cache import cache_delete_prefix
from app.core.celery_app import celery_app
from app.services import social_service
from app.tasks._base import run_db_task


@celery_app.task(name="app.tasks.challenge_result_task.challenge_result_task")
def challenge_result_task():
    def _run(db):
        classic = crud.resolve_due_challenges(db)
        social = social_service.resolve_pvp_challenges(db)
        cache_delete_prefix("leaderboard:")
        cache_delete_prefix("events:")
        return {"classic_challenges": classic, "pvp_challenges": social}

    return run_db_task(_run)
