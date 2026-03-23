from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core.dates import utc_now
from app.models import CompletedQuest, DailySteps, FriendRequest, Friendship, GameEvent, Quest, User, UserClassProgress, UserInventory
from app.services import mobile_service


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, class_name: str = "archer") -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name=class_name,
        display_name=class_name.title(),
        is_unlocked=True,
        streak=4,
        last_activity=utc_now(),
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def _make_friends(session, left_id: int, right_id: int) -> None:
    session.add(Friendship(user_id=left_id, friend_id=right_id))
    session.add(Friendship(user_id=right_id, friend_id=left_id))
    session.commit()


def _create_completed_quest(session, user_id: int, class_progress_id: int, *, xp_earned: int = 100) -> None:
    quest = Quest(
        user_id=user_id,
        class_progress_id=class_progress_id,
        title="Verified quest",
        description="Seasonal progress source",
        xp_reward=xp_earned,
        crystal_reward=10,
        rarity="common",
        is_completed=True,
        quest_type="daily",
        objective_type="xp_gained",
        target_value=xp_earned,
        completed_at=utc_now() - timedelta(hours=1),
    )
    session.add(quest)
    session.flush()
    session.add(
        CompletedQuest(
            user_id=user_id,
            quest_id=quest.id,
            completed_at=utc_now() - timedelta(hours=1),
            xp_earned=xp_earned,
            crystals_earned=10,
        )
    )


def test_rewards_summary_includes_engagement_layers(db_session) -> None:
    user = _create_user(db_session, "engagement-summary@example.com")
    sender = _create_user(db_session, "friend@example.com")
    progress = _create_progress(db_session, user.id, class_name="archer")

    db_session.add(
        DailySteps(
            user_id=user.id,
            class_progress_id=progress.id,
            steps=22000,
            date=utc_now() - timedelta(days=1),
        )
    )
    db_session.add(FriendRequest(requester_id=sender.id, receiver_id=user.id, status="pending"))
    db_session.add(
        GameEvent(
            event_type="season",
            slug="spring-festival",
            title="Spring Festival",
            description="Limited-time weekly activity.",
            status="active",
            start_at=utc_now() - timedelta(hours=2),
            end_at=utc_now() + timedelta(days=3),
        )
    )
    db_session.commit()

    payload = mobile_service.get_rewards_summary(db_session, user)

    assert payload["daily_bonus"]["available"] is True
    assert payload["streak_summary"]["current"] == 4
    assert payload["weekly_goal"]["objective_type"] == "steps"
    assert payload["weekly_goal"]["progress"] >= 22000
    assert payload["weekly_goal"]["claimed_tier_count"] == 0
    assert payload["weekly_goal"]["total_tiers"] == 3
    assert payload["weekly_goal"]["next_tier_index"] == 1
    assert len(payload["weekly_goal"]["tiers"]) == 3
    assert payload["seasonal_goal"]["objective_type"] == "steps"
    assert payload["seasonal_goal"]["event_title"] == "Spring Festival"
    assert payload["seasonal_goal"]["total_tiers"] == 3
    assert payload["seasonal_goal"]["reward_identity"]
    assert payload["social_pulse"]["pending_friend_requests"] == 1
    assert payload["active_event"]["title"] == "Spring Festival"
    assert payload["class_role"]["class_name"] == "archer"


def test_rewards_summary_exposes_social_feed_and_weekly_rank(db_session) -> None:
    user = _create_user(db_session, "pulse-owner@example.com")
    friend = _create_user(db_session, "friend-summary@example.com")
    requester = _create_user(db_session, "requester-summary@example.com")
    user_progress = _create_progress(db_session, user.id, class_name="archer")
    friend_progress = _create_progress(db_session, friend.id, class_name="archer")
    _make_friends(db_session, user.id, friend.id)
    _create_completed_quest(db_session, friend.id, friend_progress.id, xp_earned=120)

    db_session.add_all([
        DailySteps(
            user_id=user.id,
            class_progress_id=user_progress.id,
            steps=4_000,
            date=utc_now() - timedelta(hours=8),
        ),
        DailySteps(
            user_id=friend.id,
            class_progress_id=friend_progress.id,
            steps=4_700,
            date=utc_now() - timedelta(hours=4),
        ),
        FriendRequest(requester_id=requester.id, receiver_id=user.id, status="pending"),
    ])
    db_session.commit()

    payload = mobile_service.get_rewards_summary(db_session, user)
    pulse = payload["social_pulse"]

    assert pulse["weekly_rank"] == 2
    assert pulse["weekly_total"] == 2
    assert pulse["closest_friend_ahead"]["username"] == "friend_summary"
    assert pulse["primary_action"] == "friends"
    assert any(item["kind"] == "friend_requests" for item in pulse["feed_items"])
    assert any(item["kind"] == "weekly_chase" for item in pulse["feed_items"])
    assert any(item["kind"] == "friend_activity" for item in pulse["feed_items"])


