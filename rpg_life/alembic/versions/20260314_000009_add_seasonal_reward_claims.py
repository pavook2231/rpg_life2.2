"""add seasonal reward claims

Revision ID: 20260314_000009
Revises: 20260314_000008
Create Date: 2026-03-14 22:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260314_000009"
down_revision: Union[str, None] = "20260314_000008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def upgrade() -> None:
    if not _has_table("seasonal_reward_claims"):
        op.create_table(
            "seasonal_reward_claims",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("event_id", sa.Integer(), sa.ForeignKey("game_events.id"), nullable=False),
            sa.Column("class_name", sa.String(), nullable=False),
            sa.Column("objective_type", sa.String(), nullable=False),
            sa.Column("progress_value", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("target_value", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_xp", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_crystals", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_chest_name", sa.String(), nullable=True),
            sa.Column("claimed_tier_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("claimed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "event_id", name="uq_seasonal_reward_claim_user_event"),
        )

    for index_name, columns in (
        ("ix_seasonal_reward_claims_user_id", ["user_id"]),
        ("ix_seasonal_reward_claims_event_id", ["event_id"]),
        ("ix_seasonal_reward_claims_class_name", ["class_name"]),
        ("ix_seasonal_reward_claims_objective_type", ["objective_type"]),
        ("ix_seasonal_reward_claims_claimed_at", ["claimed_at"]),
    ):
        if not _has_index("seasonal_reward_claims", index_name):
            op.create_index(index_name, "seasonal_reward_claims", columns, unique=False)


def downgrade() -> None:
    for index_name in (
        "ix_seasonal_reward_claims_claimed_at",
        "ix_seasonal_reward_claims_objective_type",
        "ix_seasonal_reward_claims_class_name",
        "ix_seasonal_reward_claims_event_id",
        "ix_seasonal_reward_claims_user_id",
    ):
        if _has_index("seasonal_reward_claims", index_name):
            op.drop_index(index_name, table_name="seasonal_reward_claims")

    if _has_table("seasonal_reward_claims"):
        op.drop_table("seasonal_reward_claims")
