from datetime import datetime, timedelta
import logging
import re
import threading
import time
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.class_roles import score_item_for_class
from app import crud
from app import shop_runtime
from app.beta_content import CHEST_CATALOG
from app.chest_items import CHEST_PRESENTATION, ensure_chest_item, get_chest_catalog_entry, grant_chest_to_user
from app.core.cache import cache_acquire_lock, cache_get_json, cache_release_lock, cache_set_json
from app.core.dates import utc_now
from app.equipment_service import (
    EquipmentError,
    equip_item,
    get_equipped_inventory_ids,
    get_equipped_items,
    recalculate_total_stats,
    sync_equipped_inventory_flags,
    unequip_item,
)
from app.item_service import EquipmentError as ItemEquipmentError, buy_item, sell_item, sync_catalog_items
from app.models import CharacterEquipment, Item, User, UserClassProgress, UserInventory
from app.text_utils import normalize_item_model, normalize_nested_strings

logger = logging.getLogger(__name__)

SHOP_ROTATION_HOURS = 12
ITEM_BONUS_FIELDS = (
    "strength_bonus",
    "agility_bonus",
    "intellect_bonus",
    "stamina_bonus",
    "critical_bonus",
    "luck_bonus",
    "xp_bonus",
    "crystal_bonus",
    "health_bonus",
)
CHEST_SHOP_IDS = {
    "COMMON_CHEST": -9001,
    "RARE_CHEST": -9002,
    "EPIC_CHEST": -9003,
    "LEGENDARY_CHEST": -9004,
}
CHEST_SHOP_PRESENTATION = CHEST_PRESENTATION
SHOP_SERVICE_IDS = {
    "bandage": -9101,
    "full_heal": -9102,
    "wound_cure": -9103,
}
SHOP_SERVICE_IDS_REVERSE = {value: key for key, value in SHOP_SERVICE_IDS.items()}
SHOP_SERVICE_DEFINITIONS = {
    "bandage": {
        "name": "Bandage",
        "description": "Restore part of your hero's health.",
        "icon": "bandage",
    },
    "full_heal": {
        "name": "Battle Healer",
        "description": "Restore health to maximum.",
        "icon": "heart-plus",
    },
    "wound_cure": {
        "name": "Wound Cleanse",
        "description": "Remove wounded state and restore full health.",
        "icon": "medical-bag",
    },
}
SHOP_PURCHASE_GUARD_SECONDS = 8.0
_CLIENT_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:\-]{5,127}$")
_SHOP_PURCHASE_GUARD_LOCK = threading.Lock()
_SHOP_PURCHASE_GUARD: dict[str, float] = {}


def _normalize_client_request_id(client_request_id: str | None) -> str | None:
    if not client_request_id:
        return None
    normalized = str(client_request_id).strip()
    if not normalized:
        return None
    if not _CLIENT_REQUEST_ID_RE.match(normalized):
        raise HTTPException(status_code=400, detail="Invalid client_request_id format")
    return normalized


def _acquire_shop_purchase_guard(user_id: int, item_id: int, target_inventory_id: int | None) -> str:
    marker = f"{int(user_id)}:{int(item_id)}:{int(target_inventory_id or 0)}"
    now_mono = time.monotonic()
    with _SHOP_PURCHASE_GUARD_LOCK:
        stale_markers = [key for key, expires_at in _SHOP_PURCHASE_GUARD.items() if expires_at <= now_mono]
        for key in stale_markers:
            _SHOP_PURCHASE_GUARD.pop(key, None)
        existing_expires_at = _SHOP_PURCHASE_GUARD.get(marker)
        if existing_expires_at and existing_expires_at > now_mono:
            raise HTTPException(status_code=409, detail="Purchase is already processing")
        _SHOP_PURCHASE_GUARD[marker] = now_mono + SHOP_PURCHASE_GUARD_SECONDS
    return marker


def _release_shop_purchase_guard(marker: str) -> None:
    with _SHOP_PURCHASE_GUARD_LOCK:
        _SHOP_PURCHASE_GUARD.pop(marker, None)


def _shop_purchase_lock_key(user_id: int, item_id: int, target_inventory_id: int | None) -> str:
    return f"shop:purchase-lock:{int(user_id)}:{int(item_id)}:{int(target_inventory_id or 0)}"


def _acquire_distributed_shop_purchase_guard(
    user_id: int,
    item_id: int,
    target_inventory_id: int | None,
) -> tuple[str, str]:
    lock_key = _shop_purchase_lock_key(user_id, item_id, target_inventory_id)
    owner_token = uuid.uuid4().hex
    lock_ttl = max(1, int(SHOP_PURCHASE_GUARD_SECONDS))
    acquired = cache_acquire_lock(lock_key, owner_token, ttl_seconds=lock_ttl)
    if not acquired:
        raise HTTPException(status_code=409, detail="Purchase is already processing")
    return lock_key, owner_token


def _release_distributed_shop_purchase_guard(lock_key: str, owner_token: str) -> None:
    cache_release_lock(lock_key, owner_token)


def _get_chest_catalog_entry(chest_name: str) -> dict:
    try:
        return get_chest_catalog_entry(chest_name)
    except LookupError:
        raise HTTPException(status_code=404, detail="Сундук не найден")


def _ensure_shop_chest_item(db: Session, chest_name: str) -> Item:
    return ensure_chest_item(db, chest_name)


def _grant_shop_chest_to_user(db: Session, user_id: int, chest_name: str) -> UserInventory:
    return grant_chest_to_user(db, user_id, chest_name)


