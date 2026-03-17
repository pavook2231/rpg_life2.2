from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class UserClassProgress(Base):
    __tablename__ = "user_class_progress"
    __table_args__ = (UniqueConstraint("user_id", "class_name", name="uq_user_class_progress_user_class"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    class_name = Column(String, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    strength = Column(Float, default=1.0)
    agility = Column(Float, default=1.0)
    intellect = Column(Float, default=1.0)
    stamina = Column(Float, default=1.0)
    level = Column(Integer, default=1)
    current_xp = Column(Integer, default=0)
    crystals = Column(Integer, default=0)
    max_health = Column(Integer, default=100)
    current_health = Column(Integer, default=100)
    wounded_until = Column(DateTime, nullable=True)
    penalty_quests_remaining = Column(Integer, default=0)
    reward_penalty_percent = Column(Float, default=0.0)
    last_health_decay_at = Column(DateTime, default=utc_now)
    streak = Column(Integer, default=0)
    last_activity = Column(DateTime, default=utc_now)
    last_bonus = Column(DateTime, nullable=True)
    is_unlocked = Column(Boolean, default=False, index=True)

    user = relationship("User", back_populates="class_progress")
    equipment = relationship("CharacterEquipment", back_populates="class_progress", uselist=False)
    quests = relationship("Quest", back_populates="class_prog")
    steps_records = relationship("DailySteps", back_populates="class_prog")
    calories_records = relationship("DailyCalories", back_populates="class_prog")
    water_records = relationship("DailyWater", back_populates="class_prog")


class DailySteps(Base):
    __tablename__ = "daily_steps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    class_progress_id = Column(Integer, ForeignKey("user_class_progress.id"), nullable=True, index=True)
    steps = Column(Integer, default=0)
    target_steps = Column(Integer, default=10000)
    date = Column(DateTime, default=utc_now, index=True)
    synced_at = Column(DateTime, nullable=True)
    xp_earned = Column(Integer, default=0)
    crystals_earned = Column(Integer, default=0)
    is_reward_claimed = Column(Boolean, default=False)
    source = Column(String, default="manual")  # manual, healthkit, googlefit, pedometer, etc.

    user = relationship("User", back_populates="steps_records")
    class_prog = relationship("UserClassProgress", back_populates="steps_records")


class DailyCalories(Base):
    __tablename__ = "daily_calories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    class_progress_id = Column(Integer, ForeignKey("user_class_progress.id"), nullable=True, index=True)
    calories_consumed = Column(Integer, default=0)
    calories_burned = Column(Integer, default=0)
    net_calories = Column(Integer, default=0)
    target_calories = Column(Integer, default=2000)
    date = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", back_populates="calories_records")
    class_prog = relationship("UserClassProgress", back_populates="calories_records")


class DailyWater(Base):
    __tablename__ = "daily_water"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    class_progress_id = Column(Integer, ForeignKey("user_class_progress.id"), nullable=True, index=True)
    glasses = Column(Integer, default=0)
    target_glasses = Column(Integer, default=8)
    ml = Column(Integer, default=0)
    date = Column(DateTime, default=utc_now, index=True)
    last_updated = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="water_records")
    class_prog = relationship("UserClassProgress", back_populates="water_records")


class HealthAchievements(Base):
    __tablename__ = "health_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    steps_total = Column(Integer, default=0)
    steps_days_10k = Column(Integer, default=0)
    steps_streak = Column(Integer, default=0)
    calories_total = Column(Integer, default=0)
    calories_days_target = Column(Integer, default=0)
    water_total_glasses = Column(Integer, default=0)
    water_streak = Column(Integer, default=0)

    user = relationship("User", backref="health_achievements")
