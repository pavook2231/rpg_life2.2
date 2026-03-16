from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class UserInventory(Base):
    __tablename__ = "user_inventory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    item_id = Column(Integer, ForeignKey("items.id"), index=True)
    quantity = Column(Integer, default=1)
    is_equipped = Column(Boolean, default=False)
    acquired_at = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", back_populates="inventory_items")
    item = relationship("Item")


class CharacterEquipment(Base):
    __tablename__ = "character_equipment"
    __table_args__ = (UniqueConstraint("user_id", "class_progress_id", name="uq_character_equipment_user_class"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    class_progress_id = Column(Integer, ForeignKey("user_class_progress.id"), index=True)
    head_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    neck_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    shoulders_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    back_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    chest_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    wrist_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    hands_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    waist_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    legs_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    feet_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    ring1_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    ring2_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    trinket1_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    trinket2_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    main_hand_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    off_hand_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    ranged_id = Column(Integer, ForeignKey("user_inventory.id"), nullable=True)
    total_strength = Column(Float, default=0)
    total_agility = Column(Float, default=0)
    total_intellect = Column(Float, default=0)
    total_stamina = Column(Float, default=0)
    total_armor = Column(Integer, default=0)
    total_dps = Column(Float, default=0)
    total_health = Column(Integer, default=100)
    attack_power = Column(Integer, default=0)
    spell_power = Column(Integer, default=0)
    critical_chance = Column(Float, default=0.05)
    haste = Column(Float, default=1.0)

    user = relationship("User", back_populates="equipment", foreign_keys=[user_id])
    class_progress = relationship("UserClassProgress", back_populates="equipment", foreign_keys=[class_progress_id])
    head = relationship("UserInventory", foreign_keys=[head_id])
    neck = relationship("UserInventory", foreign_keys=[neck_id])
    shoulders = relationship("UserInventory", foreign_keys=[shoulders_id])
    back = relationship("UserInventory", foreign_keys=[back_id])
    chest = relationship("UserInventory", foreign_keys=[chest_id])
    wrist = relationship("UserInventory", foreign_keys=[wrist_id])
    hands = relationship("UserInventory", foreign_keys=[hands_id])
    waist = relationship("UserInventory", foreign_keys=[waist_id])
    legs = relationship("UserInventory", foreign_keys=[legs_id])
    feet = relationship("UserInventory", foreign_keys=[feet_id])
    ring1 = relationship("UserInventory", foreign_keys=[ring1_id])
    ring2 = relationship("UserInventory", foreign_keys=[ring2_id])
    trinket1 = relationship("UserInventory", foreign_keys=[trinket1_id])
    trinket2 = relationship("UserInventory", foreign_keys=[trinket2_id])
    main_hand = relationship("UserInventory", foreign_keys=[main_hand_id])
    off_hand = relationship("UserInventory", foreign_keys=[off_hand_id])
    ranged = relationship("UserInventory", foreign_keys=[ranged_id])