def test_get_public_user_profile_returns_goal_and_equipment_overview(db_session) -> None:
    viewer = _create_user(db_session, "viewer@example.com")
    target = _create_user(db_session, "public-target@example.com")
    progress = _create_progress(db_session, target.id, class_name="mage")
    target.selected_goal_type = "financial_growth"
    target.goal_progress_percent = 48
    target.goal_cycle_xp = 960
    target.goal_target_xp = 2000
    progress.level = 7
    progress.current_xp = 350
    db_session.commit()

    payload = mobile_service.get_public_user_profile(db_session, viewer, target.id)

    assert payload["user"]["id"] == target.id
    assert payload["user"]["goal_type"] == "financial_growth"
    assert payload["user"]["goal_title"]
    assert payload["user"]["power_rating"] > 0
    assert payload["goal"]["goal_type"] == "financial_growth"
    assert payload["goal"]["goal_progress_percent"] == 48
    assert payload["character"]["class"] == "mage"
    assert payload["character"]["level"] == 7
    assert payload["equipment_overview"]["class_info"]["class_name"] == "mage"
    assert payload["equipment_overview"]["bag_items"] == []


def test_get_public_user_profile_returns_empty_character_state_when_target_has_no_progress(db_session) -> None:
    viewer = _create_user(db_session, "viewer-no-character@example.com")
    target = _create_user(db_session, "target-no-character@example.com")

    payload = mobile_service.get_public_user_profile(db_session, viewer, target.id)

    assert payload["user"]["id"] == target.id
    assert payload["has_character"] is False
    assert payload["character"] is None
    assert payload["equipment_overview"] is None


def test_claim_weekly_goal_reward_claims_first_available_tier(db_session) -> None:
    user = _create_user(db_session, "weekly-tier-claim@example.com")
    progress = _create_progress(db_session, user.id, class_name="archer")

    db_session.add(
        DailySteps(
            user_id=user.id,
            class_progress_id=progress.id,
            steps=20000,
            date=utc_now() - timedelta(days=1),
        )
    )
    db_session.commit()

    payload = mobile_service.claim_weekly_goal_reward(db_session, user)
    refreshed_summary = mobile_service.get_rewards_summary(db_session, user)

    assert payload["success"] is True
    assert payload["objective_type"] == "steps"
    assert payload["tier_index"] == 1
    assert payload["claimed_tier_count"] == 1
    assert payload["reward_crystals"] == 15
    assert payload["reward_xp"] == 45
    assert payload["claimed_at"]
    assert refreshed_summary["weekly_goal"]["claimed_this_week"] is True
    assert refreshed_summary["weekly_goal"]["claimed_tier_count"] == 1
    assert refreshed_summary["weekly_goal"]["next_tier_index"] == 2
    assert refreshed_summary["weekly_goal"]["claimable"] is False
    assert refreshed_summary["weekly_goal"]["claimed_at"] == payload["claimed_at"]


def test_claim_weekly_goal_reward_rejects_when_all_tiers_are_claimed(db_session) -> None:
    user = _create_user(db_session, "weekly-duplicate@example.com")
    progress = _create_progress(db_session, user.id, class_name="archer")

    db_session.add(
        DailySteps(
            user_id=user.id,
            class_progress_id=progress.id,
            steps=60000,
            date=utc_now() - timedelta(days=1),
        )
    )
    db_session.commit()

    mobile_service.claim_weekly_goal_reward(db_session, user)
    mobile_service.claim_weekly_goal_reward(db_session, user)
    mobile_service.claim_weekly_goal_reward(db_session, user)

    try:
        mobile_service.claim_weekly_goal_reward(db_session, user)
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "All weekly rewards already claimed"
    else:
        raise AssertionError("Expected extra weekly claim to be rejected")


def test_claim_seasonal_goal_reward_grants_class_specific_chest(db_session) -> None:
    user = _create_user(db_session, "seasonal-claim@example.com")
    progress = _create_progress(db_session, user.id, class_name="mage")
    _create_completed_quest(db_session, user.id, progress.id, xp_earned=900)
    db_session.add(
        GameEvent(
            event_type="season",
            slug="arcane-rift",
            title="Arcane Rift",
            description="Class-specific season track.",
            status="active",
            season_key="arcane-rift",
            start_at=utc_now() - timedelta(days=2),
            end_at=utc_now() + timedelta(days=5),
        )
    )
    db_session.commit()

    mobile_service.claim_seasonal_goal_reward(db_session, user)
    mobile_service.claim_seasonal_goal_reward(db_session, user)
    payload = mobile_service.claim_seasonal_goal_reward(db_session, user)

    chest_inventory = db_session.query(UserInventory).filter(UserInventory.user_id == user.id).all()

    assert payload["success"] is True
    assert payload["tier_index"] == 3
    assert payload["reward_chest"]["chest_name"] == "EPIC_CHEST"
    assert any((entry.item.subclass if entry.item else None) == "EPIC_CHEST" for entry in chest_inventory)


