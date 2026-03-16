from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class FriendRequest(Base):
    __tablename__ = "friend_requests"
    __table_args__ = (UniqueConstraint("requester_id", "receiver_id", name="uq_friend_request_pair"),)

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="pending", index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    responded_at = Column(DateTime, nullable=True)

    requester = relationship("User", foreign_keys=[requester_id], back_populates="sent_friend_requests")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_friend_requests")


class Friendship(Base):
    __tablename__ = "friends"
    __table_args__ = (UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="accepted", index=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="friendships")
    friend = relationship("User", foreign_keys=[friend_id])


class CoopQuest(Base):
    __tablename__ = "coop_quests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    objective_type = Column(String, nullable=False, index=True)
    goal = Column(Integer, nullable=False)
    progress = Column(Integer, default=0)
    reward_xp = Column(Integer, default=0)
    reward_crystals = Column(Integer, default=0)
    status = Column(String, default="active", index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    start_at = Column(DateTime, default=utc_now, index=True)
    end_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    completed_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    participants = relationship("CoopQuestParticipant", back_populates="coop_quest", cascade="all, delete-orphan")


class CoopQuestParticipant(Base):
    __tablename__ = "coop_quest_participants"
    __table_args__ = (UniqueConstraint("coop_quest_id", "user_id", name="uq_coop_quest_participant"),)

    id = Column(Integer, primary_key=True, index=True)
    coop_quest_id = Column(Integer, ForeignKey("coop_quests.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    contribution = Column(Integer, default=0)
    joined_at = Column(DateTime, default=utc_now)

    coop_quest = relationship("CoopQuest", back_populates="participants")
    user = relationship("User", back_populates="coop_entries")


class GameEvent(Base):
    __tablename__ = "game_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    slug = Column(String, unique=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    payload_json = Column(Text, default="{}")
    status = Column(String, default="scheduled", index=True)
    season_key = Column(String, nullable=True, index=True)
    start_at = Column(DateTime, nullable=False, index=True)
    end_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class ChallengeInvitation(Base):
    __tablename__ = "challenge_invitations"
    __table_args__ = (UniqueConstraint("sender_id", "receiver_id", "challenge_type", name="uq_challenge_invitation"),)

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    challenge_type = Column(String, nullable=False, index=True)  # e.g., "pvp", "coop"
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    objective_type = Column(String, nullable=False)  # e.g., "steps", "quests_completed"
    goal = Column(Integer, nullable=False)
    reward_xp = Column(Integer, default=0)
    reward_crystals = Column(Integer, default=0)
    status = Column(String, default="pending", index=True)  # pending, accepted, declined, expired
    created_at = Column(DateTime, default=utc_now, index=True)
    responded_at = Column(DateTime, nullable=True)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
