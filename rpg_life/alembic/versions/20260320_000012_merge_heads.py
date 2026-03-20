"""merge alembic heads

Revision ID: 20260320_000012
Revises: 20260316_000010, 20260320_000011
Create Date: 2026-03-20 18:05:00
"""

from typing import Sequence, Union


revision: str = "20260320_000012"
down_revision: Union[str, Sequence[str], None] = ("20260316_000010", "20260320_000011")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
