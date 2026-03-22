from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from .equipment_service import EquipmentError
from .items_data import ITEMS, SET_BONUSES
from .models import (
    CharacterEquipment,
    Item,
    ItemArmorStats,
    ItemUniqueAbility,
    ItemWeaponStats,
    UserClassProgress,
    UserInventory,
    UserItem,
)
from .text_utils import normalize_nested_strings

logger = logging.getLogger(__name__)

SLOT_FIELDS = [
    "head_id",
    "neck_id",
    "shoulders_id",
    "back_id",
    "chest_id",
    "wrist_id",
    "hands_id",
    "waist_id",
    "legs_id",
    "feet_id",
    "ring1_id",
    "ring2_id",
    "trinket1_id",
    "trinket2_id",
    "main_hand_id",
    "off_hand_id",
    "ranged_id",
]

ITEM_BONUS_FIELDS = (
    "strength_bonus",
    "agility_bonus",
    "intellect_bonus",
    "stamina_bonus",
    "xp_bonus",
    "crystal_bonus",
    "critical_bonus",
    "luck_bonus",
    "health_bonus",
)

ABILITY_ALLOWED_KEYS = {
    "name",
    "description",
    "ability_type",
    "effect_strength",
    "effect_agility",
    "effect_intellect",
    "effect_xp_bonus",
    "effect_crystal_bonus",
    "effect_critical_bonus",
    "effect_luck_bonus",
    "cooldown",
    "duration",
    "mana_cost",
    "proc_chance",
    "proc_effect",
}

_RAW_CATALOG = normalize_nested_strings(ITEMS)


def _normalize_catalog_item(raw_item: dict) -> dict:
    stats = raw_item.get("stats") if isinstance(raw_item.get("stats"), dict) else {}
    bonuses = {
        field: stats.get(field, raw_item.get(field, 0)) or 0
        for field in ITEM_BONUS_FIELDS
    }
    weapon_stats = dict(raw_item.get("weapon_stats") or {}) or None
    armor_stats = dict(raw_item.get("armor_stats") or {}) or None
    unique_ability = dict(raw_item.get("unique_ability") or {}) or None

    if unique_ability:
        if "critical_bonus" in unique_ability and "effect_critical_bonus" not in unique_ability:
            unique_ability["effect_critical_bonus"] = unique_ability.get("critical_bonus")
        if "luck_bonus" in unique_ability and "effect_luck_bonus" not in unique_ability:
            unique_ability["effect_luck_bonus"] = unique_ability.get("luck_bonus")
        unique_ability = {key: value for key, value in unique_ability.items() if key in ABILITY_ALLOWED_KEYS}

    power = int(raw_item.get("power") or 0)
    if not power and weapon_stats:
        power = int(weapon_stats.get("damage_max") or weapon_stats.get("damage_min") or 0)
    if not power and armor_stats:
        power = int(armor_stats.get("armor_value") or 0)
    if not power:
        power = int(
            bonuses["strength_bonus"]
            + bonuses["agility_bonus"]
            + bonuses["intellect_bonus"]
            + bonuses["stamina_bonus"]
            + bonuses["health_bonus"] / 10
        )

    return {
        "id": int(raw_item["id"]),
        "name": raw_item["name"],
        "description": raw_item.get("description") or "",
        "type": raw_item.get("type") or "misc",
        "subclass": raw_item.get("subclass"),
        "slot": raw_item.get("slot"),
        "rarity": raw_item.get("rarity") or "common",
        "power": power,
        "set_name": raw_item.get("set_name"),
        "set_pieces": int(raw_item.get("set_pieces") or 1),
        "icon": raw_item.get("icon") or "package-variant",
        "price_crystals": int(raw_item.get("price_crystals") or 0),
        "required_level": int(raw_item.get("required_level") or 1),
        "required_class": raw_item.get("required_class"),
        "is_unique": bool(raw_item.get("is_unique", False)),
        "is_beta_item": bool(raw_item.get("is_beta_item", False)),
        "bonuses": bonuses,
        "weapon_stats": weapon_stats,
        "armor_stats": armor_stats,
        "unique_ability": unique_ability,
    }


CATALOG_ITEMS_BY_ID = {
    item["id"]: item
    for item in (_normalize_catalog_item(raw_item) for raw_item in _RAW_CATALOG)
}


def iter_catalog_items() -> list[dict]:
    return [dict(item) for item in CATALOG_ITEMS_BY_ID.values()]


def find_catalog_item_data(item_id: int) -> dict | None:
    item = CATALOG_ITEMS_BY_ID.get(int(item_id))
    return dict(item) if item else None


