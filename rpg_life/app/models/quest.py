from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class Quest(Base):
    __tablename__ = "quests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    class_progress_id = Column(Integer, ForeignKey("user_class_progress.id"), nullable=True, index=True)
    title = Column(String)
    description = Column(Text)
    xp_reward = Column(Integer)
    crystal_reward = Column(Integer)
    rarity = Column(String, default="common")
    goal_type = Column(String, nullable=True)
    goal_id = Column(String, nullable=True, index=True)
    template_key = Column(String, nullable=True, index=True)
    difficulty_level = Column(String, default="easy")
    goal_progress_percent = Column(Integer, default=0)
    quest_bucket = Column(String, default="daily", index=True)
    is_universal = Column(Boolean, default=False)
    is_accepted = Column(Boolean, default=True)
    is_custom = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False, index=True)
    is_completed = Column(Boolean, default=False, index=True)
    quest_type = Column(String, default="daily", index=True)
    objective_type = Column(String, nullable=True)
    target_value = Column(Integer, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    icon = Column(String, default="📝")

    user = relationship("User", back_populates="quests")
    class_prog = relationship("UserClassProgress", back_populates="quests")
    challenge = relationship("Challenge", back_populates="boss_quests")


class CompletedQuest(Base):
    __tablename__ = "completed_quests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    quest_id = Column(Integer, ForeignKey("quests.id"), index=True)
    completed_at = Column(DateTime, default=utc_now, index=True)
    xp_earned = Column(Integer)
    crystals_earned = Column(Integer)

    user = relationship("User", back_populates="completed_quests")


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    challenge_type = Column(String, default="duel", index=True)
    objective_type = Column(String, nullable=False)
    target_value = Column(Integer, default=0)
    reward_xp = Column(Integer, default=0)
    reward_crystals = Column(Integer, default=0)
    reward_chest = Column(Boolean, default=False)
    status = Column(String, default="active", index=True)
    start_at = Column(DateTime, default=utc_now)
    end_at = Column(DateTime, nullable=False, index=True)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    accepted_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_challenges")
    opponent = relationship("User", foreign_keys=[opponent_id], back_populates="received_challenges")
    winner = relationship("User", foreign_keys=[winner_id], back_populates="won_challenges")
    participants = relationship("ChallengeParticipant", back_populates="challenge", cascade="all, delete-orphan")
    boss_quests = relationship("Quest", back_populates="challenge")


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    result_value = Column(Integer, default=0)
    joined_at = Column(DateTime, default=utc_now)
    is_creator = Column(Boolean, default=False)

    challenge = relationship("Challenge", back_populates="participants")
    user = relationship("User", back_populates="challenge_entries")
