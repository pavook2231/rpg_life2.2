from collections import defaultdict
import re
from sqlalchemy.orm import Session, joinedload
from app import shop_runtime
from .models import (
    UserClassProgress,
    UserInventory,
    CharacterEquipment,
    ItemWeaponStats,
    ItemArmorStats,
    ItemUniqueAbility,
)
import logging

logger = logging.getLogger(__name__)


SLOTS = [
    "head",
    "neck",
    "shoulders",
    "back",
    "chest",
    "wrist",
    "hands",
    "waist",
    "legs",
    "feet",
    "ring1",
    "ring2",
    "trinket1",
    "trinket2",
    "main_hand",
    "off_hand",
    "ranged",
]
SLOT_SET = set(SLOTS)
SLOT_ALIASES = {
    "mainhand": "main_hand",
    "main_hand": "main_hand",
    "main": "main_hand",
    "weapon": "main_hand",
    "primary": "main_hand",
    "two_hand": "main_hand",
    "twohand": "main_hand",
    "right_hand": "main_hand",
    "offhand": "off_hand",
    "off_hand": "off_hand",
    "off": "off_hand",
    "secondary": "off_hand",
    "shield": "off_hand",
    "left_hand": "off_hand",
    "range": "ranged",
    "range_weapon": "ranged",
    "ranged_weapon": "ranged",
}


class EquipmentError(Exception):
    pass


def _slot_field(slot: str) -> str:
    return f"{slot}_id"


def _normalize_equipment_slot(raw_slot: str | None) -> str:
    if not raw_slot:
        return ""
    normalized = str(raw_slot).strip()
    if not normalized:
        return ""
    normalized = normalized.replace("-", "_").replace(" ", "_")
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", normalized)
    normalized = re.sub(r"_+", "_", normalized).lower()
    return SLOT_ALIASES.get(normalized, normalized)


def _normalize_class_name(raw_name: str | None) -> str:
    if not raw_name:
        return ""
    return str(raw_name).strip().lower()


def _resolve_target_slot(
    *,
    item_type: str,
    requested_slot: str,
    item_slot: str | None,
    item_subclass: str | None,
    weapon_stats: ItemWeaponStats | None,
) -> str:
    slot = _normalize_equipment_slot(requested_slot)
    if slot:
        return slot

    if item_type == "weapon":
        category = (weapon_stats.weapon_category if weapon_stats else "") or ""
        if category == "ranged":
            return "ranged"
        if category == "off_hand_only":
            return "off_hand"
        return "main_hand"

    if item_type == "armor":
        return _normalize_equipment_slot(item_slot)

    if item_type == "accessory":
        if item_subclass == "ring":
            return "ring1"
        if item_subclass == "necklace":
            return "neck"
        if item_subclass == "trinket":
            return "trinket1"

    return slot


def _equipped_inventory_ids(equipment: CharacterEquipment | None) -> set[int]:
    if not equipment:
        return set()
    return {
        inv_id
        for inv_id in (getattr(equipment, _slot_field(slot)) for slot in SLOTS)
        if inv_id
    }


def _get_weapon_stats_for_inventory(
    db: Session,
    user_id: int,
    inventory_id: int | None,
) -> ItemWeaponStats | None:
    if not inventory_id:
        return None

    inventory_item = (
        db.query(UserInventory)
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == user_id)
        .first()
    )
    if not inventory_item:
        return None

    return db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id == inventory_item.item_id).first()


def _prune_invalid_equipment_slots(db: Session, equipment: CharacterEquipment, user_id: int) -> bool:
    slot_values = {slot: getattr(equipment, _slot_field(slot)) for slot in SLOTS}
    inventory_ids = [inventory_id for inventory_id in slot_values.values() if inventory_id]
    if not inventory_ids:
        return False

    valid_ids = {
        row.id
        for row in (
            db.query(UserInventory)
            .filter(UserInventory.user_id == user_id, UserInventory.id.in_(inventory_ids))
            .all()
        )
    }

    changed = False
    for slot, inventory_id in slot_values.items():
        if inventory_id and inventory_id not in valid_ids:
            setattr(equipment, _slot_field(slot), None)
            changed = True
    return changed


def _clear_inventory_from_slots(
    equipment: CharacterEquipment,
    inventory_id: int,
    *,
    except_slot: str | None = None,
) -> bool:
    changed = False
    for slot in SLOTS:
        if slot == except_slot:
            continue
        if getattr(equipment, _slot_field(slot)) == inventory_id:
            setattr(equipment, _slot_field(slot), None)
            changed = True
    return changed


