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


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def upgrade() -> None:
    if not _has_column('daily_steps', 'source'):
        op.add_column('daily_steps', sa.Column('source', sa.String(), nullable=True, default='manual'))


def downgrade() -> None:
    if _has_column('daily_steps', 'source'):
        op.drop_column('daily_steps', 'source')
