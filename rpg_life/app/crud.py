from datetime import datetime, date, timedelta
import json
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_
from .models import User, UserClassProgress, Quest, CompletedQuest, Achievement, UserAchievement, DailyBonus, DailySteps, Challenge, ChallengeParticipant
from .models import StepDay
from .auth import verify_password, get_password_hash
from .config import CLASS_GROWTH, STAT_EFFECTS, XP_BASE, XP_MULTIPLIER, MAX_CUSTOM_QUESTS_PER_DAY
from .achievements import ACHIEVEMENTS, build_achievement_stats, evaluate_achievement, get_earned_achievement_map
from .character_classes import CHARACTER_CLASSES
import random
import logging
from .stat_effects import StatEffects
from .level_chests import LevelChest
from app.core.dates import utc_now
from .goals import GOALS, get_goal_quests, get_goal_info
from .config import get_xp_for_level
from .services import health_service, progression_service
from . import shop_runtime
from .text_utils import normalize_nested_strings, repair_mojibake
from .user_identity import USERNAME_MAX_LENGTH, build_public_user_id, normalize_username, username_matches_rules
logger = logging.getLogger(__name__)

CUSTOM_QUEST_XP_REWARD = 40
CUSTOM_QUEST_CRYSTAL_REWARD = max(1, CUSTOM_QUEST_XP_REWARD // 10)

OBJECTIVE_LABELS = {
    "steps": "Шаги",
    "walking_km": "Км пешком",
    "quests_completed": "Задания",
    "xp_gained": "Опыт",
    "water_ml": "Вода (мл)",
    "water_glasses": "Стаканы воды",
    "reading_minutes": "Чтение (мин)",
    "reading_pages": "Страницы",
    "reading_session": "Чтение",
    "journal_entry": "Дневник",
    "journal_lines": "Строки в дневнике",
    "journal_task": "Рефлексия",
    "ideas_count": "Идеи",
    "day_planning": "Планирование",
    "training_minutes": "Тренировка (мин)",
    "activity_session": "Активность",
    "pushups": "Отжимания",
    "squats": "Приседания",
    "lunges": "Выпады",
    "situps": "Скручивания",
    "burpees": "Берпи",
    "jumping_jacks": "Прыжки",
    "stairs_floors": "Этажи",
    "plank_seconds": "Планка (сек)",
    "plank_minutes": "Планка (мин)",
    "duration_minutes": "Минуты",
    "hydration_habit": "Водный ритуал",
    "meditation_minutes": "Медитация (мин)",
    "meditation_session": "Медитация",
    "habit_consistency": "Дни привычки",
    "sleep_consistency": "Сон по режиму",
    "study_topic": "Изученные темы",
    "practice_tasks": "Практические задачи",
    "project_milestone": "Этап проекта",
    "portfolio_cases": "Кейсы в портфолио",
    "expense_tracking": "Учет расходов",
    "finance_action": "Финансовые действия",
    "weekly_budget": "Недельный бюджет",
    "savings_growth": "Рост накоплений",
    "priority_tasks": "Приоритетные задачи",
    "focus_sessions": "Фокус-сессии",
    "routine_consistency": "Дни режима",
    "planning_streak": "Серия планирования",
    "mindfulness_minutes": "Осознанность (мин)",
    "reflection_entries": "Рефлексия",
    "skill_unlock": "Новый навык",
    "reading": "Страницы",
    "meditation": "Минуты медитации",
}


def user_friend_id(user: User | None) -> str | None:
    return build_public_user_id(getattr(user, "id", None))


def _username_exists(db: Session, username: str, exclude_user_id: int | None = None) -> bool:
    query = db.query(User).filter(func.lower(User.username) == username.lower())
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return db.query(query.exists()).scalar()


def generate_unique_username(
    db: Session,
    seed: str | None,
    *,
    exclude_user_id: int | None = None,
    fallback_user_id: int | None = None,
) -> str:
    base = normalize_username(seed) or normalize_username(f"hero_{fallback_user_id or 'user'}") or "hero_user"
    if len(base) < 3:
        base = "hero_user"
    if not _username_exists(db, base, exclude_user_id=exclude_user_id):
        return base

    suffix = 2
    while True:
        suffix_text = f"_{suffix}"
        trimmed_base = base[: max(1, USERNAME_MAX_LENGTH - len(suffix_text))]
        candidate = f"{trimmed_base}{suffix_text}"
        if username_matches_rules(candidate) and not _username_exists(db, candidate, exclude_user_id=exclude_user_id):
            return candidate
        suffix += 1


def ensure_user_identity(db: Session, user: User, preferred_username: str | None = None, *, commit: bool = False) -> User:
    changed = False
    normalized_username = normalize_username(preferred_username or user.username or user.name or (user.email.split("@")[0] if user.email else None))
    if not user.username or normalize_username(user.username) != user.username:
        user.username = generate_unique_username(
            db,
            normalized_username,
            exclude_user_id=user.id,
            fallback_user_id=user.id,
        )
        changed = True
    elif preferred_username and user.username != normalized_username:
        user.username = generate_unique_username(
            db,
            normalized_username,
            exclude_user_id=user.id,
            fallback_user_id=user.id,
        )
        changed = True

    if changed and commit:
        db.commit()
        db.refresh(user)
    return user


def assign_requested_username(db: Session, user: User, requested_username: str) -> User:
    normalized = normalize_username(requested_username)
    if not normalized or not username_matches_rules(normalized):
        raise ValueError("Username must be 3-24 characters long, start with a letter, and contain only lowercase letters, digits, or underscores")
    if _username_exists(db, normalized, exclude_user_id=user.id):
        raise ValueError("Username is already taken")
    user.username = normalized
    return user


def backfill_missing_usernames(db: Session) -> int:
    users = (
        db.query(User)
        .filter(or_(User.username == None, User.username == ""))
        .order_by(User.id.asc())
        .all()
    )
    if not users:
        return 0

    for user in users:
        ensure_user_identity(db, user)
    db.commit()
    return len(users)

TRACKED_OBJECTIVES = {"steps", "quests_completed", "xp_gained"}

CORE_DAILY_QUESTS = [
    {
        "title": "Пройти 4 000 шагов",
        "description": "Сделай базовую дневную активность и запусти прогресс героя.",
        "objective_type": "steps",
        "target_value": 4000,
        "difficulty": "easy",
        "icon": "🚶",
    },
    {
        "title": "Пройти 7 500 шагов",
        "description": "Поддержи хороший темп движения и получи усиленную награду.",
        "objective_type": "steps",
        "target_value": 7500,
        "difficulty": "easy",
        "icon": "🏃",
    },
    {
        "title": "Пройти 12 000 шагов",
        "description": "Закрой длинную прогулку и добавь редкий вклад в прогресс.",
        "objective_type": "steps",
        "target_value": 12000,
        "difficulty": "hard",
        "icon": "🥾",
    },
    {
        "title": "Закрыть 2 задания",
        "description": "Подтверди темп и доведи до конца хотя бы два проверяемых задания.",
        "objective_type": "quests_completed",
        "target_value": 2,
        "difficulty": "medium",
        "icon": "📘",
    },
    {
        "title": "Закрыть 4 задания",
        "description": "Собери крепкую серию выполненных задач за один день.",
        "objective_type": "quests_completed",
        "target_value": 4,
        "difficulty": "hard",
        "icon": "✅",
    },
    {
        "title": "Набрать 120 XP",
        "description": "Поддержи продуктивность и накопи заметный объем опыта.",
        "objective_type": "xp_gained",
        "target_value": 120,
        "difficulty": "medium",
        "icon": "✨",
    },
    {
        "title": "Набрать 220 XP",
        "description": "Разгони прогресс героя и выйди на крупный дневной результат.",
        "objective_type": "xp_gained",
        "target_value": 220,
        "difficulty": "hard",
        "icon": "🌟",
    },
]

RECENT_QUEST_LOOKBACK_DAYS = 3
DAILY_DIFFICULTY_TARGETS = {"easy": 4, "medium": 4, "hard": 2}
DAILY_QUEST_TARGET_COUNT = 10
RARE_MISSION_COOLDOWN_HOURS = 48
RARE_MISSION_DURATION_HOURS = 36

RARE_MISSION_TEMPLATES = [
    {
        "title": "Редкая миссия: марш сквозь бурю",
        "description": "Пройди 25 000 шагов до истечения таймера и получи усиленную награду.",
        "objective_type": "steps",
        "target_value": 25000,
        "rarity": "epic",
        "icon": "🜂",
        "xp": 420,
        "crystals": 95,
    },
    {
        "title": "Редкая миссия: архив знаний",
        "description": "Набери 450 XP за ограниченное время. Награда выше обычных ежедневных заданий.",
        "objective_type": "xp_gained",
        "target_value": 450,
        "rarity": "rare",
        "icon": "✦",
        "xp": 360,
        "crystals": 80,
    },
    {
        "title": "Редкая миссия: фокус мастера",
        "description": "Заверши 5 заданий за окно активности и собери редкую награду.",
        "objective_type": "quests_completed",
        "target_value": 5,
        "rarity": "legendary",
        "icon": "👁",
        "xp": 520,
        "crystals": 110,
    },
]


def _quest_difficulty(quest_template: dict) -> str:
    explicit = (quest_template.get("difficulty") or "").lower()
    if explicit in {"easy", "medium", "hard"}:
        return explicit

    xp = int(quest_template.get("xp", 50) or 50)
    if xp <= 50:
        return "easy"
    if xp <= 90:
        return "medium"
    return "hard"


def _rarity_from_difficulty(difficulty: str) -> str:
    if difficulty == "easy":
        return "common"
    if difficulty == "medium":
        return "uncommon"
    return random.choice(["rare", "epic"])


def _build_daily_quest_pool(class_name: str) -> list[dict]:
    class_quests = CHARACTER_CLASSES.get(class_name, {}).get("quests", [])
    combined = CORE_DAILY_QUESTS + class_quests
    seen_titles = set()
    unique_pool = []

    for quest_template in combined:
        title = (quest_template.get("title") or "").strip()
        if not title:
            continue
        key = title.lower()
        if key in seen_titles:
            continue
        seen_titles.add(key)
        enriched = dict(quest_template)
        for field in ("title", "description", "icon", "rarity", "type", "subclass", "slot"):
            if field in enriched:
                enriched[field] = repair_mojibake(enriched[field])
        enriched["difficulty"] = _quest_difficulty(quest_template)
        unique_pool.append(enriched)

    return unique_pool


def _recent_daily_titles(db: Session, user_id: int, class_progress_id: int) -> set[str]:
    cutoff = utc_now() - timedelta(days=RECENT_QUEST_LOOKBACK_DAYS)
    recent_rows = (
        db.query(Quest.title)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == class_progress_id,
            Quest.is_custom == False,
            Quest.created_at >= cutoff,
        )
        .all()
    )
    return {title.strip().lower() for (title,) in recent_rows if title}


