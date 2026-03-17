from datetime import datetime, timedelta

import pytest

from app import crud
from app.core.dates import utc_now
from app.models import Challenge, CompletedQuest, DailySteps, Item, Quest, User, UserClassProgress, UserInventory


def _create_user(session, email: str, *, is_active: bool = True) -> User:
    user = User(email=email, hashed_password="hashed", is_active=is_active)
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


def test_reset_daily_quests_removes_only_stale_daily_quests(
    db_session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(crud, "generate_daily_quests", lambda *args, **kwargs: None)
    monkeypatch.setattr(crud, "generate_boss_quests", lambda *args, **kwargs: None)
    monkeypatch.setattr(crud, "generate_rare_mission", lambda *args, **kwargs: None)

    user = _create_user(db_session, "player@example.com")
    progress = _create_progress(db_session, user.id)
    stale_time = utc_now() - timedelta(days=2)

    stale_daily = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Daily",
        description="",
        xp_reward=10,
        crystal_reward=1,
        is_custom=False,
        is_completed=False,
        quest_type="daily",
        created_at=stale_time,
    )
    stale_boss_daily = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Boss daily",
        description="",
        xp_reward=10,
        crystal_reward=1,
        is_custom=False,
        is_completed=False,
        quest_type="boss_daily",
        created_at=stale_time,
    )
    stale_boss_weekly = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Boss weekly",
        description="",
        xp_reward=10,
        crystal_reward=1,
        is_custom=False,
        is_completed=False,
        quest_type="boss_weekly",
        created_at=stale_time,
    )
    stale_rare_mission = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Rare mission",
        description="",
        xp_reward=50,
        crystal_reward=10,
        is_custom=False,
        is_completed=False,
        quest_type="rare_mission",
        created_at=stale_time,
        expires_at=utc_now() + timedelta(hours=8),
    )
    stale_custom = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Custom",
        description="",
        xp_reward=10,
        crystal_reward=1,
        is_custom=True,
        is_completed=False,
        quest_type="daily",
        created_at=stale_time,
    )
    current_daily = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Current daily",
        description="",
        xp_reward=10,
        crystal_reward=1,
        is_custom=False,
        is_completed=False,
        quest_type="daily",
        created_at=utc_now(),
    )
    db_session.add_all([stale_daily, stale_boss_daily, stale_boss_weekly, stale_rare_mission, stale_custom, current_daily])
    db_session.commit()

    deleted = crud.reset_daily_quests(db_session)

    remaining_types = {quest.title: quest.quest_type for quest in db_session.query(Quest).all()}

    assert deleted == 2
    assert "Daily" not in remaining_types
    assert "Boss daily" not in remaining_types
    assert remaining_types["Boss weekly"] == "boss_weekly"
    assert remaining_types["Rare mission"] == "rare_mission"
    assert remaining_types["Custom"] == "daily"
    assert remaining_types["Current daily"] == "daily"


