from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Any
from urllib import request as urllib_request
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import (
    ENABLE_PUSH_DISPATCH,
    EXPO_PUSH_ACCESS_TOKEN,
    EXPO_PUSH_ENDPOINT,
    PUSH_QUEUE_BATCH_SIZE,
    PUSH_QUEUE_MAX_ATTEMPTS,
    PUSH_QUEUE_RETRY_DELAY_SECONDS,
)
from app.core.dates import utc_now
from app.models import Challenge, NotificationEvent, NotificationQueue, PushDevice, User

logger = logging.getLogger(__name__)

EVENT_NEW_QUESTS = "daily_quests_available"
EVENT_BOSS_VICTORY = "boss_victory"
EVENT_FRIEND_INVITATION = "friend_invitation"
EVENT_CHALLENGE_COMPLETED = "challenge_completed"
EVENT_CHALLENGE_INVITATION = "challenge_invitation"
EVENT_ACTIVITY_REMINDER = "activity_reminder"
EVENT_FRIEND_ACHIEVEMENT = "friend_achievement"

STATUS_PENDING = "pending"
STATUS_SENT = "sent"
STATUS_FAILED = "failed"
STATUS_INVALID_DEVICE = "invalid_device"

_MESSAGES = {
    "ru": {
        EVENT_NEW_QUESTS: {
            "title": "Новые квесты готовы",
            "body": "На сегодня доступно {quest_count} новых квестов.",
        },
        EVENT_BOSS_VICTORY: {
            "title": "Босс побежден",
            "body": "Вы победили босса {boss_name} и получили {reward_gold} золота.",
        },
        EVENT_FRIEND_INVITATION: {
            "title": "Новое приглашение в друзья",
            "body": "{sender_name} отправил(а) вам запрос в друзья.",
        },
        EVENT_CHALLENGE_COMPLETED: {
            "title": "Челлендж завершен",
            "win": "Челлендж \"{challenge_title}\" завершен. Вы победили.",
            "loss": "Челлендж \"{challenge_title}\" завершен. Победитель: {winner_name}.",
            "draw": "Челлендж \"{challenge_title}\" завершен вничью.",
            "complete": "Челлендж \"{challenge_title}\" завершен.",
        },
        EVENT_CHALLENGE_INVITATION: {
            "title": "Новое приглашение",
            "body": "{body}",
        },
        EVENT_ACTIVITY_REMINDER: {
            "title": "Напоминание героя",
            "body": "{body}",
        },
        EVENT_FRIEND_ACHIEVEMENT: {
            "title": "Достижение друга",
            "body": "Ваш друг {friend_name} завершил квест \"{quest_title}\".",
        },
    },
    "en": {
        EVENT_NEW_QUESTS: {
            "title": "New quests are ready",
            "body": "{quest_count} new quests are available today.",
        },
        EVENT_BOSS_VICTORY: {
            "title": "Boss defeated",
            "body": "You defeated {boss_name} and earned {reward_gold} gold.",
        },
        EVENT_FRIEND_INVITATION: {
            "title": "New friend invite",
            "body": "{sender_name} sent you a friend request.",
        },
        EVENT_CHALLENGE_COMPLETED: {
            "title": "Challenge completed",
            "win": "Challenge \"{challenge_title}\" is over. You won.",
            "loss": "Challenge \"{challenge_title}\" is over. Winner: {winner_name}.",
            "draw": "Challenge \"{challenge_title}\" ended in a draw.",
            "complete": "Challenge \"{challenge_title}\" is over.",
        },
        EVENT_CHALLENGE_INVITATION: {
            "title": "New invitation",
            "body": "{body}",
        },
        EVENT_ACTIVITY_REMINDER: {
            "title": "Hero reminder",
            "body": "{body}",
        },
        EVENT_FRIEND_ACHIEVEMENT: {
            "title": "Friend achievement",
            "body": "Your friend {friend_name} completed quest \"{quest_title}\".",
        },
    },
}


def _user_language(user: User | None) -> str:
    if user and user.language_preference == "en":
        return "en"
    return "ru"


def _message(user: User, event_type: str, field: str, params: dict[str, Any] | None = None) -> str:
    language = _user_language(user)
    template = _MESSAGES[language][event_type][field]
    return template.format(**(params or {}))


def _serialize_payload(payload: dict[str, Any] | None) -> str:
    return json.dumps(payload or {}, ensure_ascii=False)


def _display_name(user: User | None) -> str:
    if user is None:
        return "Unknown"
    return user.name or user.email


