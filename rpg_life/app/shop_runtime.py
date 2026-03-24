from __future__ import annotations

from typing import Any

from app.core.cache import cache_get_json, cache_set_json
from app.core.dates import utc_now

SHOP_CATALOG_KEYS = {
    "equipment": "equipment",
    "xp_scrolls": "xp_scrolls",
    "contracts": "contracts",
    "enchants": "enchants",
    "services": "services",
}

XP_SCROLL_PRODUCTS = [
    {
        "id": -9201,
        "key": "xp_scroll_100",
        "name": "XP Scroll 100",
        "description": "Instantly grants 100 XP.",
        "icon": "script-text-outline",
        "xp_amount": 100,
        "price_crystals": 25,
    },
    {
        "id": -9202,
        "key": "xp_scroll_500",
        "name": "XP Scroll 500",
        "description": "Instantly grants 500 XP.",
        "icon": "script-text",
        "xp_amount": 500,
        "price_crystals": 100,
    },
    {
        "id": -9203,
        "key": "xp_scroll_1000",
        "name": "XP Scroll 1000",
        "description": "Instantly grants 1000 XP.",
        "icon": "book-open-page-variant",
        "xp_amount": 1000,
        "price_crystals": 180,
    },
    {
        "id": -9204,
        "key": "xp_scroll_5000",
        "name": "XP Scroll 5000",
        "description": "Instantly grants 5000 XP.",
        "icon": "book-open-variant",
        "xp_amount": 5000,
        "price_crystals": 700,
    },
    {
        "id": -9205,
        "key": "xp_scroll_10000",
        "name": "XP Scroll 10000",
        "description": "Instantly grants 10000 XP.",
        "icon": "book-open-blank-variant",
        "xp_amount": 10000,
        "price_crystals": 1300,
    },
]
XP_SCROLL_BY_ID = {entry["id"]: entry for entry in XP_SCROLL_PRODUCTS}

QUEST_CONTRACT_PRODUCTS = [
    {
        "id": -9301,
        "key": "contract_adventurer",
        "name": "Adventurer Contract",
        "description": "A short contract with balanced rewards.",
        "icon": "sword-cross",
        "price_crystals": 180,
        "charges": 3,
        "xp_bonus": 0.15,
        "gold_bonus": 0.10,
        "loot_bonus": 0.03,
    },
    {
        "id": -9302,
        "key": "contract_guild",
        "name": "Guild Contract",
        "description": "A stronger contract for active quest chains.",
        "icon": "shield-crown-outline",
        "price_crystals": 340,
        "charges": 5,
        "xp_bonus": 0.25,
        "gold_bonus": 0.18,
        "loot_bonus": 0.05,
    },
    {
        "id": -9303,
        "key": "contract_heroic",
        "name": "Heroic Contract",
        "description": "Premium long contract for serious progression.",
        "icon": "trophy-outline",
        "price_crystals": 620,
        "charges": 10,
        "xp_bonus": 0.40,
        "gold_bonus": 0.30,
        "loot_bonus": 0.08,
    },
]
QUEST_CONTRACT_BY_ID = {entry["id"]: entry for entry in QUEST_CONTRACT_PRODUCTS}

WEAPON_ENCHANT_PRODUCTS = [
    {
        "id": -9401,
        "key": "enchant_might",
        "name": "Rune of Might",
        "description": "Adds physical power and weapon damage.",
        "icon": "hammer-wrench",
        "price_crystals": 260,
        "effects": {
            "strength": 2,
            "damage_min": 2,
            "damage_max": 4,
        },
    },
    {
        "id": -9402,
        "key": "enchant_precision",
        "name": "Rune of Precision",
        "description": "Improves critical chance and hit quality.",
        "icon": "target",
        "price_crystals": 290,
        "effects": {
            "agility": 2,
            "critical_chance": 0.03,
            "damage_min": 1,
            "damage_max": 2,
        },
    },
    {
        "id": -9403,
        "key": "enchant_wisdom",
        "name": "Rune of Wisdom",
        "description": "Improves intellect and XP gains.",
        "icon": "school-outline",
        "price_crystals": 320,
        "effects": {
            "intellect": 2,
            "xp_bonus": 0.06,
        },
    },
    {
        "id": -9404,
        "key": "enchant_fortune",
        "name": "Rune of Fortune",
        "description": "Improves luck and gold rewards.",
        "icon": "clover",
        "price_crystals": 330,
        "effects": {
            "luck": 0.03,
            "gold_bonus": 0.06,
        },
    },
]
WEAPON_ENCHANT_BY_ID = {entry["id"]: entry for entry in WEAPON_ENCHANT_PRODUCTS}