def _pick_daily_quests(pool: list[dict], excluded_titles: set[str]) -> list[dict]:
    buckets = {"easy": [], "medium": [], "hard": []}
    for quest_template in pool:
        key = (quest_template.get("title") or "").strip().lower()
        if not key or key in excluded_titles:
            continue
        buckets[quest_template.get("difficulty", "easy")].append(quest_template)

    selected = []
    selected_titles = set()

    for difficulty, target in DAILY_DIFFICULTY_TARGETS.items():
        candidates = buckets.get(difficulty, [])
        random.shuffle(candidates)
        for quest_template in candidates[:target]:
            title_key = quest_template["title"].strip().lower()
            if title_key in selected_titles:
                continue
            selected.append(quest_template)
            selected_titles.add(title_key)

    if len(selected) < DAILY_QUEST_TARGET_COUNT:
        fallback = [item for item in pool if item.get("title", "").strip().lower() not in selected_titles]
        random.shuffle(fallback)
        for quest_template in fallback:
            selected.append(quest_template)
            selected_titles.add(quest_template["title"].strip().lower())
            if len(selected) >= DAILY_QUEST_TARGET_COUNT:
                break

    return selected[:DAILY_QUEST_TARGET_COUNT]


def _serialize_reward_item(item) -> dict:
    stats = []
    if getattr(item, "strength_bonus", 0):
        stats.append(f"+{int(item.strength_bonus)} Рє СЃРёР»Рµ")
    if getattr(item, "agility_bonus", 0):
        stats.append(f"+{int(item.agility_bonus)} Рє Р»РѕРІРєРѕСЃС‚Рё")
    if getattr(item, "intellect_bonus", 0):
        stats.append(f"+{int(item.intellect_bonus)} Рє РёРЅС‚РµР»Р»РµРєС‚Сѓ")
    if getattr(item, "stamina_bonus", 0):
        stats.append(f"+{int(item.stamina_bonus)} Рє РІС‹РЅРѕСЃР»РёРІРѕСЃС‚Рё")
    if getattr(item, "xp_bonus", 0):
        stats.append(f"+{int(item.xp_bonus * 100)}% Рє РѕРїС‹С‚Сѓ")
    if getattr(item, "crystal_bonus", 0):
        stats.append(f"+{int(item.crystal_bonus * 100)}% Рє РєСЂРёСЃС‚Р°Р»Р»Р°Рј")
    if getattr(item, "critical_bonus", 0):
        stats.append(f"+{int(item.critical_bonus * 100)}% Рє РєСЂРёС‚Сѓ")
    if getattr(item, "luck_bonus", 0):
        stats.append(f"+{int(item.luck_bonus * 100)}% Рє СѓРґР°С‡Рµ")
    if getattr(item, "weapon_stats", None):
        stats.append(f"РЈСЂРѕРЅ {item.weapon_stats.damage_min}-{item.weapon_stats.damage_max}")
    if getattr(item, "armor_stats", None):
        stats.append(f"Р‘СЂРѕРЅСЏ +{item.armor_stats.armor_value}")

    return {
        "id": item.id,
        "name": item.name,
        "icon": item.icon,
        "rarity": item.rarity,
        "required_level": item.required_level,
        "description": item.description,
        "stats": stats,
    }


