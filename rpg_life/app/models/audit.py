from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.dates import utc_now


class ApiAuditEvent(Base):
    __tablename__ = "api_audit_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String, nullable=True, index=True)
    method = Column(String, nullable=False, index=True)
    path = Column(String, nullable=False, index=True)
    status_code = Column(Integer, nullable=False, index=True)
    severity = Column(String, nullable=False, default="info", index=True)
    event_type = Column(String, nullable=False, default="api_write", index=True)
    reason = Column(String, nullable=True)
    ip_address = Column(String, nullable=True, index=True)
    user_agent = Column(String, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    details_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)

    user = relationship("User", foreign_keys=[user_id])
