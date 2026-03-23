from app.tasks.challenge_result_task import challenge_result_task
from app.tasks.daily_quests_task import daily_quests_task
from app.tasks.notification_dispatch_task import notification_dispatch_task
from app.tasks.reward_distribution_task import reward_distribution_task
from app.tasks.world_events_task import world_events_task
from app.tasks.audit_retention_task import audit_retention_task


def enqueue_daily_quests():
    return daily_quests_task.delay()


def enqueue_challenge_results():
    return challenge_result_task.delay()


def enqueue_world_events():
    return world_events_task.delay()


def enqueue_reward_distribution():
    return reward_distribution_task.delay()


def enqueue_notification_dispatch():
    return notification_dispatch_task.delay()


def enqueue_audit_retention():
    return audit_retention_task.delay()
