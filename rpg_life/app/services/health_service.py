from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.dates import utc_now
from app.models import UserClassProgress
from app.services import progression_service

WOUNDED_PENALTY_PERCENT = 0.25
WOUNDED_QUESTS_TO_RECOVER = 3
WOUNDED_DURATION_HOURS = 24
WOUNDED_HEALTH_SHARE = 0.35


def build_health_payload(progress: UserClassProgress | None) -> dict:
    if progress is None:
        return {
            "max_health": 100,
            "current_health": 100,
            "health_percent": 100,
            "is_wounded": False,
            "wounded_until": None,
            "penalty_quests_remaining": 0,
            "reward_penalty_percent": 0,
            "last_health_decay_at": None,
        }

    max_health = max(1, int(getattr(progress, "max_health", 100) or 100))
    current_health = max(0, min(max_health, int(getattr(progress, "current_health", max_health) or max_health)))
    wounded_until = getattr(progress, "wounded_until", None)
    reward_penalty_percent = float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0)
    penalty_quests_remaining = max(0, int(getattr(progress, "penalty_quests_remaining", 0) or 0))
    now = utc_now()
    is_wounded = bool(
        reward_penalty_percent > 0
        and (penalty_quests_remaining > 0 or (wounded_until is not None and wounded_until > now))
    )

    return {
        "max_health": max_health,
        "current_health": current_health,
        "health_percent": int(round(current_health * 100 / max_health)),
        "is_wounded": is_wounded,
        "wounded_until": wounded_until.isoformat() if wounded_until else None,
        "penalty_quests_remaining": penalty_quests_remaining,
        "reward_penalty_percent": round(reward_penalty_percent * 100, 1),
        "last_health_decay_at": getattr(progress, "last_health_decay_at", None).isoformat()
        if getattr(progress, "last_health_decay_at", None)
        else None,
    }


def _clamp_health(progress: UserClassProgress) -> None:
    max_health = max(1, int(getattr(progress, "max_health", 100) or 100))
    progress.max_health = max_health
    current_health = int(getattr(progress, "current_health", max_health) or max_health)
    progress.current_health = max(0, min(max_health, current_health))


def _refresh_max_health(db: Session, user_id: int, progress: UserClassProgress) -> None:
    total_stats = progression_service.get_total_character_stats(db, user_id, progress)
    calculated_max_health = max(1, int(round(total_stats["max_health"])))
    previous_max_health = int(getattr(progress, "max_health", 0) or 0)
    previous_current_health = int(getattr(progress, "current_health", 0) or 0)

    progress.max_health = calculated_max_health
    if previous_max_health <= 0:
        progress.current_health = calculated_max_health
    elif calculated_max_health > previous_max_health:
        # Keep player fully rewarded for growth: when max HP grows, current HP grows by the same delta.
        growth_delta = calculated_max_health - previous_max_health
        progress.current_health = previous_current_health + growth_delta
    elif previous_current_health > calculated_max_health:
        progress.current_health = calculated_max_health
    elif previous_current_health <= 0 and not getattr(progress, "wounded_until", None):
        progress.current_health = calculated_max_health

    _clamp_health(progress)


def _clear_wounded_state(progress: UserClassProgress) -> None:
    progress.wounded_until = None
    progress.penalty_quests_remaining = 0
    progress.reward_penalty_percent = 0.0


def _apply_wounded_state(progress: UserClassProgress, now: datetime) -> None:
    progress.streak = 0
    progress.reward_penalty_percent = WOUNDED_PENALTY_PERCENT
    progress.penalty_quests_remaining = max(
        WOUNDED_QUESTS_TO_RECOVER,
        int(getattr(progress, "penalty_quests_remaining", 0) or 0),
    )
    progress.wounded_until = now + timedelta(hours=WOUNDED_DURATION_HOURS)
    progress.current_health = max(1, int(round(progress.max_health * WOUNDED_HEALTH_SHARE)))
    _clamp_health(progress)


def _cleanup_wounded_state(progress: UserClassProgress, now: datetime) -> None:
    wounded_until = getattr(progress, "wounded_until", None)
    penalty_quests_remaining = int(getattr(progress, "penalty_quests_remaining", 0) or 0)
    reward_penalty_percent = float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0)

    if reward_penalty_percent <= 0:
        _clear_wounded_state(progress)
        return

    if penalty_quests_remaining <= 0 or (wounded_until is not None and wounded_until <= now):
        _clear_wounded_state(progress)


