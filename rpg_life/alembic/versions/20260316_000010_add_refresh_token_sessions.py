"""add refresh token sessions

Revision ID: 20260316_000010
Revises: 650a7a8f2763
Create Date: 2026-03-16 12:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260316_000010"
down_revision: Union[str, None] = "650a7a8f2763"
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
    if not _has_table("refresh_token_sessions"):
        op.create_table(
            "refresh_token_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("jti_hash", sa.String(), nullable=False),
            sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("jti_hash", name="uq_refresh_token_sessions_jti_hash"),
        )

    for index_name, columns in (
        ("ix_refresh_token_sessions_user_id", ["user_id"]),
        ("ix_refresh_token_sessions_jti_hash", ["jti_hash"]),
        ("ix_refresh_token_sessions_is_revoked", ["is_revoked"]),
        ("ix_refresh_token_sessions_expires_at", ["expires_at"]),
        ("ix_refresh_token_sessions_created_at", ["created_at"]),
    ):
        if not _has_index("refresh_token_sessions", index_name):
            op.create_index(index_name, "refresh_token_sessions", columns, unique=False)


def downgrade() -> None:
    for index_name in (
        "ix_refresh_token_sessions_created_at",
        "ix_refresh_token_sessions_expires_at",
        "ix_refresh_token_sessions_is_revoked",
        "ix_refresh_token_sessions_jti_hash",
        "ix_refresh_token_sessions_user_id",
    ):
        if _has_index("refresh_token_sessions", index_name):
            op.drop_index(index_name, table_name="refresh_token_sessions")

    if _has_table("refresh_token_sessions"):
        op.drop_table("refresh_token_sessions")