def _token_preview(push_token: str) -> str:
    if len(push_token) <= 16:
        return push_token
    return f"{push_token[:8]}...{push_token[-6:]}"


def _active_device_ids(db: Session, user_id: int) -> list[int]:
    rows = (
        db.query(PushDevice.id)
        .filter(PushDevice.user_id == user_id, PushDevice.is_active == True)
        .all()
    )
    return [device_id for (device_id,) in rows]


def _create_event(
    db: Session,
    *,
    user_id: int,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, Any] | None = None,
    actor_user_id: int | None = None,
    source_type: str | None = None,
    source_id: int | None = None,
    commit: bool = True,
) -> tuple[NotificationEvent, int]:
    event_payload = {"event_type": event_type, **(payload or {})}
    event = NotificationEvent(
        user_id=user_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        title=title,
        body=body,
        payload_json=_serialize_payload(event_payload),
        source_type=source_type,
        source_id=source_id,
    )
    db.add(event)
    db.flush()

    active_device_ids = _active_device_ids(db, user_id)
    for device_id in active_device_ids:
        db.add(
            NotificationQueue(
                event_id=event.id,
                user_id=user_id,
                device_id=device_id,
                status=STATUS_PENDING,
            )
        )

    if commit:
        db.commit()

    return event, len(active_device_ids)


def register_push_device(db: Session, current_user: User, payload) -> dict:
    now = utc_now()
    device = db.query(PushDevice).filter(PushDevice.push_token == payload.push_token).first()
    if device is None:
        device = PushDevice(
            user_id=current_user.id,
            push_token=payload.push_token,
            platform=payload.platform,
            device_name=payload.device_name,
            app_version=payload.app_version,
            is_active=True,
            last_seen_at=now,
        )
        db.add(device)
    else:
        device.user_id = current_user.id
        device.platform = payload.platform
        device.device_name = payload.device_name
        device.app_version = payload.app_version
        device.is_active = True
        device.last_seen_at = now

    db.commit()
    db.refresh(device)

    return {
        "ok": True,
        "device": {
            "id": device.id,
            "platform": device.platform,
            "token_preview": _token_preview(device.push_token),
            "is_active": device.is_active,
            "last_seen_at": device.last_seen_at.isoformat(),
        },
    }


def unregister_push_device(db: Session, current_user: User, push_token: str) -> dict:
    device = (
        db.query(PushDevice)
        .filter(PushDevice.push_token == push_token, PushDevice.user_id == current_user.id)
        .first()
    )
    if device is None:
        return {"ok": True, "removed": False}

    device.is_active = False
    device.updated_at = utc_now()
    db.commit()
    return {"ok": True, "removed": True}


def notify_new_daily_quests(db: Session, *, user_id: int, quest_count: int) -> int:
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None or quest_count <= 0:
        return 0

    _, queued = _create_event(
        db,
        user_id=user.id,
        event_type=EVENT_NEW_QUESTS,
        title=_message(user, EVENT_NEW_QUESTS, "title"),
        body=_message(user, EVENT_NEW_QUESTS, "body", {"quest_count": quest_count}),
        payload={"quest_count": quest_count},
        source_type="daily_quests",
    )
    return queued


def notify_boss_victory(
    db: Session,
    *,
    user_id: int,
    boss_id: int,
    boss_name: str,
    reward_gold: int,
) -> int:
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        return 0

    _, queued = _create_event(
        db,
        user_id=user.id,
        event_type=EVENT_BOSS_VICTORY,
        title=_message(user, EVENT_BOSS_VICTORY, "title"),
        body=_message(
            user,
            EVENT_BOSS_VICTORY,
            "body",
            {"boss_name": boss_name, "reward_gold": reward_gold},
        ),
        payload={"boss_id": boss_id, "boss_name": boss_name, "reward_gold": reward_gold},
        source_type="boss",
        source_id=boss_id,
    )
    return queued


def notify_friend_invitation(
    db: Session,
    *,
    receiver_id: int,
    sender: User,
    request_id: int,
) -> int:
    receiver = db.query(User).filter(User.id == receiver_id, User.is_active == True).first()
    if receiver is None:
        return 0

    _, queued = _create_event(
        db,
        user_id=receiver.id,
        event_type=EVENT_FRIEND_INVITATION,
        title=_message(receiver, EVENT_FRIEND_INVITATION, "title"),
        body=_message(
            receiver,
            EVENT_FRIEND_INVITATION,
            "body",
            {"sender_name": _display_name(sender)},
        ),
        payload={"sender_id": sender.id, "sender_name": _display_name(sender), "request_id": request_id},
        actor_user_id=sender.id,
        source_type="friend_request",
        source_id=request_id,
    )
    return queued


