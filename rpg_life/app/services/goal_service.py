from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import crud
from app.core.dates import utc_now
from app.goals import (
    GOAL_TERMS,
    SUPPORTED_GOAL_TERMS,
    get_goal_info,
    list_goal_cards,
    normalize_goal_term_months,
    normalize_goal_type,
)
from app.models import CompletedQuest, Quest, User, UserClassProgress
from app.services import ai_goal_quest_service, health_service, openai_goal_rewriter, progression_service, weight_management_service

GoalQuestSource = Literal["base", "ai"]
GoalQuestBucket = Literal["daily", "weekly", "long_term"]
GoalQuestDifficulty = Literal["easy", "medium", "hard"]

SYSTEM_GOAL_QUESTS_PER_DAY = 10
GOAL_CHANGE_COOLDOWN_DAYS = 7
QUEST_ROTATION_WINDOWS_DAYS = (14, 7, 3, 1, 0)

XP_RANGE_BY_DIFFICULTY: dict[GoalQuestDifficulty, tuple[int, int]] = {
    "easy": (20, 40),
    "medium": (40, 80),
    "hard": (80, 150),
}

GOLD_RANGE_BY_DIFFICULTY: dict[GoalQuestDifficulty, tuple[int, int]] = {
    "easy": (4, 10),
    "medium": (8, 16),
    "hard": (12, 24),
}


def _main_class_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _safe_goal_cycle_start(user: User) -> datetime:
    return user.goal_cycle_started_at or utc_now()


def _safe_goal_cycle_deadline(user: User) -> datetime:
    return user.goal_cycle_deadline_at or (
        _safe_goal_cycle_start(user) + timedelta(days=30 * normalize_goal_term_months(user.goal_term_months))
    )


def _daily_window_start() -> datetime:
    return datetime.combine(utc_now().date(), datetime.min.time())


def _daily_window_end() -> datetime:
    return datetime.combine(utc_now().date(), datetime.max.time())


def ensure_user_goal_defaults(db: Session, user: User) -> User:
    changed = False
    goal_type = normalize_goal_type(getattr(user, "selected_goal_type", None))
    if getattr(user, "selected_goal_type", None) != goal_type:
        user.selected_goal_type = goal_type
        changed = True

    goal_term = normalize_goal_term_months(getattr(user, "goal_term_months", None))
    if getattr(user, "goal_term_months", None) != goal_term:
        user.goal_term_months = goal_term
        changed = True

    if getattr(user, "goal_cycle_started_at", None) is None:
        user.goal_cycle_started_at = utc_now()
        changed = True

    if getattr(user, "goal_cycle_deadline_at", None) is None:
        user.goal_cycle_deadline_at = user.goal_cycle_started_at + timedelta(days=30 * user.goal_term_months)
        changed = True

    if getattr(user, "goal_cycle_index", None) is None:
        user.goal_cycle_index = 1
        changed = True

    if getattr(user, "goal_target_xp", None) is None:
        user.goal_target_xp = progression_service.resolve_goal_target_xp(user.goal_term_months)
        changed = True

    if getattr(user, "goal_cycle_xp", None) is None:
        user.goal_cycle_xp = progression_service.bootstrap_goal_cycle_xp(user)
        changed = True
    elif int(user.goal_cycle_xp or 0) == 0 and int(getattr(user, "goal_progress_percent", 0) or 0) > 0:
        user.goal_cycle_xp = progression_service.bootstrap_goal_cycle_xp(user)
        changed = True

    if getattr(user, "goal_progress_percent", None) is None:
        user.goal_progress_percent = 0
        changed = True

    if getattr(user, "last_goal_change_at", None) is None:
        user.last_goal_change_at = getattr(user, "goal_cycle_started_at", None) or getattr(user, "created_at", None) or utc_now()
        changed = True

    previous_progress = int(getattr(user, "goal_progress_percent", 0) or 0)
    synced_progress = progression_service.sync_goal_progress(user)
    if previous_progress != synced_progress:
        changed = True

    if changed:
        db.commit()
        db.refresh(user)
    return user


def goal_cycle_day_index(user: User) -> int:
    started_at = _safe_goal_cycle_start(user)
    return max(1, int((utc_now().date() - started_at.date()).days) + 1)