def _grant_daily_chest_if_earned(db: Session, user_id: int, class_progress_id: int, level: int):
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_quests = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == class_progress_id,
            Quest.is_custom == False,
            Quest.created_at >= today_start,
        )
        .all()
    )
    if not today_quests:
        return None

    if any(not quest.is_completed for quest in today_quests):
        return None

    if any((quest.goal_type or "").endswith("#daily_chest") for quest in today_quests):
        return None

    chest_reward = LevelChest.give_chest_reward(db, user_id, level=level, source="daily")
    if not chest_reward or not chest_reward.get("item"):
        return None

    reward_item = chest_reward["item"]

    marker_quest = today_quests[0]
    marker_quest.goal_type = f"{marker_quest.goal_type or 'daily'}#daily_chest"
    db.commit()

    return {
        "source": "daily_chest",
        "title": "Сундук за день",
        "chest_name": chest_reward.get("chest_name"),
        "inventory_id": chest_reward.get("inventory_id"),
        "item": _serialize_reward_item(reward_item),
    }


def complete_quest(db: Session, user_id: int, quest_id: int):
    quest = (
        db.query(Quest)
        .filter(Quest.id == quest_id, Quest.user_id == user_id)
        .with_for_update()
        .first()
    )
    if not quest or quest.is_completed:
        return None
    if quest.expires_at and quest.expires_at < utc_now():
        raise ValueError("Срок действия задания уже истек")

    progress = (
        db.query(UserClassProgress)
        .filter(
            UserClassProgress.id == quest.class_progress_id,
            UserClassProgress.user_id == user_id,
        )
        .with_for_update()
        .first()
    )
    if not progress:
        progress = (
            db.query(UserClassProgress)
            .filter(
                UserClassProgress.user_id == user_id,
                UserClassProgress.is_unlocked == True,
            )
            .order_by(UserClassProgress.id.asc())
            .with_for_update()
            .first()
        )
    if not progress:
        return None

    health_context = health_service.sync_character_health(db, user_id, progress, commit=False)
    progress = health_context["progress"] or progress
    can_complete, limit_error = progression_service.can_complete_quest_today(db, user_id, quest, progress)
    if not can_complete:
        raise ValueError(limit_error or "Достигнут дневной лимит заданий")

    logger.debug("Завершение квеста (до): уровень=%s опыт=%s", progress.level, progress.current_xp)

    # Р—Р°РїРѕРјРёРЅР°РµРј СѓСЂРѕРІРµРЅСЊ РґРѕ
    old_level = progress.level
    is_verified_completion = objective_supports_live_progress(quest.objective_type) and not (
        bool(getattr(quest, "goal_id", None)) and not bool(getattr(quest, "is_custom", False))
    )

    if is_verified_completion:
        objective_progress = None
        if getattr(quest, "domain", None) == "weight_management" and quest.objective_type == "steps":
            payload = {}
            try:
                payload = json.loads(getattr(quest, "payload_json", None) or "{}")
            except json.JSONDecodeError:
                payload = {}
            date_local = str(payload.get("dateLocal") or "").strip()
            if date_local:
                step_day = (
                    db.query(StepDay)
                    .filter(StepDay.user_id == user_id, StepDay.date_local == date_local)
                    .first()
                )
                objective_progress = int(step_day.steps or 0) if step_day else 0
        if objective_progress is None:
            objective_progress = get_objective_progress(
                db,
                user_id,
                quest.objective_type,
                quest.created_at,
                quest.expires_at,
            )
        target_value = int(quest.target_value or 0)
        if objective_progress is None or objective_progress < target_value:
            raise ValueError(
                f"Для завершения нужно выполнить цель: {describe_objective(quest.objective_type)} {objective_progress or 0}/{target_value}"
            )

    # РџСЂРёРјРµРЅСЏРµРј Р±РѕРЅСѓСЃС‹ РѕС‚ С…Р°СЂР°РєС‚РµСЂРёСЃС‚РёРє
    final_xp, final_crystals, is_critical, is_lucky, loot_bonus = StatEffects.apply_quest_rewards(
        db, user_id, quest.xp_reward, quest.crystal_reward
    )
    final_xp, final_crystals, reward_penalty_applied = health_service.apply_reward_penalty(
        progress,
        final_xp,
        final_crystals,
    )

    update_streak_logic(db, progress)
    progress, level_ups, _ = add_xp_and_stats(db, progress, final_xp, quest.rarity)
    health_state_after_quest = health_service.register_rewarded_quest_completion(progress)

    # РќР°С‡РёСЃР»СЏРµРј РєСЂРёСЃС‚Р°Р»Р»С‹
    progress.crystals += final_crystals

    quest.is_completed = True
    quest.completed_at = utc_now()

    if not quest.is_custom:
        completed = CompletedQuest(
            user_id=user_id,
            quest_id=quest.id,
            xp_earned=final_xp,
            crystals_earned=final_crystals,
            completed_at=quest.completed_at,
        )
        db.add(completed)
    
    # Random item drops created noisy rewards with inconsistent naming/icon data.
    # Progression now uses explicit chest-based rewards instead of ad-hoc loot items.
    loot_drop = None

    db.commit()

    # РџСЂРѕРІРµСЂСЏРµРј, РїРѕРІС‹СЃРёР»СЃСЏ Р»Рё СѓСЂРѕРІРµРЅСЊ
    chest_item = None
    if progress.level > old_level:
        # Р—Р° РєР°Р¶РґС‹Р№ РЅРѕРІС‹Р№ СѓСЂРѕРІРµРЅСЊ РґР°С‘Рј СЃСѓРЅРґСѓРє
        for level in range(old_level + 1, progress.level + 1):
            chest_item = LevelChest.give_chest_reward(db, user_id, level, source="level_up")
            if chest_item:
                logger.info("Сундук за уровень выдан: user_id=%s уровень=%s", user_id, level)

    logger.debug("Завершение квеста (после): уровень=%s опыт=%s", progress.level, progress.current_xp)
    if level_ups:
        logger.info("Повышения уровня: %s", level_ups)

    total = db.query(Quest).filter(Quest.user_id == user_id, Quest.is_completed == True).count()
    logger.info("Квест выполнен: quest_id=%s total_completed=%s", quest_id, total)

    new_achs = check_achievements(db, user_id, progress)
    bonus_level_ups = _apply_level_ups(progress)
    if bonus_level_ups:
        level_ups.extend(bonus_level_ups)
        db.commit()
        db.refresh(progress)
    daily_chest = _grant_daily_chest_if_earned(db, user_id, progress.id, progress.level)
    active_contract = shop_runtime.consume_contract_charge(user_id)

    next_xp = calculate_next_level_xp(progress.level)
    xp_percentage = (progress.current_xp / next_xp) * 100 if next_xp > 0 else 0

    return {
        "success": True,
        "new_xp": progress.current_xp,
        "new_level": progress.level,
        "level_ups": level_ups,
        "new_crystals": progress.crystals,
        "crystals_earned": final_crystals,
        "xp_earned": final_xp,
        "achievements": new_achs,
        "xp_percentage": xp_percentage,
        "next_level_xp": next_xp,
        "strength": progress.strength,
        "agility": progress.agility,
        "intellect": progress.intellect,
        "stamina": getattr(progress, "stamina", 0),
        "is_critical": is_critical,
        "is_lucky": is_lucky,
        "reward_penalty_applied": reward_penalty_applied,
        "chest_item": chest_item,
        "loot_drop": loot_drop,
        "daily_chest": daily_chest,
        "health": health_state_after_quest,
        "daily_limits": progression_service.get_daily_completion_limits(db, user_id, progress),
        "active_contract": active_contract,
    }
