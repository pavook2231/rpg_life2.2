# /app/item_service.py
from sqlalchemy.orm import Session
from .models import (
    Item, UserInventory, CharacterEquipment, User, UserClassProgress,
    ItemWeaponStats, ItemArmorStats, ItemUniqueAbility
)
from .items_data import SET_BONUSES
from .text_utils import normalize_nested_strings
import logging

logger = logging.getLogger(__name__)

SLOT_FIELDS = [
    "head_id", "neck_id", "shoulders_id", "back_id", "chest_id", "wrist_id",
    "hands_id", "waist_id", "legs_id", "feet_id", "ring1_id", "ring2_id",
    "trinket1_id", "trinket2_id", "main_hand_id", "off_hand_id", "ranged_id",
]

# РљР»Р°СЃСЃ РѕС€РёР±РєРё РґР»СЏ СЌРєРёРїРёСЂРѕРІРєРё
class EquipmentError(Exception):
    pass


def find_catalog_item_data(item_id: int) -> dict | None:
    from .items_data import ITEMS

    items_catalog = normalize_nested_strings(ITEMS)
    for item in items_catalog:
        if item.get("id") == item_id:
            return item
    return None


def ensure_catalog_item(db: Session, item_id: int) -> Item:
    item_data = find_catalog_item_data(item_id)
    if not item_data:
        raise EquipmentError(f"Catalog item not found: {item_id}")

    item = db.query(Item).filter(Item.name == item_data["name"]).first()
    if item:
        return item

    item = Item(
        name=item_data["name"],
        description=item_data["description"],
        type=item_data["type"],
        subclass=item_data.get("subclass"),
        slot=item_data.get("slot"),
        rarity=item_data["rarity"],
        strength_bonus=item_data.get("stats", {}).get("strength_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("strength_bonus", 0),
        agility_bonus=item_data.get("stats", {}).get("agility_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("agility_bonus", 0),
        intellect_bonus=item_data.get("stats", {}).get("intellect_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("intellect_bonus", 0),
        stamina_bonus=item_data.get("stats", {}).get("stamina_bonus", 0) if isinstance(item_data.get("stats"), dict) else 0,
        xp_bonus=item_data.get("stats", {}).get("xp_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("xp_bonus", 0),
        crystal_bonus=item_data.get("stats", {}).get("crystal_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("crystal_bonus", 0),
        critical_bonus=item_data.get("stats", {}).get("critical_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("critical_bonus", 0),
        luck_bonus=item_data.get("stats", {}).get("luck_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("luck_bonus", 0),
        set_name=item_data.get("set_name"),
        set_pieces=item_data.get("set_pieces", 1),
        icon=item_data.get("icon", "СЂСџвЂњВ¦"),
        price_crystals=item_data.get("price_crystals", 0),
        required_level=item_data.get("required_level", 1),
        required_class=item_data.get("required_class"),
        is_unique=item_data.get("is_unique", False),
    )
    db.add(item)
    db.flush()

    if "weapon_stats" in item_data:
        db.add(ItemWeaponStats(item_id=item.id, **item_data["weapon_stats"]))
    if "armor_stats" in item_data:
        db.add(ItemArmorStats(item_id=item.id, **item_data["armor_stats"]))
    if "unique_ability" in item_data:
        raw_ability = dict(item_data["unique_ability"])
        if "critical_bonus" in raw_ability and "effect_critical_bonus" not in raw_ability:
            raw_ability["effect_critical_bonus"] = raw_ability.get("critical_bonus")
        if "luck_bonus" in raw_ability and "effect_luck_bonus" not in raw_ability:
            raw_ability["effect_luck_bonus"] = raw_ability.get("luck_bonus")
        allowed_keys = {
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
        ability_payload = {k: v for k, v in raw_ability.items() if k in allowed_keys}
        db.add(ItemUniqueAbility(item_id=item.id, **ability_payload))

    db.flush()
    return item

# === Р¤РЈРќРљР¦РР Р”Р›РЇ РџРћРљРЈРџРљР ===
def buy_item(db: Session, user_id: int, item_id: int) -> bool:
    """РџРѕРєСѓРїРєР° РїСЂРµРґРјРµС‚Р° Р·Р° Р·РѕР»РѕС‚Рѕ"""
    item_data = find_catalog_item_data(item_id)
    
    if not item_data:
        logger.warning("РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ РІ РєР°С‚Р°Р»РѕРіРµ: item_id=%s", item_id)
        return False
    
    # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё СѓР¶Рµ С‚Р°РєРѕР№ РїСЂРµРґРјРµС‚ РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С…
    item = db.query(Item).filter(Item.name == item_data["name"]).first()
    if not item:
        # РЎРѕР·РґР°РµРј РїСЂРµРґРјРµС‚ РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С…
        item = Item(
            name=item_data["name"],
            description=item_data["description"],
            type=item_data["type"],
            subclass=item_data.get("subclass"),
            slot=item_data.get("slot"),
            rarity=item_data["rarity"],
            strength_bonus=item_data.get("stats", {}).get("strength_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("strength_bonus", 0),
            agility_bonus=item_data.get("stats", {}).get("agility_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("agility_bonus", 0),
            intellect_bonus=item_data.get("stats", {}).get("intellect_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("intellect_bonus", 0),
            stamina_bonus=item_data.get("stats", {}).get("stamina_bonus", 0) if isinstance(item_data.get("stats"), dict) else 0,
            xp_bonus=item_data.get("stats", {}).get("xp_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("xp_bonus", 0),
            crystal_bonus=item_data.get("stats", {}).get("crystal_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("crystal_bonus", 0),
            critical_bonus=item_data.get("stats", {}).get("critical_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("critical_bonus", 0),
            luck_bonus=item_data.get("stats", {}).get("luck_bonus", 0) if isinstance(item_data.get("stats"), dict) else item_data.get("luck_bonus", 0),
            set_name=item_data.get("set_name"),
            set_pieces=item_data.get("set_pieces", 1),
            icon=item_data.get("icon", "рџ“¦"),
            price_crystals=item_data.get("price_crystals", 0),
            required_level=item_data.get("required_level", 1),
            required_class=item_data.get("required_class"),
            is_unique=item_data.get("is_unique", False)
        )
        db.add(item)
        db.flush()
        
        # Р”РѕР±Р°РІР»СЏРµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РѕСЂСѓР¶РёСЏ, РµСЃР»Рё РµСЃС‚СЊ
        if "weapon_stats" in item_data:
            weapon_stats = ItemWeaponStats(
                item_id=item.id,
                **item_data["weapon_stats"]
            )
            db.add(weapon_stats)
        
        # Р”РѕР±Р°РІР»СЏРµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ Р±СЂРѕРЅРё, РµСЃР»Рё РµСЃС‚СЊ
        if "armor_stats" in item_data:
            armor_stats = ItemArmorStats(
                item_id=item.id,
                **item_data["armor_stats"]
            )
            db.add(armor_stats)
        
        # Р”РѕР±Р°РІР»СЏРµРј СѓРЅРёРєР°Р»СЊРЅС‹Рµ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё, РµСЃР»Рё РµСЃС‚СЊ
        if "unique_ability" in item_data:
            raw_ability = dict(item_data["unique_ability"])
            if "critical_bonus" in raw_ability and "effect_critical_bonus" not in raw_ability:
                raw_ability["effect_critical_bonus"] = raw_ability.get("critical_bonus")
            if "luck_bonus" in raw_ability and "effect_luck_bonus" not in raw_ability:
                raw_ability["effect_luck_bonus"] = raw_ability.get("luck_bonus")

            allowed_keys = {
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
            ability_payload = {k: v for k, v in raw_ability.items() if k in allowed_keys}
            ability = ItemUniqueAbility(item_id=item.id, **ability_payload)
            db.add(ability)
        
        db.flush()
        logger.info("РЎРѕР·РґР°РЅ РЅРѕРІС‹Р№ РїСЂРµРґРјРµС‚ РІ Р‘Р”: name=%s id=%s", item.name, item.id)
    
    user_progress = db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.is_unlocked == True
    ).first()
    
    if not user_progress:
        logger.warning("РџСЂРѕРіСЂРµСЃСЃ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅРµ РЅР°Р№РґРµРЅ: user_id=%s", user_id)
        return False
    
    logger.debug(
        "РџРѕРїС‹С‚РєР° РїРѕРєСѓРїРєРё РїСЂРµРґРјРµС‚Р°: user_id=%s crystals=%s price=%s item_id=%s",
        user_id,
        user_progress.crystals,
        item.price_crystals,
        item.id,
    )
    
    if user_progress.level < (item.required_level or 1):
        logger.info(
            "РџРѕРєСѓРїРєР° РѕС‚РєР»РѕРЅРµРЅР° (РЅРµРґРѕСЃС‚Р°С‚РѕС‡РЅС‹Р№ СѓСЂРѕРІРµРЅСЊ): user_id=%s level=%s required_level=%s item_id=%s",
            user_id,
            user_progress.level,
            item.required_level,
            item.id,
        )
        return False

    if user_progress.crystals < item.price_crystals:
        logger.info(
            "РџРѕРєСѓРїРєР° РѕС‚РєР»РѕРЅРµРЅР° (РЅРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РєСЂРёСЃС‚Р°Р»Р»РѕРІ): user_id=%s crystals=%s price=%s item_id=%s",
            user_id,
            user_progress.crystals,
            item.price_crystals,
            item.id,
        )
        return False
    
    # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё СѓР¶Рµ С‚Р°РєРѕР№ РїСЂРµРґРјРµС‚ Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РµСЃР»Рё СѓРЅРёРєР°Р»СЊРЅС‹Р№)
    if item.is_unique:
        existing = db.query(UserInventory).filter(
            UserInventory.user_id == user_id,
            UserInventory.item_id == item.id
        ).first()
        if existing:
            logger.info("РџРѕРєСѓРїРєР° РѕС‚РєР»РѕРЅРµРЅР° (СѓРЅРёРєР°Р»СЊРЅС‹Р№ РїСЂРµРґРјРµС‚ СѓР¶Рµ РµСЃС‚СЊ): user_id=%s item_id=%s", user_id, item.id)
            return False
    
    # РЎРїРёСЃС‹РІР°РµРј Р·РѕР»РѕС‚Рѕ
    user_progress.crystals -= item.price_crystals
    logger.info(
        "РљСЂРёСЃС‚Р°Р»Р»С‹ СЃРїРёСЃР°РЅС‹: user_id=%s deducted=%s remaining=%s item_id=%s",
        user_id,
        item.price_crystals,
        user_progress.crystals,
        item.id,
    )
    
    # Р”РѕР±Р°РІР»СЏРµРј РІ РёРЅРІРµРЅС‚Р°СЂСЊ
    inventory_item = UserInventory(
        user_id=user_id,
        item_id=item.id,
        quantity=1
    )
    db.add(inventory_item)
    db.commit()
    
    logger.info("РџСЂРµРґРјРµС‚ РєСѓРїР»РµРЅ: user_id=%s item_id=%s name=%s", user_id, item.id, item.name)
    return True


def sell_item(db: Session, user_id: int, inventory_id: int) -> dict | None:
    inventory_item = db.query(UserInventory).filter(
        UserInventory.id == inventory_id,
        UserInventory.user_id == user_id,
    ).first()

    if not inventory_item or not inventory_item.item:
        return None

    equipped_rows = db.query(CharacterEquipment).filter(
        CharacterEquipment.user_id == user_id
    ).all()
    is_equipped = any(
        getattr(equipment, slot) == inventory_id
        for equipment in equipped_rows
        for slot in SLOT_FIELDS
    )
    if is_equipped:
        raise EquipmentError("РЎРЅР°С‡Р°Р»Р° СЃРЅРёРјРёС‚Рµ РїСЂРµРґРјРµС‚")

    progress = db.query(UserClassProgress).filter(
        UserClassProgress.user_id == user_id,
        UserClassProgress.is_unlocked == True,
    ).first()
    if not progress:
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

# === Р¤РЈРќРљР¦РР Р”Р›РЇ Р­РљРРџРР РћР’РљР ===
def get_or_create_character_equipment(db: Session, user_id: int, class_progress_id: int):
    """РџРѕР»СѓС‡РёС‚СЊ РёР»Рё СЃРѕР·РґР°С‚СЊ Р·Р°РїРёСЃСЊ СЌРєРёРїРёСЂРѕРІРєРё РґР»СЏ РїРµСЂСЃРѕРЅР°Р¶Р°"""
    equipment = db.query(CharacterEquipment).filter(
        CharacterEquipment.user_id == user_id,
        CharacterEquipment.class_progress_id == class_progress_id
    ).first()
    
    if not equipment:
        equipment = CharacterEquipment(
            user_id=user_id,
            class_progress_id=class_progress_id
        )
        db.add(equipment)
        db.flush()
        logger.info(f"РЎРѕР·РґР°РЅР° СЌРєРёРїРёСЂРѕРІРєР° РґР»СЏ РїРµСЂСЃРѕРЅР°Р¶Р° {class_progress_id}")
    
    return equipment

def can_equip_item(db: Session, user_id: int, class_progress_id: int, inventory_id: int, target_slot: str) -> tuple[bool, str]:
    """РџСЂРѕРІРµСЂРёС‚СЊ, РјРѕР¶РЅРѕ Р»Рё СЌРєРёРїРёСЂРѕРІР°С‚СЊ РїСЂРµРґРјРµС‚ РІ СѓРєР°Р·Р°РЅРЅС‹Р№ СЃР»РѕС‚"""
    inventory_item = db.query(UserInventory).filter(
        UserInventory.id == inventory_id,
        UserInventory.user_id == user_id
    ).first()
    
    if not inventory_item:
        return False, "РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ РІ РёРЅРІРµРЅС‚Р°СЂРµ"
    
    item = inventory_item.item
    
    # РџСЂРѕРІРµСЂРєР° СѓСЂРѕРІРЅСЏ
    progress = db.query(UserClassProgress).filter(
        UserClassProgress.id == class_progress_id
    ).first()
    
    if progress and item.required_level > progress.level:
        return False, f"РўСЂРµР±СѓРµС‚СЃСЏ СѓСЂРѕРІРµРЅСЊ {item.required_level}"
    
    # РџСЂРѕРІРµСЂРєР° РєР»Р°СЃСЃР°
    if item.required_class and progress and item.required_class != progress.class_name:
        return False, f"Р­С‚РѕС‚ РїСЂРµРґРјРµС‚ С‚РѕР»СЊРєРѕ РґР»СЏ РєР»Р°СЃСЃР° {item.required_class}"
    
    # РџСЂРѕРІРµСЂРєР° СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё СЃР»РѕС‚Р°
    slot_compatibility = {
        "head": ["armor"],
        "neck": ["accessory"],
        "shoulders": ["armor"],
        "back": ["armor"],
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
        "off_hand": ["weapon", "armor"],  # РњРѕР¶РЅРѕ С‰РёС‚ РёР»Рё РѕСЂСѓР¶РёРµ
        "ranged": ["weapon"]
    }
    
    if target_slot not in slot_compatibility:
        return False, f"РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЃР»РѕС‚ {target_slot}"
    
    if item.type not in slot_compatibility[target_slot]:
        return False, f"РџСЂРµРґРјРµС‚ С‚РёРїР° {item.type} РЅРµР»СЊР·СЏ СЌРєРёРїРёСЂРѕРІР°С‚СЊ РІ СЃР»РѕС‚ {target_slot}"
    
    # РџРѕР»СѓС‡Р°РµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РѕСЂСѓР¶РёСЏ
    weapon_stats = db.query(ItemWeaponStats).filter(
        ItemWeaponStats.item_id == item.id
    ).first()
    
    # РЎРїРµС†РёР°Р»СЊРЅС‹Рµ РїСЂР°РІРёР»Р° РґР»СЏ РѕСЂСѓР¶РёСЏ
    if item.type == "weapon" and weapon_stats:
        equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
        
        # РџСЂРѕРІРµСЂРєР° РґРІСѓСЂСѓС‡РЅРѕРіРѕ РѕСЂСѓР¶РёСЏ
        if weapon_stats.weapon_category == "two_hand":
            if target_slot == "main_hand":
                if equipment.off_hand_id:
                    return False, "Р”РІСѓСЂСѓС‡РЅРѕРµ РѕСЂСѓР¶РёРµ РЅРµР»СЊР·СЏ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ СЃ РїСЂРµРґРјРµС‚РѕРј РІ РґСЂСѓРіРѕР№ СЂСѓРєРµ"
            elif target_slot == "off_hand":
                return False, "Р”РІСѓСЂСѓС‡РЅРѕРµ РѕСЂСѓР¶РёРµ РјРѕР¶РЅРѕ СЌРєРёРїРёСЂРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РІ РѕСЃРЅРѕРІРЅСѓСЋ СЂСѓРєСѓ"
        
        # РџСЂРѕРІРµСЂРєР° Р»СѓРєРѕРІ/Р°СЂР±Р°Р»РµС‚РѕРІ
        if weapon_stats.weapon_category == "ranged":
            if target_slot != "ranged":
                return False, "Р”Р°Р»СЊРЅРѕР±РѕР№РЅРѕРµ РѕСЂСѓР¶РёРµ РјРѕР¶РЅРѕ СЌРєРёРїРёСЂРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РІ СЃР»РѕС‚ РґР°Р»СЊРЅРµРіРѕ Р±РѕСЏ"
    
    return True, "OK"

def equip_item(db: Session, user_id: int, class_progress_id: int, inventory_id: int, target_slot: str) -> bool:
    """Р­РєРёРїРёСЂРѕРІРєР° РїСЂРµРґРјРµС‚Р°"""
    # РџСЂРѕРІРµСЂСЏРµРј РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ СЌРєРёРїРёСЂРѕРІРєРё
    can_equip, message = can_equip_item(db, user_id, class_progress_id, inventory_id, target_slot)
    if not can_equip:
        raise EquipmentError(message)
    
    inventory_item = db.query(UserInventory).filter(
        UserInventory.id == inventory_id,
        UserInventory.user_id == user_id
    ).first()
    
    if not inventory_item:
        return False
    
    equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
    
    # РџРѕР»СѓС‡Р°РµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РѕСЂСѓР¶РёСЏ
    weapon_stats = db.query(ItemWeaponStats).filter(
        ItemWeaponStats.item_id == inventory_item.item_id
    ).first()
    
    # Р•СЃР»Рё СЌС‚Рѕ РґРІСѓСЂСѓС‡РЅРѕРµ РѕСЂСѓР¶РёРµ, РѕС‡РёС‰Р°РµРј off_hand
    if weapon_stats and weapon_stats.weapon_category == "two_hand":
        if equipment.off_hand_id:
            old_off_hand = db.query(UserInventory).filter(
                UserInventory.id == equipment.off_hand_id
            ).first()
            if old_off_hand:
                old_off_hand.is_equipped = False
            equipment.off_hand_id = None
    
    # РЎРЅРёРјР°РµРј СЃС‚Р°СЂС‹Р№ РїСЂРµРґРјРµС‚ РІ СЌС‚РѕРј СЃР»РѕС‚Рµ
    old_item_id = getattr(equipment, f"{target_slot}_id")
    if old_item_id:
        old_item = db.query(UserInventory).filter(
            UserInventory.id == old_item_id
        ).first()
        if old_item:
            old_item.is_equipped = False
    
    # Р­РєРёРїРёСЂСѓРµРј РЅРѕРІС‹Р№
    setattr(equipment, f"{target_slot}_id", inventory_id)
    inventory_item.is_equipped = True
    
    # РџРµСЂРµСЃС‡РёС‚С‹РІР°РµРј РѕР±С‰РёРµ СЃС‚Р°С‚С‹
    recalculate_total_stats(db, equipment)
    
    db.commit()
    logger.info(f"РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ {user_id} СЌРєРёРїРёСЂРѕРІР°Р» РїСЂРµРґРјРµС‚ {inventory_item.item.name} РІ СЃР»РѕС‚ {target_slot}")
    return True

def unequip_item(db: Session, user_id: int, class_progress_id: int, slot: str) -> bool:
    """РЎРЅСЏС‚СЊ РїСЂРµРґРјРµС‚ РёР· СѓРєР°Р·Р°РЅРЅРѕРіРѕ СЃР»РѕС‚Р°"""
    equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
    
    inventory_id = getattr(equipment, f"{slot}_id")
    if not inventory_id:
        return False
    
    inventory_item = db.query(UserInventory).filter(
        UserInventory.id == inventory_id
    ).first()
    
    if inventory_item:
        inventory_item.is_equipped = False
    
    setattr(equipment, f"{slot}_id", None)
    
    # РџРµСЂРµСЃС‡РёС‚С‹РІР°РµРј СЃС‚Р°С‚С‹
    recalculate_total_stats(db, equipment)
    
    db.commit()
    logger.info(f"РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ {user_id} СЃРЅСЏР» РїСЂРµРґРјРµС‚ РёР· СЃР»РѕС‚Р° {slot}")
    return True

def recalculate_total_stats(db: Session, equipment: CharacterEquipment):
    """РџРµСЂРµСЃС‡РёС‚Р°С‚СЊ РѕР±С‰РёРµ СЃС‚Р°С‚С‹ РїРµСЂСЃРѕРЅР°Р¶Р° РѕС‚ РІСЃРµР№ СЌРєРёРїРёСЂРѕРІРєРё"""
    total_strength = 0
    total_agility = 0
    total_intellect = 0
    total_stamina = 0
    total_armor = 0
    total_dps = 0
    
    # РЎРѕР±РёСЂР°РµРј РІСЃРµ СЌРєРёРїРёСЂРѕРІР°РЅРЅС‹Рµ РїСЂРµРґРјРµС‚С‹
    slots = [
        'head', 'neck', 'shoulders', 'back', 'chest', 'wrist',
        'hands', 'waist', 'legs', 'feet', 'ring1', 'ring2',
        'trinket1', 'trinket2', 'main_hand', 'off_hand', 'ranged'
    ]
    
    for slot in slots:
        inv_id = getattr(equipment, f"{slot}_id")
        if inv_id:
            inv_item = db.query(UserInventory).filter(
                UserInventory.id == inv_id
            ).first()
            
            if inv_item and inv_item.item:
                item = inv_item.item
                total_strength += item.strength_bonus or 0
                total_agility += item.agility_bonus or 0
                total_intellect += item.intellect_bonus or 0
                total_stamina += item.stamina_bonus or 0
                
                # Р‘СЂРѕРЅСЏ
                armor_stats = db.query(ItemArmorStats).filter(
                    ItemArmorStats.item_id == item.id
                ).first()
                if armor_stats:
                    total_armor += armor_stats.armor_value or 0
                
                # РћСЂСѓР¶РёРµ
                weapon_stats = db.query(ItemWeaponStats).filter(
                    ItemWeaponStats.item_id == item.id
                ).first()
                if weapon_stats:
                    total_dps += weapon_stats.dps or 0
    
    equipment.total_strength = total_strength
    equipment.total_agility = total_agility
    equipment.total_intellect = total_intellect
    equipment.total_stamina = total_stamina
    equipment.total_armor = total_armor
    equipment.total_dps = total_dps
    
    # Р Р°СЃСЃС‡РёС‚С‹РІР°РµРј Р·РґРѕСЂРѕРІСЊРµ (Р±Р°Р·РѕРІРѕРµ 100 + СЃС‚Р°РјРёРЅР° * 10)
    equipment.total_health = 100 + (total_stamina * 10)

def get_equipped_items(db: Session, user_id: int, class_progress_id: int):
    """РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ СЌРєРёРїРёСЂРѕРІР°РЅРЅС‹Рµ РїСЂРµРґРјРµС‚С‹ СЃРѕ СЃС‚Р°С‚Р°РјРё"""
    equipment = get_or_create_character_equipment(db, user_id, class_progress_id)
    
    result = {}
    slots = [
        'head', 'neck', 'shoulders', 'back', 'chest', 'wrist',
        'hands', 'waist', 'legs', 'feet', 'ring1', 'ring2',
        'trinket1', 'trinket2', 'main_hand', 'off_hand', 'ranged'
    ]
    
    for slot in slots:
        inv_id = getattr(equipment, f"{slot}_id")
        if inv_id:
            inv_item = db.query(UserInventory).filter(
                UserInventory.id == inv_id
            ).first()
            if inv_item:
                item = inv_item.item
                weapon_stats = db.query(ItemWeaponStats).filter(
                    ItemWeaponStats.item_id == item.id
                ).first()
                armor_stats = db.query(ItemArmorStats).filter(
                    ItemArmorStats.item_id == item.id
                ).first()
                abilities = db.query(ItemUniqueAbility).filter(
                    ItemUniqueAbility.item_id == item.id
                ).all()
                
                result[slot] = {
                    "inventory_id": inv_item.id,
                    "item": item,
                    "weapon_stats": weapon_stats,
                    "armor_stats": armor_stats,
                    "abilities": abilities
                }
    
    return {
        "equipment": result,
        "totals": {
            "strength": equipment.total_strength,
            "agility": equipment.total_agility,
            "intellect": equipment.total_intellect,
            "stamina": equipment.total_stamina,
            "armor": equipment.total_armor,
            "dps": equipment.total_dps,
            "health": equipment.total_health
        }
    }

def calculate_set_bonus(db: Session, user_id: int):
    """Р Р°СЃСЃС‡РёС‚С‹РІР°РµС‚ Р±РѕРЅСѓСЃС‹ РѕС‚ СЌРєРёРїРёСЂРѕРІР°РЅРЅС‹С… СЃРµС‚РѕРІ"""
    equipment = db.query(CharacterEquipment).filter(CharacterEquipment.user_id == user_id).first()
    if not equipment:
        return {}
    
    # РЎРѕР±РёСЂР°РµРј РІСЃРµ СЌРєРёРїРёСЂРѕРІР°РЅРЅС‹Рµ РїСЂРµРґРјРµС‚С‹
    equipped_items = []
    for slot in ['head_id', 'neck_id', 'shoulders_id', 'back_id', 'chest_id', 
                 'wrist_id', 'hands_id', 'waist_id', 'legs_id', 'feet_id',
                 'ring1_id', 'ring2_id', 'trinket1_id', 'trinket2_id',
                 'main_hand_id', 'off_hand_id', 'ranged_id']:
        item_id = getattr(equipment, slot)
        if item_id:
            inv_item = db.query(UserInventory).filter(
                UserInventory.id == item_id,
                UserInventory.user_id == user_id
            ).first()
            if inv_item and inv_item.item:
                equipped_items.append(inv_item.item)
    
    # Р“СЂСѓРїРїРёСЂСѓРµРј РїРѕ СЃРµС‚Р°Рј
    sets = {}
    for item in equipped_items:
        if item.set_name:
            if item.set_name not in sets:
                sets[item.set_name] = {
                    'pieces': [],
                    'total': item.set_pieces
                }
            sets[item.set_name]['pieces'].append(item)
    
    # Р Р°СЃСЃС‡РёС‚С‹РІР°РµРј Р±РѕРЅСѓСЃС‹
    bonuses = {}
    for set_name, data in sets.items():
        piece_count = len(data['pieces'])
        if set_name in SET_BONUSES:
            set_bonus = SET_BONUSES[set_name]
            # РќР°С…РѕРґРёРј РјР°РєСЃРёРјР°Р»СЊРЅС‹Р№ Р±РѕРЅСѓСЃ РґР»СЏ РЅР°РґРµС‚РѕРіРѕ РєРѕР»РёС‡РµСЃС‚РІР° С‡Р°СЃС‚РµР№
            max_pieces = 0
            for pieces_needed in set_bonus["pieces"].keys():
                if piece_count >= pieces_needed and pieces_needed > max_pieces:
                    max_pieces = pieces_needed
            
            if max_pieces > 0:
                bonuses[set_name] = {
                    "name": set_bonus["name"],
                    "description": set_bonus["description"],
                    "bonus": set_bonus["pieces"][max_pieces],
                    "active_pieces": max_pieces,
                }
                logger.info(f"РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ {user_id} Р°РєС‚РёРІРёСЂРѕРІР°Р» Р±РѕРЅСѓСЃ СЃРµС‚Р° {set_name} ({max_pieces} С‡Р°СЃС‚РµР№)")
    
    return bonuses

def apply_item_bonuses(progress, items):
    """РџСЂРёРјРµРЅСЏРµС‚ Р±РѕРЅСѓСЃС‹ РїСЂРµРґРјРµС‚РѕРІ Рє РїСЂРѕРіСЂРµСЃСЃСѓ РїРµСЂСЃРѕРЅР°Р¶Р°"""
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

