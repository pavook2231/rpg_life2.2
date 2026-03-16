from datetime import datetime, timedelta

import pytest

from app.models import Friendship, User, UserBoss, UserClassProgress, UserInventory, UserItem
from app.core.dates import utc_now
from app.schemas.beta_schema import (
    BetaChallengeCreateSchema,
    BetaChallengeProgressSchema,
    BossCompleteSchema,
    BossProgressSchema,
    ChestOpenSchema,
)
from app.services import beta_service
from app.beta_content import BETA_ITEMS


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, crystals: int = 500) -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name="mage",
        display_name="Mage",
        is_unlocked=True,
        crystals=crystals,
        last_activity=utc_now(),
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def test_open_chest_grants_beta_item_and_deducts_gold(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(beta_service, "_draw_rarity", lambda: "rare")
    monkeypatch.setattr(beta_service.random, "choice", lambda items: items[0])

    user = _create_user(db_session, "chest@example.com")
    progress = _create_progress(db_session, user.id, crystals=300)

    payload = ChestOpenSchema(chest_name="COMMON_CHEST")
    result = beta_service.open_chest(db_session, user, payload)

    db_session.refresh(progress)

    assert result["rarity"] == "rare"
    assert result["item"]["rarity"] == "rare"
    assert db_session.query(UserItem).filter(UserItem.user_id == user.id).count() == 1
    assert db_session.query(UserInventory).filter(UserInventory.user_id == user.id).count() == 1
    assert progress.crystals == 250


def test_complete_boss_rewards_gold_and_chest(db_session) -> None:
    user = _create_user(db_session, "boss@example.com")
    progress = _create_progress(db_session, user.id, crystals=100)

    bosses = beta_service.list_bosses(db_session, user)["bosses"]
    boss_id = bosses[0]["id"]
    requirement_value = bosses[0]["requirement_value"]
    reward_gold = bosses[0]["reward_gold"]

    beta_service.update_boss_progress(db_session, user, BossProgressSchema(boss_id=boss_id, progress=requirement_value))
    result = beta_service.complete_boss(db_session, user, BossCompleteSchema(boss_id=boss_id))

    db_session.refresh(progress)
    user_boss = db_session.query(UserBoss).filter(UserBoss.user_id == user.id, UserBoss.boss_id == boss_id).first()
    chest_rows = db_session.query(UserInventory).filter(UserInventory.user_id == user.id).all()

    assert user_boss is not None and user_boss.completed is True
    assert result["reward"]["gold"] == reward_gold
    assert result["reward"]["chest"]["rarity"] == "common"
    assert result["reward"]["chest"]["item"]["name"]
    assert result["reward"]["chest"]["inventory_id"] is not None
    assert any(row.item.type == "chest" for row in chest_rows)
    assert progress.crystals == 100 + reward_gold


def test_beta_challenge_finishes_when_target_reached(db_session) -> None:
    creator = _create_user(db_session, "creator-beta@example.com")
    opponent = _create_user(db_session, "opponent-beta@example.com")
    creator_progress = _create_progress(db_session, creator.id, crystals=100)
    _create_progress(db_session, opponent.id, crystals=100)

    db_session.add(Friendship(user_id=creator.id, friend_id=opponent.id, status="accepted"))
    db_session.add(Friendship(user_id=opponent.id, friend_id=creator.id, status="accepted"))
    db_session.commit()

    challenge = beta_service.create_challenge(
        db_session,
        creator,
        BetaChallengeCreateSchema(
            opponent_id=opponent.id,
            type="steps",
            target_value=100,
            end_date=utc_now() + timedelta(days=1),
            reward_gold=90,
            reward_chest=True,
        ),
    )["challenge"]

    result = beta_service.update_challenge_progress(
        db_session,
        creator,
        BetaChallengeProgressSchema(challenge_id=challenge["id"], progress=120),
    )

    db_session.refresh(creator_progress)
    chest_rows = db_session.query(UserInventory).filter(UserInventory.user_id == creator.id).all()

    assert result["challenge"]["status"] == "finished"
    assert result["challenge"]["winner_id"] == creator.id
    assert result["reward"]["gold"] == 90
    assert result["reward"]["chest"]["rarity"] == "rare"
    assert result["reward"]["chest"]["item"]["name"]
    assert result["reward"]["chest"]["inventory_id"] is not None
    assert any(row.item.type == "chest" for row in chest_rows)
    assert creator_progress.crystals == 190


def test_beta_catalog_definition_stays_within_beta_limits() -> None:
    beta_service._validate_beta_catalog_definition()
    slot_counts = {}
    for item in BETA_ITEMS:
        slot_counts[item["slot"]] = slot_counts.get(item["slot"], 0) + 1

    assert len(BETA_ITEMS) == 25
    assert slot_counts == {
        "head": 5,
        "chest": 5,
        "shoulders": 5,
        "pants": 5,
        "legs": 5,
    }
