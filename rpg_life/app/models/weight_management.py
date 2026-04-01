from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class UserHealthProfile(Base):
    __tablename__ = "user_health_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_health_profiles_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sex = Column(String, nullable=True)
    height_cm = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    goal_type = Column(String, nullable=True, index=True)
    daily_activity_level = Column(String, nullable=True)
    target_weight_kg = Column(Float, nullable=True)
    kilos_to_lose = Column(Float, nullable=True)
    timezone_name = Column(String, nullable=True)
    anamnesis_completed_at = Column(DateTime, nullable=True)
    program_started_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="health_profile")


class WeightBaseline(Base):
    __tablename__ = "weight_baselines"
    __table_args__ = (UniqueConstraint("user_id", name="uq_weight_baselines_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    measurements_json = Column(Text, nullable=True)
    baseline_completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="weight_baseline")


class WeightEntry(Base):
    __tablename__ = "weight_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date_local = Column(String, nullable=False, index=True)
    weight_kg = Column(Float, nullable=False)
    source = Column(String, default="manual", index=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", back_populates="weight_entries")


class StepDay(Base):
    __tablename__ = "step_days"
    __table_args__ = (UniqueConstraint("user_id", "date_local", name="uq_step_days_user_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date_local = Column(String, nullable=False, index=True)
    steps = Column(Integer, default=0)
    source = Column(String, default="manual", index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="step_days")


class WalkingPlanState(Base):
    __tablename__ = "walking_plan_states"
    __table_args__ = (UniqueConstraint("user_id", name="uq_walking_plan_states_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    current_program_week = Column(Integer, default=1)
    current_daily_target_steps = Column(Integer, default=6000)
    current_mode = Column(String, default="normal", index=True)
    last_week_achieved_days = Column(Integer, default=0)
    last_week_average_steps = Column(Integer, default=0)
    last_adjustment_type = Column(String, default="initial")
    last_adjustment_reason = Column(String, nullable=True)
    last_computed_at = Column(DateTime, default=utc_now)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="walking_plan_state")


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"
    __table_args__ = (UniqueConstraint("user_id", "week_number", name="uq_weekly_reviews_user_week"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    week_number = Column(Integer, nullable=False, index=True)
    week_start_date_local = Column(String, nullable=False, index=True)
    week_end_date_local = Column(String, nullable=False, index=True)
    target_daily_steps = Column(Integer, default=0)
    achieved_days = Column(Integer, default=0)
    average_steps = Column(Integer, default=0)
    current_weight_kg = Column(Float, nullable=True)
    previous_weight_kg = Column(Float, nullable=True)
    weight_delta_kg = Column(Float, nullable=True)
    motivation_self_rating = Column(Integer, nullable=True)
    difficulty_self_rating = Column(Integer, nullable=True)
    plateau_detected = Column(Boolean, default=False)
    lapse_detected = Column(Boolean, default=False)
    next_week_target_steps = Column(Integer, nullable=True)
    completed_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="weekly_reviews")


class MotivationState(Base):
    __tablename__ = "motivation_states"
    __table_args__ = (UniqueConstraint("user_id", name="uq_motivation_states_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    motivation_score = Column(Integer, default=0)
    motivation_band = Column(String, default="medium", index=True)
    adherence_14d_pct = Column(Integer, default=0)
    quest_completion_14d_pct = Column(Integer, default=0)
    checkin_consistency_14d_pct = Column(Integer, default=0)
    self_report_component_pct = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, index=True)

    user = relationship("User", back_populates="motivation_state")
