"""add language preference

Revision ID: 20260313_000003
Revises: 20260312_000002
Create Date: 2026-03-13 10:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260313_000003"
down_revision: Union[str, None] = "20260312_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("users", "language_preference"):
        op.add_column("users", sa.Column("language_preference", sa.String(), nullable=False, server_default="ru"))


def downgrade() -> None:
    op.drop_column("users", "language_preference")