def notify_friend_achievement(
    db: Session,
    *,
    friend_ids: list[int],
    achiever: User,
    quest_title: str,
) -> int:
    total_queued = 0
    for friend_id in friend_ids:
        friend = db.query(User).filter(User.id == friend_id, User.is_active == True).first()
        if friend is None:
            continue

        _, queued = _create_event(
            db,
            user_id=friend.id,
            event_type=EVENT_FRIEND_ACHIEVEMENT,
            title=_message(friend, EVENT_FRIEND_ACHIEVEMENT, "title"),
            body=_message(
                friend,
                EVENT_FRIEND_ACHIEVEMENT,
                "body",
                {"friend_name": _display_name(achiever), "quest_title": quest_title},
            ),
            payload={"achiever_id": achiever.id, "achiever_name": _display_name(achiever), "quest_title": quest_title},
            actor_user_id=achiever.id,
            source_type="friend_achievement",
            source_id=achiever.id,
        )
        total_queued += queued
    return total_queued


def notify_challenge_completed(db: Session, *, challenge_id: int) -> int:
    challenge = (
        db.query(Challenge)
        .options(
            joinedload(Challenge.creator),
            joinedload(Challenge.opponent),
            selectinload(Challenge.participants),
        )
        .filter(Challenge.id == challenge_id)
        .first()
    )
    if challenge is None:
        return 0

    participant_ids = {participant.user_id for participant in challenge.participants if participant.user_id is not None}
    if challenge.creator_id is not None:
        participant_ids.add(challenge.creator_id)
    if challenge.opponent_id is not None:
        participant_ids.add(challenge.opponent_id)
    if not participant_ids:
        return 0

    users = db.query(User).filter(User.id.in_(participant_ids), User.is_active == True).all()
    user_map = {user.id: user for user in users}
    winner_name = _display_name(user_map.get(challenge.winner_id) if challenge.winner_id else None)
    challenge_title = challenge.title or "Challenge"

    queued = 0
    created = False
    for user in users:
        if challenge.winner_id is None:
            body = _message(user, EVENT_CHALLENGE_COMPLETED, "draw", {"challenge_title": challenge_title})
        elif challenge.winner_id == user.id:
            body = _message(user, EVENT_CHALLENGE_COMPLETED, "win", {"challenge_title": challenge_title})
        else:
            body = _message(
                user,
                EVENT_CHALLENGE_COMPLETED,
                "loss",
                {"challenge_title": challenge_title, "winner_name": winner_name},
            )

        _, device_count = _create_event(
            db,
            user_id=user.id,
            event_type=EVENT_CHALLENGE_COMPLETED,
            title=_message(user, EVENT_CHALLENGE_COMPLETED, "title"),
            body=body,
            payload={
                "challenge_id": challenge.id,
                "challenge_title": challenge_title,
                "challenge_type": challenge.challenge_type,
                "winner_id": challenge.winner_id,
            },
            actor_user_id=challenge.winner_id,
            source_type="challenge",
            source_id=challenge.id,
            commit=False,
        )
        created = True
        queued += device_count

    if created:
        db.commit()

    return queued


def create_notification(
    db: Session,
    user_id: int,
    event_type: str,
    body: str,
    payload: dict[str, Any] | None = None,
    *,
    title: str | None = None,
    actor_user_id: int | None = None,
    source_type: str | None = None,
    source_id: int | None = None,
) -> NotificationEvent | None:
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        return None

    language = _user_language(user)
    default_title = _MESSAGES.get(language, {}).get(event_type, {}).get("title")
    resolved_title = title or default_title or ("Game update" if language == "en" else "Игровое уведомление")

    event, _ = _create_event(
        db,
        user_id=user.id,
        event_type=event_type,
        title=resolved_title,
        body=body,
        payload=payload,
        actor_user_id=actor_user_id,
        source_type=source_type,
        source_id=source_id,
    )
    return event


def notify_activity_reminder(
    db: Session,
    *,
    user_id: int,
    title: str,
    body: str,
    payload: dict[str, Any] | None = None,
) -> int:
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        return 0

    _, queued = _create_event(
        db,
        user_id=user.id,
        event_type=EVENT_ACTIVITY_REMINDER,
        title=title,
        body=body,
        payload=payload,
        source_type="engagement",
    )
    return queued


