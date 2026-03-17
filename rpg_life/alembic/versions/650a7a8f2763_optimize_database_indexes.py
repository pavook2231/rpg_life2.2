"""optimize database indexes

Revision ID: 650a7a8f2763
Revises: 20260314_000009
Create Date: 2026-03-15 23:07:03.980937

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = '650a7a8f2763'
down_revision: Union[str, None] = '20260314_000009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_columns(table_name: str, column_names: list[str]) -> bool:
    if not _has_table(table_name):
        return False
    existing_columns = {column["name"] for column in _inspector().get_columns(table_name)}
    return all(column_name in existing_columns for column_name in column_names)


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def upgrade() -> None:
    for index_name, table_name, columns in (
        ("ix_friends_friend_id", "friends", ["friend_id"]),
        ("ix_coop_quest_participants_user_id", "coop_quest_participants", ["user_id"]),
        ("ix_challenge_participants_user_id", "challenge_participants", ["user_id"]),
        ("ix_daily_steps_date", "daily_steps", ["date"]),
        ("ix_completed_quests_completed_at", "completed_quests", ["completed_at"]),
        ("ix_user_class_progress_level", "user_class_progress", ["level"]),
        ("ix_challenges_status_end_at", "challenges", ["status", "end_at"]),
        ("ix_challenges_winner_id_status", "challenges", ["winner_id", "status"]),
        ("ix_friend_requests_status_created_at", "friend_requests", ["status", "created_at"]),
        ("ix_coop_quests_status_end_at", "coop_quests", ["status", "end_at"]),
        ("ix_users_is_active", "users", ["is_active"]),
    ):
        if _has_columns(table_name, columns) and not _has_index(table_name, index_name):
            op.create_index(index_name, table_name, columns, unique=False)


def downgrade() -> None:
    for index_name, table_name in (
        ("ix_users_is_active", "users"),
        ("ix_coop_quests_status_end_at", "coop_quests"),
        ("ix_friend_requests_status_created_at", "friend_requests"),
        ("ix_challenges_winner_id_status", "challenges"),
        ("ix_challenges_status_end_at", "challenges"),
        ("ix_user_class_progress_level", "user_class_progress"),
        ("ix_completed_quests_completed_at", "completed_quests"),
        ("ix_daily_steps_date", "daily_steps"),
        ("ix_challenge_participants_user_id", "challenge_participants"),
        ("ix_coop_quest_participants_user_id", "coop_quest_participants"),
        ("ix_friends_friend_id", "friends"),
    ):
        if _has_index(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)