def _get_main_progress(db: Session, user_id: int):
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _shop_rotation_start(now: datetime | None = None) -> datetime:
    current = now or utc_now()
    rotation_hour = (current.hour // SHOP_ROTATION_HOURS) * SHOP_ROTATION_HOURS
    return current.replace(hour=rotation_hour, minute=0, second=0, microsecond=0)


def _shop_rotation_end(now: datetime | None = None) -> datetime:
    return _shop_rotation_start(now) + timedelta(hours=SHOP_ROTATION_HOURS)


def _catalog_cache_key(user_id: int, rotation_start: datetime, class_name: str | None, level: int) -> str:
    return f"shop:catalog:{user_id}:{class_name or 'none'}:{level}:{rotation_start.isoformat()}"


def _extract_bonus_fields(source: Item | dict) -> dict:
    if isinstance(source, dict):
        stats = source.get("stats") if isinstance(source.get("stats"), dict) else {}
        return {
            field: stats.get(field, source.get(field, 0)) or 0
            for field in ITEM_BONUS_FIELDS
        }

    item = normalize_item_model(source)
    return {field: getattr(item, field, 0) or 0 for field in ITEM_BONUS_FIELDS}


def _coalesce_source_value(source: dict, *keys: str):
    for key in keys:
        if key in source:
            return source.get(key)
    return None


def _canonicalize_item_source_dict(source: dict) -> dict:
    return {
        "id": _coalesce_source_value(source, "id"),
        "name": _coalesce_source_value(source, "name"),
        "description": _coalesce_source_value(source, "description"),
        "type": _coalesce_source_value(source, "type"),
        "subclass": _coalesce_source_value(source, "subclass"),
        "slot": _coalesce_source_value(source, "slot"),
        "rarity": _coalesce_source_value(source, "rarity"),
        "image": _coalesce_source_value(source, "image"),
        "icon": _coalesce_source_value(source, "icon"),
        "required_level": _coalesce_source_value(source, "required_level"),
        "required_class": _coalesce_source_value(
            source,
            "required_class",
            "re equired_class",
            "required_class s",
        ),
        "set_name": _coalesce_source_value(
            source,
            "set_name",
            "set_name e",
            "set t_name",
        ),
        "price": _coalesce_source_value(
            source,
            "price",
            "pri ice",
        ),
        "price_crystals": _coalesce_source_value(source, "price_crystals"),
        "weapon_stats": _coalesce_source_value(source, "weapon_stats"),
        "armor_stats": _coalesce_source_value(source, "armor_stats"),
        "stats": _coalesce_source_value(source, "stats"),
    }


def _build_stats_record(bonuses: dict) -> dict:
    return {field: value for field, value in bonuses.items() if value}


def _build_canonical_stats_payload(
    bonuses: dict,
    weapon_stats: dict | None,
    armor_stats: dict | None,
) -> dict:
    payload = _build_stats_record(bonuses)
    payload["attack"] = int((weapon_stats or {}).get("damage_max") or 0)
    payload["defense"] = int((armor_stats or {}).get("armor_value") or 0)
    payload["hp"] = int(bonuses.get("health_bonus") or 0)
    if weapon_stats and weapon_stats.get("damage_min") is not None:
        payload["damage_min"] = int(weapon_stats["damage_min"])
    if weapon_stats and weapon_stats.get("damage_max") is not None:
        payload["damage_max"] = int(weapon_stats["damage_max"])
    if armor_stats and armor_stats.get("armor_value") is not None:
        payload["armor_value"] = int(armor_stats["armor_value"])
    return payload


def serialize_weapon_stats_payload(stats) -> dict | None:
    if not stats:
        return None
    if isinstance(stats, dict):
        payload = {
            "weapon_type": stats.get("weapon_type"),
            "weapon_category": stats.get("weapon_category"),
            "damage_min": stats.get("damage_min"),
            "damage_max": stats.get("damage_max"),
            "speed": stats.get("speed"),
            "dps": stats.get("dps"),
            "critical_strike_chance": stats.get("critical_strike_chance"),
            "required_strength": stats.get("required_strength"),
            "required_agility": stats.get("required_agility"),
            "required_intellect": stats.get("required_intellect"),
        }
    else:
        payload = {
            "weapon_type": stats.weapon_type,
            "weapon_category": stats.weapon_category,
            "damage_min": stats.damage_min,
            "damage_max": stats.damage_max,
            "speed": stats.speed,
            "dps": stats.dps,
            "critical_strike_chance": getattr(stats, "critical_strike_chance", None),
            "required_strength": getattr(stats, "required_strength", None),
            "required_agility": getattr(stats, "required_agility", None),
            "required_intellect": getattr(stats, "required_intellect", None),
        }
    return normalize_nested_strings(payload)


def serialize_armor_stats_payload(stats) -> dict | None:
    if not stats:
        return None
    if isinstance(stats, dict):
        payload = {
            "armor_type": stats.get("armor_type"),
            "armor_value": stats.get("armor_value"),
            "slot": stats.get("slot"),
            "dodge_chance": stats.get("dodge_chance"),
            "block_chance": stats.get("block_chance"),
        }
    else:
        payload = {
            "armor_type": getattr(stats, "armor_type", None),
            "armor_value": stats.armor_value,
            "slot": stats.slot,
            "dodge_chance": getattr(stats, "dodge_chance", None),
            "block_chance": getattr(stats, "block_chance", None),
        }
    return normalize_nested_strings(payload)


def serialize_item_payload(source: Item | dict) -> dict:
    if isinstance(source, dict):
        canonical_source = _canonicalize_item_source_dict(source)
        bonuses = _extract_bonus_fields(source)
        weapon_stats = serialize_weapon_stats_payload(canonical_source.get("weapon_stats"))
        armor_stats = serialize_armor_stats_payload(canonical_source.get("armor_stats"))
        payload = {
            "id": canonical_source.get("id"),
            "name": canonical_source.get("name"),
            "description": canonical_source.get("description"),
            "type": canonical_source.get("type"),
            "subclass": canonical_source.get("subclass"),
            "slot": canonical_source.get("slot"),
            "rarity": canonical_source.get("rarity"),
            "image": canonical_source.get("image") or canonical_source.get("icon"),
            "icon": canonical_source.get("icon"),
            "required_level": canonical_source.get("required_level", 1),
            "required_class": canonical_source.get("required_class"),
            "set_name": canonical_source.get("set_name"),
            "price": canonical_source.get("price", canonical_source.get("price_crystals", 0)),
            "price_crystals": canonical_source.get("price_crystals", 0),
            **bonuses,
            "stats": _build_canonical_stats_payload(bonuses, weapon_stats, armor_stats),
        }
        return normalize_nested_strings(payload)

    item = normalize_item_model(source)
    bonuses = _extract_bonus_fields(item)
    weapon_stats = serialize_weapon_stats_payload(item.weapon_stats)
    armor_stats = serialize_armor_stats_payload(item.armor_stats)
    payload = {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "type": item.type,
        "subclass": item.subclass,
        "slot": item.slot,
        "rarity": item.rarity,
        "image": item.icon,
        "icon": item.icon,
        "required_level": item.required_level,
        "required_class": item.required_class,
        "set_name": item.set_name,
        "price": item.price_crystals,
        "price_crystals": item.price_crystals,
        **bonuses,
        "stats": _build_canonical_stats_payload(bonuses, weapon_stats, armor_stats),
    }
    return normalize_nested_strings(payload)


def _serialize_shop_item_entry(item: dict) -> dict:
    return normalize_nested_strings(
        {
            **serialize_item_payload(item),
            "weapon_stats": serialize_weapon_stats_payload(item.get("weapon_stats")),
            "armor_stats": serialize_armor_stats_payload(item.get("armor_stats")),
            "chest_name": item.get("chest_name"),
        }
    )


def _serialize_shop_items(items: list[dict]) -> list[dict]:
    return [_serialize_shop_item_entry(item) for item in items]


def _build_shop_chests() -> list[dict]:
    chest_items: list[dict] = []
    for payload in CHEST_CATALOG:
        chest_name = payload["name"]
        if chest_name not in CHEST_SHOP_IDS:
            continue
        presentation = CHEST_SHOP_PRESENTATION.get(chest_name, {})
        chest_items.append(
            {
                "id": CHEST_SHOP_IDS[chest_name],
                "name": presentation.get("name", chest_name.replace("_", " ").title()),
                "description": presentation.get("description", ""),
                "type": "chest",
                "subclass": "loot_chest",
                "slot": None,
                "icon": "treasure-chest",
                "rarity": payload["rarity"],
                "price_crystals": payload["gold_cost"],
                "required_level": 1,
                "chest_name": chest_name,
                "stats": {},
            }
        )
    return chest_items


def _serialize_db_shop_item(item: Item) -> dict:
    normalized_item = normalize_item_model(item)
    payload = serialize_item_payload(normalized_item)
    payload["weapon_stats"] = serialize_weapon_stats_payload(normalized_item.weapon_stats)
    payload["armor_stats"] = serialize_armor_stats_payload(normalized_item.armor_stats)
    return normalize_nested_strings(payload)


def _build_shop_catalog(db: Session, class_name: str | None = None) -> list[dict]:
    sync_catalog_items(db)
    catalog_rows = (
        db.query(Item)
        .options(joinedload(Item.weapon_stats), joinedload(Item.armor_stats))
        .filter(Item.type.in_(["weapon", "armor", "accessory"]), Item.is_beta_item == False)
        .order_by(Item.id.asc())
        .all()
    )

    all_by_type: dict[str, list[dict]] = {}
    for item in catalog_rows:
        serialized_item = _serialize_db_shop_item(item)
        item_type = serialized_item.get("type", "")
        if item_type:
            all_by_type.setdefault(item_type, []).append(serialized_item)

    shop_items: list[dict] = []
    for full_candidates in all_by_type.values():
        sorted_candidates = sorted(
            full_candidates,
            key=lambda entry: (
                -score_item_for_class(entry, class_name),
                entry.get("required_level") or 0,
                entry.get("price_crystals") or 0,
                entry.get("id") or 0,
            ),
        )
        shop_items.extend(sorted_candidates)

    shop_items.extend(_build_shop_chests())
    return shop_items

    shop_items: list[dict] = []
    for item_type, full_candidates in all_by_type.items():
        unique_candidates = {candidate["id"]: candidate for candidate in full_candidates}.values()
        sorted_candidates = sorted(
            unique_candidates,
            key=lambda entry: (
                -score_item_for_class(entry, class_name),
                entry.get("required_level") or 0,
                entry.get("price_crystals") or 0,
                entry.get("id") or 0,
            ),
        )
        shop_items.extend(sorted_candidates)

    shop_items.extend(_build_shop_chests())
    return shop_items


def _resolve_shop_items(db: Session, current_user: User, level: int, force_refresh: bool = False) -> tuple[list[dict], datetime]:
    rotation_start = _shop_rotation_start()
    rotation_end = _shop_rotation_end()
    progress = _get_main_progress(db, current_user.id)
    class_name = progress.class_name if progress else None
    cache_key = _catalog_cache_key(current_user.id, rotation_start, class_name, level)

    if not force_refresh:
        cached = cache_get_json(cache_key)
        if cached and cached.get("items"):
            return cached["items"], rotation_end

    items = _serialize_shop_items(_build_shop_catalog(db, class_name))
    ttl = max(int((rotation_end - utc_now()).total_seconds()), 60)
    cache_set_json(cache_key, {"items": items}, ttl=ttl)
    return items, rotation_end


def _get_shop_meta(next_rotation_at: datetime) -> dict:
    return {
        "refresh_cost": 0,
        "refresh_cooldown_seconds": 0,
        "refresh_available_at": None,
        "refresh_remaining_seconds": 0,
        "can_refresh": False,
        "next_rotation_at": next_rotation_at.isoformat(),
    }


def _is_progress_wounded(progress: UserClassProgress | None, now: datetime | None = None) -> bool:
    if progress is None:
        return False
    wounded_until = getattr(progress, "wounded_until", None)
    penalty_quests_remaining = max(0, int(getattr(progress, "penalty_quests_remaining", 0) or 0))
    reward_penalty_percent = float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0)
    current = now or utc_now()
    return bool(
        reward_penalty_percent > 0
        and (penalty_quests_remaining > 0 or (wounded_until is not None and wounded_until > current))
    )


