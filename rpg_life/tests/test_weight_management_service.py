from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.dates import utc_now
from app.models import MotivationState, Quest, StepDay, User, UserClassProgress, WalkingPlanState, WeeklyReview, WeightEntry
from app.services import quest_service, weight_management_service


def _create_user(session, email: str, *, goal_type: str = "lose") -> User:
    now = utc_now()
    user = User(
        email=email,
        hashed_password="hashed",
        is_active=True,
        selected_goal_type=goal_type,
        goal_term_months=6,
        goal_cycle_index=1,
        goal_cycle_started_at=now,
        goal_cycle_deadline_at=now + timedelta(days=180),
        goal_cycle_xp=0,
        goal_target_xp=20000,
        goal_progress_percent=0,
        last_goal_change_at=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, class_name: str = "mage") -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name=class_name,
        display_name=class_name.title(),
        is_unlocked=True,
        last_activity=utc_now(),
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def _activate_weight_program(session, email: str = "weight@example.com") -> User:
    user = _create_user(session, email)
    _create_progress(session, user.id)
    weight_management_service.submit_anamnesis(
        session,
        user,
        sex="male",
        height_cm=180,
        weight_kg=85.0,
        goal_type="lose",
        daily_activity_level="light",
        timezone_name="Europe/Moscow",
    )
    weight_management_service.submit_baseline(
        session,
        user,
        measurements={"waistCm": 92.0, "hipsCm": 101.0, "chestCm": 103.0},
        target_weight_kg=78.0,
    )
    session.refresh(user)
    return user


def _set_week_steps(session, user_id: int, week_start, steps_per_day: list[int]) -> None:
    for offset, steps in enumerate(steps_per_day):
        day = week_start + timedelta(days=offset)
        session.add(
            StepDay(
                user_id=user_id,
                date_local=day.isoformat(),
                steps=int(steps),
                source="manual",
            )
        )
    session.commit()


def test_weight_program_blocks_before_anamnesis(db_session) -> None:
    user = _create_user(db_session, "blocking@example.com")
    _create_progress(db_session, user.id)

    payload = quest_service.get_daily_quests(db_session, user.id)
    active_items = [item for item in payload["items"] if not item["is_completed"]]

    assert [item["quest_code"] for item in active_items] == ["onboarding_anamnesis"]
    assert payload["goal"]["program_phase"] == "anamnesis_required"
    assert payload["goal"]["anamnesis_completed"] is False


def test_weight_program_falls_back_to_utc_when_zoneinfo_data_is_missing(db_session, monkeypatch) -> None:
    user = _create_user(db_session, "tz-fallback@example.com")
    _create_progress(db_session, user.id)

    def _missing_zoneinfo(_name: str):
        raise weight_management_service.ZoneInfoNotFoundError("tzdata unavailable")

    monkeypatch.setattr(weight_management_service, "ZoneInfo", _missing_zoneinfo)

    payload = quest_service.get_daily_quests(db_session, user.id)

    assert payload["goal"]["program_phase"] == "anamnesis_required"
    assert payload["goal"]["timezone_name"] == "UTC"
    assert [item["quest_code"] for item in payload["items"] if not item["is_completed"]] == ["onboarding_anamnesis"]


def test_anamnesis_unlocks_baseline_checklist_but_not_walking(db_session) -> None:
    user = _create_user(db_session, "anamnesis@example.com")
    _create_progress(db_session, user.id)

    weight_management_service.submit_anamnesis(
        db_session,
        user,
        sex="female",
        height_cm=168,
        weight_kg=76.5,
        goal_type="lose",
        daily_activity_level="moderate",
        timezone_name="Europe/Moscow",
    )

    payload = quest_service.get_daily_quests(db_session, user.id)
    active_codes = {item["quest_code"] for item in payload["items"] if not item["is_completed"]}

    assert payload["goal"]["program_phase"] == "baseline_required"
    assert payload["goal"]["anamnesis_completed"] is True
    assert active_codes == {"baseline_measurements", "baseline_set_weight_goal"}
    assert "walking_daily_target" not in active_codes


