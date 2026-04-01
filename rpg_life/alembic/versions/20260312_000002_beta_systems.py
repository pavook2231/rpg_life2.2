"""beta systems

Revision ID: 20260312_000002
Revises: 20260308_000001
Create Date: 2026-03-12 19:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260312_000002"
down_revision: Union[str, None] = "20260308_000001"
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


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_unique_constraint(table_name: str, constraint_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return constraint_name in {item["name"] for item in _inspector().get_unique_constraints(table_name)}


def _has_unique_index_or_constraint(table_name: str, name: str) -> bool:
    return _has_unique_constraint(table_name, name) or _has_index(table_name, name)


def upgrade() -> None:
    if not _has_column("items", "power"):
        op.add_column("items", sa.Column("power", sa.Integer(), nullable=False, server_default="0"))
    if not _has_column("items", "is_beta_item"):
        op.add_column("items", sa.Column("is_beta_item", sa.Boolean(), nullable=False, server_default=sa.false()))
    if not _has_index("items", "ix_items_beta_rarity_slot"):
        op.create_index("ix_items_beta_rarity_slot", "items", ["is_beta_item", "rarity", "slot"], unique=False)

    if not _has_column("friends", "status"):
        op.add_column("friends", sa.Column("status", sa.String(), nullable=False, server_default="accepted"))
    if not _has_index("friends", "ix_friends_status"):
        op.create_index("ix_friends_status", "friends", ["status"], unique=False)

    if not _has_table("chests"):
        op.create_table(
            "chests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("rarity", sa.String(), nullable=False),
            sa.Column("gold_cost", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if not _has_index("chests", "ix_chests_name"):
        op.create_index("ix_chests_name", "chests", ["name"], unique=True)
    if not _has_index("chests", "ix_chests_rarity"):
        op.create_index("ix_chests_rarity", "chests", ["rarity"], unique=False)

    if not _has_table("bosses"):
        op.create_table(
            "bosses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=False),
            sa.Column("requirement_type", sa.String(), nullable=False),
            sa.Column("requirement_value", sa.Integer(), nullable=False),
            sa.Column("reward_gold", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_chest", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if not _has_index("bosses", "ix_bosses_name"):
        op.create_index("ix_bosses_name", "bosses", ["name"], unique=True)
    if not _has_index("bosses", "ix_bosses_requirement_type"):
        op.create_index("ix_bosses_requirement_type", "bosses", ["requirement_type"], unique=False)

    if not _has_table("user_items"):
        op.create_table(
            "user_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id"), nullable=False),
            sa.Column("equipped", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if not _has_index("user_items", "ix_user_items_user_id"):
        op.create_index("ix_user_items_user_id", "user_items", ["user_id"], unique=False)
    if not _has_index("user_items", "ix_user_items_item_id"):
        op.create_index("ix_user_items_item_id", "user_items", ["item_id"], unique=False)
    if not _has_index("user_items", "ix_user_items_equipped"):
        op.create_index("ix_user_items_equipped", "user_items", ["equipped"], unique=False)

    if not _has_table("user_bosses"):
        op.create_table(
            "user_bosses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("boss_id", sa.Integer(), sa.ForeignKey("bosses.id"), nullable=False),
            sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
        )
    if not _has_index("user_bosses", "ix_user_bosses_user_id"):
        op.create_index("ix_user_bosses_user_id", "user_bosses", ["user_id"], unique=False)
    if not _has_index("user_bosses", "ix_user_bosses_boss_id"):
        op.create_index("ix_user_bosses_boss_id", "user_bosses", ["boss_id"], unique=False)
    if not _has_index("user_bosses", "ix_user_bosses_completed"):
        op.create_index("ix_user_bosses_completed", "user_bosses", ["completed"], unique=False)
    if not _has_unique_index_or_constraint("user_bosses", "uq_user_bosses_user_boss"):
        op.create_index("uq_user_bosses_user_boss", "user_bosses", ["user_id", "boss_id"], unique=True)


def downgrade() -> None:
    if _has_unique_constraint("user_bosses", "uq_user_bosses_user_boss"):
        op.drop_constraint("uq_user_bosses_user_boss", "user_bosses", type_="unique")
    elif _has_index("user_bosses", "uq_user_bosses_user_boss"):
        op.drop_index("uq_user_bosses_user_boss", table_name="user_bosses")
    op.drop_index("ix_user_bosses_completed", table_name="user_bosses")
    op.drop_index("ix_user_bosses_boss_id", table_name="user_bosses")
    op.drop_index("ix_user_bosses_user_id", table_name="user_bosses")
    op.drop_table("user_bosses")

    op.drop_index("ix_user_items_equipped", table_name="user_items")
    op.drop_index("ix_user_items_item_id", table_name="user_items")
    op.drop_index("ix_user_items_user_id", table_name="user_items")
    op.drop_table("user_items")

    op.drop_index("ix_bosses_requirement_type", table_name="bosses")
    op.drop_index("ix_bosses_name", table_name="bosses")
    op.drop_table("bosses")

    op.drop_index("ix_chests_rarity", table_name="chests")
    op.drop_index("ix_chests_name", table_name="chests")
    op.drop_table("chests")

    op.drop_index("ix_friends_status", table_name="friends")
    op.drop_column("friends", "status")

    op.drop_index("ix_items_beta_rarity_slot", table_name="items")
    op.drop_column("items", "is_beta_item")
    op.drop_column("items", "power")