def ensure_equipment_integrity(db: Session, equipment: CharacterEquipment, user_id: int) -> bool:
    changed = _prune_invalid_equipment_slots(db, equipment, user_id)

    main_hand_weapon = _get_weapon_stats_for_inventory(db, user_id, equipment.main_hand_id)
    if main_hand_weapon and main_hand_weapon.weapon_category == "two_hand" and equipment.off_hand_id:
        equipment.off_hand_id = None
        changed = True

    if changed:
        db.flush()

    return changed


def sync_equipped_inventory_flags(db: Session, user_id: int) -> None:
    db.flush()
    equipped_ids = get_equipped_inventory_ids(db, user_id)
    inventory_rows = db.query(UserInventory).filter(UserInventory.user_id == user_id).all()
    for inventory_row in inventory_rows:
        inventory_row.is_equipped = inventory_row.id in equipped_ids


def get_equipped_inventory_ids(
    db: Session, user_id: int, class_progress_id: int | None = None
) -> set[int]:
    query = db.query(CharacterEquipment).filter(CharacterEquipment.user_id == user_id)
    if class_progress_id is not None:
        query = query.filter(CharacterEquipment.class_progress_id == class_progress_id)
    equipped_ids: set[int] = set()
    for equipment in query.all():
        equipped_ids.update(_equipped_inventory_ids(equipment))
    return equipped_ids


def get_or_create_character_equipment(db: Session, user_id: int, class_progress_id: int):
    equipment = (
        db.query(CharacterEquipment)
        .filter(
            CharacterEquipment.user_id == user_id,
            CharacterEquipment.class_progress_id == class_progress_id,
        )
        .first()
    )

    if not equipment:
        equipment = CharacterEquipment(user_id=user_id, class_progress_id=class_progress_id)
        db.add(equipment)
        db.flush()

    return equipment


def can_equip_item(
    db: Session,
    user_id: int,
    class_progress_id: int,
    inventory_id: int,
    target_slot: str,
) -> tuple[bool, str]:
    inventory_item = (
        db.query(UserInventory)
        .options(joinedload(UserInventory.item))
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == user_id)
        .first()
    )

    if not inventory_item:
        return False, "Item not found in inventory"

    item = inventory_item.item
    progress = (
        db.query(UserClassProgress)
        .filter(
            UserClassProgress.id == class_progress_id,
            UserClassProgress.user_id == user_id,
        )
        .first()
    )
    if not progress:
        return False, "Character class progress not found"

    if item.required_level and item.required_level > progress.level:
        return False, f"Требуется уровень {item.required_level}"
    if item.required_class and _normalize_class_name(item.required_class) != _normalize_class_name(progress.class_name):
        return False, f"Предмет доступен только для класса {item.required_class}"

    weapon_stats = (
        db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id == item.id).first()
        if item.type == "weapon"
        else None
    )
    target_slot = _resolve_target_slot(
        item_type=item.type or "",
        requested_slot=target_slot,
        item_slot=item.slot,
        item_subclass=item.subclass,
        weapon_stats=weapon_stats,
    )

    slot_compatibility = {
        "head": ["armor"],
        "neck": ["accessory"],
        "shoulders": ["armor"],
        "back": ["armor", "accessory"],
        "chest": ["armor"],
        "wrist": ["armor"],
        "hands": ["armor"],
        "waist": ["armor"],
        "legs": ["armor"],
        "feet": ["armor"],
        "ring1": ["accessory"],
        "ring2": ["accessory"],
        "trinket1": ["accessory"],
        "trinket2": ["accessory"],
        "main_hand": ["weapon"],
        "off_hand": ["weapon", "armor"],
        "ranged": ["weapon"],
    }

    if target_slot not in SLOT_SET:
        return False, f"Unknown slot: {target_slot}"
    if item.type not in slot_compatibility[target_slot]:
        return False, f"Cannot equip item type '{item.type}' to slot '{target_slot}'"

    if item.type == "armor" and item.slot and _normalize_equipment_slot(item.slot) != target_slot:
        return False, f"Armor slot mismatch: expected '{item.slot}'"

    if item.type == "accessory":
        if item.subclass == "ring" and target_slot not in ["ring1", "ring2"]:
            return False, "Ring can be equipped only in ring slots"
        if item.subclass == "necklace" and target_slot != "neck":
            return False, "Necklace can be equipped only in neck slot"
        if item.subclass == "trinket" and target_slot not in ["trinket1", "trinket2"]:
            return False, "Trinket can be equipped only in trinket slots"

    if item.type == "weapon" and weapon_stats:
        if weapon_stats.required_strength and weapon_stats.required_strength > progress.strength:
            return False, f"Required strength: {weapon_stats.required_strength}"
        if weapon_stats.required_agility and weapon_stats.required_agility > progress.agility:
            return False, f"Required agility: {weapon_stats.required_agility}"
        if weapon_stats.required_intellect and weapon_stats.required_intellect > progress.intellect:
            return False, f"Required intellect: {weapon_stats.required_intellect}"

        equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
        ensure_equipment_integrity(db, equipment, user_id)
        category = weapon_stats.weapon_category
        if category == "two_hand":
            if target_slot != "main_hand":
                return False, "Two-hand weapon can be equipped only to main hand"
        elif category == "ranged" and target_slot != "ranged":
            return False, "Ranged weapon can be equipped only to ranged slot"
        elif category == "main_hand_only" and target_slot != "main_hand":
            return False, "Weapon can be equipped only to main hand"
        elif category == "off_hand_only" and target_slot != "off_hand":
            return False, "Weapon can be equipped only to off hand"

    if target_slot == "off_hand":
        equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
        ensure_equipment_integrity(db, equipment, user_id)
        main_hand_weapon = _get_weapon_stats_for_inventory(db, user_id, equipment.main_hand_id)
        if main_hand_weapon and main_hand_weapon.weapon_category == "two_hand":
            return False, "Cannot equip off-hand item while two-hand weapon is equipped"

    return True, "OK"