def test_partial_baseline_does_not_unlock_walking(db_session) -> None:
    user = _create_user(db_session, "partial-baseline@example.com")
    _create_progress(db_session, user.id)
    weight_management_service.submit_anamnesis(
        db_session,
        user,
        sex="male",
        height_cm=181,
        weight_kg=92.0,
        goal_type="lose",
        daily_activity_level="light",
        timezone_name="Europe/Moscow",
    )

    weight_management_service.submit_baseline(
        db_session,
        user,
        measurements={"waistCm": 98.0},
    )

    payload = quest_service.get_daily_quests(db_session, user.id)
    active_codes = {item["quest_code"] for item in payload["items"] if not item["is_completed"]}

    assert payload["goal"]["baseline_completed"] is False
    assert "walking_daily_target" not in active_codes
    assert "baseline_measurements" not in active_codes
    assert {"baseline_set_weight_goal"}.issubset(active_codes)


def test_unsupported_goal_type_is_stored_without_fake_walking_flow(db_session) -> None:
    user = _create_user(db_session, "maintain@example.com", goal_type="maintain")
    _create_progress(db_session, user.id)

    weight_management_service.submit_anamnesis(
        db_session,
        user,
        sex="male",
        height_cm=178,
        weight_kg=80.0,
        goal_type="maintain",
        daily_activity_level="light",
        timezone_name="Europe/Moscow",
    )

    goal_state = quest_service.get_goal_state(db_session, user)
    payload = quest_service.get_daily_quests(db_session, user.id)

    assert goal_state["health_profile"]["goal_type"] == "maintain"
    assert goal_state["program_phase"] == "unsupported_goal"
    assert goal_state["unsupported_goal"] is True
    assert payload["items"] == []


def test_runtime_feed_filters_unrelated_legacy_quests_and_is_deterministic(db_session) -> None:
    user = _activate_weight_program(db_session, "filter-feed@example.com")
    db_session.add(
        Quest(
            user_id=user.id,
            title="Legacy quest",
            description="Should stay out of the active weight-loss feed.",
            xp_reward=10,
            crystal_reward=1,
            quest_type="daily",
            goal_type="personal_development",
            is_custom=False,
            is_completed=False,
            is_archived=False,
            created_at=utc_now(),
        )
    )
    db_session.commit()

    first_payload = quest_service.get_daily_quests(db_session, user.id)
    second_payload = quest_service.get_daily_quests(db_session, user.id)
    first_active = [item for item in first_payload["items"] if not item["is_completed"]]
    second_active = [item for item in second_payload["items"] if not item["is_completed"]]

    assert all(item["domain"] == weight_management_service.QUEST_DOMAIN for item in first_active)
    assert all(item["quest_type"] != "boss_daily" for item in first_active)
    assert all(item["quest_type"] != "rare_mission" for item in first_active)
    assert all(item["title"] != "Legacy quest" for item in first_active)
    assert [item["quest_code"] for item in first_active] == [item["quest_code"] for item in second_active]


def test_deprecated_photo_quests_are_archived_and_hidden_from_feed(db_session) -> None:
    user = _create_user(db_session, "deprecated-photo@example.com")
    _create_progress(db_session, user.id)
    weight_management_service.submit_anamnesis(
        db_session,
        user,
        sex="female",
        height_cm=170,
        weight_kg=79.0,
        goal_type="lose",
        daily_activity_level="light",
        timezone_name="Europe/Moscow",
    )

    for code in ("baseline_photo_front", "baseline_photo_side"):
        db_session.add(
            Quest(
                user_id=user.id,
                title=code,
                description="Deprecated baseline photo quest.",
                xp_reward=10,
                crystal_reward=1,
                quest_type="daily",
                quest_bucket="daily",
                goal_type="lose",
                domain=weight_management_service.QUEST_DOMAIN,
                quest_code=code,
                phase_code="baseline_required",
                is_required=True,
                is_repeatable=False,
                quest_state="available",
                is_custom=False,
                is_completed=False,
                is_archived=False,
                created_at=utc_now(),
            )
        )
    db_session.commit()

    payload = quest_service.get_daily_quests(db_session, user.id)
    photo_rows = (
        db_session.query(Quest)
        .filter(Quest.user_id == user.id, Quest.quest_code.in_(["baseline_photo_front", "baseline_photo_side"]))
        .all()
    )

    assert all(item["quest_code"] not in {"baseline_photo_front", "baseline_photo_side"} for item in payload["items"])
    assert all(row.is_archived is True for row in photo_rows)


