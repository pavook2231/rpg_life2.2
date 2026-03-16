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


def upgrade() -> None:
    # Add indexes for social features performance
    op.create_index('ix_friends_friend_id', 'friends', ['friend_id'])
    op.create_index('ix_coop_quest_participants_user_id', 'coop_quest_participants', ['user_id'])
    op.create_index('ix_challenge_participants_user_id', 'challenge_participants', ['user_id'])
    
    # Add indexes for stats aggregation
    op.create_index('ix_daily_steps_date', 'daily_steps', ['date'])
    op.create_index('ix_completed_quests_completed_at', 'completed_quests', ['completed_at'])
    op.create_index('ix_user_class_progress_level', 'user_class_progress', ['level'])
    
    # Composite indexes for common queries
    op.create_index('ix_challenges_status_end_at', 'challenges', ['status', 'end_at'])
    op.create_index('ix_challenges_winner_id_status', 'challenges', ['winner_id', 'status'])
    op.create_index('ix_friend_requests_status_created_at', 'friend_requests', ['status', 'created_at'])
    op.create_index('ix_coop_quests_status_end_at', 'coop_quests', ['status', 'end_at'])
    
    # Index for leaderboard queries
    op.create_index('ix_users_is_active', 'users', ['is_active'])


def downgrade() -> None:
    # Drop indexes in reverse order
    op.drop_index('ix_users_is_active', 'users')
    op.drop_index('ix_coop_quests_status_end_at', 'coop_quests')
    op.drop_index('ix_friend_requests_status_created_at', 'friend_requests')
    op.drop_index('ix_challenges_winner_id_status', 'challenges')
    op.drop_index('ix_challenges_status_end_at', 'challenges')
    op.drop_index('ix_user_class_progress_level', 'user_class_progress')
    op.drop_index('ix_completed_quests_completed_at', 'completed_quests')
    op.drop_index('ix_daily_steps_date', 'daily_steps')
    op.drop_index('ix_challenge_participants_user_id', 'challenge_participants')
    op.drop_index('ix_coop_quest_participants_user_id', 'coop_quest_participants')
    op.drop_index('ix_friends_friend_id', 'friends')
