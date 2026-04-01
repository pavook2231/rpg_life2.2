"""add weight management runtime schema for existing databases

Revision ID: 20260401_000015
Revises: 20260330_000014
Create Date: 2026-04-01 18:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260401_000015"
down_revision: Union[str, Sequence[str], None] = "20260330_000014"
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


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_unique_constraint(table_name: str, constraint_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return constraint_name in {item["name"] for item in _inspector().get_unique_constraints(table_name)}


def _ensure_index(table_name: str, index_name: str, columns: list[str], *, unique: bool = False) -> None:
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _ensure_users_goal_columns() -> None:
    additions: list[tuple[str, sa.Column]] = [
        ("selected_goal_type", sa.Column("selected_goal_type", sa.String(), nullable=False, server_default="lose")),
        ("goal_term_months", sa.Column("goal_term_months", sa.Integer(), nullable=False, server_default="6")),
        ("goal_cycle_index", sa.Column("goal_cycle_index", sa.Integer(), nullable=False, server_default="1")),
        ("goal_cycle_started_at", sa.Column("goal_cycle_started_at", sa.DateTime(), nullable=True)),
        ("goal_cycle_deadline_at", sa.Column("goal_cycle_deadline_at", sa.DateTime(), nullable=True)),
        ("goal_cycle_xp", sa.Column("goal_cycle_xp", sa.Integer(), nullable=False, server_default="0")),
        ("goal_target_xp", sa.Column("goal_target_xp", sa.Integer(), nullable=False, server_default="20000")),
        ("goal_progress_percent", sa.Column("goal_progress_percent", sa.Integer(), nullable=False, server_default="0")),
        ("last_goal_change_at", sa.Column("last_goal_change_at", sa.DateTime(), nullable=True)),
        ("birth_year", sa.Column("birth_year", sa.Integer(), nullable=True)),
        ("gender", sa.Column("gender", sa.String(), nullable=False, server_default="unspecified")),
        ("name", sa.Column("name", sa.String(), nullable=True)),
        ("is_active", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())),
    ]
    for column_name, column in additions:
        if not _has_column("users", column_name):
            op.add_column("users", column)

    _ensure_index("users", "ix_users_selected_goal_type", ["selected_goal_type"])
    _ensure_index("users", "ix_users_is_active", ["is_active"])


def _ensure_quest_runtime_columns() -> None:
    additions: list[tuple[str, sa.Column]] = [
        ("goal_id", sa.Column("goal_id", sa.String(), nullable=True)),
        ("template_key", sa.Column("template_key", sa.String(), nullable=True)),
        ("difficulty_level", sa.Column("difficulty_level", sa.String(), nullable=False, server_default="easy")),
        ("goal_progress_percent", sa.Column("goal_progress_percent", sa.Integer(), nullable=False, server_default="0")),
        ("quest_bucket", sa.Column("quest_bucket", sa.String(), nullable=False, server_default="daily")),
        ("is_universal", sa.Column("is_universal", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("is_accepted", sa.Column("is_accepted", sa.Boolean(), nullable=False, server_default=sa.true())),
        ("is_archived", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("quest_type", sa.Column("quest_type", sa.String(), nullable=False, server_default="daily")),
        ("objective_type", sa.Column("objective_type", sa.String(), nullable=True)),
        ("target_value", sa.Column("target_value", sa.Integer(), nullable=True)),
        ("domain", sa.Column("domain", sa.String(), nullable=True)),
        ("quest_code", sa.Column("quest_code", sa.String(), nullable=True)),
        ("phase_code", sa.Column("phase_code", sa.String(), nullable=True)),
        ("is_required", sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("is_repeatable", sa.Column("is_repeatable", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("quest_state", sa.Column("quest_state", sa.String(), nullable=False, server_default="available")),
        ("reason_text", sa.Column("reason_text", sa.Text(), nullable=True)),
        ("payload_json", sa.Column("payload_json", sa.Text(), nullable=True)),
        ("expires_at", sa.Column("expires_at", sa.DateTime(), nullable=True)),
        ("challenge_id", sa.Column("challenge_id", sa.Integer(), nullable=True)),
    ]
    for column_name, column in additions:
        if not _has_column("quests", column_name):
            op.add_column("quests", column)

    _ensure_index("quests", "ix_quests_goal_id", ["goal_id"])
    _ensure_index("quests", "ix_quests_template_key", ["template_key"])
    _ensure_index("quests", "ix_quests_type_expires", ["quest_type", "expires_at"])
    _ensure_index("quests", "ix_quests_bucket_accepted", ["quest_bucket", "is_accepted"])
    _ensure_index("quests", "ix_quests_domain", ["domain"])
    _ensure_index("quests", "ix_quests_quest_code", ["quest_code"])
    _ensure_index("quests", "ix_quests_phase_code", ["phase_code"])
    _ensure_index("quests", "ix_quests_quest_state", ["quest_state"])
    _ensure_index("quests", "ix_quests_expires_at", ["expires_at"])
    _ensure_index("quests", "ix_quests_challenge_id", ["challenge_id"])


def _create_user_health_profiles() -> None:
    if _has_table("user_health_profiles"):
        return
    op.create_table(
        "user_health_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("sex", sa.String(), nullable=True),
        sa.Column("height_cm", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("goal_type", sa.String(), nullable=True),
        sa.Column("daily_activity_level", sa.String(), nullable=True),
        sa.Column("target_weight_kg", sa.Float(), nullable=True),
        sa.Column("kilos_to_lose", sa.Float(), nullable=True),
        sa.Column("timezone_name", sa.String(), nullable=True),
        sa.Column("anamnesis_completed_at", sa.DateTime(), nullable=True),
        sa.Column("program_started_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_user_health_profiles_user"),
    )
    _ensure_index("user_health_profiles", "ix_user_health_profiles_user_id", ["user_id"])
    _ensure_index("user_health_profiles", "ix_user_health_profiles_goal_type", ["goal_type"])
    _ensure_index("user_health_profiles", "ix_user_health_profiles_created_at", ["created_at"])


def _create_weight_baselines() -> None:
    if _has_table("weight_baselines"):
        return
    op.create_table(
        "weight_baselines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("measurements_json", sa.Text(), nullable=True),
        sa.Column("baseline_completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_weight_baselines_user"),
    )
    _ensure_index("weight_baselines", "ix_weight_baselines_user_id", ["user_id"])
    _ensure_index("weight_baselines", "ix_weight_baselines_created_at", ["created_at"])


def _create_weight_entries() -> None:
    if _has_table("weight_entries"):
        return
    op.create_table(
        "weight_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date_local", sa.String(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("source", sa.String(), nullable=True, server_default="manual"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    _ensure_index("weight_entries", "ix_weight_entries_user_id", ["user_id"])
    _ensure_index("weight_entries", "ix_weight_entries_date_local", ["date_local"])
    _ensure_index("weight_entries", "ix_weight_entries_source", ["source"])
    _ensure_index("weight_entries", "ix_weight_entries_created_at", ["created_at"])


def _create_step_days() -> None:
    if _has_table("step_days"):
        return
    op.create_table(
        "step_days",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date_local", sa.String(), nullable=False),
        sa.Column("steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(), nullable=True, server_default="manual"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "date_local", name="uq_step_days_user_date"),
    )
    _ensure_index("step_days", "ix_step_days_user_id", ["user_id"])
    _ensure_index("step_days", "ix_step_days_date_local", ["date_local"])
    _ensure_index("step_days", "ix_step_days_source", ["source"])
    _ensure_index("step_days", "ix_step_days_created_at", ["created_at"])


def _create_walking_plan_states() -> None:
    if _has_table("walking_plan_states"):
        return
    op.create_table(
        "walking_plan_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("current_program_week", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("current_daily_target_steps", sa.Integer(), nullable=False, server_default="6000"),
        sa.Column("current_mode", sa.String(), nullable=False, server_default="normal"),
        sa.Column("last_week_achieved_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_week_average_steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_adjustment_type", sa.String(), nullable=False, server_default="initial"),
        sa.Column("last_adjustment_reason", sa.String(), nullable=True),
        sa.Column("last_computed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_walking_plan_states_user"),
    )
    _ensure_index("walking_plan_states", "ix_walking_plan_states_user_id", ["user_id"])
    _ensure_index("walking_plan_states", "ix_walking_plan_states_current_mode", ["current_mode"])
    _ensure_index("walking_plan_states", "ix_walking_plan_states_created_at", ["created_at"])


def _create_weekly_reviews() -> None:
    if _has_table("weekly_reviews"):
        return
    op.create_table(
        "weekly_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("week_start_date_local", sa.String(), nullable=False),
        sa.Column("week_end_date_local", sa.String(), nullable=False),
        sa.Column("target_daily_steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("achieved_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_weight_kg", sa.Float(), nullable=True),
        sa.Column("previous_weight_kg", sa.Float(), nullable=True),
        sa.Column("weight_delta_kg", sa.Float(), nullable=True),
        sa.Column("motivation_self_rating", sa.Integer(), nullable=True),
        sa.Column("difficulty_self_rating", sa.Integer(), nullable=True),
        sa.Column("plateau_detected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("lapse_detected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("next_week_target_steps", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "week_number", name="uq_weekly_reviews_user_week"),
    )
    _ensure_index("weekly_reviews", "ix_weekly_reviews_user_id", ["user_id"])
    _ensure_index("weekly_reviews", "ix_weekly_reviews_week_number", ["week_number"])
    _ensure_index("weekly_reviews", "ix_weekly_reviews_week_start_date_local", ["week_start_date_local"])
    _ensure_index("weekly_reviews", "ix_weekly_reviews_week_end_date_local", ["week_end_date_local"])
    _ensure_index("weekly_reviews", "ix_weekly_reviews_completed_at", ["completed_at"])
    _ensure_index("weekly_reviews", "ix_weekly_reviews_created_at", ["created_at"])


def _create_motivation_states() -> None:
    if _has_table("motivation_states"):
        return
    op.create_table(
        "motivation_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("motivation_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("motivation_band", sa.String(), nullable=False, server_default="medium"),
        sa.Column("adherence_14d_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quest_completion_14d_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checkin_consistency_14d_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("self_report_component_pct", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_motivation_states_user"),
    )
    _ensure_index("motivation_states", "ix_motivation_states_user_id", ["user_id"])
    _ensure_index("motivation_states", "ix_motivation_states_motivation_band", ["motivation_band"])
    _ensure_index("motivation_states", "ix_motivation_states_updated_at", ["updated_at"])


def upgrade() -> None:
    _ensure_users_goal_columns()
    _ensure_quest_runtime_columns()
    _create_user_health_profiles()
    _create_weight_baselines()
    _create_weight_entries()
    _create_step_days()
    _create_walking_plan_states()
    _create_weekly_reviews()
    _create_motivation_states()


def downgrade() -> None:
    for table_name in (
        "motivation_states",
        "weekly_reviews",
        "walking_plan_states",
        "step_days",
        "weight_entries",
        "weight_baselines",
        "user_health_profiles",
    ):
        if _has_table(table_name):
            op.drop_table(table_name)
