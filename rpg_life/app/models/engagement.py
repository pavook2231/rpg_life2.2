from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class WeeklyRewardClaim(Base):
    __tablename__ = "weekly_reward_claims"
    __table_args__ = (UniqueConstraint("user_id", "week_start_at", name="uq_weekly_reward_claim_user_week"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    class_name = Column(String, nullable=False, index=True)
    objective_type = Column(String, nullable=False, index=True)
    progress_value = Column(Integer, nullable=False, default=0)
    target_value = Column(Integer, nullable=False, default=0)
    reward_xp = Column(Integer, nullable=False, default=0)
    reward_crystals = Column(Integer, nullable=False, default=0)
    claimed_tier_count = Column(Integer, nullable=False, default=0)
    week_start_at = Column(DateTime, nullable=False, index=True)
    week_end_at = Column(DateTime, nullable=False, index=True)
    claimed_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    user = relationship("User", backref="weekly_reward_claims")


class SeasonalRewardClaim(Base):
    __tablename__ = "seasonal_reward_claims"
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_seasonal_reward_claim_user_event"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("game_events.id"), nullable=False, index=True)
    class_name = Column(String, nullable=False, index=True)
    objective_type = Column(String, nullable=False, index=True)
    progress_value = Column(Integer, nullable=False, default=0)
    target_value = Column(Integer, nullable=False, default=0)
    reward_xp = Column(Integer, nullable=False, default=0)
    reward_crystals = Column(Integer, nullable=False, default=0)
    reward_chest_name = Column(String, nullable=True)
    claimed_tier_count = Column(Integer, nullable=False, default=0)
    claimed_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    user = relationship("User", backref="seasonal_reward_claims")
    event = relationship("GameEvent")
