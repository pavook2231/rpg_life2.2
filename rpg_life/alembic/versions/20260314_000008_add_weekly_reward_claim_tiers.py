"""add weekly reward claim tiers

Revision ID: 20260314_000008
Revises: 20260314_000007
Create Date: 2026-03-14 17:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260314_000008"
down_revision: Union[str, None] = "20260314_000007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def upgrade() -> None:
    if _has_table("weekly_reward_claims") and not _has_column("weekly_reward_claims", "claimed_tier_count"):
        op.add_column(
            "weekly_reward_claims",
            sa.Column("claimed_tier_count", sa.Integer(), nullable=False, server_default="0"),
        )
        op.execute(
            sa.text(
                "UPDATE weekly_reward_claims "
                "SET claimed_tier_count = 3 "
                "WHERE claimed_tier_count IS NULL OR claimed_tier_count = 0"
            )
        )


def downgrade() -> None:
    if _has_table("weekly_reward_claims") and _has_column("weekly_reward_claims", "claimed_tier_count"):
        op.drop_column("weekly_reward_claims", "claimed_tier_count")