def resolve_goal_phase(user: User) -> int:
    day_index = goal_cycle_day_index(user)
    if day_index <= 14:
        return 1
    if day_index <= 42:
        return 2
    return 3


def _scaled_reward(
    base_value: int,
    *,
    level: int,
    term_months: int,
    difficulty: GoalQuestDifficulty,
    as_gold: bool,
) -> int:
    low, high = (GOLD_RANGE_BY_DIFFICULTY if as_gold else XP_RANGE_BY_DIFFICULTY)[difficulty]
    term_multiplier = float(GOAL_TERMS[normalize_goal_term_months(term_months)]["xp_multiplier"])
    level_multiplier = 1.0 + min(max(level - 1, 0), 25) * (0.01 if as_gold else 0.02)
    difficulty_multiplier = {"easy": 1.0, "medium": 1.18, "hard": 1.42}[difficulty]
    if as_gold:
        term_multiplier *= 0.9
        difficulty_multiplier *= 0.86

    raw = int(round(base_value * term_multiplier * level_multiplier * difficulty_multiplier))
    return max(low, min(high, raw))


def _resolve_quest_rarity(difficulty: GoalQuestDifficulty) -> str:
    if difficulty == "easy":
        return "common" if random.random() < 0.65 else "uncommon"
    if difficulty == "medium":
        return "rare" if random.random() < 0.7 else "uncommon"
    return "epic" if random.random() < 0.2 else "rare"


def _normalize_title(value: str | None) -> str:
    return str(value or "").strip().lower()


def _serialize_goal_card(card: dict) -> dict:
    return {
        "id": card["id"],
        "title": card["title"],
        "description": card["description"],
        "result_example": card["result_example"],
        "icon": card["icon"],
        "accent_color": card["accent_color"],
        "recommended_term_months": card["recommended_term_months"],
        "is_primary": bool(card.get("is_primary", False)),
    }


def get_goal_templates_payload() -> dict:
    return weight_management_service.get_goal_templates_payload()


def _template_identity_from_values(template_key: str | None, title: str | None) -> str:
    normalized_key = str(template_key or "").strip()
    if normalized_key:
        return normalized_key
    return _normalize_title(title)


def _visible_goal_quests_query(db: Session, user: User):
    return db.query(Quest).filter(
        Quest.user_id == user.id,
        Quest.is_custom == False,
        Quest.quest_type == "daily",
        Quest.created_at >= _daily_window_start(),
        or_(Quest.is_archived == False, Quest.is_archived == None),
    )


def _quest_identity_key(quest: Quest) -> str:
    return _template_identity_from_values(getattr(quest, "template_key", None), getattr(quest, "title", None))


def _todays_generated_template_keys(db: Session, user: User) -> set[str]:
    rows = (
        db.query(Quest.template_key, Quest.title)
        .filter(
            Quest.user_id == user.id,
            Quest.is_custom == False,
            Quest.quest_type == "daily",
            Quest.created_at >= _daily_window_start(),
        )
        .all()
    )
    return {_template_identity_from_values(template_key, title) for template_key, title in rows if template_key or title}


def _todays_generated_titles(db: Session, user: User) -> set[str]:
    rows = (
        db.query(Quest.title)
        .filter(
            Quest.user_id == user.id,
            Quest.is_custom == False,
            Quest.quest_type == "daily",
            Quest.created_at >= _daily_window_start(),
        )
        .all()
    )
    return {_normalize_title(title) for (title,) in rows if title and _normalize_title(title)}


def _todays_generated_categories(db: Session, user: User) -> dict[str, int]:
    rows = (
        db.query(Quest.template_key)
        .filter(
            Quest.user_id == user.id,
            Quest.is_custom == False,
            Quest.quest_type == "daily",
            Quest.created_at >= _daily_window_start(),
        )
        .all()
    )
    category_counts = {}
    for (template_key,) in rows:
        if template_key and template_key.startswith("ai:"):
            parts = template_key.split(":")
            if len(parts) >= 2:
                category = parts[1]
                category_counts[category] = category_counts.get(category, 0) + 1
    return category_counts