def get_or_create_class_progress(db: Session, user_id: int, class_name: str, is_start: bool = False) -> UserClassProgress:
    progress = db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.class_name == class_name
    ).first()
    if not progress:
        growth = CLASS_GROWTH.get(class_name, {"strength": 1, "agility": 1, "intellect": 1, "stamina": 1})
        starting_stamina = growth.get("stamina", 1)
        starting_health = int(100 + starting_stamina * 5)
        progress = UserClassProgress(
            user_id=user_id,
            class_name=class_name,
            display_name=CHARACTER_CLASSES.get(class_name, {}).get("name", class_name),
            strength=growth["strength"],
            agility=growth["agility"],
            intellect=growth["intellect"],
            stamina=starting_stamina,
            max_health=starting_health,
            current_health=starting_health,
            is_unlocked=is_start
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user or user.is_active != True or not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(
    db: Session,
    email: str,
    password: str,
    start_class: str,
    name: str | None = None,
    username: str | None = None,
    birth_year: int | None = None,
    gender: str = "unspecified",
    goal_type: str = "lose",
    goal_term_months: int = 6,
) -> User:
    hashed_password = get_password_hash(password)
    normalized_goal_type = get_goal_info(goal_type).get("id", goal_type)
    now = utc_now()
    db_user = User(
        email=email,
        hashed_password=hashed_password,
        name=name,
        username=None,
        birth_year=birth_year,
        gender=gender,
        selected_goal_type=normalized_goal_type,
        goal_term_months=goal_term_months,
        goal_cycle_index=1,
        goal_cycle_started_at=now,
        goal_cycle_deadline_at=now + timedelta(days=30 * goal_term_months),
        goal_cycle_xp=0,
        goal_target_xp=progression_service.resolve_goal_target_xp(goal_term_months),
        goal_progress_percent=0,
        last_goal_change_at=now,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    ensure_user_identity(db, db_user, preferred_username=username, commit=True)
    get_or_create_class_progress(db, db_user.id, start_class, is_start=True)
    if name:
        update_character_name(db, db_user.id, name)
    return db_user


def get_active_class_progress(db: Session, user_id: int, class_name: str) -> UserClassProgress:
    return db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.class_name == class_name,
        UserClassProgress.is_unlocked == True
    ).first()


def get_all_unlocked_classes(db: Session, user_id: int):
    return db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.is_unlocked == True
    ).order_by(UserClassProgress.id.asc()).all()


def calculate_next_level_xp(level: int) -> int:
    safe_level = max(1, int(level or 1))
    return safe_level * 120


def _apply_level_ups(progress: UserClassProgress) -> list[int]:
    level_ups = []

    while True:
        next_level_xp = calculate_next_level_xp(progress.level)
        if progress.current_xp < next_level_xp:
            break

        progress.current_xp -= next_level_xp
        progress.level += 1
        level_ups.append(progress.level)

        growth = CLASS_GROWTH.get(progress.class_name, {})
        for stat, growth_rate in growth.items():
            current_val = getattr(progress, stat)
            setattr(progress, stat, current_val + growth_rate)

        logger.debug("Повышение уровня: новый_уровень=%s остаток_xp=%s", progress.level, progress.current_xp)

    return level_ups


def add_xp_and_stats(db: Session, progress: UserClassProgress, amount: int, quest_rarity: str = "common"):
    final_xp = int(amount)
    progress.current_xp += final_xp

    level_ups = _apply_level_ups(progress)
    db.commit()
    db.refresh(progress)
    return progress, level_ups, final_xp
def update_streak_logic(db: Session, progress: UserClassProgress):
    today = utc_now().date()
    if progress.last_activity:
        last_date = progress.last_activity.date()
        if last_date == today:
            return progress
        diff = (today - last_date).days
        if diff == 1:
            progress.streak += 1
        elif diff > 1:
            progress.streak = 1
    else:
        progress.streak = 1
    progress.last_activity = utc_now()
    db.commit()
    return progress


def generate_daily_quests(db: Session, user_id: int, class_name: str):
    """Generate a unique daily quest set with difficulty-based rarity."""
    today_start = datetime.combine(utc_now().date(), datetime.min.time())

    existing = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.class_progress_id.in_(
            db.query(UserClassProgress.id).filter(
                UserClassProgress.user_id == user_id,
                UserClassProgress.class_name == class_name,
            )
        ),
        Quest.created_at >= today_start,
        Quest.is_custom == False,
        Quest.quest_type == "daily",
    ).count()

    if existing > 0:
        logger.debug("Ежедневные задания уже существуют: user_id=%s класс=%s", user_id, class_name)
        return

    progress = get_active_class_progress(db, user_id, class_name)
    if not progress:
        return

    pool = _build_daily_quest_pool(class_name)
    if not pool:
        return

    class_prog_id = progress.id
    recent_titles = _recent_daily_titles(db, user_id, class_prog_id)
    selected_quests = _pick_daily_quests(pool, recent_titles)
    if len(selected_quests) < DAILY_QUEST_TARGET_COUNT:
        selected_quests = _pick_daily_quests(pool, set())

    rarity_multiplier = {
        "common": 1.00,
        "uncommon": 1.25,
        "rare": 1.55,
        "epic": 1.90,
    }

    for quest_template in selected_quests:
        difficulty = quest_template.get("difficulty", "easy")
        rarity = _rarity_from_difficulty(difficulty)
        base_xp = int(quest_template.get("xp", 50) or 50)
        final_xp = max(20, int(base_xp * rarity_multiplier.get(rarity, 1.0)))
        crystal_reward = max(2, int(final_xp * 0.2))

        q = Quest(
            user_id=user_id,
            class_progress_id=class_prog_id,
            title=quest_template["title"],
            description=quest_template.get("description", ""),
            xp_reward=final_xp,
            crystal_reward=crystal_reward,
            rarity=rarity,
            is_custom=False,
            goal_type=class_name,
            quest_type="daily",
            objective_type=quest_template.get("objective_type"),
            target_value=quest_template.get("target_value"),
            icon=quest_template.get("icon", "рџ“ќ"),
        )
        db.add(q)

    db.commit()
    logger.info("Сгенерированы ежедневные задания: user_id=%s класс=%s количество=%s", user_id, class_name, len(selected_quests))
    try:
        from app.services import notification_service

        notification_service.notify_new_daily_quests(db, user_id=user_id, quest_count=len(selected_quests))
    except Exception:
        db.rollback()
        logger.exception("Не удалось поставить уведомление о новых квестах: user_id=%s", user_id)