def _normalized_health_values(progress: UserClassProgress | None) -> tuple[int, int]:
    if progress is None:
        return 100, 100
    max_health = max(1, int(getattr(progress, "max_health", 100) or 100))
    current_health = max(0, min(max_health, int(getattr(progress, "current_health", max_health) or max_health)))
    return max_health, current_health


def _serialize_health_payload(progress: UserClassProgress | None) -> dict:
    max_health, current_health = _normalized_health_values(progress)
    wounded_until = getattr(progress, "wounded_until", None) if progress is not None else None
    penalty_quests_remaining = max(0, int(getattr(progress, "penalty_quests_remaining", 0) or 0)) if progress is not None else 0
    reward_penalty_percent = float(getattr(progress, "reward_penalty_percent", 0.0) or 0.0) if progress is not None else 0.0
    is_wounded = _is_progress_wounded(progress)
    return {
        "max_health": max_health,
        "current_health": current_health,
        "health_percent": int(round(current_health * 100 / max_health)),
        "is_wounded": is_wounded,
        "wounded_until": wounded_until.isoformat() if wounded_until else None,
        "penalty_quests_remaining": penalty_quests_remaining,
        "reward_penalty_percent": round(reward_penalty_percent * 100, 1),
        "last_health_decay_at": getattr(progress, "last_health_decay_at", None).isoformat()
        if progress is not None and getattr(progress, "last_health_decay_at", None)
        else None,
    }


