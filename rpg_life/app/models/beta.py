from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class Chest(Base):
    __tablename__ = "chests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    rarity = Column(String, nullable=False, index=True)
    gold_cost = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now, index=True)


class UserItem(Base):
    __tablename__ = "user_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    equipped = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    user = relationship("User")
    item = relationship("Item")


class Boss(Base):
    __tablename__ = "bosses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=False)
    requirement_type = Column(String, nullable=False, index=True)
    requirement_value = Column(Integer, nullable=False)
    reward_gold = Column(Integer, default=0)
    reward_chest = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)


class UserBoss(Base):
    __tablename__ = "user_bosses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    boss_id = Column(Integer, ForeignKey("bosses.id"), nullable=False, index=True)
    progress = Column(Integer, default=0)
    completed = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User")
    boss = relationship("Boss")