def generate_rare_mission(db: Session, user_id: int, class_name: str):
    progress = get_active_class_progress(db, user_id, class_name)
    if not progress:
        return None

    now = utc_now()
    active_mission = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == progress.id,
            Quest.quest_type == "rare_mission",
            Quest.is_completed == False,
            Quest.expires_at != None,
            Quest.expires_at >= now,
        )
        .first()
    )
    if active_mission:
        return active_mission

    last_mission = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == progress.id,
            Quest.quest_type == "rare_mission",
        )
        .order_by(Quest.created_at.desc())
        .first()
    )
    if last_mission and last_mission.created_at and last_mission.created_at > now - timedelta(hours=RARE_MISSION_COOLDOWN_HOURS):
        return None

    template = random.choice(RARE_MISSION_TEMPLATES)
    quest = Quest(
        user_id=user_id,
        class_progress_id=progress.id,
        title=template["title"],
        description=template["description"],
        xp_reward=template["xp"],
        crystal_reward=template["crystals"],
        rarity=template["rarity"],
        goal_type=class_name,
        is_custom=False,
        quest_type="rare_mission",
        objective_type=template["objective_type"],
        target_value=template["target_value"],
        expires_at=now + timedelta(hours=RARE_MISSION_DURATION_HOURS),
        icon=template["icon"],
    )
    db.add(quest)
    db.commit()
    db.refresh(quest)
    logger.info("Сгенерирована редкая миссия: user_id=%s class=%s quest_id=%s", user_id, class_name, quest.id)
    return quest


def reset_daily_quests(db: Session):
    """РЎР±СЂР°СЃС‹РІР°РµС‚ РІСЃРµ РµР¶РµРґРЅРµРІРЅС‹Рµ РєРІРµСЃС‚С‹ (РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ 00:00)"""
    today_start = datetime.combine(utc_now().date(), datetime.min.time())
    
    # РЈРґР°Р»СЏРµРј РІСЃРµ РЅРµРІС‹РїРѕР»РЅРµРЅРЅС‹Рµ РµР¶РµРґРЅРµРІРЅС‹Рµ РєРІРµСЃС‚С‹
    deleted = db.query(Quest).filter(
        Quest.is_custom == False,
        Quest.is_completed == False,
        Quest.quest_type.in_(["daily", "boss_daily"]),
        Quest.created_at < today_start,
    ).delete(synchronize_session=False)
    
    db.commit()
    logger.info("Удалены устаревшие ежедневные задания: удалено=%s", deleted)
    
    # Р“РµРЅРµСЂРёСЂСѓРµРј РЅРѕРІС‹Рµ РєРІРµСЃС‚С‹ РґР»СЏ РІСЃРµС… Р°РєС‚РёРІРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
    users = db.query(User).filter(User.is_active == True).all()
    try:
        import app.services.goal_service as goal_service

        for user in users:
            goal_service.generate_goal_quests_for_user(db, user, source="ai", force_regenerate=False)
    except Exception:
        logger.exception("Не удалось обновить цель-ориентированные задания, выполняем fallback генерацию")
        for user in users:
            classes = db.query(UserClassProgress).filter(
                UserClassProgress.user_id == user.id,
                UserClassProgress.is_unlocked == True
            ).all()

            for progress in classes:
                generate_daily_quests(db, user.id, progress.class_name)
                generate_boss_quests(db, user.id, progress.class_name)
                generate_rare_mission(db, user.id, progress.class_name)
    
    logger.info("Сгенерированы новые задания: пользователей=%s", len(users))
    return deleted
def create_custom_quest(db: Session, user_id: int, class_progress_id: int, quest_data) -> Quest:
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_custom = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.is_custom == True,
        Quest.created_at >= today_start
    ).count()
    if today_custom >= MAX_CUSTOM_QUESTS_PER_DAY:
        raise ValueError(f"Р”РѕСЃС‚РёРіРЅСѓС‚ Р»РёРјРёС‚ СЃРѕР·РґР°РЅРёСЏ РєРІРµСЃС‚РѕРІ ({MAX_CUSTOM_QUESTS_PER_DAY} РІ РґРµРЅСЊ)")

    # Custom quest rewards are assigned by the server so crafted clients cannot boost XP arbitrarily.
    xp = CUSTOM_QUEST_XP_REWARD
    if xp < 30:
        rarity = "common"
    elif xp < 60:
        rarity = "uncommon"
    elif xp < 100:
        rarity = "rare"
    elif xp < 150:
        rarity = "mythic"
    elif xp < 250:
        rarity = "legendary"
    else:
        rarity = "immortal"

    quest = Quest(
        user_id=user_id,
        class_progress_id=class_progress_id,
        title=quest_data.title if hasattr(quest_data, 'title') else quest_data.get('title'),
        description=quest_data.description if hasattr(quest_data, 'description') else quest_data.get('description', ''),
        xp_reward=xp,
        crystal_reward=CUSTOM_QUEST_CRYSTAL_REWARD,
        rarity=rarity,
        is_custom=True,
        is_completed=False,
        icon=quest_data.icon if hasattr(quest_data, 'icon') else quest_data.get('icon', 'рџ“њ'),
        created_at=utc_now()
    )
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return quest


def delete_quest(db: Session, user_id: int, quest_id: int) -> bool:
    quest = db.query(Quest).filter(
        Quest.id == quest_id,
        Quest.user_id == user_id,
        Quest.is_custom == True
    ).first()
    if not quest:
        return False
    db.delete(quest)
    db.commit()
    return True


def update_user_profile(db: Session, user_id: int, profile_data: dict):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    requested_username = profile_data.pop("username", None) if "username" in profile_data else None
    for key, value in profile_data.items():
        if hasattr(user, key) and value is not None:
            setattr(user, key, value)
    if requested_username is not None:
        assign_requested_username(db, user, requested_username)
    db.commit()
    db.refresh(user)
    return user


def update_character_name(db: Session, user_id: int, character_name: str):
    progress = db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.is_unlocked == True
    ).first()
    if progress and hasattr(progress, 'display_name'):
        progress.display_name = character_name
        db.commit()
    return progress