def _shop_service_price(service_key: str, level: int) -> int:
    normalized_level = max(1, int(level or 1))
    if service_key == "bandage":
        return 20 + normalized_level * 8
    if service_key == "full_heal":
        return 40 + normalized_level * 11
    if service_key == "wound_cure":
        return 65 + normalized_level * 14
    raise KeyError(service_key)


def _build_shop_services(progress: UserClassProgress | None, level: int) -> list[dict]:
    max_health, current_health = _normalized_health_values(progress)
    is_wounded = _is_progress_wounded(progress)
    services: list[dict] = []

    for service_key, service_meta in SHOP_SERVICE_DEFINITIONS.items():
        price = _shop_service_price(service_key, level)
        payload = {
            "id": SHOP_SERVICE_IDS[service_key],
            "key": service_key,
            "name": service_meta["name"],
            "description": service_meta["description"],
            "icon": service_meta["icon"],
            "price_crystals": price,
            "available": False,
            "unavailable_reason": None,
            "effect_preview": "",
        }

        if progress is None:
            payload["unavailable_reason"] = "Character not found"
            payload["effect_preview"] = "Unavailable"
            services.append(payload)
            continue

        if service_key == "bandage":
            heal_amount = max(1, int(round(max_health * 0.35)))
            payload["effect_preview"] = f"Heal +{heal_amount} HP"
            if is_wounded:
                payload["unavailable_reason"] = "Unavailable while wounded"
            elif current_health >= max_health:
                payload["unavailable_reason"] = "Health is already full"
            else:
                payload["available"] = True
        elif service_key == "full_heal":
            payload["effect_preview"] = "Restore to full HP"
            if is_wounded:
                payload["unavailable_reason"] = "Unavailable while wounded"
            elif current_health >= max_health:
                payload["unavailable_reason"] = "Health is already full"
            else:
                payload["available"] = True
        elif service_key == "wound_cure":
            payload["effect_preview"] = "Remove wounded state and restore full HP"
            if not is_wounded:
                payload["unavailable_reason"] = "Hero is not wounded"
            else:
                payload["available"] = True
        services.append(payload)

    return services


def _apply_shop_service_effect(progress: UserClassProgress, service_key: str) -> None:
    max_health, current_health = _normalized_health_values(progress)
    if service_key == "bandage":
        heal_amount = max(1, int(round(max_health * 0.35)))
        progress.current_health = min(max_health, current_health + heal_amount)
        return
    if service_key == "full_heal":
        progress.current_health = max_health
        return
    if service_key == "wound_cure":
        progress.wounded_until = None
        progress.penalty_quests_remaining = 0
        progress.reward_penalty_percent = 0.0
        progress.current_health = max_health
        return
    raise KeyError(service_key)


def _build_shop_xp_scrolls(progress: UserClassProgress | None) -> list[dict]:
    if progress is None:
        return [
            {
                **product,
                "available": False,
                "unavailable_reason": "Character not found",
                "effect_preview": f"+{int(product['xp_amount'])} XP",
            }
            for product in shop_runtime.XP_SCROLL_PRODUCTS
        ]

    level = max(1, int(getattr(progress, "level", 1) or 1))
    return [
        {
            **product,
            "available": True,
            "unavailable_reason": None,
            "effect_preview": f"+{int(product['xp_amount'])} XP (Level {level})",
        }
        for product in shop_runtime.XP_SCROLL_PRODUCTS
    ]


def _build_shop_contracts(current_user: User, progress: UserClassProgress | None) -> list[dict]:
    active_contract = shop_runtime.get_active_contract(current_user.id)
    contracts: list[dict] = []
    for product in shop_runtime.QUEST_CONTRACT_PRODUCTS:
        effect_preview = (
            f"+{int(round(float(product['xp_bonus']) * 100))}% XP • "
            f"+{int(round(float(product['gold_bonus']) * 100))}% gold • "
            f"{int(product['charges'])} quests"
        )
        contracts.append(
            {
                **product,
                "available": bool(progress),
                "unavailable_reason": None if progress else "Character not found",
                "effect_preview": effect_preview,
                "active": bool(active_contract and active_contract.get("key") == product["key"]),
            }
        )
    return contracts


