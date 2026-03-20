from app.core.cache import invalidate_leaderboard_cache, invalidate_profile_cache
from app.core.celery_app import celery_app
from app.services import engagement_service, social_service
from app.tasks._base import run_db_task


@celery_app.task(name="app.tasks.reward_distribution_task.reward_distribution_task")
def reward_distribution_task():
    def _run(db):
        state = {
            "coop_updated": social_service.resolve_coop_quests(db),
            "activity_reminders": engagement_service.queue_activity_reminders(db),
        }
        invalidate_leaderboard_cache()
        invalidate_profile_cache()
        return state

    return run_db_task(_run)