def _apply_catalog_definition(item: Item, item_data: dict) -> None:
    bonuses = item_data["bonuses"]
    item.name = item_data["name"]
    item.description = item_data["description"]
    item.type = item_data["type"]
    item.subclass = item_data["subclass"]
    item.slot = item_data["slot"]
    item.rarity = item_data["rarity"]
    item.power = item_data["power"]
    item.set_name = item_data["set_name"]
    item.set_pieces = item_data["set_pieces"]
    item.icon = item_data["icon"]
    item.price_crystals = item_data["price_crystals"]
    item.required_level = item_data["required_level"]
    item.required_class = item_data["required_class"]
    item.is_unique = item_data["is_unique"]
    item.is_beta_item = item_data["is_beta_item"]

    for field, value in bonuses.items():
        setattr(item, field, value)


def _ensure_weapon_stats_row(db: Session, item: Item, weapon_stats_data: dict | None) -> None:
    existing = db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id == item.id).first()
    if weapon_stats_data is None:
        if existing is not None:
            db.delete(existing)
        return

    if existing is None:
        existing = ItemWeaponStats(item_id=item.id)
        db.add(existing)

    for field in (
        "weapon_type",
        "weapon_category",
        "damage_min",
        "damage_max",
        "speed",
        "dps",
        "required_strength",
        "required_agility",
        "required_intellect",
        "range",
        "critical_strike_chance",
        "critical_strike_damage",
    ):
        if field in weapon_stats_data:
            setattr(existing, field, weapon_stats_data.get(field))


def _ensure_armor_stats_row(db: Session, item: Item, armor_stats_data: dict | None) -> None:
    existing = db.query(ItemArmorStats).filter(ItemArmorStats.item_id == item.id).first()
    if armor_stats_data is None:
        if existing is not None:
            db.delete(existing)
        return

    if existing is None:
        existing = ItemArmorStats(item_id=item.id)
        db.add(existing)

    for field in ("armor_type", "armor_value", "slot", "dodge_chance", "block_chance"):
        if field in armor_stats_data:
            setattr(existing, field, armor_stats_data.get(field))


def _ensure_ability_rows(db: Session, item: Item, ability_data: dict | None) -> None:
    existing_rows = db.query(ItemUniqueAbility).filter(ItemUniqueAbility.item_id == item.id).all()
    if ability_data is None:
        for row in existing_rows:
            db.delete(row)
        return

    if existing_rows:
        row = existing_rows[0]
        for extra_row in existing_rows[1:]:
            db.delete(extra_row)
    else:
        row = ItemUniqueAbility(item_id=item.id)
        db.add(row)

    for field in ABILITY_ALLOWED_KEYS:
        if field in ability_data:
            setattr(row, field, ability_data.get(field))


def _merge_legacy_item(db: Session, canonical_item: Item, legacy_item: Item) -> None:
    if legacy_item.id == canonical_item.id:
        return

    logger.warning(
        "Repairing legacy item duplicate: canonical_id=%s legacy_id=%s name=%s",
        canonical_item.id,
        legacy_item.id,
        canonical_item.name,
    )

    db.query(UserInventory).filter(UserInventory.item_id == legacy_item.id).update(
        {UserInventory.item_id: canonical_item.id},
        synchronize_session=False,
    )
    db.query(UserItem).filter(UserItem.item_id == legacy_item.id).update(
        {UserItem.item_id: canonical_item.id},
        synchronize_session=False,
    )

    legacy_weapon = db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id == legacy_item.id).first()
    if legacy_weapon is not None:
        canonical_weapon = db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id == canonical_item.id).first()
        if canonical_weapon is None:
            legacy_weapon.item_id = canonical_item.id
        else:
            db.delete(legacy_weapon)

    legacy_armor = db.query(ItemArmorStats).filter(ItemArmorStats.item_id == legacy_item.id).first()
    if legacy_armor is not None:
        canonical_armor = db.query(ItemArmorStats).filter(ItemArmorStats.item_id == canonical_item.id).first()
        if canonical_armor is None:
            legacy_armor.item_id = canonical_item.id
        else:
            db.delete(legacy_armor)

    db.query(ItemUniqueAbility).filter(ItemUniqueAbility.item_id == legacy_item.id).update(
        {ItemUniqueAbility.item_id: canonical_item.id},
        synchronize_session=False,
    )

    db.delete(legacy_item)


def _upsert_catalog_item(db: Session, item_data: dict) -> Item:
    item = db.query(Item).filter(Item.id == item_data["id"]).first()
    if item is None:
        item = Item(id=item_data["id"])
        db.add(item)
        db.flush()

    _apply_catalog_definition(item, item_data)
    db.flush()

    legacy_items = (
        db.query(Item)
        .filter(Item.name == item_data["name"], Item.id != item.id)
        .all()
    )
    for legacy_item in legacy_items:
        _merge_legacy_item(db, item, legacy_item)

    _ensure_weapon_stats_row(db, item, item_data["weapon_stats"])
    _ensure_armor_stats_row(db, item, item_data["armor_stats"])
    _ensure_ability_rows(db, item, item_data["unique_ability"])
    db.flush()
    return item


