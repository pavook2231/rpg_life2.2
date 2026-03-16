from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class PushDevice(Base):
    __tablename__ = "push_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    push_token = Column(String, nullable=False, unique=True, index=True)
    platform = Column(String, nullable=False, default="unknown")
    device_name = Column(String, nullable=True)
    app_version = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    last_seen_at = Column(DateTime, nullable=False, default=utc_now, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="push_devices")
    queue_entries = relationship("NotificationQueue", back_populates="device", cascade="all, delete-orphan")


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False, default="")
    payload_json = Column(Text, nullable=False, default="{}")
    source_type = Column(String, nullable=True, index=True)
    source_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="notification_events")
    actor = relationship("User", foreign_keys=[actor_user_id])
    queue_entries = relationship("NotificationQueue", back_populates="event", cascade="all, delete-orphan")


class NotificationQueue(Base):
    __tablename__ = "notification_queue"
    __table_args__ = (UniqueConstraint("event_id", "device_id", name="uq_notification_queue_event_device"),)

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("notification_events.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("push_devices.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    scheduled_at = Column(DateTime, nullable=False, default=utc_now, index=True)
    sent_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    event = relationship("NotificationEvent", back_populates="queue_entries")
    device = relationship("PushDevice", back_populates="queue_entries")
    user = relationship("User")
