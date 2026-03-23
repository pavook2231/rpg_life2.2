import atexit
import logging
import os
import threading
import time
from datetime import timedelta
from pathlib import Path
from tempfile import gettempdir

from app.core.dates import utc_now
from app.tasks.dispatcher import (
    enqueue_audit_retention,
    enqueue_challenge_results,
    enqueue_daily_quests,
    enqueue_reward_distribution,
    enqueue_world_events,
)

MAINTENANCE_INTERVAL_SECONDS = 15 * 60
LOCK_FILE_PATH = Path(gettempdir()) / "rpg_life_internal_scheduler.lock"

logger = logging.getLogger(__name__)

_scheduler_thread: threading.Thread | None = None
_scheduler_guard = threading.Lock()
_lock_handle = None


def run_maintenance_loop():
    """Local scheduler that only enqueues Celery tasks."""
    last_daily_enqueued = None
    last_weekly_enqueued = None
    last_audit_purge_enqueued = None

    while True:
        now = utc_now()
        if last_daily_enqueued != now.date() and now.hour == 0:
            enqueue_daily_quests()
            last_daily_enqueued = now.date()

        week_key = (now.isocalendar().year, now.isocalendar().week)
        if last_weekly_enqueued != week_key and now.weekday() == 0 and now.hour == 0:
            enqueue_world_events()
            last_weekly_enqueued = week_key

        if last_audit_purge_enqueued != now.date() and now.hour >= 3:
            enqueue_audit_retention()
            last_audit_purge_enqueued = now.date()

        enqueue_challenge_results()
        enqueue_reward_distribution()

        next_tick = now + timedelta(seconds=MAINTENANCE_INTERVAL_SECONDS)
        logger.info(
            f"[scheduler] Next queue dispatch at "
            f"{next_tick.strftime('%Y-%m-%d %H:%M:%S')} UTC"
        )
        time.sleep(MAINTENANCE_INTERVAL_SECONDS)


def _release_lock() -> None:
    global _lock_handle

    if _lock_handle is None:
        return

    try:
        if os.name == "nt":
            import msvcrt

            _lock_handle.seek(0)
            msvcrt.locking(_lock_handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(_lock_handle.fileno(), fcntl.LOCK_UN)
    except OSError:
        pass
    finally:
        _lock_handle.close()
        _lock_handle = None


def _try_acquire_lock() -> bool:
    global _lock_handle

    if _lock_handle is not None:
        return True

    LOCK_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    handle = LOCK_FILE_PATH.open("a+")

    if handle.tell() == 0:
        handle.write("0")
        handle.flush()

    try:
        handle.seek(0)
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return False

    _lock_handle = handle
    return True


def start_scheduler() -> bool:
    global _scheduler_thread

    with _scheduler_guard:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return True

        if not _try_acquire_lock():
            logger.info("[scheduler] Another process already owns the scheduler lock")
            return False

        _scheduler_thread = threading.Thread(target=run_maintenance_loop, daemon=True)
        _scheduler_thread.start()
        logger.info("[scheduler] Queue dispatcher started")
        return True


atexit.register(_release_lock)
