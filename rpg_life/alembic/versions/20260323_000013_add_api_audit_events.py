"""add api audit events table

Revision ID: 20260323_000013
Revises: 20260320_000012
Create Date: 2026-03-23 12:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260323_000013"
down_revision: Union[str, None] = "20260320_000012"
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
    if not _has_table("api_audit_events"):
        op.create_table(
            "api_audit_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("user_email", sa.String(), nullable=True),
            sa.Column("method", sa.String(), nullable=False),
            sa.Column("path", sa.String(), nullable=False),
            sa.Column("status_code", sa.Integer(), nullable=False),
            sa.Column("severity", sa.String(), nullable=False, server_default="info"),
            sa.Column("event_type", sa.String(), nullable=False, server_default="api_write"),
            sa.Column("reason", sa.String(), nullable=True),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.Column("user_agent", sa.String(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("details_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if not _has_index("api_audit_events", "ix_api_audit_events_user_id"):
        op.create_index("ix_api_audit_events_user_id", "api_audit_events", ["user_id"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_user_email"):
        op.create_index("ix_api_audit_events_user_email", "api_audit_events", ["user_email"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_method"):
        op.create_index("ix_api_audit_events_method", "api_audit_events", ["method"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_path"):
        op.create_index("ix_api_audit_events_path", "api_audit_events", ["path"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_status_code"):
        op.create_index("ix_api_audit_events_status_code", "api_audit_events", ["status_code"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_severity"):
        op.create_index("ix_api_audit_events_severity", "api_audit_events", ["severity"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_event_type"):
        op.create_index("ix_api_audit_events_event_type", "api_audit_events", ["event_type"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_ip_address"):
        op.create_index("ix_api_audit_events_ip_address", "api_audit_events", ["ip_address"], unique=False)
    if not _has_index("api_audit_events", "ix_api_audit_events_created_at"):
        op.create_index("ix_api_audit_events_created_at", "api_audit_events", ["created_at"], unique=False)


def downgrade() -> None:
    if _has_index("api_audit_events", "ix_api_audit_events_created_at"):
        op.drop_index("ix_api_audit_events_created_at", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_ip_address"):
        op.drop_index("ix_api_audit_events_ip_address", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_event_type"):
        op.drop_index("ix_api_audit_events_event_type", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_severity"):
        op.drop_index("ix_api_audit_events_severity", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_status_code"):
        op.drop_index("ix_api_audit_events_status_code", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_path"):
        op.drop_index("ix_api_audit_events_path", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_method"):
        op.drop_index("ix_api_audit_events_method", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_user_email"):
        op.drop_index("ix_api_audit_events_user_email", table_name="api_audit_events")
    if _has_index("api_audit_events", "ix_api_audit_events_user_id"):
        op.drop_index("ix_api_audit_events_user_id", table_name="api_audit_events")
    if _has_table("api_audit_events"):
        op.drop_table("api_audit_events")