def test_generate_rare_mission_creates_single_timed_high_value_mission(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(crud.random, "choice", lambda entries: entries[0])

    user = _create_user(db_session, "rare@example.com")
    progress = _create_progress(db_session, user.id, class_name="warrior")

    mission = crud.generate_rare_mission(db_session, user.id, progress.class_name)
    same_window_result = crud.generate_rare_mission(db_session, user.id, progress.class_name)

    assert mission is not None
    assert mission.quest_type == "rare_mission"
    assert mission.xp_reward >= 300
    assert mission.crystal_reward >= 70
    assert mission.expires_at is not None
    assert same_window_result.id == mission.id


def test_get_daily_quests_auto_includes_rare_mission(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import quest_service

    monkeypatch.setattr(crud.random, "choice", lambda entries: entries[0])

    user = _create_user(db_session, "quest-view@example.com")
    progress = _create_progress(db_session, user.id, class_name="warrior")

    payload = quest_service.get_daily_quests(db_session, user.id)

    rare_items = [item for item in payload["items"] if item["quest_type"] == "rare_mission"]
    assert progress.id > 0
    assert len(rare_items) == 1
    assert rare_items[0]["xp_reward"] >= 300


def test_get_daily_quests_auto_generates_daily_and_boss_quests_when_missing(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import quest_service

    monkeypatch.setattr(crud.random, "choice", lambda entries: entries[0])

    user = _create_user(db_session, "daily-missing@example.com")
    progress = _create_progress(db_session, user.id, class_name="mage")

    payload = quest_service.get_daily_quests(db_session, user.id)

    quest_types = {item["quest_type"] for item in payload["items"]}

    assert progress.id > 0
    assert "daily" in quest_types
    assert "boss_daily" in quest_types


def test_resolve_due_challenges_skips_pvp_challenges(db_session) -> None:
    creator = _create_user(db_session, "creator@example.com")
    opponent = _create_user(db_session, "opponent@example.com")
    _create_progress(db_session, creator.id)
    _create_progress(db_session, opponent.id)

    open_challenge = Challenge(
        creator_id=creator.id,
        title="Open challenge",
        description="",
        challenge_type="open",
        objective_type="steps",
        target_value=100,
        reward_xp=10,
        reward_crystals=1,
        status="active",
        start_at=utc_now() - timedelta(days=2),
        end_at=utc_now() - timedelta(hours=1),
    )
    pvp_challenge = Challenge(
        creator_id=creator.id,
        opponent_id=opponent.id,
        title="PvP challenge",
        description="",
        challenge_type="pvp",
        objective_type="steps",
        target_value=100,
        reward_xp=10,
        reward_crystals=1,
        status="active",
        start_at=utc_now() - timedelta(days=2),
        end_at=utc_now() - timedelta(hours=1),
    )
    db_session.add_all([open_challenge, pvp_challenge])
    db_session.commit()

    resolved_ids = crud.resolve_due_challenges(db_session)

    db_session.refresh(open_challenge)
    db_session.refresh(pvp_challenge)

    assert open_challenge.id in resolved_ids
    assert open_challenge.status == "resolved"
    assert pvp_challenge.id not in resolved_ids
    assert pvp_challenge.status == "active"


def test_verified_quest_requires_live_progress_before_completion(db_session) -> None:
    user = _create_user(db_session, "verified-quest@example.com")
    progress = _create_progress(db_session, user.id)
    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Steps quest",
        description="",
        xp_reward=50,
        crystal_reward=10,
        is_custom=False,
        is_completed=False,
        quest_type="daily",
        objective_type="steps",
        target_value=5000,
        created_at=utc_now(),
    )
    db_session.add(quest)
    db_session.commit()

    with pytest.raises(ValueError):
        crud.complete_quest(db_session, user.id, quest.id)

    db_session.add(DailySteps(user_id=user.id, date=utc_now(), steps=5200))
    db_session.commit()

    result = crud.complete_quest(db_session, user.id, quest.id)

    assert result is not None
    assert db_session.query(CompletedQuest).filter(CompletedQuest.user_id == user.id).count() == 1


def test_manual_quest_completes_without_competitive_record(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(crud.random, "random", lambda: 1.0)

    user = _create_user(db_session, "manual-quest@example.com")
    progress = _create_progress(db_session, user.id)
    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Manual quest",
        description="",
        xp_reward=25,
        crystal_reward=5,
        is_custom=True,
        is_completed=False,
        quest_type="daily",
        created_at=utc_now(),
    )
    db_session.add(quest)
    db_session.commit()

    result = crud.complete_quest(db_session, user.id, quest.id)

    assert result is not None
    assert db_session.query(CompletedQuest).filter(CompletedQuest.user_id == user.id).count() == 0


def test_level_up_grants_chest_to_inventory_instead_of_direct_loot(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(crud.random, "random", lambda: 1.0)

    user = _create_user(db_session, "level-chest@example.com")
    progress = _create_progress(db_session, user.id)
    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Big progress quest",
        description="",
        xp_reward=crud.calculate_next_level_xp(progress.level) + 50,
        crystal_reward=0,
        is_custom=True,
        is_completed=False,
        quest_type="daily",
        created_at=utc_now(),
    )
    db_session.add(quest)
    db_session.commit()

    result = crud.complete_quest(db_session, user.id, quest.id)

    chest_rows = (
        db_session.query(UserInventory)
        .join(UserInventory.item)
        .filter(UserInventory.user_id == user.id, Item.type == "chest")
        .all()
    )

    assert result is not None
    assert result["chest_item"] is not None
    assert result["chest_item"]["item"].type == "chest"
    assert result["chest_item"]["inventory_id"] is not None
    assert result["loot_drop"] is None
    assert chest_rows


def test_daily_chest_grants_chest_to_inventory_after_all_daily_quests(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(crud.random, "random", lambda: 1.0)

    user = _create_user(db_session, "daily-chest@example.com")
    progress = _create_progress(db_session, user.id)
    today = utc_now()

    first_quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="First daily",
        description="",
        xp_reward=15,
        crystal_reward=1,
        is_custom=False,
        is_completed=False,
        quest_type="daily",
        created_at=today,
    )
    second_quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Second daily",
        description="",
        xp_reward=15,
        crystal_reward=1,
        is_custom=False,
        is_completed=True,
        completed_at=today,
        quest_type="daily",
        created_at=today,
    )
    db_session.add_all([first_quest, second_quest])
    db_session.commit()

    result = crud.complete_quest(db_session, user.id, first_quest.id)

    chest_rows = (
        db_session.query(UserInventory)
        .join(UserInventory.item)
        .filter(UserInventory.user_id == user.id, Item.type == "chest")
        .all()
    )

    assert result is not None
    assert result["daily_chest"] is not None
    assert result["daily_chest"]["chest_name"] == "COMMON_CHEST"
    assert result["daily_chest"]["inventory_id"] is not None
    assert chest_rows


def test_achievement_completion_does_not_attach_crafting_resource_reward(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "achievement-no-item@example.com")
    progress = _create_progress(db_session, user.id)
    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="First quest",
        description="",
        xp_reward=25,
        crystal_reward=5,
        is_custom=False,
        is_completed=False,
        quest_type="daily",
        created_at=utc_now(),
    )
    db_session.add(quest)
    db_session.commit()

    result = crud.complete_quest(db_session, user.id, quest.id)

    assert result is not None
    assert result["achievements"]
    assert "crafting_reward" not in result
