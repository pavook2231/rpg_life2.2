"""initial schema

Revision ID: 20260308_000001
Revises:
Create Date: 2026-03-08 16:55:00
"""

from typing import Sequence, Union

from alembic import op

from app.core.database import Base
import app.models  # noqa: F401


revision: str = "20260308_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
