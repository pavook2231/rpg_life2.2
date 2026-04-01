"""remove weight baseline photo columns

Revision ID: 20260330_000014
Revises: 20260323_000013
Create Date: 2026-03-30 15:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260330_000014"
down_revision: Union[str, Sequence[str], None] = "20260323_000013"
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
    if not _has_table("weight_baselines"):
        return

    with op.batch_alter_table("weight_baselines") as batch_op:
        if _has_column("weight_baselines", "before_photo_front_uri"):
            batch_op.drop_column("before_photo_front_uri")
        if _has_column("weight_baselines", "before_photo_side_uri"):
            batch_op.drop_column("before_photo_side_uri")


def downgrade() -> None:
    if not _has_table("weight_baselines"):
        return

    with op.batch_alter_table("weight_baselines") as batch_op:
        if not _has_column("weight_baselines", "before_photo_front_uri"):
            batch_op.add_column(sa.Column("before_photo_front_uri", sa.String(), nullable=True))
        if not _has_column("weight_baselines", "before_photo_side_uri"):
            batch_op.add_column(sa.Column("before_photo_side_uri", sa.String(), nullable=True))
