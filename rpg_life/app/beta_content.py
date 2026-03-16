from datetime import datetime, timedelta

from app.core.dates import utc_now


CHEST_CATALOG = [
    {"name": "COMMON_CHEST", "rarity": "common", "gold_cost": 50},
    {"name": "RARE_CHEST", "rarity": "rare", "gold_cost": 125},
    {"name": "EPIC_CHEST", "rarity": "epic", "gold_cost": 250},
    {"name": "LEGENDARY_CHEST", "rarity": "legendary", "gold_cost": 420},
]


def _beta_item(name: str, slot: str, rarity: str, icon: str, power: int) -> dict:
    return {
        "name": name,
        "slot": slot,
        "rarity": rarity,
        "icon": icon,
        "power": power,
        "type": "armor",
        "subclass": slot,
        "description": f"Beta {slot} item: {name}",
        "price_crystals": max(10, power * 3),
    }


BETA_ITEMS = [
    _beta_item("Recruit Hood", "head", "common", "H1", 5),
    _beta_item("Scout Hood", "head", "uncommon", "H2", 9),
    _beta_item("Vanguard Helm", "head", "rare", "H3", 14),
    _beta_item("Storm Crown", "head", "epic", "H4", 20),
    _beta_item("Aurora Halo", "head", "legendary", "H5", 28),
    _beta_item("Recruit Vest", "chest", "common", "C1", 6),
    _beta_item("Scout Vest", "chest", "uncommon", "C2", 10),
    _beta_item("Vanguard Plate", "chest", "rare", "C3", 15),
    _beta_item("Storm Carapace", "chest", "epic", "C4", 21),
    _beta_item("Aurora Aegis", "chest", "legendary", "C5", 30),
    _beta_item("Recruit Mantle", "shoulders", "common", "S1", 4),
    _beta_item("Scout Mantle", "shoulders", "uncommon", "S2", 8),
    _beta_item("Vanguard Pauldrons", "shoulders", "rare", "S3", 13),
    _beta_item("Storm Mantle", "shoulders", "epic", "S4", 19),
    _beta_item("Aurora Shoulderguard", "shoulders", "legendary", "S5", 27),
    _beta_item("Recruit Pants", "pants", "common", "P1", 5),
    _beta_item("Scout Pants", "pants", "uncommon", "P2", 9),
    _beta_item("Vanguard Legwraps", "pants", "rare", "P3", 14),
    _beta_item("Storm Pants", "pants", "epic", "P4", 20),
    _beta_item("Aurora Greaves", "pants", "legendary", "P5", 29),
    _beta_item("Recruit Legguards", "legs", "common", "L1", 5),
    _beta_item("Scout Legguards", "legs", "uncommon", "L2", 9),
    _beta_item("Vanguard Greaves", "legs", "rare", "L3", 14),
    _beta_item("Storm Treads", "legs", "epic", "L4", 20),
    _beta_item("Aurora Striders", "legs", "legendary", "L5", 29),
]


def beta_boss_catalog(now: datetime | None = None) -> list[dict]:
    current_time = now or utc_now()
    return [
        {
            "name": "Iron Walker",
            "description": "Walk 30000 steps",
            "requirement_type": "steps",
            "requirement_value": 30000,
            "reward_gold": 120,
            "reward_chest": "COMMON_CHEST",
        },
        {
            "name": "Task Breaker",
            "description": "Complete 10 tasks",
            "requirement_type": "tasks",
            "requirement_value": 10,
            "reward_gold": 160,
            "reward_chest": "RARE_CHEST",
        },
        {
            "name": "Pulse Titan",
            "description": "Finish 6 workouts",
            "requirement_type": "workouts",
            "requirement_value": 6,
            "reward_gold": 200,
            "reward_chest": "RARE_CHEST",
        },
        {
            "name": "Sky Runner",
            "description": "Walk 50000 steps",
            "requirement_type": "steps",
            "requirement_value": 50000,
            "reward_gold": 260,
            "reward_chest": "EPIC_CHEST",
        },
        {
            "name": "Final Architect",
            "description": "Complete 20 tasks in one beta cycle",
            "requirement_type": "tasks",
            "requirement_value": 20,
            "reward_gold": 320,
            "reward_chest": "EPIC_CHEST",
        },
    ]