def _recent_generated_template_keys(
    db: Session,
    user: User,
    *,
    days: int,
    include_today: bool = False,
) -> set[str]:
    if days <= 0:
        return set()

    lower_bound = utc_now() - timedelta(days=days)
    query = (
        db.query(Quest.template_key, Quest.title)
        .filter(
            Quest.user_id == user.id,
            Quest.is_custom == False,
            Quest.quest_type == "daily",
            Quest.goal_type == user.selected_goal_type,
            Quest.created_at >= lower_bound,
        )
    )
    if not include_today:
        query = query.filter(Quest.created_at < _daily_window_start())

    rows = query.all()
    return {_template_identity_from_values(template_key, title) for template_key, title in rows if template_key or title}


def _recent_generated_titles(
    db: Session,
    user: User,
    *,
    days: int,
    include_today: bool = False,
) -> set[str]:
    if days <= 0:
        return set()

    lower_bound = utc_now() - timedelta(days=days)
    query = (
        db.query(Quest.title)
        .filter(
            Quest.user_id == user.id,
            Quest.is_custom == False,
            Quest.quest_type == "daily",
            Quest.goal_type == user.selected_goal_type,
            Quest.created_at >= lower_bound,
        )
    )
    if not include_today:
        query = query.filter(Quest.created_at < _daily_window_start())

    rows = query.all()
    return {_normalize_title(title) for (title,) in rows if title and _normalize_title(title)}


def _build_adaptive_daily_pool(
    db: Session,
    user: User,
    *,
    phase: int,
    level: int,
    target_count: int,
    used_template_keys: set[str],
    used_titles: set[str],
    used_categories: dict[str, int],
) -> list[dict]:
    for days_window in QUEST_ROTATION_WINDOWS_DAYS:
        blocked_keys = set(used_template_keys)
        blocked_titles = set(used_titles)
        if days_window > 0:
            blocked_keys.update(
                _recent_generated_template_keys(
                    db,
                    user,
                    days=days_window,
                    include_today=False,
                )
            )
            blocked_titles.update(
                _recent_generated_titles(
                    db,
                    user,
                    days=days_window,
                    include_today=False,
                )
            )

        pool = ai_goal_quest_service.build_daily_quest_plan(
            goal_type=user.selected_goal_type,
            phase=phase,
            level=level,
            count=target_count,
            used_template_keys=blocked_keys,
            used_titles=blocked_titles,
            used_categories=dict(used_categories),
        )
        if len(pool) >= target_count or days_window == 0:
            return pool

    return []


def _build_fallback_goal_daily_pool(
    progress: UserClassProgress | None,
    *,
    target_count: int,
    used_titles: set[str],
) -> list[dict]:
    class_name = getattr(progress, "class_name", None)
    if not class_name:
        return []

    fallback_pool = crud._build_daily_quest_pool(class_name)
    if not fallback_pool:
        return []

    fallback_templates: list[dict] = []
    for template in fallback_pool:
        title = str(template.get("title") or "").strip()
        title_key = _normalize_title(title)
        if not title or not title_key or title_key in used_titles:
            continue
        fallback_templates.append(
            {
                "template_key": f"fallback:{class_name}:{title_key}",
                "title": title,
                "description": str(template.get("description") or "").strip(),
                "difficulty": str(template.get("difficulty") or "easy"),
                "objective_type": template.get("objective_type"),
                "target_value": template.get("target_value"),
                "icon": template.get("icon"),
                "is_universal": bool(template.get("is_universal", False)),
            }
        )
        if len(fallback_templates) >= target_count:
            break
    return fallback_templates


def _archive_visible_goal_quests(db: Session, user: User) -> None:
    rows = _visible_goal_quests_query(db, user).all()
    for quest in rows:
        quest.is_archived = True


def _build_goal_id(user: User) -> str:
    return f"{user.id}:{user.goal_cycle_index}"


