from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.dates import utc_now
from app.equipment_service import get_equipped_items
from app.goals import normalize_goal_term_months
from app.models import Quest, User, UserClassProgress

GOAL_TARGET_XP_BY_TERM = {
    3: 12_000,
    6: 20_000,
    9: 30_000,
}

BASE_SYSTEM_DAILY_CAP = 10
CUSTOM_DAILY_CAP = 10
TOTAL_DAILY_COMPLETION_CAP = 20


def get_main_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(
            UserClassProgress.user_id == user_id,
            UserClassProgress.is_unlocked == True,
        )
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def resolve_goal_target_xp(term_months: int | None) -> int:
    return GOAL_TARGET_XP_BY_TERM[normalize_goal_term_months(term_months)]


def bootstrap_goal_cycle_xp(user: User) -> int:
    target_xp = max(1, int(getattr(user, "goal_target_xp", 0) or resolve_goal_target_xp(user.goal_term_months)))
    existing_cycle_xp = int(getattr(user, "goal_cycle_xp", 0) or 0)
    if existing_cycle_xp > 0:
        return existing_cycle_xp

    legacy_percent = max(0, min(100, int(getattr(user, "goal_progress_percent", 0) or 0)))
    if legacy_percent <= 0:
        return 0

    return int(round(target_xp * legacy_percent / 100))


def sync_goal_progress(user: User) -> int:
    target_xp = max(1, int(getattr(user, "goal_target_xp", 0) or resolve_goal_target_xp(user.goal_term_months)))
    cycle_xp = max(0, int(getattr(user, "goal_cycle_xp", 0) or 0))
    progress_percent = max(0, min(100, int(round(cycle_xp * 100 / target_xp))))

    user.goal_target_xp = target_xp
    user.goal_cycle_xp = cycle_xp
    user.goal_progress_percent = progress_percent
    return progress_percent


def preview_goal_progress_percent(xp_reward: int, target_xp: int | None) -> float:
    safe_target = max(1, int(target_xp or 0))
    return round(max(0, int(xp_reward or 0)) * 100 / safe_target, 1)


def calculate_system_daily_cap(strength: float) -> int:
    safe_strength = max(0.0, float(strength or 0.0))
    bonus = int(safe_strength // 10)
    return min(BASE_SYSTEM_DAILY_CAP + bonus, 15)


def daily_window_start(reference: datetime | None = None) -> datetime:
    current = reference or utc_now()
    return datetime.combine(current.date(), datetime.min.time())


def get_total_character_stats(
    db: Session,
    user_id: int,
    progress: UserClassProgress | None = None,
) -> dict[str, float]:
    progress = progress or get_main_progress(db, user_id)
    if not progress:
        return {
            "strength": 0.0,
            "agility": 0.0,
            "intellect": 0.0,
            "stamina": 0.0,
            "armor": 0.0,
            "critical": 0.0,
            "critical_chance_percent": 0.0,
            "luck": 0.0,
            "luck_percent": 0.0,
            "max_health": 100.0,
        }

    equipment_totals = {}
    try:
        equipment_totals = get_equipped_items(db, user_id, progress.id).get("totals", {})
    except Exception:
        equipment_totals = {}

    strength = float(progress.strength or 0) + float(equipment_totals.get("strength", 0) or 0)
    agility = float(progress.agility or 0) + float(equipment_totals.get("agility", 0) or 0)
    intellect = float(progress.intellect or 0) + float(equipment_totals.get("intellect", 0) or 0)
    stamina = float(getattr(progress, "stamina", 0) or 0) + float(equipment_totals.get("stamina", 0) or 0)
    armor = float(equipment_totals.get("armor", 0) or 0)
    critical_chance_percent = float(equipment_totals.get("critical_chance", 0) or 0)
    luck_percent = float(equipment_totals.get("luck", 0) or 0)

    level = max(1.0, float(getattr(progress, "level", 1) or 1))
    health_from_level = level * 8.0
    health_from_stamina = stamina * 5.0
    health_from_strength = strength * 1.0
    health_from_equipment = float(equipment_totals.get("health", 0) or 0)

    return {
        "strength": strength,
        "agility": agility,
        "intellect": intellect,
        "stamina": stamina,
        "armor": armor,
        "critical": critical_chance_percent / 0.5 if critical_chance_percent > 0 else 0.0,
        "critical_chance_percent": critical_chance_percent,
        "luck": luck_percent,
        "luck_percent": luck_percent,
        "max_health": 100.0 + health_from_level + health_from_stamina + health_from_strength + health_from_equipment,
    }


def count_completed_quests_today(
    db: Session,
    user_id: int,
    *,
    is_custom: bool | None = None,
) -> int:
    query = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.is_completed == True,
        Quest.completed_at != None,
        Quest.completed_at >= daily_window_start(),
    )
    if is_custom is not None:
        query = query.filter(Quest.is_custom == is_custom)
    return query.count()


def get_daily_completion_limits(
    db: Session,
    user_id: int,
    progress: UserClassProgress | None = None,
) -> dict[str, int]:
    progress = progress or get_main_progress(db, user_id)
    stats = get_total_character_stats(db, user_id, progress)
    system_cap = calculate_system_daily_cap(stats["strength"])
    completed_total = count_completed_quests_today(db, user_id)
    completed_system = count_completed_quests_today(db, user_id, is_custom=False)
    completed_custom = count_completed_quests_today(db, user_id, is_custom=True)
    remaining_total = max(0, TOTAL_DAILY_COMPLETION_CAP - completed_total)

    return {
        "completed_total": completed_total,
        "total_cap": TOTAL_DAILY_COMPLETION_CAP,
        "completed_system": completed_system,
        "system_cap": system_cap,
        "completed_custom": completed_custom,
        "custom_cap": CUSTOM_DAILY_CAP,
        "remaining_total": remaining_total,
        "remaining_system": max(0, min(system_cap - completed_system, remaining_total)),
        "remaining_custom": max(0, min(CUSTOM_DAILY_CAP - completed_custom, remaining_total)),
    }


def can_complete_quest_today(
    db: Session,
    user_id: int,
    quest: Quest,
    progress: UserClassProgress | None = None,
) -> tuple[bool, str | None]:
    if getattr(quest, "domain", None) == "weight_management":
        return True, None

    limits = get_daily_completion_limits(db, user_id, progress)

    if limits["completed_total"] >= limits["total_cap"]:
        return False, "Достигнут дневной лимит выполнения заданий"

    if quest.is_custom:
        if limits["completed_custom"] >= limits["custom_cap"]:
            return False, "Достигнут дневной лимит пользовательских заданий"
    elif limits["completed_system"] >= limits["system_cap"]:
        return False, "Достигнут дневной лимит системных заданий"

    return True, None


def distribute_system_quest_targets(term_months: int | None, system_cap: int) -> dict[str, int]:
    _ = term_months
    safe_cap = max(BASE_SYSTEM_DAILY_CAP, int(system_cap or BASE_SYSTEM_DAILY_CAP))
    return {"daily": safe_cap, "weekly": 0, "long_term": 0}