def sync_catalog_items(db: Session) -> None:
    for item_id in sorted(CATALOG_ITEMS_BY_ID):
        _upsert_catalog_item(db, CATALOG_ITEMS_BY_ID[item_id])
    db.flush()


def ensure_catalog_item(db: Session, item_id: int) -> Item:
    item_data = find_catalog_item_data(item_id)
    if not item_data:
        raise EquipmentError(f"Catalog item not found: {item_id}")

    return _upsert_catalog_item(db, item_data)


def buy_item(db: Session, user_id: int, item_id: int) -> bool:
    sync_catalog_items(db)

    try:
        item = ensure_catalog_item(db, item_id)
    except EquipmentError:
        logger.warning("Catalog item not found for purchase: item_id=%s", item_id)
        return False

    user_progress = (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )
    if user_progress is None:
        logger.warning("Character progress not found for purchase: user_id=%s", user_id)
        return False

    if user_progress.level < (item.required_level or 1):
        logger.info(
            "Purchase rejected because of level requirement: user_id=%s item_id=%s level=%s required_level=%s",
            user_id,
            item.id,
            user_progress.level,
            item.required_level,
        )
        return False

    if user_progress.crystals < (item.price_crystals or 0):
        logger.info(
            "Purchase rejected because of insufficient crystals: user_id=%s item_id=%s crystals=%s price=%s",
            user_id,
            item.id,
            user_progress.crystals,
            item.price_crystals,
        )
        return False

    if item.is_unique:
        existing = (
            db.query(UserInventory)
            .filter(UserInventory.user_id == user_id, UserInventory.item_id == item.id)
            .first()
        )
        if existing is not None:
            logger.info("Purchase rejected because unique item already owned: user_id=%s item_id=%s", user_id, item.id)
            return False

    user_progress.crystals -= item.price_crystals or 0
    inventory_item = UserInventory(user_id=user_id, item_id=item.id, quantity=1, is_equipped=False)
    db.add(inventory_item)
    db.commit()
    logger.info("Item purchased: user_id=%s item_id=%s inventory_id=%s", user_id, item.id, inventory_item.id)
    return True


def sell_item(db: Session, user_id: int, inventory_id: int) -> dict | None:
    inventory_item = (
        db.query(UserInventory)
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == user_id)
        .first()
    )
    if not inventory_item or not inventory_item.item:
        return None

    equipped_rows = db.query(CharacterEquipment).filter(CharacterEquipment.user_id == user_id).all()
    is_equipped = any(
        getattr(equipment, slot) == inventory_id
        for equipment in equipped_rows
        for slot in SLOT_FIELDS
    )
    if is_equipped:
        raise EquipmentError("Сначала снимите предмет")

    progress = (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )
    if progress is None:
        return None

    item = inventory_item.item
    sell_price = max(1, int((item.price_crystals or 0) * 0.5))
    progress.crystals += sell_price

    payload = {
        "item_name": item.name,
        "sell_price": sell_price,
        "new_crystals": progress.crystals,
    }
    db.delete(inventory_item)
    db.commit()
    return payload


def calculate_set_bonus(db: Session, user_id: int) -> dict:
    equipment = db.query(CharacterEquipment).filter(CharacterEquipment.user_id == user_id).first()
    if equipment is None:
        return {}

    equipped_items: list[Item] = []
    for slot in SLOT_FIELDS:
        inventory_id = getattr(equipment, slot)
        if not inventory_id:
            continue
        inventory_item = (
            db.query(UserInventory)
            .filter(UserInventory.id == inventory_id, UserInventory.user_id == user_id)
            .first()
        )
        if inventory_item and inventory_item.item:
            equipped_items.append(inventory_item.item)

    sets: dict[str, dict] = {}
    for item in equipped_items:
        if not item.set_name:
            continue
        if item.set_name not in sets:
            sets[item.set_name] = {
                "pieces": [],
                "total": item.set_pieces,
            }
        sets[item.set_name]["pieces"].append(item)

    bonuses = {}
    for set_name, data in sets.items():
        if set_name not in SET_BONUSES:
            continue
        piece_count = len(data["pieces"])
        set_bonus = SET_BONUSES[set_name]
        max_pieces = 0
        for pieces_needed in set_bonus["pieces"].keys():
            if piece_count >= pieces_needed and pieces_needed > max_pieces:
                max_pieces = pieces_needed
        if max_pieces <= 0:
            continue
        bonuses[set_name] = {
            "name": set_bonus["name"],
            "description": set_bonus["description"],
            "bonus": set_bonus["pieces"][max_pieces],
            "active_pieces": max_pieces,
        }
    return bonuses


def apply_item_bonuses(progress, items):
    if not items:
        return progress

    for item in items:
        if item.strength_bonus:
            progress.strength += item.strength_bonus
        if item.agility_bonus:
            progress.agility += item.agility_bonus
        if item.intellect_bonus:
            progress.intellect += item.intellect_bonus

    return progress
