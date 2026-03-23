try:
    from celery import Celery
    from celery.schedules import crontab
except Exception:  # pragma: no cover
    Celery = None
    crontab = None

from app.core.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND


class _EagerTask:
    def __init__(self, fn):
        self.fn = fn
        self.__name__ = getattr(fn, "__name__", "task")

    def __call__(self, *args, **kwargs):
        return self.fn(*args, **kwargs)

    def delay(self, *args, **kwargs):
        return self.fn(*args, **kwargs)


class _FallbackCelery:
    def __init__(self):
        self.main = "rpg_life_fallback"
        self.conf = type("Config", (), {"beat_schedule": {}})()

    def task(self, *args, **kwargs):
        def decorator(fn):
            return _EagerTask(fn)

        return decorator

    def autodiscover_tasks(self, packages):
        return packages


if Celery:
    celery_app = Celery(
        "rpg_life",
        broker=CELERY_BROKER_URL,
        backend=CELERY_RESULT_BACKEND,
    )

    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        worker_prefetch_multiplier=1,
        beat_schedule={
            "daily-quests-reset": {
                "task": "app.tasks.daily_quests_task.daily_quests_task",
                "schedule": crontab(hour=0, minute=0),
            },
            "challenge-result-resolution": {
                "task": "app.tasks.challenge_result_task.challenge_result_task",
                "schedule": crontab(minute="*/5"),
            },
            "world-events-sync": {
                "task": "app.tasks.world_events_task.world_events_task",
                "schedule": crontab(minute="*/15"),
            },
            "reward-distribution-refresh": {
                "task": "app.tasks.reward_distribution_task.reward_distribution_task",
                "schedule": crontab(minute="*/10"),
            },
            "notification-dispatch": {
                "task": "app.tasks.notification_dispatch_task.notification_dispatch_task",
                "schedule": crontab(minute="*/1"),
            },
            "audit-retention-purge": {
                "task": "app.tasks.audit_retention_task.audit_retention_task",
                "schedule": crontab(hour=3, minute=30),
            },
        },
    )

    celery_app.autodiscover_tasks(["app.tasks"])
else:  # pragma: no cover
    celery_app = _FallbackCelery()
