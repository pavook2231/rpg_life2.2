"""add notifications

Revision ID: 20260313_000004
Revises: 20260313_000003
Create Date: 2026-03-13 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260313_000004"
down_revision: Union[str, None] = "20260313_000003"
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
    if not _has_table("push_devices"):
        op.create_table(
            "push_devices",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("push_token", sa.String(), nullable=False),
            sa.Column("platform", sa.String(), nullable=False, server_default="unknown"),
            sa.Column("device_name", sa.String(), nullable=True),
            sa.Column("app_version", sa.String(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("last_seen_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if not _has_index("push_devices", "ix_push_devices_user_id"):
        op.create_index("ix_push_devices_user_id", "push_devices", ["user_id"], unique=False)
    if not _has_index("push_devices", "ix_push_devices_push_token"):
        op.create_index("ix_push_devices_push_token", "push_devices", ["push_token"], unique=True)
    if not _has_index("push_devices", "ix_push_devices_is_active"):
        op.create_index("ix_push_devices_is_active", "push_devices", ["is_active"], unique=False)
    if not _has_index("push_devices", "ix_push_devices_last_seen_at"):
        op.create_index("ix_push_devices_last_seen_at", "push_devices", ["last_seen_at"], unique=False)
    if not _has_index("push_devices", "ix_push_devices_created_at"):
        op.create_index("ix_push_devices_created_at", "push_devices", ["created_at"], unique=False)
    if not _has_index("push_devices", "ix_push_devices_user_active"):
        op.create_index("ix_push_devices_user_active", "push_devices", ["user_id", "is_active"], unique=False)

    if not _has_table("notification_events"):
        op.create_table(
            "notification_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("body", sa.Text(), nullable=False, server_default=""),
            sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("source_type", sa.String(), nullable=True),
            sa.Column("source_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if not _has_index("notification_events", "ix_notification_events_user_id"):
        op.create_index("ix_notification_events_user_id", "notification_events", ["user_id"], unique=False)
    if not _has_index("notification_events", "ix_notification_events_actor_user_id"):
        op.create_index("ix_notification_events_actor_user_id", "notification_events", ["actor_user_id"], unique=False)
    if not _has_index("notification_events", "ix_notification_events_event_type"):
        op.create_index("ix_notification_events_event_type", "notification_events", ["event_type"], unique=False)
    if not _has_index("notification_events", "ix_notification_events_source_type"):
        op.create_index("ix_notification_events_source_type", "notification_events", ["source_type"], unique=False)
    if not _has_index("notification_events", "ix_notification_events_source_id"):
        op.create_index("ix_notification_events_source_id", "notification_events", ["source_id"], unique=False)
    if not _has_index("notification_events", "ix_notification_events_created_at"):
        op.create_index("ix_notification_events_created_at", "notification_events", ["created_at"], unique=False)
    if not _has_index("notification_events", "ix_notification_events_user_created"):
        op.create_index("ix_notification_events_user_created", "notification_events", ["user_id", "created_at"], unique=False)

    if not _has_table("notification_queue"):
        op.create_table(
            "notification_queue",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("event_id", sa.Integer(), sa.ForeignKey("notification_events.id"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("device_id", sa.Integer(), sa.ForeignKey("push_devices.id"), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="pending"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("scheduled_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("event_id", "device_id", name="uq_notification_queue_event_device"),
        )
    if not _has_index("notification_queue", "ix_notification_queue_event_id"):
        op.create_index("ix_notification_queue_event_id", "notification_queue", ["event_id"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_user_id"):
        op.create_index("ix_notification_queue_user_id", "notification_queue", ["user_id"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_device_id"):
        op.create_index("ix_notification_queue_device_id", "notification_queue", ["device_id"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_status"):
        op.create_index("ix_notification_queue_status", "notification_queue", ["status"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_scheduled_at"):
        op.create_index("ix_notification_queue_scheduled_at", "notification_queue", ["scheduled_at"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_sent_at"):
        op.create_index("ix_notification_queue_sent_at", "notification_queue", ["sent_at"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_created_at"):
        op.create_index("ix_notification_queue_created_at", "notification_queue", ["created_at"], unique=False)
    if not _has_index("notification_queue", "ix_notification_queue_status_schedule"):
        op.create_index("ix_notification_queue_status_schedule", "notification_queue", ["status", "scheduled_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notification_queue_status_schedule", table_name="notification_queue")
    op.drop_index("ix_notification_queue_created_at", table_name="notification_queue")
    op.drop_index("ix_notification_queue_sent_at", table_name="notification_queue")
    op.drop_index("ix_notification_queue_scheduled_at", table_name="notification_queue")
    op.drop_index("ix_notification_queue_status", table_name="notification_queue")
    op.drop_index("ix_notification_queue_device_id", table_name="notification_queue")
    op.drop_index("ix_notification_queue_user_id", table_name="notification_queue")
    op.drop_index("ix_notification_queue_event_id", table_name="notification_queue")
    op.drop_table("notification_queue")

    op.drop_index("ix_notification_events_user_created", table_name="notification_events")
    op.drop_index("ix_notification_events_created_at", table_name="notification_events")
    op.drop_index("ix_notification_events_source_id", table_name="notification_events")
    op.drop_index("ix_notification_events_source_type", table_name="notification_events")
    op.drop_index("ix_notification_events_event_type", table_name="notification_events")
    op.drop_index("ix_notification_events_actor_user_id", table_name="notification_events")
    op.drop_index("ix_notification_events_user_id", table_name="notification_events")
    op.drop_table("notification_events")

    op.drop_index("ix_push_devices_user_active", table_name="push_devices")
    op.drop_index("ix_push_devices_created_at", table_name="push_devices")
    op.drop_index("ix_push_devices_last_seen_at", table_name="push_devices")
    op.drop_index("ix_push_devices_is_active", table_name="push_devices")
    op.drop_index("ix_push_devices_push_token", table_name="push_devices")
    op.drop_index("ix_push_devices_user_id", table_name="push_devices")
    op.drop_table("push_devices")