def _build_quest_from_template(
    db: Session,
    user: User,
    progress: UserClassProgress | None,
    template: dict,
) -> Quest:
    difficulty = str(template.get("difficulty") or "easy")
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "easy"

    level = int(progress.level if progress else 1)
    xp_reward = _scaled_reward(
        int(template.get("base_xp", 30)),
        level=level,
        term_months=user.goal_term_months,
        difficulty=difficulty,  # type: ignore[arg-type]
        as_gold=False,
    )
    gold_reward = _scaled_reward(
        int(template.get("base_gold", 10)),
        level=level,
        term_months=user.goal_term_months,
        difficulty=difficulty,  # type: ignore[arg-type]
        as_gold=True,
    )
    goal_info = get_goal_info(user.selected_goal_type)
    template_key = _template_identity_from_values(template.get("template_key"), template.get("title"))

    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id if progress else None,
        title=str(template.get("title", "Задание")).strip(),
        description=str(template.get("description", "")).strip(),
        xp_reward=xp_reward,
        crystal_reward=gold_reward,
        rarity=_resolve_quest_rarity(difficulty),  # type: ignore[arg-type]
        goal_type=user.selected_goal_type,
        goal_id=_build_goal_id(user),
        template_key=template_key,
        difficulty_level=difficulty,
        goal_progress_percent=0,
        quest_bucket="daily",
        is_universal=bool(template.get("is_universal", False)),
        is_accepted=True,
        is_custom=False,
        is_archived=False,
        is_completed=False,
        quest_type="daily",
        objective_type=template.get("objective_type"),
        target_value=int(template.get("target_value")) if template.get("target_value") is not None else None,
        expires_at=_daily_window_end(),
        icon=str(template.get("icon") or goal_info.get("icon") or "notebook-outline"),
    )
    db.add(quest)
    return quest


def get_user_goal_state(db: Session, user: User) -> dict:
    payload = weight_management_service.get_goal_state(db, user)
    payload["daily_limits"] = progression_service.get_daily_completion_limits(db, user.id)
    payload["health"] = health_service.sync_character_health(db, user.id)["health"]
    return payload


def _goal_change_is_locked(user: User, now: datetime) -> tuple[bool, datetime]:
    last_changed = (
        getattr(user, "last_goal_change_at", None)
        or getattr(user, "goal_cycle_started_at", None)
        or getattr(user, "created_at", None)
        or now
    )
    next_change_at = last_changed + timedelta(days=GOAL_CHANGE_COOLDOWN_DAYS)
    return now < next_change_at, next_change_at


def set_user_goal(
    db: Session,
    user: User,
    goal_type: str,
    goal_term_months: int,
    start_new_cycle: bool,
) -> dict:
    normalized_term = normalize_goal_term_months(goal_term_months)
    user.goal_target_xp = progression_service.resolve_goal_target_xp(normalized_term)
    progression_service.sync_goal_progress(user)
    return weight_management_service.set_goal(db, user, goal_type, normalized_term, start_new_cycle)


def generate_goal_quests_for_user(
    db: Session,
    user: User,
    source: GoalQuestSource = "ai",
    force_regenerate: bool = False,
) -> dict:
    _ = source
    _ = force_regenerate
    payload = weight_management_service.ensure_program_quests(db, user)
    return {"generated": len(payload.get("items", []))}


def _serialize_quest(db: Session, user: User, quest: Quest) -> dict:
    progress = _main_class_progress(db, user.id)
    can_complete = False
    if not quest.is_completed:
        can_complete, _ = progression_service.can_complete_quest_today(db, user.id, quest, progress)

    return {
        "id": quest.id,
        "title": quest.title,
        "description": quest.description,
        "xp_reward": quest.xp_reward,
        "crystal_reward": quest.crystal_reward,
        "rarity": quest.rarity,
        "quest_type": "daily",
        "quest_bucket": "daily",
        "goal_type": quest.goal_type,
        "goal_id": quest.goal_id,
        "difficulty_level": quest.difficulty_level,
        "goal_progress_percent": progression_service.preview_goal_progress_percent(
            int(quest.xp_reward or 0),
            int(getattr(user, "goal_target_xp", 0) or progression_service.resolve_goal_target_xp(user.goal_term_months)),
        ),
        "is_universal": bool(quest.is_universal),
        "is_accepted": True,
        "objective_type": quest.objective_type,
        "objective_label": crud.describe_objective(quest.objective_type) if quest.objective_type else None,
        "target_value": int(quest.target_value) if quest.target_value is not None else None,
        "progress_value": None,
        "supports_live_progress": False,
        "tracking_mode": "manual",
        "can_complete": can_complete,
        "is_completed": bool(quest.is_completed),
        "expires_at": quest.expires_at.isoformat() if quest.expires_at else None,
    }


