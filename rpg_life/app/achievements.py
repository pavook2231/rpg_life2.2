from __future__ import annotations

from .text_utils import repair_mojibake


ACHIEVEMENTS = [
    {
        "id": "first_quest",
        "title": "Первое задание",
        "description": "Выполнить первое задание.",
        "icon": "🌟",
        "xp_reward": 50,
        "crystal_reward": 10,
    },
    {
        "id": "quest_master_10",
        "title": "Мастер заданий I",
        "description": "Выполнить 10 заданий.",
        "icon": "⚔️",
        "xp_reward": 100,
        "crystal_reward": 20,
    },
    {
        "id": "quest_master_25",
        "title": "Мастер заданий II",
        "description": "Выполнить 25 заданий.",
        "icon": "📜",
        "xp_reward": 180,
        "crystal_reward": 35,
    },
    {
        "id": "quest_master_50",
        "title": "Мастер заданий III",
        "description": "Выполнить 50 заданий.",
        "icon": "🏆",
        "xp_reward": 320,
        "crystal_reward": 60,
    },
    {
        "id": "level_5",
        "title": "Уровень 5",
        "description": "Достичь 5 уровня.",
        "icon": "📈",
        "xp_reward": 200,
        "crystal_reward": 30,
    },
    {
        "id": "level_10",
        "title": "Уровень 10",
        "description": "Достичь 10 уровня.",
        "icon": "💪",
        "xp_reward": 500,
        "crystal_reward": 50,
    },
    {
        "id": "level_20",
        "title": "Уровень 20",
        "description": "Достичь 20 уровня.",
        "icon": "👑",
        "xp_reward": 900,
        "crystal_reward": 120,
    },
    {
        "id": "streak_7",
        "title": "Неделя силы",
        "description": "Заходить 7 дней подряд.",
        "icon": "📅",
        "xp_reward": 100,
        "crystal_reward": 20,
    },
    {
        "id": "streak_30",
        "title": "Железная дисциплина",
        "description": "Держать серию 30 дней.",
        "icon": "🔥",
        "xp_reward": 450,
        "crystal_reward": 80,
    },
    {
        "id": "crystals_100",
        "title": "Коллекционер",
        "description": "Накопить 100 золота.",
        "icon": "💰",
        "xp_reward": 100,
        "crystal_reward": 0,
    },
    {
        "id": "gold_250",
        "title": "Золотой запас",
        "description": "Накопить 250 золота.",
        "icon": "🪙",
        "xp_reward": 250,
        "crystal_reward": 30,
    },
    {
        "id": "custom_creator_5",
        "title": "Архитектор дня",
        "description": "Выполнить 5 собственных заданий.",
        "icon": "🛠️",
        "xp_reward": 180,
        "crystal_reward": 30,
    },
    {
        "id": "boss_slayer_3",
        "title": "Покоритель боссов",
        "description": "Закрыть 3 больших задания.",
        "icon": "🐉",
        "xp_reward": 420,
        "crystal_reward": 65,
    },
    {
        "id": "master_warrior",
        "title": "Мастер Воина",
        "description": "Достичь 10 уровня классом Воин.",
        "icon": "⚔️",
        "xp_reward": 500,
        "crystal_reward": 100,
    },
    {
        "id": "master_archer",
        "title": "Мастер Лучника",
        "description": "Достичь 10 уровня классом Лучник.",
        "icon": "🏹",
        "xp_reward": 500,
        "crystal_reward": 100,
    },
    {
        "id": "master_mage",
        "title": "Мастер Мага",
        "description": "Достичь 10 уровня классом Маг.",
        "icon": "🧙",
        "xp_reward": 500,
        "crystal_reward": 100,
    },
    {
        "id": "immortal_hunter",
        "title": "Охотник за Бессмертными",
        "description": "Выполнить 5 бессмертных квестов.",
        "icon": "🗡️",
        "xp_reward": 1000,
        "crystal_reward": 200,
    },
]