def create_class_progress(db: Session, user_id: int, class_name: str, character_name: str = None) -> UserClassProgress:
    existing = db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.class_name == class_name
    ).first()
    if existing:
        return existing

    growth = CLASS_GROWTH.get(class_name, {"strength": 1, "agility": 1, "intellect": 1, "stamina": 1})
    starting_stamina = growth.get("stamina", 1)
    starting_health = int(100 + starting_stamina * 5)
    progress = UserClassProgress(
        user_id=user_id,
        class_name=class_name,
        display_name=character_name or CHARACTER_CLASSES.get(class_name, {}).get("name", class_name),
        strength=growth["strength"],
        agility=growth["agility"],
        intellect=growth["intellect"],
        stamina=starting_stamina,
        max_health=starting_health,
        current_health=starting_health,
        is_unlocked=True,
        level=1,
        current_xp=0,
        crystals=0,
        streak=0,
        last_activity=utc_now()
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def get_daily_bonus_info(db: Session, user_id: int):
    """РџРѕР»СѓС‡РµРЅРёРµ РёРЅС„РѕСЂРјР°С†РёРё Рѕ РµР¶РµРґРЅРµРІРЅРѕРј Р±РѕРЅСѓСЃРµ"""
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())
    
    # РџРѕР»СѓС‡Р°РµРј РїРѕСЃР»РµРґРЅРёР№ РїРѕР»СѓС‡РµРЅРЅС‹Р№ Р±РѕРЅСѓСЃ
    last_bonus = db.query(DailyBonus).filter(
        DailyBonus.user_id == user_id
    ).order_by(DailyBonus.claimed_at.desc()).first()

    # РџСЂРѕРІРµСЂСЏРµРј, РїРѕР»СѓС‡Р°Р» Р»Рё СЃРµРіРѕРґРЅСЏ
    if last_bonus and last_bonus.claimed_at >= today_start and last_bonus.claimed_at <= today_end:
        return normalize_nested_strings({
            "available": False,
            "message": "Р‘РѕРЅСѓСЃ СѓР¶Рµ РїРѕР»СѓС‡РµРЅ СЃРµРіРѕРґРЅСЏ",
            "next_in": "Р·Р°РІС‚СЂР°",
            "current_day": last_bonus.day_number,
            "can_claim": False
        })

    # РћРїСЂРµРґРµР»СЏРµРј С‚РµРєСѓС‰РёР№ РґРµРЅСЊ СЃС‚СЂРёРєР°
    current_day = 1
    if last_bonus:
        last_claim_date = last_bonus.claimed_at.date()
        today = date.today()
        days_diff = (today - last_claim_date).days
        
        if days_diff == 1:
            # РџРѕР»СѓС‡Р°Р»Рё РІС‡РµСЂР° - РїСЂРѕРґРѕР»Р¶Р°РµРј СЃС‚СЂРёРє
            current_day = min(last_bonus.day_number + 1, 7)
        elif days_diff > 1:
            # РџСЂРѕРїСѓСЃС‚РёР»Рё РґРµРЅСЊ - СЃР±СЂР°СЃС‹РІР°РµРј
            current_day = 1
        # Р•СЃР»Рё days_diff == 0, СѓР¶Рµ РѕР±СЂР°Р±РѕС‚Р°РЅРѕ РІС‹С€Рµ

    # Р Р°СЃСЃС‡РёС‚С‹РІР°РµРј РЅР°РіСЂР°РґСѓ Р·Р° С‚РµРєСѓС‰РёР№ РґРµРЅСЊ
    bonus_xp = 50 * current_day
    bonus_crystals = 10 * current_day

    return normalize_nested_strings({
        "available": True,
        "can_claim": True,
        "current_day": current_day,
        "bonus_xp": bonus_xp,
        "bonus_crystals": bonus_crystals,
        "max_day": 7,
        "message": f"Р‘РѕРЅСѓСЃ РґРЅСЏ {current_day}: +{bonus_xp} XP, +{bonus_crystals} рџ’Ћ"
    })
def claim_daily_bonus(db: Session, user_id: int):
    """РџРѕР»СѓС‡РµРЅРёРµ РµР¶РµРґРЅРµРІРЅРѕРіРѕ Р±РѕРЅСѓСЃР°"""
    now = utc_now()
    today_start = datetime.combine(now.date(), datetime.min.time())
    today_end = datetime.combine(now.date(), datetime.max.time())

    # Serialize bonus claims per user to prevent double-claim races.
    user_row = db.query(User).filter(User.id == user_id).with_for_update().first()
    if user_row is None:
        return None
    
    # РџСЂРѕРІРµСЂСЏРµРј, РїРѕР»СѓС‡Р°Р» Р»Рё СѓР¶Рµ СЃРµРіРѕРґРЅСЏ
    existing = db.query(DailyBonus).filter(
        DailyBonus.user_id == user_id,
        DailyBonus.claimed_at >= today_start,
        DailyBonus.claimed_at <= today_end
    ).first()
    
    if existing:
        logger.info("Ежедневный бонус уже получен: user_id=%s", user_id)
        return None

    # РџРѕР»СѓС‡Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ С‚РµРєСѓС‰РµРј РґРЅРµ
    bonus_info = get_daily_bonus_info(db, user_id)
    if not bonus_info["available"]:
        logger.info("Ежедневный бонус недоступен: user_id=%s", user_id)
        return None

    current_day = bonus_info["current_day"]
    bonus_xp = bonus_info["bonus_xp"]
    bonus_crystals = bonus_info["bonus_crystals"]

    # РЎРѕР·РґР°РµРј Р·Р°РїРёСЃСЊ Рѕ Р±РѕРЅСѓСЃРµ
    bonus = DailyBonus(
        user_id=user_id,
        day_number=current_day,
        bonus_xp=bonus_xp,
        bonus_crystals=bonus_crystals,
        claimed_at=now
    )
    db.add(bonus)

    # РќР°С‡РёСЃР»СЏРµРј Р±РѕРЅСѓСЃ РїРµСЂСЃРѕРЅР°Р¶Сѓ
    progress = db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.is_unlocked == True
    ).first()
    
    level_ups = []
    old_level = progress.level if progress else None
    
    if progress:
        progress.current_xp += bonus_xp
        progress.crystals += bonus_crystals
        level_ups = _apply_level_ups(progress)
        for new_level in level_ups:
            logger.info("Повышение уровня от ежедневного бонуса: user_id=%s новый_уровень=%s", user_id, new_level)

    db.commit()
    logger.info(
        "Ежедневный бонус получен: user_id=%s день=%s опыт=%s кристаллы=%s",
        user_id,
        current_day,
        bonus_xp,
        bonus_crystals,
    )
    
    return {
        "success": True,
        "day": current_day,
        "xp": bonus_xp,
        "crystals": bonus_crystals,
        "new_level": progress.level if progress else None,
        "level_ups": level_ups,
        "old_level": old_level
    }