def equip_item(
    db: Session,
    user_id: int,
    class_progress_id: int,
    inventory_id: int,
    target_slot: str,
) -> bool:
    target_slot = _normalize_equipment_slot(target_slot)
    can_equip, message = can_equip_item(db, user_id, class_progress_id, inventory_id, target_slot)
    if not can_equip:
        raise EquipmentError(message)

    inventory_item = (
        db.query(UserInventory)
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == user_id)
        .first()
    )
    if not inventory_item:
        return False

    equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
    ensure_equipment_integrity(db, equipment, user_id)
    weapon_stats = (
        db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id == inventory_item.item_id).first()
    )

    target_slot = _resolve_target_slot(
        item_type=(inventory_item.item.type if inventory_item.item else ""),
        requested_slot=target_slot,
        item_slot=(inventory_item.item.slot if inventory_item.item else None),
        item_subclass=(inventory_item.item.subclass if inventory_item.item else None),
        weapon_stats=weapon_stats,
    )
    # Единственный источник истины: только slot_id в CharacterEquipment.
    if weapon_stats and weapon_stats.weapon_category == "two_hand" and equipment.off_hand_id:
        equipment.off_hand_id = None

    _clear_inventory_from_slots(equipment, inventory_id, except_slot=target_slot)
    setattr(equipment, _slot_field(target_slot), inventory_id)
    recalculate_total_stats(db, equipment)
    sync_equipped_inventory_flags(db, user_id)
    db.commit()
    return True


def unequip_item(db: Session, user_id: int, class_progress_id: int, slot: str) -> bool:
    equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
    ensure_equipment_integrity(db, equipment, user_id)
    inventory_id = getattr(equipment, _slot_field(slot))
    if not inventory_id:
        return False

    setattr(equipment, _slot_field(slot), None)
    recalculate_total_stats(db, equipment)
    sync_equipped_inventory_flags(db, user_id)
    db.commit()
    return True


def _load_equipped_payload(db: Session, equipment: CharacterEquipment):
    inv_ids = list(_equipped_inventory_ids(equipment))
    if not inv_ids:
        return {}, {}, {}, defaultdict(list)

    inv_rows = (
        db.query(UserInventory)
        .options(joinedload(UserInventory.item))
        .filter(UserInventory.id.in_(inv_ids))
        .all()
    )
    inv_map = {row.id: row for row in inv_rows if row.item}
    item_ids = [row.item_id for row in inv_rows if row.item_id]

    weapon_map = {
        row.item_id: row
        for row in db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id.in_(item_ids)).all()
    } if item_ids else {}
    armor_map = {
        row.item_id: row
        for row in db.query(ItemArmorStats).filter(ItemArmorStats.item_id.in_(item_ids)).all()
    } if item_ids else {}

    abilities_map: defaultdict[int, list] = defaultdict(list)
    if item_ids:
        for row in db.query(ItemUniqueAbility).filter(ItemUniqueAbility.item_id.in_(item_ids)).all():
            abilities_map[row.item_id].append(row)

    return inv_map, weapon_map, armor_map, abilities_map


def recalculate_total_stats(db: Session, equipment: CharacterEquipment):
    total_strength = 0.0
    total_agility = 0.0
    total_intellect = 0.0
    total_stamina = 0.0
    total_armor = 0
    total_dps = 0.0

    inv_map, weapon_map, armor_map, _ = _load_equipped_payload(db, equipment)

    for slot in SLOTS:
        inv_id = getattr(equipment, f"{slot}_id")
        if not inv_id:
            continue
        inv_item = inv_map.get(inv_id)
        if not inv_item or not inv_item.item:
            continue

        item = inv_item.item
        total_strength += item.strength_bonus or 0
        total_agility += item.agility_bonus or 0
        total_intellect += item.intellect_bonus or 0
        total_stamina += item.stamina_bonus or 0

        armor_stats = armor_map.get(item.id)
        if armor_stats:
            total_armor += armor_stats.armor_value or 0

        weapon_stats = weapon_map.get(item.id)
        if weapon_stats:
            total_dps += weapon_stats.dps or 0

    equipment.total_strength = total_strength
    equipment.total_agility = total_agility
    equipment.total_intellect = total_intellect
    equipment.total_stamina = total_stamina
    equipment.total_armor = total_armor
    equipment.total_dps = total_dps
    equipment.total_health = 100 + int(total_stamina * 10)


