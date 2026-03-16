from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String, nullable=True)
    birth_year = Column(Integer, nullable=True)
    gender = Column(String, default="unspecified")
    language_preference = Column(String, default="ru")
    selected_goal_type = Column(String, default="personal_development", index=True)
    goal_term_months = Column(Integer, default=6)
    goal_cycle_index = Column(Integer, default=1)
    goal_cycle_started_at = Column(DateTime, nullable=True)
    goal_cycle_deadline_at = Column(DateTime, nullable=True)
    goal_cycle_xp = Column(Integer, default=0)
    goal_target_xp = Column(Integer, default=20000)
    goal_progress_percent = Column(Integer, default=0)
    last_goal_change_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    class_progress = relationship("UserClassProgress", back_populates="user", cascade="all, delete-orphan")
    quests = relationship("Quest", back_populates="user", cascade="all, delete-orphan")
    completed_quests = relationship("CompletedQuest", back_populates="user", cascade="all, delete-orphan")
    user_achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    inventory_items = relationship("UserInventory", back_populates="user", cascade="all, delete-orphan")
    equipment = relationship("CharacterEquipment", back_populates="user", cascade="all, delete-orphan")
    steps_records = relationship("DailySteps", back_populates="user", cascade="all, delete-orphan")
    calories_records = relationship("DailyCalories", back_populates="user", cascade="all, delete-orphan")
    water_records = relationship("DailyWater", back_populates="user", cascade="all, delete-orphan")
    created_challenges = relationship("Challenge", foreign_keys="Challenge.creator_id", back_populates="creator")
    received_challenges = relationship("Challenge", foreign_keys="Challenge.opponent_id", back_populates="opponent")
    won_challenges = relationship("Challenge", foreign_keys="Challenge.winner_id", back_populates="winner")
    challenge_entries = relationship("ChallengeParticipant", back_populates="user", cascade="all, delete-orphan")
    sent_friend_requests = relationship(
        "FriendRequest",
        foreign_keys="FriendRequest.requester_id",
        back_populates="requester",
        cascade="all, delete-orphan",
    )
    received_friend_requests = relationship(
        "FriendRequest",
        foreign_keys="FriendRequest.receiver_id",
        back_populates="receiver",
        cascade="all, delete-orphan",
    )
    friendships = relationship(
        "Friendship",
        foreign_keys="Friendship.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    coop_entries = relationship("CoopQuestParticipant", back_populates="user", cascade="all, delete-orphan")
    sent_challenge_invitations = relationship(
        "ChallengeInvitation",
        foreign_keys="ChallengeInvitation.sender_id",
        back_populates="sender",
        cascade="all, delete-orphan",
    )
    received_challenge_invitations = relationship(
        "ChallengeInvitation",
        foreign_keys="ChallengeInvitation.receiver_id",
        back_populates="receiver",
        cascade="all, delete-orphan",
    )
    push_devices = relationship("PushDevice", back_populates="user", cascade="all, delete-orphan")
    social_accounts = relationship("UserSocialAccount", back_populates="user", cascade="all, delete-orphan")
    notification_events = relationship(
        "NotificationEvent",
        foreign_keys="NotificationEvent.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    refresh_token_sessions = relationship(
        "RefreshTokenSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    icon = Column(String, default="🏆")
    xp_reward = Column(Integer, default=0)
    crystal_reward = Column(Integer, default=0)

    users = relationship("UserAchievement", back_populates="achievement")


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), index=True)
    earned_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="user_achievements")
    achievement = relationship("Achievement", back_populates="users")


class DailyBonus(Base):
    __tablename__ = "daily_bonuses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    day_number = Column(Integer)
    bonus_xp = Column(Integer)
    bonus_crystals = Column(Integer)
    claimed_at = Column(DateTime, default=utc_now, index=True)

    user = relationship("User")
