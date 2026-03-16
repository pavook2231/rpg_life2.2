from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.dates import utc_now
from app.core.database import Base


class UserSocialAccount(Base):
    __tablename__ = "user_social_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_user_social_accounts_provider_user"),
        UniqueConstraint("user_id", "provider", name="uq_user_social_accounts_user_provider"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    provider_user_id = Column(String, nullable=False)
    provider_email = Column(String, nullable=True)
    provider_username = Column(String, nullable=True)
    provider_display_name = Column(String, nullable=True)
    provider_avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="social_accounts")
