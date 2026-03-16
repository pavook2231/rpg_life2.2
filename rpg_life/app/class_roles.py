from __future__ import annotations

from typing import Any


def _weekly_focus(
    objective_type: str,
    *,
    label_ru: str,
    label_en: str,
    tiers: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "objective_type": objective_type,
        "target": int(tiers[-1]["target"]),
        "reward_xp": sum(int(tier["reward_xp"]) for tier in tiers),
        "reward_crystals": sum(int(tier["reward_crystals"]) for tier in tiers),
        "label": {"ru": label_ru, "en": label_en},
        "tiers": tiers,
    }


def _seasonal_focus(
    objective_type: str,
    *,
    label_ru: str,
    label_en: str,
    reward_identity_ru: str,
    reward_identity_en: str,
    tiers: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "objective_type": objective_type,
        "target": int(tiers[-1]["target"]),
        "label": {"ru": label_ru, "en": label_en},
        "reward_identity": {"ru": reward_identity_ru, "en": reward_identity_en},
        "tiers": tiers,
    }


CLASS_ROLE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "warrior": {
        "name": {"ru": "Воин", "en": "Warrior"},
        "title": {"ru": "Фронтовой штурмовик", "en": "Frontline bruiser"},
        "description": {
            "ru": "Воин растет через устойчивый ритм, закрытые задания, тяжелую броню и силовое оружие.",
            "en": "Warriors grow through steady rhythm, closed tasks, heavy armor, and strength weapons.",
        },
        "weekly_focus": _weekly_focus(
            "quests_completed",
            label_ru="Закрой 14 подтверждаемых заданий за неделю.",
            label_en="Complete 14 verified tasks this week.",
            tiers=[
                {
                    "target": 5,
                    "reward_xp": 45,
                    "reward_crystals": 15,
                    "title": {"ru": "Строй", "en": "Formation"},
                },
                {
                    "target": 9,
                    "reward_xp": 60,
                    "reward_crystals": 20,
                    "title": {"ru": "Штурм", "en": "Assault"},
                },
                {
                    "target": 14,
                    "reward_xp": 75,
                    "reward_crystals": 25,
                    "title": {"ru": "Легенда фронта", "en": "Frontline legend"},
                },
            ],
        ),
        "seasonal_focus": _seasonal_focus(
            "quests_completed",
            label_ru="Сезон фронтира: закрой 12 подтверждаемых заданий.",
            label_en="Frontier season: finish 12 verified tasks.",
            reward_identity_ru="Воин получает больше фронтового жалования и сундуки с тяжелой добычей.",
            reward_identity_en="Warriors earn more frontline pay and heavier loot caches.",
            tiers=[
                {
                    "target": 4,
                    "reward_xp": 35,
                    "reward_crystals": 20,
                    "title": {"ru": "Передовой дозор", "en": "Forward watch"},
                },
                {
                    "target": 8,
                    "reward_xp": 50,
                    "reward_crystals": 25,
                    "chest_name": "COMMON_CHEST",
                    "title": {"ru": "Железный строй", "en": "Iron formation"},
                },
                {
                    "target": 12,
                    "reward_xp": 65,
                    "reward_crystals": 35,
                    "chest_name": "RARE_CHEST",
                    "title": {"ru": "Гроза бастиона", "en": "Bastion storm"},
                },
            ],
        ),
        "shop_preferences": {
            "required_class": 90.0,
            "wrong_class_penalty": -70.0,
            "type_weights": {"armor": 20.0, "weapon": 16.0, "accessory": 6.0},
            "slot_weights": {
                "head": 10.0,
                "chest": 14.0,
                "shoulders": 10.0,
                "hands": 8.0,
                "waist": 7.0,
                "legs": 10.0,
                "feet": 8.0,
                "main_hand": 14.0,
                "off_hand": 8.0,
            },
            "subclass_weights": {"sword": 14.0, "axe": 14.0, "mace": 12.0, "helmet": 10.0, "belt": 6.0},
            "weapon_category_weights": {"one_hand": 6.0, "two_hand": 10.0},
            "stat_weights": {
                "strength_bonus": 14.0,
                "stamina_bonus": 10.0,
                "armor": 0.08,
                "damage": 1.4,
                "critical_strike_chance": 30.0,
            },
        },
    },
    "archer": {
        "name": {"ru": "Лучник", "en": "Archer"},
        "title": {"ru": "Охотник на темп", "en": "Tempo hunter"},
        "description": {
            "ru": "Лучник раскрывается через шаги, мобильность, криты и точные дальние билды.",
            "en": "Archers thrive on steps, mobility, crits, and precise ranged builds.",
        },
        "weekly_focus": _weekly_focus(
            "steps",
            label_ru="Пройди 56 000 шагов за неделю.",
            label_en="Walk 56,000 steps this week.",
            tiers=[
                {
                    "target": 16000,
                    "reward_xp": 45,
                    "reward_crystals": 15,
                    "title": {"ru": "Следопыт", "en": "Pathfinder"},
                },
                {
                    "target": 36000,
                    "reward_xp": 60,
                    "reward_crystals": 20,
                    "title": {"ru": "Засада", "en": "Ambush"},
                },
                {
                    "target": 56000,
                    "reward_xp": 75,
                    "reward_crystals": 25,
                    "title": {"ru": "Королевский выстрел", "en": "Royal shot"},
                },
            ],
        ),
        "seasonal_focus": _seasonal_focus(
            "steps",
            label_ru="Сезон охоты: пройди 48 000 шагов.",
            label_en="Hunt season: walk 48,000 steps.",
            reward_identity_ru="Лучник растит темп и получает тайники разведчика за движение.",
            reward_identity_en="Archers build tempo and unlock scout caches through movement.",
            tiers=[
                {
                    "target": 12000,
                    "reward_xp": 40,
                    "reward_crystals": 15,
                    "title": {"ru": "Тихий след", "en": "Silent trail"},
                },
                {
                    "target": 28000,
                    "reward_xp": 55,
                    "reward_crystals": 20,
                    "chest_name": "COMMON_CHEST",
                    "title": {"ru": "Лесная засада", "en": "Forest ambush"},
                },
                {
                    "target": 48000,
                    "reward_xp": 70,
                    "reward_crystals": 25,
                    "chest_name": "RARE_CHEST",
                    "title": {"ru": "Ветер дальнего выстрела", "en": "Longshot wind"},
                },
            ],
        ),
        "shop_preferences": {
            "required_class": 90.0,
            "wrong_class_penalty": -70.0,
            "type_weights": {"weapon": 18.0, "armor": 10.0, "accessory": 14.0},
            "slot_weights": {
                "back": 8.0,
                "chest": 8.0,
                "feet": 8.0,
                "hands": 6.0,
                "ring": 10.0,
                "trinket": 12.0,
            },
            "subclass_weights": {"bow": 18.0, "dagger": 9.0, "ring": 10.0, "trinket": 12.0},
            "weapon_category_weights": {"ranged": 20.0, "one_hand": 6.0},
            "stat_weights": {
                "agility_bonus": 15.0,
                "damage": 1.3,
                "critical_strike_chance": 36.0,
                "luck_bonus": 18.0,
            },
        },
    },
    "mage": {
        "name": {"ru": "Маг", "en": "Mage"},
        "title": {"ru": "Мастер концентрации", "en": "Focus channeler"},
        "description": {
            "ru": "Маг сильнее всего растет через большие всплески опыта, интеллект и усиление наград.",
            "en": "Mages scale best through large XP bursts, intellect, and reward amplification.",
        },
        "weekly_focus": _weekly_focus(
            "xp_gained",
            label_ru="Набери 950 опыта за неделю.",
            label_en="Earn 950 XP this week.",
            tiers=[
                {
                    "target": 250,
                    "reward_xp": 45,
                    "reward_crystals": 15,
                    "title": {"ru": "Искра", "en": "Spark"},
                },
                {
                    "target": 550,
                    "reward_xp": 60,
                    "reward_crystals": 20,
                    "title": {"ru": "Фокус", "en": "Focus"},
                },
                {
                    "target": 950,
                    "reward_xp": 75,
                    "reward_crystals": 25,
                    "title": {"ru": "Арканный пик", "en": "Arcane apex"},
                },
            ],
        ),
        "seasonal_focus": _seasonal_focus(
            "xp_gained",
            label_ru="Сезон мистерий: накопи 820 опыта.",
            label_en="Mystic season: earn 820 XP.",
            reward_identity_ru="Маг получает всплески опыта и более редкие арканные сундуки.",
            reward_identity_en="Mages gain larger XP bursts and rarer arcane caches.",
            tiers=[
                {
                    "target": 220,
                    "reward_xp": 50,
                    "reward_crystals": 10,
                    "title": {"ru": "Малая искра", "en": "Minor spark"},
                },
                {
                    "target": 480,
                    "reward_xp": 70,
                    "reward_crystals": 15,
                    "chest_name": "COMMON_CHEST",
                    "title": {"ru": "Печать фокуса", "en": "Seal of focus"},
                },
                {
                    "target": 820,
                    "reward_xp": 90,
                    "reward_crystals": 20,
                    "chest_name": "EPIC_CHEST",
                    "title": {"ru": "Арканный прорыв", "en": "Arcane breakthrough"},
                },
            ],
        ),
        "shop_preferences": {
            "required_class": 90.0,
            "wrong_class_penalty": -70.0,
            "type_weights": {"weapon": 18.0, "armor": 8.0, "accessory": 16.0},
            "slot_weights": {
                "head": 7.0,
                "chest": 8.0,
                "neck": 10.0,
                "ring": 10.0,
                "trinket": 12.0,
                "main_hand": 14.0,
                "off_hand": 12.0,
            },
            "subclass_weights": {"staff": 20.0, "necklace": 10.0, "ring": 10.0, "trinket": 12.0},
            "weapon_category_weights": {"two_hand": 14.0, "one_hand": 4.0},
            "stat_weights": {
                "intellect_bonus": 15.0,
                "damage": 1.2,
                "critical_strike_chance": 28.0,
                "luck_bonus": 16.0,
            },
        },
    },
}


