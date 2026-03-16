from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Quest, UserAchievement, UserClassProgress

LEARNING_OBJECTIVES = {
    "study_topic",
    "practice_tasks",
    "reading_minutes",
    "mindfulness_minutes",
    "project_milestone",
    "portfolio_cases",
    "skill_unlock",
}

SOCIAL_OBJECTIVES = {
    "social_task",
    "friend_support",
    "communication",
    "relationships_action",
    "team_task",
}


def _clamp(value: float, low: int = 1, high: int = 100) -> int:
    return max(low, min(high, int(round(value))))


def _tier(value: int) -> str:
    if value >= 85:
        return "legendary"
    if value >= 65:
        return "epic"
    if value >= 45:
        return "rare"
    if value >= 25:
        return "uncommon"
    return "common"


def build_secondary_skills(
    db: Session,
    user_id: int,
    progress: UserClassProgress | None,
    reward_effects: dict[str, float] | None = None,
) -> dict:
    if progress is None:
        return {
            "skills": [],
            "summary": {"total_power": 0, "dominant_skill": None},
        }

    reward_effects = reward_effects or {}
    total_completed = (
        db.query(Quest)
        .filter(Quest.user_id == user_id, Quest.is_completed == True)
        .count()
    )
    learning_completed = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.is_completed == True,
            Quest.objective_type.in_(list(LEARNING_OBJECTIVES)),
        )
        .count()
    )
    social_completed = (
        db.query(Quest)
        .filter(
            Quest.user_id == user_id,
            Quest.is_completed == True,
            Quest.objective_type.in_(list(SOCIAL_OBJECTIVES)),
        )
        .count()
    )
    achievements_count = db.query(UserAchievement).filter(UserAchievement.user_id == user_id).count()

    streak = int(progress.streak or 0)
    level = int(progress.level or 1)
    strength = float(progress.strength or 0)
    agility = float(progress.agility or 0)
    intellect = float(progress.intellect or 0)
    stamina = float(getattr(progress, "stamina", 0) or 0)

    xp_bonus_percent = float(reward_effects.get("xp_bonus", 0.0) or 0.0) * 100.0
    loot_bonus_percent = float(reward_effects.get("loot_bonus", 0.0) or 0.0) * 100.0
    gold_bonus_percent = float(reward_effects.get("gold_bonus", 0.0) or 0.0) * 100.0

    discipline_value = _clamp(18 + streak * 1.7 + min(total_completed, 220) * 0.14 + level * 0.4)
    focus_value = _clamp(16 + intellect * 1.5 + learning_completed * 0.65 + xp_bonus_percent * 0.4)
    energy_value = _clamp(20 + stamina * 1.8 + level * 1.9 + streak * 0.35)
    charisma_value = _clamp(14 + agility * 1.2 + social_completed * 1.4 + achievements_count * 0.8 + gold_bonus_percent * 0.25)
    luck_value = _clamp(12 + loot_bonus_percent * 1.45 + achievements_count * 0.6 + strength * 0.12)

    skills = [
        {
            "id": "discipline",
            "value": discipline_value,
            "tier": _tier(discipline_value),
            "effect": {"quest_success_bonus_percent": round(min(24.0, discipline_value * 0.26), 1)},
            "source": {
                "streak": streak,
                "completed_quests": total_completed,
            },
        },
        {
            "id": "focus",
            "value": focus_value,
            "tier": _tier(focus_value),
            "effect": {"learning_xp_bonus_percent": round(min(30.0, 4.0 + focus_value * 0.28), 1)},
            "source": {
                "intellect": intellect,
                "learning_quests": learning_completed,
            },
        },
        {
            "id": "energy",
            "value": energy_value,
            "tier": _tier(energy_value),
            "effect": {"extra_daily_quests": min(3, energy_value // 30)},
            "source": {
                "stamina": stamina,
                "level": level,
            },
        },
        {
            "id": "charisma",
            "value": charisma_value,
            "tier": _tier(charisma_value),
            "effect": {"social_gold_bonus_percent": round(min(22.0, charisma_value * 0.24), 1)},
            "source": {
                "agility": agility,
                "social_quests": social_completed,
            },
        },
        {
            "id": "luck",
            "value": luck_value,
            "tier": _tier(luck_value),
            "effect": {"rare_loot_bonus_percent": round(min(18.0, luck_value * 0.2), 1)},
            "source": {
                "loot_bonus_percent": round(loot_bonus_percent, 2),
                "achievements": achievements_count,
            },
        },
    ]

    dominant = max(skills, key=lambda entry: entry["value"]) if skills else None
    total_power = int(round(sum(entry["value"] for entry in skills) / max(len(skills), 1)))

    return {
        "skills": skills,
        "summary": {
            "total_power": total_power,
            "dominant_skill": dominant["id"] if dominant else None,
            "streak": streak,
            "completed_quests": total_completed,
        },
    }
