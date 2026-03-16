# /app/weapon_system.py
from sqlalchemy.orm import Session
from .models import (
    Item, ItemWeaponStats, CharacterEquipment, UserInventory,
    UserClassProgress
)
import logging

logger = logging.getLogger(__name__)

class WeaponCompatibilityError(Exception):
    pass

def check_weapon_compatibility(
    db: Session, 
    user_id: int, 
    class_progress_id: int,
    weapon_item: Item,
    target_slot: str
) -> tuple[bool, str]:
    """
    Проверяет совместимость оружия с классом и слотами
    """
    # Получаем статистику оружия
    weapon_stats = db.query(ItemWeaponStats).filter(
        ItemWeaponStats.item_id == weapon_item.id
    ).first()
    
    if not weapon_stats:
        return False, "Это не оружие"
    
    # Получаем прогресс класса
    progress = db.query(UserClassProgress).filter(
        UserClassProgress.id == class_progress_id
    ).first()
    
    if not progress:
        return False, "Класс не найден"
    
    # Проверка требований по классу
    if weapon_item.required_class and weapon_item.required_class != progress.class_name:
        return False, f"Это оружие только для класса {weapon_item.required_class}"
    
    # Проверка уровня
    if weapon_item.required_level > progress.level:
        return False, f"Требуется уровень {weapon_item.required_level}"
    
    # Проверка требований к статам
    if weapon_stats.required_strength > progress.strength:
        return False, f"Требуется сила {weapon_stats.required_strength}"
    if weapon_stats.required_agility > progress.agility:
        return False, f"Требуется ловкость {weapon_stats.required_agility}"
    if weapon_stats.required_intellect > progress.intellect:
        return False, f"Требуется интеллект {weapon_stats.required_intellect}"
    
    # Получаем текущую экипировку
    equipment = db.query(CharacterEquipment).filter(
        CharacterEquipment.user_id == user_id,
        CharacterEquipment.class_progress_id == class_progress_id
    ).first()
    
    # Проверка совместимости слотов по категории оружия
    category = weapon_stats.weapon_category
    
    if category == "two_hand":
        # Двуручное оружие - только в main_hand, off_hand должен быть пуст
        if target_slot != "main_hand":
            return False, "Двуручное оружие можно экипировать только в правую руку"
        if equipment and equipment.off_hand_id:
            return False, "Двуручное оружие нельзя использовать с предметом в левой руке"
            
    elif category == "one_hand":
        # Одноручное - можно в любую руку
        if target_slot not in ["main_hand", "off_hand"]:
            return False, "Одноручное оружие можно экипировать только в руки"
            
    elif category == "main_hand_only":
        # Только в правую руку (меч со щитом)
        if target_slot != "main_hand":
            return False, "Это оружие можно экипировать только в правую руку"
            
    elif category == "off_hand_only":
        # Только в левую руку (щит)
        if target_slot != "off_hand":
            return False, "Щиты можно экипировать только в левую руку"
            
    elif category == "ranged":
        # Дальний бой
        if target_slot != "ranged":
            return False, "Дальнобойное оружие можно экипировать только в слот дальнего боя"
    
    # Проверка двух одинаковых оружий в двух руках
    if target_slot in ["main_hand", "off_hand"] and equipment:
        # Если пытаемся экипировать второе оружие, проверяем что оно одноручное
        other_slot = "off_hand" if target_slot == "main_hand" else "main_hand"
        other_item_id = getattr(equipment, f"{other_slot}_id")
        
        if other_item_id:
            other_inv = db.query(UserInventory).filter(
                UserInventory.id == other_item_id
            ).first()
            
            if other_inv:
                other_weapon_stats = db.query(ItemWeaponStats).filter(
                    ItemWeaponStats.item_id == other_inv.item_id
                ).first()
                
                if other_weapon_stats and other_weapon_stats.weapon_category == "two_hand":
                    return False, "Нельзя использовать одноручное оружие с двуручным"
    
    return True, "OK"

def calculate_weapon_damage(
    weapon_stats: ItemWeaponStats,
    strength: float,
    agility: float,
    intellect: float
) -> dict:
    """
    Рассчитывает урон оружия с учётом характеристик персонажа
    """
    # Базовая формула урона
    base_damage = (weapon_stats.damage_min + weapon_stats.damage_max) / 2
    
    # Модификаторы от характеристик в зависимости от типа оружия
    modifier = 1.0
    
    if weapon_stats.weapon_type in ["one_hand_sword", "two_hand_sword"]:
        # Мечи зависят от силы
        modifier += strength / 100
    elif weapon_stats.weapon_type in ["dagger", "bow", "crossbow"]:
        # Кинжалы и луки от ловкости
        modifier += agility / 100
    elif weapon_stats.weapon_type in ["staff", "wand"]:
        # Посохи и жезлы от интеллекта
        modifier += intellect / 100
    
    # Урон в секунду
    dps = base_damage / weapon_stats.speed * modifier
    
    # Шанс критического удара
    crit_chance = weapon_stats.critical_strike_chance or 0
    if weapon_stats.weapon_type in ["dagger", "bow"]:
        crit_chance += agility / 200  # Ловкость увеличивает крит
    
    return {
        "min_damage": int(weapon_stats.damage_min * modifier),
        "max_damage": int(weapon_stats.damage_max * modifier),
        "dps": round(dps, 1),
        "crit_chance": round(crit_chance * 100, 1),
        "speed": weapon_stats.speed
    }

def get_dual_wield_bonus(equipment: CharacterEquipment) -> dict:
    """
    Рассчитывает бонусы за использование двух оружий
    """
    if not equipment.main_hand_id or not equipment.off_hand_id:
        return {}
    
    # Проверяем, что в обоих руках оружие
    main_hand = db.query(UserInventory).filter(
        UserInventory.id == equipment.main_hand_id
    ).first()
    
    off_hand = db.query(UserInventory).filter(
        UserInventory.id == equipment.off_hand_id
    ).first()
    
    if not main_hand or not off_hand:
        return {}
    
    main_weapon = db.query(ItemWeaponStats).filter(
        ItemWeaponStats.item_id == main_hand.item_id
    ).first()
    
    off_weapon = db.query(ItemWeaponStats).filter(
        ItemWeaponStats.item_id == off_hand.item_id
    ).first()
    
    if not main_weapon or not off_weapon:
        return {}
    
    # Бонусы за две руки
    return {
        "attack_speed": 1.1,  # +10% скорости атаки
        "extra_attack_chance": 0.2,  # 20% шанс дополнительной атаки
        "damage_penalty": 0.9  # Урон снижен на 10% (баланс)
    }