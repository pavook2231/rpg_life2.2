from __future__ import annotations

DEFAULT_GOAL_TYPE = "lose"
DEFAULT_GOAL_TERM_MONTHS = 6
SUPPORTED_GOAL_TERMS = (3, 6, 9)

GOAL_TERMS = {
    3: {
        "id": 3,
        "title": "3 months",
        "ru_title": "3 месяца",
        "tempo": "fast",
        "daily_goal_tasks": 1,
        "weekly_goal_tasks": 1,
        "long_term_goal_tasks": 0,
        "xp_multiplier": 1.1,
    },
    6: {
        "id": 6,
        "title": "6 months",
        "ru_title": "6 месяцев",
        "tempo": "balanced",
        "daily_goal_tasks": 1,
        "weekly_goal_tasks": 1,
        "long_term_goal_tasks": 0,
        "xp_multiplier": 1.0,
    },
    9: {
        "id": 9,
        "title": "9 months",
        "ru_title": "9 месяцев",
        "tempo": "steady",
        "daily_goal_tasks": 1,
        "weekly_goal_tasks": 1,
        "long_term_goal_tasks": 0,
        "xp_multiplier": 0.9,
    },
}

GOAL_CARDS = {
    "lose": {
        "id": "lose",
        "title": "Снижение веса",
        "description": "Детерминированная программа снижения веса с обязательным анамнезом, базовой точкой и адаптивным планом ходьбы.",
        "result_example": "Чёткий маршрут: стартовые данные, замеры, шаги и еженедельный обзор прогресса.",
        "icon": "run-fast",
        "accent_color": "#2ecc71",
        "recommended_term_months": 6,
        "is_primary": True,
    },
    "maintain": {
        "id": "maintain",
        "title": "Удержание веса",
        "description": "Профиль можно сохранить уже сейчас, но отдельная программа удержания веса пока не активирована.",
        "result_example": "Здесь появится отдельный маршрут без имитации логики снижения веса.",
        "icon": "scale-balance",
        "accent_color": "#3498db",
        "recommended_term_months": 6,
        "is_primary": False,
    },
    "gain": {
        "id": "gain",
        "title": "Набор веса",
        "description": "Профиль можно сохранить уже сейчас, но отдельная программа набора веса пока не поддерживается.",
        "result_example": "Когда режим будет готов, он получит собственную механику вместо заглушки.",
        "icon": "arm-flex",
        "accent_color": "#e67e22",
        "recommended_term_months": 6,
        "is_primary": False,
    },
}

GOAL_QUEST_LIBRARY = {
    "lose": [],
    "maintain": [],
    "gain": [],
}


def normalize_goal_type(goal_type: str | None) -> str:
    raw = str(goal_type or "").strip().lower()
    if not raw:
        return DEFAULT_GOAL_TYPE
    if raw in GOAL_CARDS:
        return raw
    aliases = {
        "weight_health": "lose",
        "weight_loss": "lose",
        "weightloss": "lose",
        "lose_weight": "lose",
        "loss": "lose",
        "maintain_weight": "maintain",
        "maintenance": "maintain",
        "gain_weight": "gain",
        "mass_gain": "gain",
        "personal_development": "lose",
        "self_development": "lose",
        "productivity": "lose",
        "financial_growth": "lose",
        "financial_independence": "lose",
        "new_profession": "lose",
        "discipline_productivity": "lose",
        "self_realization": "lose",
        "business_building": "lose",
        "relationships": "lose",
        "creativity": "lose",
        "language_learning": "lose",
    }
    return aliases.get(raw, DEFAULT_GOAL_TYPE)


def normalize_goal_term_months(months: int | None) -> int:
    if months in SUPPORTED_GOAL_TERMS:
        return int(months)
    return DEFAULT_GOAL_TERM_MONTHS


def get_goal_term(months: int | None) -> dict:
    term_months = normalize_goal_term_months(months)
    return GOAL_TERMS[term_months]


def get_goal_info(goal_type: str | None) -> dict:
    normalized = normalize_goal_type(goal_type)
    return GOAL_CARDS[normalized]


def list_goal_cards(include_optional: bool = True) -> list[dict]:
    cards = [card for card in GOAL_CARDS.values() if include_optional or card.get("is_primary", False)]
    return sorted(cards, key=lambda entry: (not entry.get("is_primary", False), entry.get("title", "")))


def get_goal_templates(goal_type: str | None, bucket: str, phase: int) -> list[dict]:
    _ = bucket
    _ = phase
    normalized = normalize_goal_type(goal_type)
    return list(GOAL_QUEST_LIBRARY.get(normalized, []))


GOALS = {
    key: {
        "name": value["title"],
        "icon": value["icon"],
        "description": value["description"],
        "color": value["accent_color"],
        "quests": GOAL_QUEST_LIBRARY.get(key, []),
    }
    for key, value in GOAL_CARDS.items()
}


def get_goal_quests(goal_type: str):
    normalized = normalize_goal_type(goal_type)
    return GOAL_QUEST_LIBRARY.get(normalized, GOAL_QUEST_LIBRARY[DEFAULT_GOAL_TYPE])


def get_all_goals():
    return list(GOAL_CARDS.keys())