def _resolve_target_weapon_inventory_id(db: Session, current_user: User, preferred_inventory_id: int | None = None) -> int | None:
    if preferred_inventory_id:
        preferred = (
            db.query(UserInventory)
            .options(joinedload(UserInventory.item))
            .filter(UserInventory.user_id == current_user.id, UserInventory.id == preferred_inventory_id)
            .first()
        )
        if preferred and preferred.item and preferred.item.type == "weapon":
            return preferred.id

    classes = crud.get_all_unlocked_classes(db, current_user.id)
    class_progress_id = classes[0].id if classes else None
    if class_progress_id is not None:
        try:
            equipment_payload = get_equipped_items(db, current_user.id, class_progress_id)
            for slot in ("main_hand", "off_hand", "ranged"):
                slot_entry = equipment_payload.get("equipment", {}).get(slot)
                if slot_entry and slot_entry.get("inventory_id"):
                    return int(slot_entry["inventory_id"])
        except Exception:
            pass

    fallback = (
        db.query(UserInventory)
        .options(joinedload(UserInventory.item))
        .filter(UserInventory.user_id == current_user.id)
        .order_by(UserInventory.acquired_at.desc())
        .all()
    )
    for row in fallback:
        if row.item and row.item.type == "weapon":
            return row.id
    return None


def _build_shop_weapon_enchants(db: Session, current_user: User, progress: UserClassProgress | None) -> list[dict]:
    target_inventory_id = _resolve_target_weapon_inventory_id(db, current_user)
    target_weapon_name = None
    if target_inventory_id:
        target_row = (
            db.query(UserInventory)
            .options(joinedload(UserInventory.item))
            .filter(UserInventory.user_id == current_user.id, UserInventory.id == target_inventory_id)
            .first()
        )
        if target_row and target_row.item:
            target_weapon_name = target_row.item.name

    active_enchant = shop_runtime.get_weapon_enchant_for_inventory(current_user.id, target_inventory_id) if target_inventory_id else None
    enchants: list[dict] = []
    for product in shop_runtime.WEAPON_ENCHANT_PRODUCTS:
        effects = product.get("effects", {}) or {}
        lines: list[str] = []
        if effects.get("damage_min") or effects.get("damage_max"):
            lines.append(f"Damage +{int(effects.get('damage_min', 0))}-{int(effects.get('damage_max', 0))}")
        if effects.get("strength"):
            lines.append(f"Strength +{int(effects['strength'])}")
        if effects.get("agility"):
            lines.append(f"Agility +{int(effects['agility'])}")
        if effects.get("intellect"):
            lines.append(f"Intellect +{int(effects['intellect'])}")
        if effects.get("critical_chance"):
            lines.append(f"Crit +{int(round(float(effects['critical_chance']) * 100))}%")
        if effects.get("luck"):
            lines.append(f"Luck +{int(round(float(effects['luck']) * 100))}%")
        if effects.get("xp_bonus"):
            lines.append(f"XP gain +{int(round(float(effects['xp_bonus']) * 100))}%")
        if effects.get("gold_bonus"):
            lines.append(f"Gold gain +{int(round(float(effects['gold_bonus']) * 100))}%")

        available = bool(progress and target_inventory_id)
        unavailable_reason = None
        if not progress:
            unavailable_reason = "Character not found"
        elif not target_inventory_id:
            unavailable_reason = "No weapon found in inventory"

        enchants.append(
            {
                **product,
                "available": available,
                "unavailable_reason": unavailable_reason,
                "effect_preview": " • ".join(lines) if lines else "Weapon bonus",
                "target_inventory_id": target_inventory_id,
                "target_weapon_name": target_weapon_name,
                "current_enchant": active_enchant,
            }
        )
    return enchants


def _build_catalog_tabs(items: list[dict], services: list[dict], xp_scrolls: list[dict], quest_contracts: list[dict], weapon_enchants: list[dict]) -> list[dict]:
    return [
        {"key": shop_runtime.SHOP_CATALOG_KEYS["equipment"], "label": "Equipment", "count": len(items)},
        {"key": shop_runtime.SHOP_CATALOG_KEYS["xp_scrolls"], "label": "XP Scrolls", "count": len(xp_scrolls)},
        {"key": shop_runtime.SHOP_CATALOG_KEYS["contracts"], "label": "Contracts", "count": len(quest_contracts)},
        {"key": shop_runtime.SHOP_CATALOG_KEYS["enchants"], "label": "Enchants", "count": len(weapon_enchants)},
        {"key": shop_runtime.SHOP_CATALOG_KEYS["services"], "label": "Services", "count": len(services)},
    ]


def _validate_inventory_item_reference(inv: UserInventory) -> Item:
    if inv.item is None:
        logger.error("Inventory row references missing item: inventory_id=%s item_id=%s", inv.id, inv.item_id)
        raise HTTPException(status_code=500, detail="Inventory item reference is invalid")

    item = normalize_item_model(inv.item)
    if inv.item_id != item.id:
        logger.error(
            "Inventory row item mismatch detected: inventory_id=%s stored_item_id=%s resolved_item_id=%s",
            inv.id,
            inv.item_id,
            item.id,
        )
        raise HTTPException(status_code=500, detail="Inventory item data is inconsistent")
    return item


def serialize_inventory_item_entry(inv: UserInventory, *, is_equipped: bool) -> dict:
    item = _validate_inventory_item_reference(inv)
    return normalize_nested_strings(
        {
            "id": inv.id,
            "inventory_id": inv.id,
            "item_id": inv.item_id,
            "quantity": inv.quantity,
            "is_equipped": is_equipped,
            "acquired_at": inv.acquired_at.isoformat() if inv.acquired_at else None,
            "item": serialize_item_payload(item),
            "weapon_stats": serialize_weapon_stats_payload(item.weapon_stats),
            "armor_stats": serialize_armor_stats_payload(item.armor_stats),
        }
    )