def get_class_role(character_class: str | None) -> dict[str, Any]:
    if character_class in CLASS_ROLE_DEFINITIONS:
        return CLASS_ROLE_DEFINITIONS[character_class]
    return CLASS_ROLE_DEFINITIONS["mage"]


def _localized(payload: dict[str, str] | None, language: str) -> str:
    if not payload:
        return ""
    if language == "en" and payload.get("en"):
        return payload["en"]
    return payload.get("ru") or payload.get("en") or ""


def build_class_role_summary(character_class: str | None, language: str = "ru") -> dict[str, Any]:
    role = get_class_role(character_class)
    weekly_focus = role["weekly_focus"]
    seasonal_focus = role.get("seasonal_focus") or {}
    tier_count = len(weekly_focus.get("tiers") or [])
    return {
        "class_name": character_class or "mage",
        "name": _localized(role.get("name"), language),
        "title": _localized(role.get("title"), language),
        "description": _localized(role.get("description"), language),
        "weekly_focus_label": _localized(weekly_focus.get("label"), language),
        "weekly_tier_count": tier_count,
        "seasonal_focus_label": _localized(seasonal_focus.get("label"), language),
        "seasonal_reward_identity": _localized(seasonal_focus.get("reward_identity"), language),
    }


def score_item_for_class(item: dict[str, Any], character_class: str | None) -> float:
    role = get_class_role(character_class)
    preferences = role["shop_preferences"]
    stats = item.get("stats") or {}
    weapon_stats = item.get("weapon_stats") or {}
    armor_stats = item.get("armor_stats") or {}

    score = 0.0

    required_class = item.get("required_class")
    if required_class and character_class:
        if required_class == character_class:
            score += preferences.get("required_class", 0.0)
        else:
            score += preferences.get("wrong_class_penalty", 0.0)

    score += preferences.get("type_weights", {}).get(item.get("type"), 0.0)
    score += preferences.get("slot_weights", {}).get(item.get("slot"), 0.0)
    score += preferences.get("subclass_weights", {}).get(item.get("subclass"), 0.0)
    score += preferences.get("weapon_category_weights", {}).get(weapon_stats.get("weapon_category"), 0.0)

    stat_weights = preferences.get("stat_weights", {})
    score += float(stats.get("strength_bonus", 0)) * stat_weights.get("strength_bonus", 0.0)
    score += float(stats.get("agility_bonus", 0)) * stat_weights.get("agility_bonus", 0.0)
    score += float(stats.get("intellect_bonus", 0)) * stat_weights.get("intellect_bonus", 0.0)
    score += float(stats.get("stamina_bonus", 0)) * stat_weights.get("stamina_bonus", 0.0)
    score += float(stats.get("luck_bonus", 0)) * stat_weights.get("luck_bonus", 0.0)
    score += float(stats.get("critical_bonus", 0)) * stat_weights.get("critical_bonus", 0.0)
    score += float(weapon_stats.get("critical_strike_chance", 0)) * stat_weights.get("critical_strike_chance", 0.0)
    score += float(armor_stats.get("armor_value", 0)) * stat_weights.get("armor", 0.0)

    avg_damage = (float(weapon_stats.get("damage_min", 0)) + float(weapon_stats.get("damage_max", 0))) / 2
    score += avg_damage * stat_weights.get("damage", 0.0)

    if item.get("required_level", 1) <= 5:
        score += 1.0

    return score
