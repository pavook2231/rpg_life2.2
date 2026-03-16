import random
from sqlalchemy.orm import Session
from .models import Item, UserInventory


RARITY_WEIGHTS = [
    ("common", 60),
    ("uncommon", 25),
    ("rare", 10),
    ("epic", 4),
    ("legendary", 1),
]

RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"]
BASE_DROP_CHANCE = 0.30
MAX_DROP_CHANCE = 0.55


def _normalized_loot_bonus(loot_bonus: float) -> float:
    return max(0.0, min(float(loot_bonus or 0.0), 0.60))


def _level_up_drop_chance(loot_bonus: float) -> float:
    bonus = _normalized_loot_bonus(loot_bonus)
    # Up to +24% absolute chance from max luck bonus (0.60).
    return min(MAX_DROP_CHANCE, BASE_DROP_CHANCE + bonus * 0.40)


def _promote_rarity(rarity: str, loot_bonus: float) -> str:
    bonus = _normalized_loot_bonus(loot_bonus)
    if bonus <= 0:
        return rarity

    current_index = RARITY_ORDER.index(rarity) if rarity in RARITY_ORDER else 0
    if current_index >= len(RARITY_ORDER) - 1:
        return rarity

    # One guaranteed roll for potential +1 tier, then a smaller chance for +2 tiers.
    if random.random() < bonus * 0.45:
        current_index += 1
        if current_index < len(RARITY_ORDER) - 1 and random.random() < bonus * 0.15:
            current_index += 1
    return RARITY_ORDER[current_index]


def _choose_rarity(loot_bonus: float = 0.0) -> str:
    roll = random.uniform(0, 100)
    cursor = 0.0
    chosen = "common"
    for rarity, weight in RARITY_WEIGHTS:
        cursor += weight
        if roll <= cursor:
            chosen = rarity
            break
    return _promote_rarity(chosen, loot_bonus)


def _item_payload(item: Item) -> dict:
    stats = []
    if item.strength_bonus:
        stats.append(f"+{int(item.strength_bonus)} Strength")
    if item.agility_bonus:
        stats.append(f"+{int(item.agility_bonus)} Agility")
    if item.intellect_bonus:
        stats.append(f"+{int(item.intellect_bonus)} Intellect")
    if item.stamina_bonus:
        stats.append(f"+{int(item.stamina_bonus)} Stamina")
    if item.xp_bonus:
        stats.append(f"+{int(item.xp_bonus * 100)}% XP Bonus")
    if item.crystal_bonus:
        stats.append(f"+{int(item.crystal_bonus * 100)}% Crystal Bonus")
    if item.critical_bonus:
        stats.append(f"+{int(item.critical_bonus * 100)}% Crit")
    if item.luck_bonus:
        stats.append(f"+{int(item.luck_bonus * 100)}% Luck")
    if item.weapon_stats:
        stats.append(
            f"Damage {item.weapon_stats.damage_min}-{item.weapon_stats.damage_max}"
        )
    if item.armor_stats:
        stats.append(f"Armor +{item.armor_stats.armor_value}")

    return {
        "id": item.id,
        "name": item.name,
        "icon": item.icon,
        "rarity": item.rarity,
        "required_level": item.required_level,
        "description": item.description,
        "stats": stats,
    }


def roll_level_up_loot(db: Session, user_id: int, level: int, loot_bonus: float = 0.0) -> dict | None:
    if random.random() >= _level_up_drop_chance(loot_bonus):
        return None

    for _ in range(12):
        rarity = _choose_rarity(loot_bonus)
        candidates = (
            db.query(Item)
            .filter(
                Item.required_level <= level,
                Item.rarity == rarity,
            )
            .all()
        )
        if not candidates:
            continue

        random.shuffle(candidates)
        for item in candidates:
            if item.is_unique:
                owned = (
                    db.query(UserInventory)
                    .filter(
                        UserInventory.user_id == user_id,
                        UserInventory.item_id == item.id,
                    )
                    .first()
                )
                if owned:
                    continue

            db.add(UserInventory(user_id=user_id, item_id=item.id, quantity=1))
            db.flush()
            return _item_payload(item)

    return None
