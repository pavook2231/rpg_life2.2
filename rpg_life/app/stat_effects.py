import random
from sqlalchemy.orm import Session

from .models import (
    CharacterEquipment,
    ItemUniqueAbility,
    ItemWeaponStats,
    UserClassProgress,
    UserInventory,
)
from . import shop_runtime
from .services import progression_service


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


class StatEffects:
    @staticmethod
    def calculate_xp_bonus(intellect: float, gear_bonus: float = 0.0) -> float:
        return max(0.0, float(intellect or 0) * 0.005 + float(gear_bonus or 0.0))

    @staticmethod
    def calculate_gold_bonus(agility: float, gear_bonus: float = 0.0) -> float:
        return max(0.0, float(agility or 0) * 0.002 + float(gear_bonus or 0.0))

    @staticmethod
    def calculate_critical_chance(crit_points: float) -> float:
        return min(0.95, max(0.0, float(crit_points or 0) * 0.005))

    @staticmethod
    def calculate_luck(luck_points: float) -> float:
        return min(0.60, max(0.0, float(luck_points or 0) * 0.01))

    @staticmethod
    def calculate_armor_reduction(armor: float) -> float:
        return min(0.90, max(0.0, float(armor or 0) * 0.001))

    @staticmethod
    def _load_gear_effects(db: Session, user_id: int) -> dict[str, float]:
        equipment = db.query(CharacterEquipment).filter(CharacterEquipment.user_id == user_id).first()
        if not equipment:
            return {
                "crit_points": 0.0,
                "luck_points": 0.0,
                "xp_bonus": 0.0,
                "gold_bonus": 0.0,
            }

        inv_ids = [
            getattr(equipment, f"{slot}_id")
            for slot in SLOTS
            if getattr(equipment, f"{slot}_id")
        ]
        if not inv_ids:
            return {
                "crit_points": 0.0,
                "luck_points": 0.0,
                "xp_bonus": 0.0,
                "gold_bonus": 0.0,
            }

        gear_crit_chance = 0.0
        gear_luck_chance = 0.0
        gear_xp_bonus = 0.0
        gear_gold_bonus = 0.0
        inv_rows = db.query(UserInventory).filter(UserInventory.id.in_(inv_ids)).all()
        item_ids = [row.item_id for row in inv_rows if row.item_id]
        weapon_map = (
            {
                row.item_id: row
                for row in db.query(ItemWeaponStats).filter(ItemWeaponStats.item_id.in_(item_ids)).all()
            }
            if item_ids
            else {}
        )
        ability_rows = (
            db.query(ItemUniqueAbility).filter(ItemUniqueAbility.item_id.in_(item_ids)).all()
            if item_ids
            else []
        )
        enchant_payloads = shop_runtime.get_weapon_enchants(user_id)
        ability_by_item: dict[int, list[ItemUniqueAbility]] = {}
        for ability in ability_rows:
            ability_by_item.setdefault(ability.item_id, []).append(ability)

        for inv_item in inv_rows:
            if not inv_item.item:
                continue
            item = inv_item.item
            gear_crit_chance += (item.critical_bonus or 0) * 100
            gear_luck_chance += (item.luck_bonus or 0) * 100
            gear_xp_bonus += item.xp_bonus or 0
            gear_gold_bonus += item.crystal_bonus or 0

            weapon_stats = weapon_map.get(item.id)
            if weapon_stats and weapon_stats.critical_strike_chance:
                gear_crit_chance += weapon_stats.critical_strike_chance * 100

            for ability in ability_by_item.get(item.id, []):
                gear_crit_chance += (ability.effect_critical_bonus or 0) * 100
                gear_luck_chance += (ability.effect_luck_bonus or 0) * 100
                if ability.proc_effect in {"critical_bonus", "critical_chance"}:
                    gear_crit_chance += (ability.proc_chance or 0) * 100
                if ability.proc_effect in {"luck_bonus", "luck"}:
                    gear_luck_chance += (ability.proc_chance or 0) * 100

            enchant = enchant_payloads.get(str(int(inv_item.id)))
            if enchant:
                effects = enchant.get("effects", {}) if isinstance(enchant.get("effects", {}), dict) else {}
                gear_xp_bonus += float(effects.get("xp_bonus", 0.0) or 0.0)
                gear_gold_bonus += float(effects.get("gold_bonus", 0.0) or 0.0)

        return {
            "crit_points": gear_crit_chance / 0.5 if gear_crit_chance > 0 else 0.0,
            "luck_points": gear_luck_chance,
            "xp_bonus": gear_xp_bonus,
            "gold_bonus": gear_gold_bonus,
        }

    @classmethod
    def build_reward_effects(cls, db: Session, user_id: int) -> dict[str, float]:
        progress = (
            db.query(UserClassProgress)
            .filter(
                UserClassProgress.user_id == user_id,
                UserClassProgress.is_unlocked == True,
            )
            .first()
        )
        if not progress:
            return {
                "xp_bonus": 0.0,
                "gold_bonus": 0.0,
                "crit_reward_chance": 0.0,
                "loot_bonus": 0.0,
                "armor_reduction": 0.0,
                "system_daily_cap": progression_service.BASE_SYSTEM_DAILY_CAP,
                "strength": 0.0,
                "agility": 0.0,
                "intellect": 0.0,
                "stamina": 0.0,
                "critical": 0.0,
                "luck": 0.0,
                "armor": 0.0,
            }

        total_stats = progression_service.get_total_character_stats(db, user_id, progress)
        gear_effects = cls._load_gear_effects(db, user_id)
        critical_points = float(total_stats["critical"])
        luck_points = float(total_stats["luck"])

        return {
            "xp_bonus": cls.calculate_xp_bonus(total_stats["intellect"], gear_effects["xp_bonus"]),
            "gold_bonus": cls.calculate_gold_bonus(total_stats["agility"], gear_effects["gold_bonus"]),
            "crit_reward_chance": cls.calculate_critical_chance(critical_points),
            "loot_bonus": cls.calculate_luck(luck_points),
            "armor_reduction": cls.calculate_armor_reduction(total_stats["armor"]),
            "system_daily_cap": progression_service.calculate_system_daily_cap(total_stats["strength"]),
            "strength": total_stats["strength"],
            "agility": total_stats["agility"],
            "intellect": total_stats["intellect"],
            "stamina": total_stats["stamina"],
            "critical": critical_points,
            "luck": luck_points,
            "armor": total_stats["armor"],
        }

    @staticmethod
    def serialize_reward_effects(effects: dict[str, float]) -> dict[str, float]:
        return {
            "xp_bonus_percent": round(effects.get("xp_bonus", 0.0) * 100, 1),
            "gold_bonus_percent": round(effects.get("gold_bonus", 0.0) * 100, 1),
            "crit_reward_chance_percent": round(effects.get("crit_reward_chance", 0.0) * 100, 1),
            "loot_bonus_percent": round(effects.get("loot_bonus", 0.0) * 100, 1),
            "armor_reduction_percent": round(effects.get("armor_reduction", 0.0) * 100, 1),
            "system_daily_cap": int(effects.get("system_daily_cap", progression_service.BASE_SYSTEM_DAILY_CAP)),
        }

    @classmethod
    def apply_quest_rewards(cls, db: Session, user_id: int, quest_xp: int, quest_crystals: int):
        effects = cls.build_reward_effects(db, user_id)
        loot_bonus = float(effects.get("loot_bonus", 0.0) or 0.0)

        final_xp = int(quest_xp * (1 + effects["xp_bonus"]))
        final_crystals = int(quest_crystals * (1 + effects["gold_bonus"]))

        active_contract = shop_runtime.get_active_contract(user_id)
        if active_contract:
            contract_xp_bonus = float(active_contract.get("xp_bonus", 0.0) or 0.0)
            contract_gold_bonus = float(active_contract.get("gold_bonus", 0.0) or 0.0)
            contract_loot_bonus = float(active_contract.get("loot_bonus", 0.0) or 0.0)
            final_xp = int(round(final_xp * (1.0 + contract_xp_bonus)))
            final_crystals = int(round(final_crystals * (1.0 + contract_gold_bonus)))
            loot_bonus += contract_loot_bonus

        is_critical = random.random() < effects["crit_reward_chance"]
        if is_critical:
            final_xp *= 2
            final_crystals *= 2

        is_lucky = random.random() < loot_bonus
        return final_xp, final_crystals, is_critical, is_lucky, loot_bonus
