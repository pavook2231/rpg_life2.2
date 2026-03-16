from datetime import timedelta

from fastapi import HTTPException

from app.core.dates import utc_now
from app.models import CompletedQuest, DailySteps, FriendRequest, GameEvent, Quest, User, UserClassProgress, UserInventory
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