def get_equipped_items(db: Session, user_id: int, class_progress_id: int):
    equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
    ensure_equipment_integrity(db, equipment, user_id)
    recalculate_total_stats(db, equipment)

    result = {}
    total_crit = 0.0
    total_luck = 0.0

    inv_map, weapon_map, armor_map, abilities_map = _load_equipped_payload(db, equipment)

    for slot in SLOTS:
        inv_id = getattr(equipment, f"{slot}_id")
        if not inv_id:
            continue
        inv_item = inv_map.get(inv_id)
        if not inv_item or not inv_item.item:
            continue

        item = inv_item.item
        weapon_stats = weapon_map.get(item.id)
        armor_stats = armor_map.get(item.id)
        abilities = abilities_map.get(item.id, [])

        if weapon_stats and weapon_stats.critical_strike_chance:
            total_crit += weapon_stats.critical_strike_chance

        total_crit += item.critical_bonus or 0
        total_luck += item.luck_bonus or 0

        for ability in abilities:
            total_crit += ability.effect_critical_bonus or 0
            total_luck += ability.effect_luck_bonus or 0
            if ability.proc_effect in {"critical_bonus", "critical_chance"}:
                total_crit += ability.proc_chance or 0
            if ability.proc_effect in {"luck_bonus", "luck"}:
                total_luck += ability.proc_chance or 0

        result[slot] = {
            "inventory_id": inv_item.id,
            "item": item,
            "weapon_stats": weapon_stats,
            "armor_stats": armor_stats,
            "abilities": abilities,
        }

    damage_min = 0
    damage_max = 0
    if "main_hand" in result and result["main_hand"].get("weapon_stats"):
        ws = result["main_hand"]["weapon_stats"]
        damage_min += ws.damage_min
        damage_max += ws.damage_max
    if "off_hand" in result and result["off_hand"].get("weapon_stats"):
        ws = result["off_hand"]["weapon_stats"]
        damage_min += ws.damage_min // 2
        damage_max += ws.damage_max // 2

    enchant_payloads = shop_runtime.get_weapon_enchants(user_id)
    enchant_strength = 0.0
    enchant_agility = 0.0
    enchant_intellect = 0.0
    enchant_stamina = 0.0
    enchant_crit = 0.0
    enchant_luck = 0.0
    enchant_damage_min = 0
    enchant_damage_max = 0
    for slot in ("main_hand", "off_hand", "ranged"):
        slot_entry = result.get(slot)
        if not slot_entry:
            continue
        inventory_id = slot_entry.get("inventory_id")
        if not inventory_id:
            continue
        enchant = enchant_payloads.get(str(int(inventory_id)))
        if not enchant:
            continue
        effects = enchant.get("effects", {}) if isinstance(enchant.get("effects", {}), dict) else {}
        enchant_strength += float(effects.get("strength", 0.0) or 0.0)
        enchant_agility += float(effects.get("agility", 0.0) or 0.0)
        enchant_intellect += float(effects.get("intellect", 0.0) or 0.0)
        enchant_stamina += float(effects.get("stamina", 0.0) or 0.0)
        enchant_crit += float(effects.get("critical_chance", 0.0) or 0.0)
        enchant_luck += float(effects.get("luck", 0.0) or 0.0)
        enchant_damage_min += int(effects.get("damage_min", 0) or 0)
        enchant_damage_max += int(effects.get("damage_max", 0) or 0)
        slot_entry["enchant"] = enchant

    return {
        "equipment": result,
        "totals": {
            "strength": equipment.total_strength + enchant_strength,
            "agility": equipment.total_agility + enchant_agility,
            "intellect": equipment.total_intellect + enchant_intellect,
            "stamina": equipment.total_stamina + enchant_stamina,
            "armor": equipment.total_armor,
            "dps": equipment.total_dps,
            "health": equipment.total_health + int(enchant_stamina * 10),
            "damage_min": damage_min + enchant_damage_min,
            "damage_max": damage_max + enchant_damage_max,
            "critical_chance": (total_crit + enchant_crit) * 100,
            "luck": (total_luck + enchant_luck) * 100,
        },
    }