ACHIEVEMENT_VISUALS = {
    "first_quest": {"theme": "self", "background_key": "adventure_start", "tier": "common", "animated_background": False},
    "quest_master_10": {"theme": "self", "background_key": "quest_board", "tier": "uncommon", "animated_background": False},
    "quest_master_25": {"theme": "self", "background_key": "quest_board", "tier": "rare", "animated_background": False},
    "quest_master_50": {"theme": "self", "background_key": "quest_board_elite", "tier": "epic", "animated_background": True},
    "level_5": {"theme": "work", "background_key": "career_steps", "tier": "uncommon", "animated_background": False},
    "level_10": {"theme": "work", "background_key": "career_growth", "tier": "rare", "animated_background": False},
    "level_20": {"theme": "work", "background_key": "career_legend", "tier": "epic", "animated_background": True},
    "streak_7": {"theme": "sport", "background_key": "training_week", "tier": "uncommon", "animated_background": False},
    "streak_30": {"theme": "sport", "background_key": "training_marathon", "tier": "legendary", "animated_background": True},
    "crystals_100": {"theme": "finance", "background_key": "coin_path", "tier": "uncommon", "animated_background": False},
    "gold_250": {"theme": "finance", "background_key": "treasury", "tier": "rare", "animated_background": False},
    "custom_creator_5": {"theme": "self", "background_key": "design_lab", "tier": "rare", "animated_background": False},
    "boss_slayer_3": {"theme": "sport", "background_key": "arena", "tier": "epic", "animated_background": True},
    "master_warrior": {"theme": "work", "background_key": "warrior_hall", "tier": "epic", "animated_background": True},
    "master_archer": {"theme": "work", "background_key": "ranger_hall", "tier": "epic", "animated_background": True},
    "master_mage": {"theme": "books", "background_key": "mage_library", "tier": "epic", "animated_background": True},
    "immortal_hunter": {"theme": "self", "background_key": "immortal_vault", "tier": "legendary", "animated_background": True},
}

for achievement in ACHIEVEMENTS:
    visuals = ACHIEVEMENT_VISUALS.get(achievement["id"], {})
    achievement.update(
        {
            "theme": visuals.get("theme", "self"),
            "background_key": visuals.get("background_key", "default"),
            "tier": visuals.get("tier", "common"),
            "animated_background": bool(visuals.get("animated_background", False)),
        }
    )

ACHIEVEMENT_BY_ID = {achievement["id"]: achievement for achievement in ACHIEVEMENTS}
ACHIEVEMENT_ID_BY_TITLE = {achievement["title"]: achievement["id"] for achievement in ACHIEVEMENTS}


def get_earned_achievement_map(user_achievements):
    earned = {}
    for user_achievement in user_achievements:
        achievement = getattr(user_achievement, "achievement", None)
        if not achievement:
            continue
        achievement_name = repair_mojibake(getattr(achievement, "name", None))
        achievement_id = ACHIEVEMENT_ID_BY_TITLE.get(achievement_name)
        if achievement_id:
            earned[achievement_id] = user_achievement
    return earned


def build_achievement_stats(classes, total_completed: int, custom_completed: int, boss_completed: int, immortal_count: int):
    return {
        "classes": classes,
        "total_completed": total_completed,
        "custom_completed": custom_completed,
        "boss_completed": boss_completed,
        "immortal_count": immortal_count,
        "max_level": max((character.level for character in classes), default=0),
        "max_streak": max((character.streak for character in classes), default=0),
        "current_gold": sum(character.crystals for character in classes),
    }


def evaluate_achievement(achievement_id: str, stats: dict) -> bool:
    classes = stats["classes"]

    if achievement_id == "first_quest":
        return stats["total_completed"] >= 1
    if achievement_id == "quest_master_10":
        return stats["total_completed"] >= 10
    if achievement_id == "quest_master_25":
        return stats["total_completed"] >= 25
    if achievement_id == "quest_master_50":
        return stats["total_completed"] >= 50
    if achievement_id == "level_5":
        return stats["max_level"] >= 5
    if achievement_id == "level_10":
        return stats["max_level"] >= 10
    if achievement_id == "level_20":
        return stats["max_level"] >= 20
    if achievement_id == "streak_7":
        return stats["max_streak"] >= 7
    if achievement_id == "streak_30":
        return stats["max_streak"] >= 30
    if achievement_id == "crystals_100":
        return stats["current_gold"] >= 100
    if achievement_id == "gold_250":
        return stats["current_gold"] >= 250
    if achievement_id == "custom_creator_5":
        return stats["custom_completed"] >= 5
    if achievement_id == "boss_slayer_3":
        return stats["boss_completed"] >= 3
    if achievement_id == "master_warrior":
        return any(character.class_name == "warrior" and character.level >= 10 for character in classes)
    if achievement_id == "master_archer":
        return any(character.class_name == "archer" and character.level >= 10 for character in classes)
    if achievement_id == "master_mage":
        return any(character.class_name == "mage" and character.level >= 10 for character in classes)
    if achievement_id == "immortal_hunter":
        return stats["immortal_count"] >= 5
    return False