CONTRACT_TTL_SECONDS = 30 * 24 * 60 * 60
ENCHANTS_TTL_SECONDS = 90 * 24 * 60 * 60
PURCHASE_RESULT_TTL_SECONDS = 15 * 60


def _contract_cache_key(user_id: int) -> str:
    return f"shop:contract:{user_id}"


def _enchant_cache_key(user_id: int) -> str:
    return f"shop:weapon-enchants:{user_id}"


def _purchase_result_cache_key(user_id: int, client_request_id: str) -> str:
    return f"shop:purchase-result:{user_id}:{client_request_id}"


def get_active_contract(user_id: int) -> dict[str, Any] | None:
    payload = cache_get_json(_contract_cache_key(user_id))
    if not payload or not isinstance(payload, dict):
        return None
    remaining = max(0, int(payload.get("remaining_quests", 0) or 0))
    if remaining <= 0:
        return None
    return payload


def set_active_contract(user_id: int, contract_product: dict[str, Any]) -> dict[str, Any]:
    now_iso = utc_now().isoformat()
    payload = {
        "id": contract_product["id"],
        "key": contract_product["key"],
        "name": contract_product["name"],
        "icon": contract_product["icon"],
        "description": contract_product["description"],
        "xp_bonus": float(contract_product.get("xp_bonus", 0.0) or 0.0),
        "gold_bonus": float(contract_product.get("gold_bonus", 0.0) or 0.0),
        "loot_bonus": float(contract_product.get("loot_bonus", 0.0) or 0.0),
        "remaining_quests": int(contract_product.get("charges", 0) or 0),
        "total_quests": int(contract_product.get("charges", 0) or 0),
        "started_at": now_iso,
    }
    cache_set_json(_contract_cache_key(user_id), payload, ttl=CONTRACT_TTL_SECONDS)
    return payload


def consume_contract_charge(user_id: int) -> dict[str, Any] | None:
    active = get_active_contract(user_id)
    if not active:
        return None
    remaining = max(0, int(active.get("remaining_quests", 0) or 0) - 1)
    if remaining <= 0:
        cache_set_json(_contract_cache_key(user_id), {"remaining_quests": 0}, ttl=30)
        return None
    active["remaining_quests"] = remaining
    cache_set_json(_contract_cache_key(user_id), active, ttl=CONTRACT_TTL_SECONDS)
    return active


def get_weapon_enchants(user_id: int) -> dict[str, dict[str, Any]]:
    payload = cache_get_json(_enchant_cache_key(user_id))
    if not payload or not isinstance(payload, dict):
        return {}
    normalized: dict[str, dict[str, Any]] = {}
    for inventory_id, enchant_payload in payload.items():
        if not isinstance(enchant_payload, dict):
            continue
        normalized[str(inventory_id)] = enchant_payload
    return normalized


def set_weapon_enchant(user_id: int, inventory_id: int, enchant_product: dict[str, Any]) -> dict[str, Any]:
    payload = get_weapon_enchants(user_id)
    normalized_inventory_id = str(int(inventory_id))
    enchant_payload = {
        "id": enchant_product["id"],
        "key": enchant_product["key"],
        "name": enchant_product["name"],
        "icon": enchant_product["icon"],
        "description": enchant_product["description"],
        "effects": dict(enchant_product.get("effects", {}) or {}),
        "applied_at": utc_now().isoformat(),
    }
    payload[normalized_inventory_id] = enchant_payload
    cache_set_json(_enchant_cache_key(user_id), payload, ttl=ENCHANTS_TTL_SECONDS)
    return enchant_payload


def get_weapon_enchant_for_inventory(user_id: int, inventory_id: int | None) -> dict[str, Any] | None:
    if not inventory_id:
        return None
    payload = get_weapon_enchants(user_id)
    return payload.get(str(int(inventory_id)))


def get_cached_purchase_result(user_id: int, client_request_id: str) -> dict[str, Any] | None:
    if not client_request_id:
        return None
    payload = cache_get_json(_purchase_result_cache_key(user_id, client_request_id))
    if not payload or not isinstance(payload, dict):
        return None
    return payload


def cache_purchase_result(user_id: int, client_request_id: str, payload: dict[str, Any]) -> None:
    if not client_request_id:
        return
    cache_set_json(
        _purchase_result_cache_key(user_id, client_request_id),
        payload,
        ttl=PURCHASE_RESULT_TTL_SECONDS,
    )
