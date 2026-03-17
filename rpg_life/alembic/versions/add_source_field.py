"""Add source field to daily_steps table

Revision ID: add_source_field
Revises: 20260316_000010
Create Date: 2026-03-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_source_field'
down_revision: Union[str, None] = '20260316_000010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {col['name'] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    # Add source column to daily_steps table
    if _has_table('daily_steps') and not _has_column('daily_steps', 'source'):
        op.add_column('daily_steps', sa.Column('source', sa.String(), nullable=True, server_default='manual'))


def downgrade() -> None:
    # Remove source column from daily_steps table
    if _has_table('daily_steps') and _has_column('daily_steps', 'source'):
        op.drop_column('daily_steps', 'source')
