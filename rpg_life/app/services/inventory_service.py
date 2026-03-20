from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.class_roles import score_item_for_class
from app import crud
from app.beta_content import CHEST_CATALOG
from app.chest_items import CHEST_PRESENTATION, ensure_chest_item, get_chest_catalog_entry, grant_chest_to_user
from app.core.cache import cache_get_json, cache_set_json
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
from app.item_service import EquipmentError as ItemEquipmentError, buy_item, sell_item
from app.items_data import ITEMS
from app.models import CharacterEquipment, Item, User, UserClassProgress, UserInventory
from app.text_utils import normalize_item_model, normalize_nested_strings

SHOP_ROTATION_HOURS = 12
CHEST_SHOP_IDS = {
    "COMMON_CHEST": -9001,
    "RARE_CHEST": -9002,
    "EPIC_CHEST": -9003,
    "LEGENDARY_CHEST": -9004,
}
CHEST_SHOP_PRESENTATION = CHEST_PRESENTATION


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


def _serialize_shop_items(items: list[dict]) -> list[dict]:
    return [normalize_nested_strings(item) for item in items]


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


def _build_shop_catalog(level: int, _seed: int, class_name: str | None = None) -> list[dict]:
    all_by_type: dict[str, list[dict]] = {}
    for item in ITEMS:
        item_type = item.get("type", "")
        if item_type:
            all_by_type.setdefault(item_type, []).append(item)

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

    seed = (current_user.id * 100_003) + (level * 97) + int(rotation_start.timestamp())
    items = _serialize_shop_items(_build_shop_catalog(level, seed, class_name))
    ttl = max(int((rotation_end - utc_now()).total_seconds()), 60)
    cache_set_json(cache_key, {"items": items, "seed": seed}, ttl=ttl)
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


def build_character_inventory_context(db: Session, current_user: User, request) -> dict:
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
        normalize_item_model(inventory_item.item)

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
    progress = _get_main_progress(db, current_user.id)
    level = progress.level if progress else 1
    items, next_rotation_at = _resolve_shop_items(db, current_user, level)

    return {
        "items": items,
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
        "crystals": progress.crystals,
        "character_level": progress.level,
        **_get_shop_meta(next_rotation_at),
    }

def refresh_shop_context(db: Session, current_user: User) -> dict:
    progress = _get_main_progress(db, current_user.id)
    if not progress:
        raise HTTPException(status_code=404, detail="Character not found")

    items, next_rotation_at = _resolve_shop_items(db, current_user, progress.level, force_refresh=True)

    return {
        "items": items,
        "crystals": progress.crystals,
        "character_level": progress.level,
        **_get_shop_meta(next_rotation_at),
    }