def _build_expo_message(entry: NotificationQueue) -> dict[str, Any]:
    payload: dict[str, Any]
    try:
        payload = json.loads(entry.event.payload_json or "{}")
    except json.JSONDecodeError:
        payload = {}

    payload.setdefault("event_type", entry.event.event_type)
    return {
        "to": entry.device.push_token,
        "title": entry.event.title,
        "body": entry.event.body,
        "data": payload,
        "sound": "default",
    }


def _post_push_batch(messages: list[dict[str, Any]], headers: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(messages).encode("utf-8")
    request = urllib_request.Request(EXPO_PUSH_ENDPOINT, data=body, headers=headers, method="POST")
    with urllib_request.urlopen(request, timeout=20.0) as response:
        raw_response = response.read().decode("utf-8")
    return json.loads(raw_response)


def _mark_delivery_failure(entry: NotificationQueue, error_message: str, attempted_at) -> None:
    entry.attempts += 1
    entry.last_error = error_message
    entry.updated_at = attempted_at
    if entry.attempts >= PUSH_QUEUE_MAX_ATTEMPTS:
        entry.status = STATUS_FAILED
    else:
        entry.status = STATUS_PENDING
        entry.scheduled_at = attempted_at + timedelta(seconds=PUSH_QUEUE_RETRY_DELAY_SECONDS)


def dispatch_pending_notifications(db: Session) -> dict:
    now = utc_now()
    pending = (
        db.query(NotificationQueue)
        .options(joinedload(NotificationQueue.event), joinedload(NotificationQueue.device))
        .join(NotificationQueue.device)
        .filter(
            NotificationQueue.status == STATUS_PENDING,
            NotificationQueue.scheduled_at <= now,
            NotificationQueue.attempts < PUSH_QUEUE_MAX_ATTEMPTS,
            PushDevice.is_active == True,
        )
        .order_by(NotificationQueue.created_at.asc())
        .limit(PUSH_QUEUE_BATCH_SIZE)
        .all()
    )

    if not pending:
        return {"queued": 0, "sent": 0, "failed": 0, "invalid_devices": 0, "dispatch_enabled": ENABLE_PUSH_DISPATCH}

    if not ENABLE_PUSH_DISPATCH or not EXPO_PUSH_ENDPOINT:
        return {
            "queued": len(pending),
            "sent": 0,
            "failed": 0,
            "invalid_devices": 0,
            "dispatch_enabled": False,
        }

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
    }
    if EXPO_PUSH_ACCESS_TOKEN:
        headers["authorization"] = f"Bearer {EXPO_PUSH_ACCESS_TOKEN}"

    messages = [_build_expo_message(entry) for entry in pending]
    try:
        payload = _post_push_batch(messages, headers)
        data = payload.get("data", [])
        if not isinstance(data, list) or len(data) != len(pending):
            raise ValueError("Unexpected Expo push response payload")
    except Exception as exc:  # pragma: no cover - exercised with monkeypatch in tests
        logger.warning("Push dispatch batch failed: %s", exc)
        for entry in pending:
            _mark_delivery_failure(entry, str(exc), now)
        db.commit()
        failed_count = sum(1 for entry in pending if entry.status == STATUS_FAILED)
        return {
            "queued": len(pending),
            "sent": 0,
            "failed": failed_count,
            "invalid_devices": 0,
            "dispatch_enabled": True,
        }

    sent = 0
    failed = 0
    invalid_devices = 0
    for entry, item in zip(pending, data):
        entry.attempts += 1
        entry.updated_at = now
        status = item.get("status")
        if status == "ok":
            entry.status = STATUS_SENT
            entry.sent_at = now
            entry.last_error = None
            sent += 1
            continue

        details = item.get("details") or {}
        error_code = details.get("error")
        message = item.get("message") or error_code or "Unknown push delivery error"
        if error_code == "DeviceNotRegistered":
            entry.device.is_active = False
            entry.status = STATUS_INVALID_DEVICE
            entry.last_error = message
            invalid_devices += 1
            continue

        entry.attempts -= 1
        _mark_delivery_failure(entry, message, now)
        failed += 1 if entry.status == STATUS_FAILED else 0

    db.commit()
    return {
        "queued": len(pending),
        "sent": sent,
        "failed": failed,
        "invalid_devices": invalid_devices,
        "dispatch_enabled": True,
    }