def test_walking_plan_starts_at_6000_and_manual_steps_autocomplete_daily_target(db_session) -> None:
    user = _activate_weight_program(db_session, "steps-manual@example.com")

    goal_state = quest_service.get_goal_state(db_session, user)
    payload = quest_service.get_daily_quests(db_session, user.id)
    walking_item = next(item for item in payload["items"] if item["quest_code"] == "walking_daily_target" and not item["is_completed"])

    assert goal_state["walking_plan"]["current_program_week"] == 1
    assert goal_state["walking_plan"]["current_daily_target_steps"] == 6000
    assert walking_item["target_value"] == 6000

    weight_management_service.sync_steps(db_session, user, steps=6000, source="manual")
    db_session.commit()

    quest_row = (
        db_session.query(Quest)
        .filter(Quest.user_id == user.id, Quest.domain == weight_management_service.QUEST_DOMAIN, Quest.quest_code == "walking_daily_target")
        .order_by(Quest.id.desc())
        .first()
    )

    assert quest_row is not None
    assert quest_row.is_completed is True


def test_fresh_program_starts_in_normal_mode_without_recovery_overlay(db_session) -> None:
    user = _activate_weight_program(db_session, "fresh-program-mode@example.com")

    payload = quest_service.get_daily_quests(db_session, user.id)
    active_codes = {item["quest_code"] for item in payload["items"] if not item["is_completed"]}

    assert payload["goal"]["program_mode"] == "normal"
    assert "walking_daily_target" in active_codes
    assert "recovery_restart" not in active_codes


def test_goal_state_reports_real_timeline_fields(db_session) -> None:
    user = _activate_weight_program(db_session, "timeline@example.com")
    profile = user.health_profile
    assert profile is not None

    started_at = utc_now() - timedelta(days=10)
    deadline_at = started_at + timedelta(days=90)
    profile.timezone_name = "UTC"
    profile.program_started_at = started_at
    user.goal_term_months = 3
    user.goal_cycle_started_at = started_at
    user.goal_cycle_deadline_at = deadline_at
    db_session.commit()

    goal_state = quest_service.get_goal_state(db_session, user)

    assert goal_state["goal_started_at"] == started_at.isoformat()
    assert goal_state["goal_deadline_at"] == deadline_at.isoformat()
    assert goal_state["goal_days_passed"] == 10
    assert goal_state["goal_days_total"] == 90
    assert goal_state["goal_days_remaining"] == 80


@pytest.mark.parametrize(
    ("previous_target", "next_week", "achieved_days", "average_steps", "expected_target"),
    [
        (6000, 2, 7, 6100, 7000),
        (15000, 20, 7, 16000, 15000),
        (11000, 7, 2, 8000, 10000),
        (10000, 8, 2, 7000, 10000),
        (8000, 4, 2, 5000, 8000),
        (11000, 10, 7, 11200, 12000),
    ],
)
def test_adaptive_step_target_rules_are_deterministic(
    previous_target: int,
    next_week: int,
    achieved_days: int,
    average_steps: int,
    expected_target: int,
) -> None:
    target, _, _ = weight_management_service._compute_next_target(
        previous_target,
        next_week,
        achieved_days=achieved_days,
        average_steps=average_steps,
        plateau_detected=False,
        lapse_detected=False,
    )

    assert target == expected_target


def test_weekly_review_is_due_and_advances_target_after_successful_week(db_session) -> None:
    user = _activate_weight_program(db_session, "weekly-review@example.com")
    profile = user.health_profile
    walking_state = user.walking_plan_state
    assert profile is not None
    assert walking_state is not None

    profile.program_started_at = utc_now() - timedelta(days=8)
    walking_state.current_program_week = 1
    walking_state.current_daily_target_steps = 6000
    week_start, _ = weight_management_service._week_date_range(profile, 1)
    _set_week_steps(db_session, user.id, week_start, [6500, 7000, 7200, 6100, 6800, 6400, 6600])

    payload = quest_service.get_daily_quests(db_session, user.id)
    review_preview = payload["goal"]["weekly_review_preview"]
    assert any(item["quest_code"] == "weekly_review" for item in payload["items"] if not item["is_completed"])
    assert review_preview["week_number"] == 1
    assert review_preview["target_daily_steps"] == 6000
    assert review_preview["achieved_days"] == 7
    assert review_preview["average_steps"] == 6657
    assert review_preview["review_due"] is True

    result = weight_management_service.submit_weekly_review(
        db_session,
        user,
        current_weight_kg=84.0,
        motivation_self_rating=4,
        difficulty_self_rating=3,
    )
    db_session.refresh(user)
    db_session.refresh(walking_state)

    review = db_session.query(WeeklyReview).filter(WeeklyReview.user_id == user.id, WeeklyReview.week_number == 1).first()

    assert review is not None
    assert result["review"]["next_week_target_steps"] == 7000
    assert result["review"]["weight_delta_kg"] == pytest.approx(-1.0)
    assert walking_state.current_program_week == 2
    assert walking_state.current_daily_target_steps == 7000
    assert db_session.query(WeightEntry).filter(WeightEntry.user_id == user.id).count() == 1


