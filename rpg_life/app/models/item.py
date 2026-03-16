import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class WeaponType(str, enum.Enum):
    ONE_HAND_SWORD = "one_hand_sword"
    ONE_HAND_AXE = "one_hand_axe"
    ONE_HAND_MACE = "one_hand_mace"
    DAGGER = "dagger"
    TWO_HAND_SWORD = "two_hand_sword"
    TWO_HAND_AXE = "two_hand_axe"
    TWO_HAND_MACE = "two_hand_mace"
    STAFF = "staff"
    POLEARM = "polearm"
    BOW = "bow"
    CROSSBOW = "crossbow"
    WAND = "wand"


class WeaponCategory(str, enum.Enum):
    ONE_HAND = "one_hand"
    TWO_HAND = "two_hand"
    MAIN_HAND_ONLY = "main_hand_only"
    OFF_HAND_ONLY = "off_hand_only"
    RANGED = "ranged"


class ArmorType(str, enum.Enum):
    CLOTH = "cloth"
    LEATHER = "leather"
    MAIL = "mail"
    PLATE = "plate"


class ItemRarity(str, enum.Enum):
    POOR = "poor"
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


class ItemType(str, enum.Enum):
    WEAPON = "weapon"
    ARMOR = "armor"
    ACCESSORY = "accessory"


class ItemSubclass(str, enum.Enum):
    SWORD = "sword"
    AXE = "axe"
    MACE = "mace"
    DAGGER = "dagger"
    STAFF = "staff"
    BOW = "bow"
    CROSSBOW = "crossbow"
    POLEARM = "polearm"
    HELMET = "helmet"
    SHOULDER = "shoulder"
    CHESTPIECE = "chestpiece"
    GAUNTLETS = "gauntlets"
    BELT = "belt"
    LEGGINGS = "leggings"
    BOOTS = "boots"
    CLOAK = "cloak"
    SHIELD = "shield"
    RING = "ring"
    NECKLACE = "necklace"
    TRINKET = "trinket"


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    type = Column(String)
    subclass = Column(String, nullable=True)
    slot = Column(String, nullable=True)
    rarity = Column(String, default="common")
    power = Column(Integer, default=0)
    strength_bonus = Column(Float, default=0)
    agility_bonus = Column(Float, default=0)
    intellect_bonus = Column(Float, default=0)
    stamina_bonus = Column(Float, default=0)
    xp_bonus = Column(Float, default=0)
    crystal_bonus = Column(Float, default=0)
    critical_bonus = Column(Float, default=0)
    luck_bonus = Column(Float, default=0)
    health_bonus = Column(Integer, default=0)
    set_name = Column(String, nullable=True)
    set_pieces = Column(Integer, default=1)
    icon = Column(String, default="📦")
    price_crystals = Column(Integer, default=0)
    required_level = Column(Integer, default=1)
    required_class = Column(String, nullable=True)
    is_unique = Column(Boolean, default=False)
    is_beta_item = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=utc_now)

    weapon_stats = relationship("ItemWeaponStats", back_populates="item", uselist=False, cascade="all, delete-orphan")
    armor_stats = relationship("ItemArmorStats", back_populates="item", uselist=False, cascade="all, delete-orphan")
    abilities = relationship("ItemUniqueAbility", back_populates="item", cascade="all, delete-orphan")


class ItemWeaponStats(Base):
    __tablename__ = "item_weapon_stats"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), unique=True, index=True)
    weapon_type = Column(String)
    weapon_category = Column(String)
    damage_min = Column(Integer, default=1)
    damage_max = Column(Integer, default=3)
    speed = Column(Float, default=2.0)
    dps = Column(Float, default=0)
    required_strength = Column(Integer, default=0)
    required_agility = Column(Integer, default=0)
    required_intellect = Column(Integer, default=0)
    range = Column(Integer, default=5)
    critical_strike_chance = Column(Float, default=0)
    critical_strike_damage = Column(Float, default=2.0)

    item = relationship("Item", back_populates="weapon_stats")


class ItemArmorStats(Base):
    __tablename__ = "item_armor_stats"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), unique=True, index=True)
    armor_type = Column(String)
    armor_value = Column(Integer, default=0)
    slot = Column(String)
    dodge_chance = Column(Float, default=0)
    block_chance = Column(Float, default=0)

    item = relationship("Item", back_populates="armor_stats")


class ItemUniqueAbility(Base):
    __tablename__ = "item_unique_abilities"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), index=True)
    name = Column(String)
    description = Column(Text)
    ability_type = Column(String)
    effect_strength = Column(Float, default=0)
    effect_agility = Column(Float, default=0)
    effect_intellect = Column(Float, default=0)
    effect_xp_bonus = Column(Float, default=0)
    effect_crystal_bonus = Column(Float, default=0)
    effect_critical_bonus = Column(Float, default=0)
    effect_luck_bonus = Column(Float, default=0)
    cooldown = Column(Integer, default=0)
    duration = Column(Integer, default=0)
    mana_cost = Column(Integer, default=0)
    proc_chance = Column(Float, default=0)
    proc_effect = Column(String, nullable=True)

    item = relationship("Item", back_populates="abilities")