def build_character_inventory_context(db: Session, current_user: User, request) -> dict:
    sync_catalog_items(db)
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    if not classes:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    main_class = classes[0]
    equipment_data = get_equipped_items(db, current_user.id, main_class.id)
    inventory = (
        db.query(UserInventory)
        .options(
            joinedload(UserInventory.item).joinedload(Item.weapon_stats),
            joinedload(UserInventory.item).joinedload(Item.armor_stats),
        )
        .filter(UserInventory.user_id == current_user.id)
        .order_by(UserInventory.acquired_at.desc())
        .all()
    )

    for inventory_item in inventory:
        _validate_inventory_item_reference(inventory_item)

    equipped_ids = {entry["inventory_id"] for entry in equipment_data["equipment"].values()}
    bag_items = [item for item in inventory if item.id not in equipped_ids]

    return {
        "request": request,
        "user": current_user,
        "class_info": main_class,
        "equipment": equipment_data["equipment"],
        "equipment_totals": equipment_data["totals"],
        "inventory": inventory,
        "bag_items": bag_items,
        "crystals": main_class.crystals,
    }


def get_shop_context(db: Session, current_user: User) -> dict:
    sync_catalog_items(db)
    progress = _get_main_progress(db, current_user.id)
    level = progress.level if progress else 1
    items, next_rotation_at = _resolve_shop_items(db, current_user, level)
    services = _build_shop_services(progress, level)
    xp_scrolls = _build_shop_xp_scrolls(progress)
    quest_contracts = _build_shop_contracts(current_user, progress)
    weapon_enchants = _build_shop_weapon_enchants(db, current_user, progress)
    active_contract = shop_runtime.get_active_contract(current_user.id)

    return {
        "items": items,
        "services": services,
        "xp_scrolls": xp_scrolls,
        "quest_contracts": quest_contracts,
        "weapon_enchants": weapon_enchants,
        "active_contract": active_contract,
        "catalog_tabs": _build_catalog_tabs(items, services, xp_scrolls, quest_contracts, weapon_enchants),
        "crystals": progress.crystals if progress else 0,
        "character_level": level,
        **_get_shop_meta(next_rotation_at),
    }


def _legacy_refresh_shop_context_unused(db: Session, current_user: User) -> dict:
    progress = _get_main_progress(db, current_user.id)
    if not progress:
        raise HTTPException(status_code=404, detail="Character not found")

    cooldown = _get_refresh_cooldown_state(current_user.id)
    if cooldown and cooldown.get("refresh_available_at"):
        available_at = datetime.fromisoformat(cooldown["refresh_available_at"])
        remaining = max(int((available_at - utc_now()).total_seconds()), 0)
        if remaining > 0:
            raise HTTPException(status_code=400, detail=f"Обновление витрины будет доступно через {remaining} сек.")

    if progress.crystals < SHOP_REFRESH_COST:
        raise HTTPException(status_code=400, detail="Недостаточно золота для обновления витрины")

    progress.crystals -= SHOP_REFRESH_COST
    db.add(progress)
    db.commit()
    db.refresh(progress)

    cache_delete_prefix(f"shop:catalog:{current_user.id}:")
    items, next_rotation_at = _resolve_shop_items(db, current_user, progress.level, force_refresh=True)
    refresh_available_at = utc_now() + timedelta(seconds=SHOP_REFRESH_COOLDOWN_SECONDS)
    cache_set_json(
        _cooldown_cache_key(current_user.id),
        {"refresh_available_at": refresh_available_at.isoformat()},
        ttl=SHOP_REFRESH_COOLDOWN_SECONDS,
    )

    return {
        "items": items,
        "services": _build_shop_services(progress, progress.level),
        "xp_scrolls": _build_shop_xp_scrolls(progress),
        "quest_contracts": _build_shop_contracts(current_user, progress),
        "weapon_enchants": _build_shop_weapon_enchants(db, current_user, progress),
        "active_contract": shop_runtime.get_active_contract(current_user.id),
        "catalog_tabs": _build_catalog_tabs(
            items,
            _build_shop_services(progress, progress.level),
            _build_shop_xp_scrolls(progress),
            _build_shop_contracts(current_user, progress),
            _build_shop_weapon_enchants(db, current_user, progress),
        ),
        "crystals": progress.crystals,
        "character_level": progress.level,
        **_get_shop_meta(next_rotation_at),
    }

def refresh_shop_context(db: Session, current_user: User) -> dict:
    progress = _get_main_progress(db, current_user.id)
    if not progress:
        raise HTTPException(status_code=404, detail="Character not found")

    items, next_rotation_at = _resolve_shop_items(db, current_user, progress.level, force_refresh=True)

    services = _build_shop_services(progress, progress.level)
    xp_scrolls = _build_shop_xp_scrolls(progress)
    quest_contracts = _build_shop_contracts(current_user, progress)
    weapon_enchants = _build_shop_weapon_enchants(db, current_user, progress)
    return {
        "items": items,
        "services": services,
        "xp_scrolls": xp_scrolls,
        "quest_contracts": quest_contracts,
        "weapon_enchants": weapon_enchants,
        "active_contract": shop_runtime.get_active_contract(current_user.id),
        "catalog_tabs": _build_catalog_tabs(items, services, xp_scrolls, quest_contracts, weapon_enchants),
        "crystals": progress.crystals,
        "character_level": progress.level,
        **_get_shop_meta(next_rotation_at),
    }


