"""Add public usernames to users

Revision ID: 20260320_000011
Revises: add_source_field
Create Date: 2026-03-20 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.user_identity import USERNAME_MAX_LENGTH, normalize_username


# revision identifiers, used by Alembic.
revision: str = "20260320_000011"
down_revision: Union[str, None] = "add_source_field"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _build_unique_username(base: str | None, used: set[str], fallback_user_id: int) -> str:
    candidate = normalize_username(base) or normalize_username(f"hero_{fallback_user_id}") or f"hero_{fallback_user_id}"
    if candidate not in used:
        used.add(candidate)
        return candidate

    suffix = 2
    while True:
        suffix_text = f"_{suffix}"
        trimmed = candidate[: max(1, USERNAME_MAX_LENGTH - len(suffix_text))]
        trial = f"{trimmed}{suffix_text}"
        if trial not in used:
            used.add(trial)
            return trial
        suffix += 1


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "username" not in columns:
        op.add_column("users", sa.Column("username", sa.String(), nullable=True))

    session = Session(bind=bind)
    users = session.execute(
        sa.text("SELECT id, email, name, username FROM users ORDER BY id ASC")
    ).mappings().all()
    used = {row["username"] for row in users if row["username"]}

    for row in users:
        if row["username"]:
            continue
        email = row["email"] or ""
        seed = row["name"] or email.split("@")[0] or f"hero_{row['id']}"
        username = _build_unique_username(seed, used, int(row["id"]))
        session.execute(
            sa.text("UPDATE users SET username = :username WHERE id = :user_id"),
            {"username": username, "user_id": row["id"]},
        )

    session.commit()
    op.create_unique_constraint("uq_users_username", "users", ["username"])
    op.create_index("ix_users_username", "users", ["username"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "username")