def check_achievements(db: Session, user_id: int, progress: UserClassProgress = None):
    """Проверка и выдача достижений."""
    classes = get_all_unlocked_classes(db, user_id)
    if not classes:
        return []

    earned = db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
    earned_map = get_earned_achievement_map(earned)

    total_completed = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.is_completed == True
    ).count()
    custom_completed = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.is_custom == True,
        Quest.is_completed == True,
    ).count()
    boss_completed = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.quest_type.in_(["boss_daily", "boss_weekly", "boss_challenge"]),
        Quest.is_completed == True,
    ).count()

    immortal_count = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.rarity == 'immortal',
        Quest.is_completed == True
    ).count()
    stats = build_achievement_stats(
        classes=classes,
        total_completed=total_completed,
        custom_completed=custom_completed,
        boss_completed=boss_completed,
        immortal_count=immortal_count,
    )

    new_achievements = []

    for ach in ACHIEVEMENTS:
        ach_id = ach["id"]
        if ach_id in earned_map:
            continue

        if not evaluate_achievement(ach_id, stats):
            continue

        ach_record = db.query(Achievement).filter(Achievement.name == ach["title"]).first()
        if not ach_record:
            ach_record = Achievement(
                name=ach["title"],
                description=ach["description"],
                icon=ach.get("icon", "🏆"),
                xp_reward=ach.get("xp_reward", 0),
                crystal_reward=ach.get("crystal_reward", 0),
            )
            db.add(ach_record)
            db.flush()

        db.add(
            UserAchievement(
                user_id=user_id,
                achievement_id=ach_record.id,
                earned_at=utc_now(),
            )
        )

        if progress:
            progress.current_xp += ach_record.xp_reward
            progress.crystals += ach_record.crystal_reward

        new_achievements.append(
            {
                "id": ach_id,
                "title": ach["title"],
                "icon": ach.get("icon", "🏆"),
                "tier": ach.get("tier", "common"),
                "xp": ach_record.xp_reward,
                "crystals": ach_record.crystal_reward,
            }
        )

    if new_achievements:
        db.commit()

    return new_achievements
def get_user_stats(db: Session, user_id: int):
    classes = get_all_unlocked_classes(db, user_id)
    total_quests = db.query(Quest).filter(Quest.user_id == user_id, Quest.is_completed == True).count()
    total_custom = db.query(Quest).filter(Quest.user_id == user_id, Quest.is_custom == True).count()
    total_xp = db.query(func.sum(CompletedQuest.xp_earned)).filter(CompletedQuest.user_id == user_id).scalar() or 0
    total_crystals = db.query(func.sum(CompletedQuest.crystals_earned)).filter(CompletedQuest.user_id == user_id).scalar() or 0
    immortal_quests = db.query(Quest).filter(
        Quest.user_id == user_id,
        Quest.rarity == 'immortal',
        Quest.is_completed == True
    ).count()

    return {
        "classes": len(classes),
        "total_quests": total_quests,
        "custom_quests": total_custom,
        "total_xp": total_xp,
        "total_crystals": total_crystals,
        "highest_level": max((c.level for c in classes), default=0),
        "longest_streak": max((c.streak for c in classes), default=0),
        "immortal_quests": immortal_quests
    }


BOSS_QUEST_TEMPLATES = [
    {
        "title": "Босс: пройти 30 000 шагов",
        "description": "Испытание на выносливость. Закрой огромную дистанцию за один день.",
        "objective_type": "steps",
        "target_value": 30000,
        "quest_type": "boss_daily",
        "rarity": "epic",
        "icon": "👹",
        "xp": 320,
        "crystals": 70,
    },
    {
        "title": "Босс: прочитать 50 страниц",
        "description": "Набери 350 XP за день и покажи стабильную продуктивность.",
        "objective_type": "xp_gained",
        "target_value": 350,
        "quest_type": "boss_daily",
        "rarity": "epic",
        "icon": "📖",
        "xp": 280,
        "crystals": 60,
    },
    {
        "title": "Босс: медитация 30 минут",
        "description": "Закрой 6 проверяемых заданий и выдержи высокий темп до конца дня.",
        "objective_type": "quests_completed",
        "target_value": 6,
        "quest_type": "boss_daily",
        "rarity": "epic",
        "icon": "🧘",
        "xp": 260,
        "crystals": 55,
    },
    {
        "title": "Недельный босс: 100 000 шагов",
        "description": "Большой марафон активности на всю неделю.",
        "objective_type": "steps",
        "target_value": 100000,
        "quest_type": "boss_weekly",
        "rarity": "legendary",
        "icon": "🐉",
        "xp": 900,
        "crystals": 180,
    },
]


def _challenge_window_end(duration_days: int) -> datetime:
    return utc_now() + timedelta(days=duration_days)


def _active_main_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _quest_result_for_window(db: Session, user_id: int, objective_type: str, start_at: datetime, end_at: datetime) -> int:
    if objective_type == "xp_gained":
        return (
            db.query(func.sum(CompletedQuest.xp_earned))
            .filter(
                CompletedQuest.user_id == user_id,
                CompletedQuest.completed_at >= start_at,
                CompletedQuest.completed_at <= end_at,
            )
            .scalar()
            or 0
        )
    if objective_type == "steps":
        return (
            db.query(func.sum(DailySteps.steps))
            .filter(
                DailySteps.user_id == user_id,
                DailySteps.date >= start_at,
                DailySteps.date <= end_at,
            )
            .scalar()
            or 0
        )
    return (
        db.query(CompletedQuest)
        .filter(
            CompletedQuest.user_id == user_id,
            CompletedQuest.completed_at >= start_at,
            CompletedQuest.completed_at <= end_at,
        )
        .count()
    )


def describe_objective(objective_type: str | None) -> str:
    return OBJECTIVE_LABELS.get(objective_type or "", "Прогресс")


def objective_supports_live_progress(objective_type: str | None) -> bool:
    return (objective_type or "") in TRACKED_OBJECTIVES


def get_objective_progress(
    db: Session,
    user_id: int,
    objective_type: str | None,
    start_at: datetime,
    end_at: datetime | None = None,
) -> int | None:
    if not objective_supports_live_progress(objective_type):
        return None

    progress_end = min(end_at or utc_now(), utc_now())
    return _quest_result_for_window(db, user_id, objective_type or "", start_at, progress_end)


def generate_boss_quests(db: Session, user_id: int, class_name: str):
    progress = get_active_class_progress(db, user_id, class_name)
    if not progress:
        return []

    created = []
    today_start = datetime.combine(date.today(), datetime.min.time())
    week_start = today_start - timedelta(days=today_start.weekday())

    existing_daily = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == progress.id,
            Quest.quest_type == "boss_daily",
            Quest.created_at >= today_start,
        )
        .count()
    )
    if existing_daily == 0:
        template = random.choice([t for t in BOSS_QUEST_TEMPLATES if t["quest_type"] == "boss_daily"])
        quest = Quest(
            user_id=user_id,
            class_progress_id=progress.id,
            title=template["title"],
            description=template["description"],
            xp_reward=template["xp"],
            crystal_reward=template["crystals"],
            rarity=template["rarity"],
            goal_type=class_name,
            is_custom=False,
            quest_type=template["quest_type"],
            objective_type=template["objective_type"],
            target_value=template["target_value"],
            expires_at=datetime.combine(date.today(), datetime.max.time()),
            icon=template["icon"],
        )
        db.add(quest)
        created.append(quest)

    existing_weekly = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == progress.id,
            Quest.quest_type == "boss_weekly",
            Quest.created_at >= week_start,
        )
        .count()
    )
    if existing_weekly == 0:
        template = next(t for t in BOSS_QUEST_TEMPLATES if t["quest_type"] == "boss_weekly")
        week_end = week_start + timedelta(days=6, hours=23, minutes=59)
        quest = Quest(
            user_id=user_id,
            class_progress_id=progress.id,
            title=template["title"],
            description=template["description"],
            xp_reward=template["xp"],
            crystal_reward=template["crystals"],
            rarity=template["rarity"],
            goal_type=class_name,
            is_custom=False,
            quest_type=template["quest_type"],
            objective_type=template["objective_type"],
            target_value=template["target_value"],
            expires_at=week_end,
            icon=template["icon"],
        )
        db.add(quest)
        created.append(quest)

    if created:
        db.commit()

    return created


