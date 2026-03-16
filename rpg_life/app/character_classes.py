CHARACTER_CLASSES = {
    "warrior": {
        "name": "Воин",
        "icon": "⚔️",
        "description": "Мастер силы и ближнего боя",
        "color": "#e74c3c",
        "main_stat": "strength",
        "quests": [
            {
                "title": "Воин: набрать 180 XP",
                "description": "Держи высокий темп и заработай достаточно опыта за день.",
                "objective_type": "xp_gained",
                "target_value": 180,
                "xp": 95,
                "crystals": 14,
                "icon": "🛡️",
                "difficulty": "medium",
            },
            {
                "title": "Воин: закрыть 3 задания",
                "description": "Покажи дисциплину и добейся результата сразу в нескольких заданиях.",
                "objective_type": "quests_completed",
                "target_value": 3,
                "xp": 100,
                "crystals": 15,
                "icon": "⚔️",
                "difficulty": "hard",
            },
        ],
    },
    "archer": {
        "name": "Лучник",
        "icon": "🏹",
        "description": "Мастер ловкости и темпа",
        "color": "#27ae60",
        "main_stat": "agility",
        "quests": [
            {
                "title": "Лучник: пройти 8 000 шагов",
                "description": "Держи мобильность и накапливай прогресс через активность.",
                "objective_type": "steps",
                "target_value": 8000,
                "xp": 90,
                "crystals": 14,
                "icon": "🏃",
                "difficulty": "medium",
            },
            {
                "title": "Лучник: пройти 12 000 шагов",
                "description": "Сделай длинный марш и добейся усиленной награды.",
                "objective_type": "steps",
                "target_value": 12000,
                "xp": 115,
                "crystals": 18,
                "icon": "🎯",
                "difficulty": "hard",
            },
        ],
    },
    "mage": {
        "name": "Маг",
        "icon": "🧙",
        "description": "Мастер интеллекта и концентрации",
        "color": "#9b59b6",
        "main_stat": "intellect",
        "quests": [
            {
                "title": "Маг: набрать 240 XP",
                "description": "Сохрани концентрацию и накопи крупный объем опыта за день.",
                "objective_type": "xp_gained",
                "target_value": 240,
                "xp": 105,
                "crystals": 16,
                "icon": "🔮",
                "difficulty": "hard",
            },
            {
                "title": "Маг: закрыть 4 задания",
                "description": "Собери серию завершенных задач и подтверди мастерство контроля.",
                "objective_type": "quests_completed",
                "target_value": 4,
                "xp": 100,
                "crystals": 15,
                "icon": "📘",
                "difficulty": "medium",
            },
        ],
    },
}


def get_class_quests(character_class: str):
    if character_class in CHARACTER_CLASSES:
        return CHARACTER_CLASSES[character_class]["quests"]
    return CHARACTER_CLASSES["mage"]["quests"]


def get_class_info(character_class: str):
    return CHARACTER_CLASSES.get(character_class, CHARACTER_CLASSES["mage"])