def test_plateau_detection_holds_target_and_surfaces_overlay_quests(db_session) -> None:
    user = _activate_weight_program(db_session, "plateau@example.com")
    profile = user.health_profile
    walking_state = user.walking_plan_state
    assert profile is not None
    assert walking_state is not None

    profile.program_started_at = utc_now() - timedelta(days=22)
    walking_state.current_program_week = 3
    walking_state.current_daily_target_steps = 8000

    week1_start, week1_end = weight_management_service._week_date_range(profile, 1)
    week2_start, week2_end = weight_management_service._week_date_range(profile, 2)
    week3_start, week3_end = weight_management_service._week_date_range(profile, 3)

    db_session.add_all(
        [
            WeeklyReview(
                user_id=user.id,
                week_number=1,
                week_start_date_local=week1_start.isoformat(),
                week_end_date_local=week1_end.isoformat(),
                target_daily_steps=6000,
                achieved_days=5,
                average_steps=6200,
                current_weight_kg=90.0,
                previous_weight_kg=91.0,
                weight_delta_kg=-1.0,
                completed_at=utc_now() - timedelta(days=14),
            ),
            WeeklyReview(
                user_id=user.id,
                week_number=2,
                week_start_date_local=week2_start.isoformat(),
                week_end_date_local=week2_end.isoformat(),
                target_daily_steps=7000,
                achieved_days=5,
                average_steps=7100,
                current_weight_kg=89.9,
                previous_weight_kg=90.0,
                weight_delta_kg=-0.1,
                completed_at=utc_now() - timedelta(days=7),
            ),
        ]
    )
    db_session.commit()
    _set_week_steps(db_session, user.id, week3_start, [8200, 8300, 8100, 8200, 8400, 8000, 8200])

    result = weight_management_service.submit_weekly_review(
        db_session,
        user,
        current_weight_kg=89.9,
        motivation_self_rating=4,
        difficulty_self_rating=3,
    )
    db_session.refresh(walking_state)

    payload = quest_service.get_daily_quests(db_session, user.id)
    active_codes = {item["quest_code"] for item in payload["items"] if not item["is_completed"]}

    assert result["review"]["plateau_detected"] is True
    assert result["review"]["next_week_target_steps"] == 8000
    assert walking_state.current_mode == "plateau_hold"
    assert {"plateau_review", "plateau_measurements_refresh"}.issubset(active_codes)


def test_lapse_detection_enters_recovery_without_wiping_progress(db_session) -> None:
    user = _activate_weight_program(db_session, "recovery@example.com")
    profile = user.health_profile
    walking_state = user.walking_plan_state
    assert profile is not None
    assert walking_state is not None

    user.goal_cycle_xp = 321
    profile.program_started_at = utc_now() - timedelta(days=10)
    walking_state.current_program_week = 2
    walking_state.current_daily_target_steps = 7000
    walking_state.current_mode = "normal"
    db_session.commit()

    payload = quest_service.get_daily_quests(db_session, user.id)
    active_codes = {item["quest_code"] for item in payload["items"] if not item["is_completed"]}
    db_session.refresh(user)
    db_session.refresh(walking_state)

    assert payload["goal"]["program_mode"] == "recovery"
    assert "recovery_restart" in active_codes
    assert user.goal_cycle_xp == 321
    assert walking_state.current_mode == "recovery"


def test_motivation_without_self_report_uses_behavioral_signals(db_session) -> None:
    user = _activate_weight_program(db_session, "motivation@example.com")

    quest_service.get_daily_quests(db_session, user.id)
    weight_management_service.sync_steps(db_session, user, steps=6000, source="manual")
    payload = quest_service.get_daily_quests(db_session, user.id)

    motivation = db_session.query(MotivationState).filter(MotivationState.user_id == user.id).first()

    assert motivation is not None
    assert motivation.self_report_component_pct is None
    assert motivation.motivation_score > 0
    assert all(item["domain"] == weight_management_service.QUEST_DOMAIN for item in payload["items"])