def create_challenge(db: Session, creator_id: int, payload) -> Challenge:
    progress = _active_main_progress(db, creator_id)
    if not progress:
        raise ValueError("Персонаж не найден")

    end_at = _challenge_window_end(payload.duration_days)
    challenge = Challenge(
        creator_id=creator_id,
        title=payload.title,
        description=payload.description,
        challenge_type=payload.challenge_type,
        objective_type=payload.objective_type,
        target_value=payload.target_value,
        reward_xp=payload.reward_xp,
        reward_crystals=payload.reward_crystals,
        reward_chest=payload.reward_chest,
        end_at=end_at,
    )
    db.add(challenge)
    db.flush()

    db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=creator_id, is_creator=True))

    if payload.challenge_type == "duel":
        if not payload.opponent_id or payload.opponent_id == creator_id:
            raise ValueError("Для дуэли нужен второй игрок")
        db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=payload.opponent_id, is_creator=False))

    if payload.challenge_type == "boss":
        boss_progress = _active_main_progress(db, creator_id)
        if boss_progress:
            boss_quest = Quest(
                user_id=creator_id,
                class_progress_id=boss_progress.id,
                title=f"Челлендж-босс: {payload.title}",
                description=payload.description,
                xp_reward=max(250, payload.reward_xp),
                crystal_reward=max(50, payload.reward_crystals),
                rarity="legendary",
                goal_type=boss_progress.class_name,
                is_custom=False,
                quest_type="boss_challenge",
                objective_type=payload.objective_type,
                target_value=payload.target_value,
                expires_at=end_at,
                challenge_id=challenge.id,
                icon="👑",
            )
            db.add(boss_quest)

    db.commit()
    db.refresh(challenge)
    return challenge


def join_challenge(db: Session, challenge_id: int, user_id: int) -> ChallengeParticipant:
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge or challenge.status != "active":
        raise ValueError("Испытание недоступно")
    if challenge.challenge_type == "duel":
        raise ValueError("В дуэль нельзя вступить вручную")
    if challenge.end_at <= utc_now():
        raise ValueError("Испытание уже завершено")

    existing = (
        db.query(ChallengeParticipant)
        .filter(ChallengeParticipant.challenge_id == challenge_id, ChallengeParticipant.user_id == user_id)
        .first()
    )
    if existing:
        return existing

    entry = ChallengeParticipant(challenge_id=challenge_id, user_id=user_id, is_creator=False)
    db.add(entry)

    if challenge.challenge_type == "boss":
        progress = _active_main_progress(db, user_id)
        if progress:
            db.add(
                Quest(
                    user_id=user_id,
                    class_progress_id=progress.id,
                    title=f"Челлендж-босс: {challenge.title}",
                    description=challenge.description,
                    xp_reward=max(250, challenge.reward_xp),
                    crystal_reward=max(50, challenge.reward_crystals),
                    rarity="legendary",
                    goal_type=progress.class_name,
                    is_custom=False,
                    quest_type="boss_challenge",
                    objective_type=challenge.objective_type,
                    target_value=challenge.target_value,
                    expires_at=challenge.end_at,
                    challenge_id=challenge.id,
                    icon="👑",
                )
            )

    db.commit()
    db.refresh(entry)
    return entry


def resolve_due_challenges(db: Session):
    due_challenges = (
        db.query(Challenge)
        .filter(
            Challenge.status == "active",
            Challenge.challenge_type != "pvp",
            Challenge.end_at <= utc_now(),
        )
        .all()
    )

    resolved = []
    for challenge in due_challenges:
        winner_id = None
        best_score = -1

        for participant in challenge.participants:
            score = _quest_result_for_window(
                db,
                participant.user_id,
                challenge.objective_type,
                challenge.start_at,
                challenge.end_at,
            )
            participant.result_value = score
            if score > best_score:
                best_score = score
                winner_id = participant.user_id

        challenge.status = "resolved"
        challenge.resolved_at = utc_now()
        challenge.winner_id = winner_id

        if winner_id:
            winner_progress = _active_main_progress(db, winner_id)
            if winner_progress:
                winner_progress.current_xp += challenge.reward_xp
                winner_progress.crystals += challenge.reward_crystals
                if challenge.reward_chest:
                    LevelChest.give_chest_reward(db, winner_id, winner_progress.level, source="challenge")

        resolved.append(challenge.id)

    if resolved:
        db.commit()
        from app.services import notification_service

        for challenge_id in resolved:
            try:
                notification_service.notify_challenge_completed(db, challenge_id=challenge_id)
            except Exception:
                db.rollback()
                logger.exception("Не удалось поставить уведомление о завершении челленджа: challenge_id=%s", challenge_id)

    return resolved


def get_dashboard_encounters(db: Session, user_id: int):
    progress = _active_main_progress(db, user_id)
    if not progress:
        return {"boss_quests": [], "challenges": [], "public_challenges": [], "opponents": []}

    now = utc_now()
    boss_quests = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.class_progress_id == progress.id,
            Quest.quest_type.in_(["boss_daily", "boss_weekly", "boss_challenge"]),
            Quest.is_completed == False,
            ((Quest.expires_at == None) | (Quest.expires_at >= now)),
        )
        .all()
    )

    challenges = (
        db.query(Challenge)
        .options(
            selectinload(Challenge.participants).joinedload(ChallengeParticipant.user),
            joinedload(Challenge.creator),
        )
        .join(ChallengeParticipant, ChallengeParticipant.challenge_id == Challenge.id)
        .filter(ChallengeParticipant.user_id == user_id, Challenge.status == "active")
        .order_by(Challenge.end_at.asc())
        .all()
    )

    public_challenges = (
        db.query(Challenge)
        .options(
            selectinload(Challenge.participants).joinedload(ChallengeParticipant.user),
            joinedload(Challenge.creator),
        )
        .filter(
            Challenge.status == "active",
            Challenge.challenge_type.in_(["open", "boss"]),
            Challenge.creator_id != user_id,
            ~Challenge.participants.any(ChallengeParticipant.user_id == user_id),
        )
        .order_by(Challenge.created_at.desc())
        .limit(12)
        .all()
    )

    opponents = (
        db.query(User)
        .filter(User.id != user_id, User.is_active == True)
        .order_by(User.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "boss_quests": boss_quests,
        "challenges": challenges,
        "public_challenges": public_challenges,
        "opponents": opponents,
    }