def buy_shop_item(db: Session, current_user: User, item_id: int) -> dict:
    if item_id in CHEST_SHOP_IDS.values():
        chest_name = next((name for name, shop_id in CHEST_SHOP_IDS.items() if shop_id == item_id), None)
        if not chest_name:
            raise HTTPException(status_code=404, detail="\u0421\u0443\u043d\u0434\u0443\u043a \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d")
        progress = _get_main_progress(db, current_user.id)
        if not progress:
            raise HTTPException(status_code=404, detail="Character not found")
        chest_payload = _get_chest_catalog_entry(chest_name)
        if progress.crystals < chest_payload["gold_cost"]:
            raise HTTPException(status_code=400, detail="Недостаточно золота")

        progress.crystals -= chest_payload["gold_cost"]
        inventory_item = _grant_shop_chest_to_user(db, current_user.id, chest_name)
        chest_item = inventory_item.item or _ensure_shop_chest_item(db, chest_name)
        db.add(progress)
        db.commit()

        return {
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
        }

    success = buy_item(db, current_user.id, item_id)
    if not success:
        raise HTTPException(status_code=400, detail="Недостаточно кристаллов, предмет не найден или не хватает уровня")
    return {"ok": True, "kind": "item"}


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
        normalize_item_model(inv.item)
        item_data = {
            "id": inv.id,
            "item_id": inv.item_id,
            "quantity": inv.quantity,
            "is_equipped": inv.id in equipped_ids,
            "acquired_at": inv.acquired_at.isoformat() if inv.acquired_at else None,
            "item": {
                "id": inv.item.id,
                "name": inv.item.name,
                "description": inv.item.description,
                "type": inv.item.type,
                "subclass": inv.item.subclass,
                "slot": inv.item.slot,
                "rarity": inv.item.rarity,
                "icon": inv.item.icon,
                "strength_bonus": inv.item.strength_bonus,
                "agility_bonus": inv.item.agility_bonus,
                "intellect_bonus": inv.item.intellect_bonus,
                "stamina_bonus": inv.item.stamina_bonus,
                "xp_bonus": inv.item.xp_bonus,
                "crystal_bonus": inv.item.crystal_bonus,
                "set_name": inv.item.set_name,
                "required_level": inv.item.required_level,
                "required_class": inv.item.required_class,
            },
        }
        if inv.item.weapon_stats:
            item_data["item"]["weapon_stats"] = {
                "weapon_type": inv.item.weapon_stats.weapon_type,
                "weapon_category": inv.item.weapon_stats.weapon_category,
                "damage_min": inv.item.weapon_stats.damage_min,
                "damage_max": inv.item.weapon_stats.damage_max,
                "speed": inv.item.weapon_stats.speed,
                "dps": inv.item.weapon_stats.dps,
                "critical_strike_chance": inv.item.weapon_stats.critical_strike_chance,
            }
        if inv.item.armor_stats:
            item_data["item"]["armor_stats"] = {
                "armor_type": inv.item.armor_stats.armor_type,
                "armor_value": inv.item.armor_stats.armor_value,
                "slot": inv.item.armor_stats.slot,
            }
        result.append(normalize_nested_strings(item_data))

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

    item = inventory_item.item
    normalize_item_model(item)
    equipped_ids = get_equipped_inventory_ids(db, current_user.id)

    return normalize_nested_strings(
        {
            "inventory_id": inventory_item.id,
            "is_equipped": inventory_item.id in equipped_ids,
            "sell_price": max(1, int((item.price_crystals or 0) * 0.5)),
            "item": {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "type": item.type,
                "subclass": item.subclass,
                "slot": item.slot,
                "icon": item.icon,
                "rarity": item.rarity,
                "strength_bonus": item.strength_bonus,
                "agility_bonus": item.agility_bonus,
                "intellect_bonus": item.intellect_bonus,
                "stamina_bonus": item.stamina_bonus,
                "xp_bonus": item.xp_bonus,
                "crystal_bonus": item.crystal_bonus,
                "health_bonus": item.health_bonus,
                "required_level": item.required_level,
                "required_class": item.required_class,
                "set_name": item.set_name,
            },
            "weapon_stats": {
                "weapon_type": item.weapon_stats.weapon_type,
                "weapon_category": item.weapon_stats.weapon_category,
                "damage_min": item.weapon_stats.damage_min,
                "damage_max": item.weapon_stats.damage_max,
                "speed": item.weapon_stats.speed,
                "dps": item.weapon_stats.dps,
                "critical_strike_chance": item.weapon_stats.critical_strike_chance,
                "required_strength": item.weapon_stats.required_strength,
                "required_agility": item.weapon_stats.required_agility,
                "required_intellect": item.weapon_stats.required_intellect,
            }
            if item.weapon_stats
            else None,
            "armor_stats": {
                "armor_type": item.armor_stats.armor_type,
                "armor_value": item.armor_stats.armor_value,
                "slot": item.armor_stats.slot,
                "dodge_chance": item.armor_stats.dodge_chance,
                "block_chance": item.armor_stats.block_chance,
            }
            if item.armor_stats
            else None,
        }
    )


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
