from datetime import timedelta

import pytest

from app import crud
from app.core.cache import cache_delete_prefix
from app.core.dates import utc_now
from app.models import (
    Challenge,
    ChallengeParticipant,
    CompletedQuest,
    Quest,
    NotificationEvent,
    NotificationQueue,
    PushDevice,
    User,
    UserBoss,
    UserClassProgress,
)
from app.schemas.beta_schema import BossCompleteSchema, BossProgressSchema
from app.schemas.notification_schema import PushDeviceRegisterSchema
from app.services import beta_service, engagement_service, notification_service, social_service


def _create_user(session, email: str, *, language: str = "ru") -> User:
    user = User(email=email, hashed_password="hashed", is_active=True, language_preference=language)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, crystals: int = 0) -> UserClassProgress:
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


def _register_device(session, user: User, token: str) -> None:
    notification_service.register_push_device(
        session,
        user,
        PushDeviceRegisterSchema(push_token=token, platform="android", app_version="1.0.0"),
    )


def test_register_push_device_upserts_existing_token(db_session) -> None:
    first_user = _create_user(db_session, "push-one@example.com")
    second_user = _create_user(db_session, "push-two@example.com")

    notification_service.register_push_device(
        db_session,
        first_user,
        PushDeviceRegisterSchema(push_token="ExponentPushToken[same-token]", platform="android"),
    )
    notification_service.register_push_device(
        db_session,
        second_user,
        PushDeviceRegisterSchema(push_token="ExponentPushToken[same-token]", platform="ios"),
    )

    devices = db_session.query(PushDevice).all()

    assert len(devices) == 1
    assert devices[0].user_id == second_user.id
    assert devices[0].platform == "ios"
    assert devices[0].is_active is True


def test_friend_request_queues_notification_for_receiver_device(db_session) -> None:
    sender = _create_user(db_session, "sender@example.com")
    receiver = _create_user(db_session, "receiver@example.com", language="en")
    _register_device(db_session, receiver, "ExponentPushToken[friend]")

    social_service.send_friend_request(db_session, sender, receiver.id)

    event = db_session.query(NotificationEvent).one()
    queue_entry = db_session.query(NotificationQueue).one()

    assert event.event_type == notification_service.EVENT_FRIEND_INVITATION
    assert event.user_id == receiver.id
    assert "friend request" in event.body.lower()
    assert queue_entry.status == notification_service.STATUS_PENDING


def test_complete_boss_queues_notification(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(beta_service, "_draw_rarity", lambda: "common")
    monkeypatch.setattr(beta_service.random, "choice", lambda items: items[0])

    user = _create_user(db_session, "boss-push@example.com")
    _create_progress(db_session, user.id, crystals=100)
    _register_device(db_session, user, "ExponentPushToken[boss]")

    bosses = beta_service.list_bosses(db_session, user)["bosses"]
    boss_id = bosses[0]["id"]
    requirement_value = bosses[0]["requirement_value"]

    beta_service.update_boss_progress(db_session, user, BossProgressSchema(boss_id=boss_id, progress=requirement_value))
    beta_service.complete_boss(db_session, user, BossCompleteSchema(boss_id=boss_id))

    user_boss = db_session.query(UserBoss).filter(UserBoss.user_id == user.id, UserBoss.boss_id == boss_id).one()
    event = (
        db_session.query(NotificationEvent)
        .filter(NotificationEvent.event_type == notification_service.EVENT_BOSS_VICTORY)
        .one()
    )

    assert user_boss.completed is True
    assert event.user_id == user.id
    assert db_session.query(NotificationQueue).count() == 1


def test_resolve_due_challenges_queues_notifications_for_participants(db_session) -> None:
    creator = _create_user(db_session, "creator-notify@example.com")
    opponent = _create_user(db_session, "opponent-notify@example.com")
    _create_progress(db_session, creator.id)
    _create_progress(db_session, opponent.id)
    _register_device(db_session, creator, "ExponentPushToken[creator]")
    _register_device(db_session, opponent, "ExponentPushToken[opponent]")

    start_at = utc_now() - timedelta(days=2)
    end_at = utc_now() - timedelta(hours=1)
    challenge = Challenge(
        creator_id=creator.id,
        opponent_id=opponent.id,
        title="Late duel",
        description="",
        challenge_type="duel",
        objective_type="quests_completed",
        target_value=1,
        reward_xp=10,
        reward_crystals=5,
        status="active",
        start_at=start_at,
        end_at=end_at,
    )
    db_session.add(challenge)
    db_session.flush()
    db_session.add(ChallengeParticipant(challenge_id=challenge.id, user_id=creator.id, is_creator=True))
    db_session.add(ChallengeParticipant(challenge_id=challenge.id, user_id=opponent.id, is_creator=False))
    db_session.add(
        CompletedQuest(
            user_id=creator.id,
            quest_id=None,
            completed_at=start_at + timedelta(hours=2),
            xp_earned=10,
            crystals_earned=1,
        )
    )
    db_session.commit()

    resolved_ids = crud.resolve_due_challenges(db_session)

    challenge = db_session.query(Challenge).filter(Challenge.id == challenge.id).one()
    events = (
        db_session.query(NotificationEvent)
        .filter(NotificationEvent.event_type == notification_service.EVENT_CHALLENGE_COMPLETED)
        .all()
    )

    assert challenge.id in resolved_ids
    assert challenge.status == "resolved"
    assert len(events) == 2
    assert db_session.query(NotificationQueue).count() == 2


def test_dispatch_pending_notifications_marks_queue_entry_sent(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "dispatch@example.com", language="en")
    _register_device(db_session, user, "ExponentPushToken[dispatch]")
    notification_service.notify_new_daily_quests(db_session, user_id=user.id, quest_count=4)

    monkeypatch.setattr(
        notification_service,
        "_post_push_batch",
        lambda *args, **kwargs: {"data": [{"status": "ok", "id": "ticket-1"}]},
    )

    result = notification_service.dispatch_pending_notifications(db_session)
    queue_entry = db_session.query(NotificationQueue).one()

    assert result["sent"] == 1
    assert queue_entry.status == notification_service.STATUS_SENT
    assert queue_entry.sent_at is not None


def test_queue_activity_reminders_is_deduped_for_same_user(db_session) -> None:
    cache_delete_prefix("engagement:activity-reminder:")

    user = _create_user(db_session, "reminder@example.com")
    progress = _create_progress(db_session, user.id)
    _register_device(db_session, user, "ExponentPushToken[reminder]")

    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id,
        title="Tracked quest",
        description="",
        xp_reward=50,
        crystal_reward=10,
        is_custom=False,
        is_completed=False,
        quest_type="daily",
        objective_type="steps",
        target_value=4000,
        created_at=utc_now(),
    )
    db_session.add(quest)
    db_session.commit()

    first_batch = engagement_service.queue_activity_reminders(db_session)
    second_batch = engagement_service.queue_activity_reminders(db_session)

    events = (
        db_session.query(NotificationEvent)
        .filter(NotificationEvent.user_id == user.id, NotificationEvent.event_type == notification_service.EVENT_ACTIVITY_REMINDER)
        .all()
    )

    assert user.id in first_batch
    assert second_batch == []
    assert len(events) == 1