def buy_shop_item(
    db: Session,
    current_user: User,
    item_id: int,
    target_inventory_id: int | None = None,
    client_request_id: str | None = None,
) -> dict:
    normalized_client_request_id = _normalize_client_request_id(client_request_id)
    if normalized_client_request_id:
        cached_result = shop_runtime.get_cached_purchase_result(current_user.id, normalized_client_request_id)
        if cached_result:
            replayed = dict(cached_result)
            replayed["idempotency_replayed"] = True
            replayed["client_request_id"] = normalized_client_request_id
            return replayed

    guard_marker = _acquire_shop_purchase_guard(current_user.id, item_id, target_inventory_id)
    distributed_lock: tuple[str, str] | None = None

    def _build_purchase_result(payload: dict, *, price_paid: int, balance_after: int | None) -> dict:
        result = dict(payload)
        result["price_paid"] = max(0, int(price_paid or 0))
        if balance_after is not None:
            result["balance_after"] = max(0, int(balance_after))
        if normalized_client_request_id:
            result["client_request_id"] = normalized_client_request_id
            result["idempotency_replayed"] = False
            shop_runtime.cache_purchase_result(current_user.id, normalized_client_request_id, result)
        return result

    try:
        distributed_lock = _acquire_distributed_shop_purchase_guard(current_user.id, item_id, target_inventory_id)
        service_key = SHOP_SERVICE_IDS_REVERSE.get(item_id)
        if service_key:
            progress = _get_main_progress(db, current_user.id)
            if not progress:
                raise HTTPException(status_code=404, detail="Character not found")

            services = _build_shop_services(progress, progress.level)
            selected_service = next((service for service in services if service["key"] == service_key), None)
            if selected_service is None:
                raise HTTPException(status_code=404, detail="Service not found")
            if not selected_service.get("available"):
                raise HTTPException(
                    status_code=400,
                    detail=selected_service.get("unavailable_reason") or "Service is currently unavailable",
                )
            service_price = int(selected_service.get("price_crystals") or 0)
            if progress.crystals < service_price:
                raise HTTPException(status_code=400, detail="Not enough gold")

            progress.crystals -= service_price
            _apply_shop_service_effect(progress, service_key)
            db.add(progress)
            db.commit()
            db.refresh(progress)
            return _build_purchase_result(
                {
                    "ok": True,
                    "kind": "service",
                    "service_key": service_key,
                    "service_name": selected_service["name"],
                    "health": _serialize_health_payload(progress),
                },
                price_paid=service_price,
                balance_after=progress.crystals,
            )

        xp_scroll = shop_runtime.XP_SCROLL_BY_ID.get(item_id)
        if xp_scroll:
            progress = _get_main_progress(db, current_user.id)
            if not progress:
                raise HTTPException(status_code=404, detail="Character not found")
            scroll_price = int(xp_scroll.get("price_crystals") or 0)
            if progress.crystals < scroll_price:
                raise HTTPException(status_code=400, detail="Not enough gold")

            progress.crystals -= scroll_price
            progress, level_ups, _ = crud.add_xp_and_stats(db, progress, int(xp_scroll.get("xp_amount") or 0), "common")
            return _build_purchase_result(
                {
                    "ok": True,
                    "kind": "xp_scroll",
                    "scroll_key": xp_scroll["key"],
                    "scroll_name": xp_scroll["name"],
                    "xp_gained": int(xp_scroll.get("xp_amount") or 0),
                    "level_ups": level_ups,
                    "new_level": progress.level,
                    "new_xp": progress.current_xp,
                },
                price_paid=scroll_price,
                balance_after=progress.crystals,
            )

        quest_contract = shop_runtime.QUEST_CONTRACT_BY_ID.get(item_id)
        if quest_contract:
            progress = _get_main_progress(db, current_user.id)
            if not progress:
                raise HTTPException(status_code=404, detail="Character not found")
            contract_price = int(quest_contract.get("price_crystals") or 0)
            if progress.crystals < contract_price:
                raise HTTPException(status_code=400, detail="Not enough gold")
            progress.crystals -= contract_price
            active_contract = shop_runtime.set_active_contract(current_user.id, quest_contract)
            db.add(progress)
            db.commit()
            db.refresh(progress)
            return _build_purchase_result(
                {
                    "ok": True,
                    "kind": "contract",
                    "contract": active_contract,
                },
                price_paid=contract_price,
                balance_after=progress.crystals,
            )

        weapon_enchant = shop_runtime.WEAPON_ENCHANT_BY_ID.get(item_id)
        if weapon_enchant:
            progress = _get_main_progress(db, current_user.id)
            if not progress:
                raise HTTPException(status_code=404, detail="Character not found")
            enchant_price = int(weapon_enchant.get("price_crystals") or 0)
            if progress.crystals < enchant_price:
                raise HTTPException(status_code=400, detail="Not enough gold")

            resolved_target_inventory_id = _resolve_target_weapon_inventory_id(db, current_user, target_inventory_id)
            if not resolved_target_inventory_id:
                raise HTTPException(status_code=400, detail="No weapon available for enchant")

            target_row = (
                db.query(UserInventory)
                .options(joinedload(UserInventory.item))
                .filter(UserInventory.user_id == current_user.id, UserInventory.id == resolved_target_inventory_id)
                .first()
            )
            if not target_row or not target_row.item or target_row.item.type != "weapon":
                raise HTTPException(status_code=400, detail="Selected inventory item is not a weapon")

            progress.crystals -= enchant_price
            enchant_payload = shop_runtime.set_weapon_enchant(current_user.id, resolved_target_inventory_id, weapon_enchant)
            db.add(progress)
            db.commit()
            db.refresh(progress)
            return _build_purchase_result(
                {
                    "ok": True,
                    "kind": "enchant",
                    "enchant": enchant_payload,
                    "target_inventory_id": resolved_target_inventory_id,
                    "target_weapon_name": target_row.item.name,
                },
                price_paid=enchant_price,
                balance_after=progress.crystals,
            )

        if item_id in CHEST_SHOP_IDS.values():
            chest_name = next((name for name, shop_id in CHEST_SHOP_IDS.items() if shop_id == item_id), None)
            if not chest_name:
                raise HTTPException(status_code=404, detail="Chest not found")
            progress = _get_main_progress(db, current_user.id)
            if not progress:
                raise HTTPException(status_code=404, detail="Character not found")
            chest_payload = _get_chest_catalog_entry(chest_name)
            chest_price = int(chest_payload.get("gold_cost") or 0)
            if progress.crystals < chest_price:
                raise HTTPException(status_code=400, detail="Not enough gold")

            progress.crystals -= chest_price
            inventory_item = _grant_shop_chest_to_user(db, current_user.id, chest_name)
            chest_item = inventory_item.item or _ensure_shop_chest_item(db, chest_name)
            db.add(progress)
            db.commit()
            db.refresh(progress)

            return _build_purchase_result(
                {
                    "ok": True,
                    "kind": "chest",
                    "chest_name": chest_name,
                    "inventory_id": inventory_item.id,
                    "chest_item": {
                        "id": chest_item.id,
                        "name": chest_item.name,
                        "icon": chest_item.icon,
                        "rarity": chest_item.rarity or chest_payload["rarity"],
                    },
                },
                price_paid=chest_price,
                balance_after=progress.crystals,
            )

        catalog_item = db.query(Item.id, Item.price_crystals).filter(Item.id == item_id).first()
        item_price = int(catalog_item.price_crystals or 0) if catalog_item else 0
        success = buy_item(db, current_user.id, item_id)
        if not success:
            raise HTTPException(status_code=400, detail="Not enough gold, item not found, or level too low")
        refreshed_progress = _get_main_progress(db, current_user.id)
        return _build_purchase_result(
            {"ok": True, "kind": "item"},
            price_paid=item_price,
            balance_after=(refreshed_progress.crystals if refreshed_progress else None),
        )
    finally:
        if distributed_lock is not None:
            _release_distributed_shop_purchase_guard(distributed_lock[0], distributed_lock[1])
        _release_shop_purchase_guard(guard_marker)