def get_user_goal_quests(
    db: Session,
    user: User,
    page: int = 1,
    limit: int = 30,
    sort: str = "created_at",
    bucket: GoalQuestBucket | None = None,
) -> dict:
    _ = page
    _ = limit
    _ = sort
    _ = bucket
    return weight_management_service.ensure_program_quests(db, user)


def accept_goal_quest(db: Session, user: User, quest_id: int) -> dict:
    quest = (
        db.query(Quest)
        .filter(
            Quest.id == quest_id,
            Quest.user_id == user.id,
            Quest.is_custom == False,
            or_(Quest.is_archived == False, Quest.is_archived == None),
        )
        .first()
    )
    if not quest:
        raise ValueError("Задание не найдено")
    quest.is_accepted = True
    db.commit()
    db.refresh(quest)
    return _serialize_quest(db, user, quest)


def replace_goal_quest(db: Session, user: User, quest_id: int, source: GoalQuestSource) -> dict:
    _ = source
    user = ensure_user_goal_defaults(db, user)
    quest = (
        db.query(Quest)
        .filter(
            Quest.id == quest_id,
            Quest.user_id == user.id,
            Quest.is_custom == False,
            or_(Quest.is_archived == False, Quest.is_archived == None),
        )
        .first()
    )
    if not quest:
        raise ValueError("Задание не найдено")
    if quest.is_completed:
        raise ValueError("Нельзя заменить выполненное задание")

    progress = _main_class_progress(db, user.id)
    used_template_keys = _todays_generated_template_keys(db, user)
    used_titles = _todays_generated_titles(db, user)
    used_template_keys.update(_recent_generated_template_keys(db, user, days=7, include_today=False))
    used_titles.update(_recent_generated_titles(db, user, days=7, include_today=False))
    used_template_keys.add(_quest_identity_key(quest))
    used_titles.add(_normalize_title(quest.title))
    replacement_candidates = ai_goal_quest_service.build_daily_quest_plan(
        goal_type=user.selected_goal_type,
        phase=resolve_goal_phase(user),
        level=int(progress.level if progress else 1),
        count=1,
        used_template_keys=used_template_keys,
        used_titles=used_titles,
    )
    if not replacement_candidates:
        raise ValueError("На сегодня закончились уникальные задания по этой цели")

    quest.is_archived = True
    replacement = _build_quest_from_template(db, user, progress, replacement_candidates[0])
    db.commit()
    db.refresh(replacement)
    return _serialize_quest(db, user, replacement)


def apply_goal_progress_on_completion(db: Session, user_id: int, quest_id: int) -> int:
    quest = (
        db.query(Quest)
        .filter(Quest.id == quest_id, Quest.user_id == user_id, Quest.is_completed == True)
        .first()
    )
    if not quest:
        return 0
    if getattr(quest, "domain", None) == weight_management_service.QUEST_DOMAIN:
        user = db.query(User).filter(User.id == user_id).first()
        return int(getattr(user, "goal_progress_percent", 0) or 0) if user else 0

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return 0
    user = ensure_user_goal_defaults(db, user)

    if not quest.goal_id or quest.goal_id != _build_goal_id(user):
        return int(user.goal_progress_percent or 0)

    completed_entry = (
        db.query(CompletedQuest)
        .filter(CompletedQuest.user_id == user_id, CompletedQuest.quest_id == quest_id)
        .order_by(CompletedQuest.completed_at.desc())
        .first()
    )
    if not completed_entry:
        return int(user.goal_progress_percent or 0)

    earned_xp = max(0, int(completed_entry.xp_earned or 0))
    user.goal_cycle_xp = int(getattr(user, "goal_cycle_xp", 0) or 0) + earned_xp
    progression_service.sync_goal_progress(user)
    db.commit()
    db.refresh(user)
    return int(user.goal_progress_percent or 0)


def validate_goal_choice(goal_type: str, term_months: int) -> tuple[str, int]:
    normalized_goal = normalize_goal_type(goal_type)
    normalized_term = normalize_goal_term_months(term_months)
    supported_goals = {card["id"] for card in weight_management_service.get_goal_templates_payload()["goals"]}
    if normalized_goal not in supported_goals:
        raise ValueError("Неподдерживаемая цель")
    if normalized_term not in SUPPORTED_GOAL_TERMS:
        raise ValueError("Неподдерживаемый срок цели")
    return normalized_goal, normalized_term