def calculate_inactivity_damage(level: int, armor: float, missed_days: int) -> int:
    if missed_days <= 0:
        return 0

    base_damage = max(1.0, float(level or 1) * 1.2)
    armor_multiplier = max(0.1, min(1.0, 1.0 - float(armor or 0.0) * 0.001))
    total_damage = base_damage * armor_multiplier * missed_days
    return max(missed_days, int(round(total_damage)))


def sync_character_health(
    db: Session,
    user_id: int,
    progress: UserClassProgress | None = None,
    *,
    commit: bool = True,
) -> dict:
    now = utc_now()
    progress = progress or progression_service.get_main_progress(db, user_id)
    if progress is None:
        return {"progress": None, "health": build_health_payload(None), "missed_days": 0, "damage_applied": 0}

    original_snapshot = (
        int(getattr(progress, "max_health", 100) or 100),
        int(getattr(progress, "current_health", 100) or 100),
        getattr(progress, "wounded_until", None),
        int(getattr(progress, "penalty_quests_remaining", 0) or 0),
        float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0),
        getattr(progress, "last_health_decay_at", None),
        int(getattr(progress, "streak", 0) or 0),
    )
    _refresh_max_health(db, user_id, progress)

    if getattr(progress, "last_health_decay_at", None) is None:
        progress.last_health_decay_at = getattr(progress, "last_activity", None) or now

    if getattr(progress, "current_health", None) is None:
        progress.current_health = progress.max_health

    _cleanup_wounded_state(progress, now)

    last_decay_at = getattr(progress, "last_health_decay_at", None) or now
    hours_since_last_check = max(0.0, (now - last_decay_at).total_seconds() / 3600)
    missed_days = max(0, int(hours_since_last_check // 24))
    damage_applied = 0

    if missed_days > 0:
        total_stats = progression_service.get_total_character_stats(db, user_id, progress)
        damage_applied = calculate_inactivity_damage(progress.level, total_stats["armor"], missed_days)
        progress.current_health = max(0, int(getattr(progress, "current_health", progress.max_health) or progress.max_health) - damage_applied)
        if progress.current_health <= 0:
            _apply_wounded_state(progress, now)

    if getattr(progress, "last_health_decay_at", None) is None or hours_since_last_check >= 1:
        progress.last_health_decay_at = now
    _clamp_health(progress)
    _cleanup_wounded_state(progress, now)

    changed = original_snapshot != (
        int(getattr(progress, "max_health", 100) or 100),
        int(getattr(progress, "current_health", 100) or 100),
        getattr(progress, "wounded_until", None),
        int(getattr(progress, "penalty_quests_remaining", 0) or 0),
        float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0),
        getattr(progress, "last_health_decay_at", None),
        int(getattr(progress, "streak", 0) or 0),
    )

    if commit and changed:
        db.add(progress)
        db.commit()
        db.refresh(progress)
    elif changed:
        db.flush()

    return {
        "progress": progress,
        "health": build_health_payload(progress),
        "missed_days": missed_days,
        "damage_applied": damage_applied,
    }


def apply_reward_penalty(progress: UserClassProgress, xp: int, gold: int) -> tuple[int, int, bool]:
    now = utc_now()
    _cleanup_wounded_state(progress, now)
    penalty = float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0)
    quests_remaining = int(getattr(progress, "penalty_quests_remaining", 0) or 0)
    wounded_until = getattr(progress, "wounded_until", None)
    is_active = penalty > 0 and (quests_remaining > 0 or (wounded_until is not None and wounded_until > now))
    if not is_active:
        return int(xp), int(gold), False

    multiplier = max(0.0, 1.0 - penalty)
    penalized_xp = max(1 if xp > 0 else 0, int(round(xp * multiplier)))
    penalized_gold = max(0, int(round(gold * multiplier)))
    return penalized_xp, penalized_gold, True


def register_rewarded_quest_completion(progress: UserClassProgress) -> dict:
    now = utc_now()
    _cleanup_wounded_state(progress, now)

    penalty = float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0)
    quests_remaining = int(getattr(progress, "penalty_quests_remaining", 0) or 0)
    wounded_until = getattr(progress, "wounded_until", None)
    is_active = penalty > 0 and (quests_remaining > 0 or (wounded_until is not None and wounded_until > now))
    if not is_active:
        return build_health_payload(progress)

    progress.penalty_quests_remaining = max(0, quests_remaining - 1)
    _cleanup_wounded_state(progress, now)
    return build_health_payload(progress)