def equip_inventory_item(db: Session, current_user: User, inventory_id: int, slot: str, class_progress_id: int | None) -> dict:
    if not class_progress_id:
        progress = _get_main_progress(db, current_user.id)
        class_progress_id = progress.id if progress else None
    if not class_progress_id:
        raise HTTPException(status_code=400, detail="Класс персонажа не найден")
    try:
        success = equip_item(db, current_user.id, class_progress_id, inventory_id, slot)
    except EquipmentError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not success:
        raise HTTPException(status_code=400, detail="Нельзя экипировать этот предмет")
    return {"ok": True}


def get_inventory_payload(db: Session, current_user: User) -> dict:
    sync_catalog_items(db)
    inventory = (
        db.query(UserInventory)
        .options(
            joinedload(UserInventory.item).joinedload(Item.weapon_stats),
            joinedload(UserInventory.item).joinedload(Item.armor_stats),
        )
        .filter(UserInventory.user_id == current_user.id)
        .order_by(UserInventory.acquired_at.desc())
        .all()
    )
    equipped_ids = get_equipped_inventory_ids(db, current_user.id)

    result = []
    for inv in inventory:
        result.append(serialize_inventory_item_entry(inv, is_equipped=inv.id in equipped_ids))

    return {"inventory": result}


def unequip_inventory_item(db: Session, current_user: User, inventory_id: int) -> dict:
    inventory_item = (
        db.query(UserInventory)
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == current_user.id)
        .first()
    )
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Предмет не найден")

    all_equipment = db.query(CharacterEquipment).filter(CharacterEquipment.user_id == current_user.id).all()
    slot_fields = [
        "head_id", "neck_id", "shoulders_id", "back_id", "chest_id", "wrist_id", "hands_id",
        "waist_id", "legs_id", "feet_id", "ring1_id", "ring2_id", "trinket1_id", "trinket2_id",
        "main_hand_id", "off_hand_id", "ranged_id",
    ]
    for equipment in all_equipment:
        for slot in slot_fields:
            if getattr(equipment, slot) == inventory_id:
                setattr(equipment, slot, None)
                recalculate_total_stats(db, equipment)
                break
    sync_equipped_inventory_flags(db, current_user.id)
    db.commit()
    return {"ok": True}


def sell_inventory_item(db: Session, current_user: User, inventory_id: int) -> dict:
    try:
        result = sell_item(db, current_user.id, inventory_id)
    except (EquipmentError, ItemEquipmentError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not result:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    return {"ok": True, **result}


def get_inventory_item_detail(db: Session, current_user: User, inventory_id: int) -> dict:
    sync_catalog_items(db)
    inventory_item = (
        db.query(UserInventory)
        .options(
            joinedload(UserInventory.item).joinedload(Item.weapon_stats),
            joinedload(UserInventory.item).joinedload(Item.armor_stats),
        )
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == current_user.id)
        .first()
    )
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Предмет не найден")

    item = _validate_inventory_item_reference(inventory_item)
    equipped_ids = get_equipped_inventory_ids(db, current_user.id)
    payload = serialize_inventory_item_entry(inventory_item, is_equipped=inventory_item.id in equipped_ids)
    payload["sell_price"] = max(1, int((item.price_crystals or 0) * 0.5))
    return payload


def equip_character_item(db: Session, current_user: User, inventory_id: int, class_progress_id: int, slot: str) -> dict:
    try:
        equip_item(db, current_user.id, class_progress_id, inventory_id, slot)
    except EquipmentError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


def unequip_character_item(db: Session, current_user: User, class_progress_id: int, slot: str) -> dict:
    success = unequip_item(db, current_user.id, class_progress_id, slot)
    if not success:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    return {"ok": True}