def test_sync_today_steps_rejects_backdated_day_started_at(db_session) -> None:
    user = _create_user(db_session, "backdated-steps@example.com")
    _create_progress(db_session, user.id)

    with pytest.raises(HTTPException) as exc:
        mobile_service.sync_today_steps(
            db_session,
            user,
            1234,
            (utc_now() - timedelta(days=2)).isoformat(),
            "device",
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Step sync is only allowed for the current day"


def test_sync_today_steps_rejects_anomalous_step_jump(db_session) -> None:
    user = _create_user(db_session, "step-spike@example.com")
    _create_progress(db_session, user.id)
    current_day_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    first_sync = mobile_service.sync_today_steps(db_session, user, 4_000, current_day_start, "device")

    with pytest.raises(HTTPException) as exc:
        mobile_service.sync_today_steps(db_session, user, 40_001, current_day_start, "device")

    assert first_sync["steps"] == 4_000
    assert exc.value.status_code == 400
    assert exc.value.detail == "Step sync jump is too large"


def test_sync_today_steps_invalidates_leaderboard_cache_on_progress_change(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "step-cache@example.com")
    _create_progress(db_session, user.id)
    current_day_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    invalidations: list[str] = []

    monkeypatch.setattr(mobile_service, "invalidate_leaderboard_cache", lambda: invalidations.append("leaderboard"))

    payload = mobile_service.sync_today_steps(db_session, user, 5_500, current_day_start, "device")

    assert payload["delta"] == 5_500
    assert invalidations == ["leaderboard"]


def test_sync_today_steps_rejects_unsupported_source(db_session) -> None:
    user = _create_user(db_session, "step-source-invalid@example.com")
    _create_progress(db_session, user.id)
    current_day_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    with pytest.raises(HTTPException) as exc:
        mobile_service.sync_today_steps(db_session, user, 1_000, current_day_start, "spoofed-script")

    assert exc.value.status_code == 400
    assert exc.value.detail == "Unsupported step sync source"


def test_sync_today_steps_rejects_implausible_rate(db_session) -> None:
    user = _create_user(db_session, "step-rate-spike@example.com")
    _create_progress(db_session, user.id)
    current_day_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    mobile_service.sync_today_steps(db_session, user, 2_000, current_day_start, "device")
    record = (
        db_session.query(DailySteps)
        .filter(DailySteps.user_id == user.id)
        .order_by(DailySteps.date.desc())
        .first()
    )
    assert record is not None
    record.synced_at = utc_now() - timedelta(seconds=10)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        mobile_service.sync_today_steps(db_session, user, 8_500, current_day_start, "device")

    assert exc.value.status_code == 400
    assert exc.value.detail == "Step sync rate is implausible"


def test_claim_weekly_goal_reward_invalidates_leaderboard_cache(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "weekly-cache@example.com")
    progress = _create_progress(db_session, user.id, class_name="archer")
    invalidations: list[str] = []

    db_session.add(
        DailySteps(
            user_id=user.id,
            class_progress_id=progress.id,
            steps=20000,
            date=utc_now() - timedelta(days=1),
        )
    )
    db_session.commit()

    monkeypatch.setattr(mobile_service, "invalidate_leaderboard_cache", lambda: invalidations.append("leaderboard"))

    payload = mobile_service.claim_weekly_goal_reward(db_session, user)

    assert payload["success"] is True
    assert invalidations == ["leaderboard"]


def test_get_profile_exposes_public_identity(db_session) -> None:
    user = _create_user(db_session, "profile-identity@example.com")
    _create_progress(db_session, user.id)

    payload = mobile_service.get_profile(db_session, user)

    assert payload["user"]["username"] == "profile_identity"
    assert payload["user"]["friend_id"] == "RPG-000001"


def test_get_leaderboard_returns_period_metadata(db_session) -> None:
    user = _create_user(db_session, "leaderboard-period@example.com")
    progress = _create_progress(db_session, user.id)
    db_session.add(
        DailySteps(
            user_id=user.id,
            class_progress_id=progress.id,
            steps=6_100,
            date=utc_now() - timedelta(hours=3),
        )
    )
    db_session.commit()

    payload = mobile_service.get_leaderboard(db_session, user, "global", "steps", 1, 20, "weekly")

    assert payload["period"] == "weekly"
    assert payload["period_started_at"] is not None
    assert payload["items"][0]["user_id"] == user.id


def test_get_leaderboard_me_matches_rank_from_list(db_session) -> None:
    current = _create_user(db_session, "leaderboard-me-current@example.com")
    leader = _create_user(db_session, "leaderboard-me-leader@example.com")
    current_progress = _create_progress(db_session, current.id)
    leader_progress = _create_progress(db_session, leader.id)

    current_progress.level = 4
    current_progress.current_xp = 80
    leader_progress.level = 6
    leader_progress.current_xp = 30
    db_session.commit()

    payload = mobile_service.get_leaderboard(db_session, current, "global", "power", 1, 20, "all_time")
    me_payload = mobile_service.get_leaderboard_me(db_session, current, "global", "power", "all_time")
    expected_entry = next(item for item in payload["items"] if item["user_id"] == current.id)

    assert me_payload["item"]["user_id"] == current.id
    assert me_payload["item"]["rank"] == expected_entry["rank"]
    assert me_payload["item"]["score"] == expected_entry["score"]
    assert me_payload["item"]["is_current_user"] is True
