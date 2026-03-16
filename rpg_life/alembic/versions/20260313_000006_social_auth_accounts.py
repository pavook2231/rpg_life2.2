"""add social auth accounts

Revision ID: 20260313_000006
Revises: 20260313_000005
Create Date: 2026-03-13 20:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260313_000006"
down_revision: Union[str, None] = "20260313_000005"
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
    if not _has_table("user_social_accounts"):
        op.create_table(
            "user_social_accounts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("provider_user_id", sa.String(), nullable=False),
            sa.Column("provider_email", sa.String(), nullable=True),
            sa.Column("provider_username", sa.String(), nullable=True),
            sa.Column("provider_display_name", sa.String(), nullable=True),
            sa.Column("provider_avatar_url", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("provider", "provider_user_id", name="uq_user_social_accounts_provider_user"),
            sa.UniqueConstraint("user_id", "provider", name="uq_user_social_accounts_user_provider"),
        )

    if not _has_index("user_social_accounts", "ix_user_social_accounts_user_id"):
        op.create_index("ix_user_social_accounts_user_id", "user_social_accounts", ["user_id"], unique=False)
    if not _has_index("user_social_accounts", "ix_user_social_accounts_provider"):
        op.create_index("ix_user_social_accounts_provider", "user_social_accounts", ["provider"], unique=False)


def downgrade() -> None:
    if _has_index("user_social_accounts", "ix_user_social_accounts_provider"):
        op.drop_index("ix_user_social_accounts_provider", table_name="user_social_accounts")
    if _has_index("user_social_accounts", "ix_user_social_accounts_user_id"):
        op.drop_index("ix_user_social_accounts_user_id", table_name="user_social_accounts")
    if _has_table("user_social_accounts"):
        op.drop_table("user_social_accounts")
