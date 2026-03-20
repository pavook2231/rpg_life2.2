"""Add source field to daily_steps table

Revision ID: add_source_field
Revises: 650a7a8f2763
Create Date: 2026-03-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_source_field'
down_revision: Union[str, None] = '650a7a8f2763'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add source column to daily_steps table
    op.add_column('daily_steps', sa.Column('source', sa.String(), nullable=True, default='manual'))


def downgrade() -> None:
    # Remove source column from daily_steps table
    op.drop_column('daily_steps', 'source')