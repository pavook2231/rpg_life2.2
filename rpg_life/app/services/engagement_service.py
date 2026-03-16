from __future__ import annotations

import json
from datetime import datetime, time, timedelta
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.chest_items import build_chest_grant_payload, grant_chest_to_user
from app.class_roles import build_class_role_summary, get_class_role
from app.core.cache import cache_get_json, cache_set_json
from app.core.dates import utc_now
from app.models import (
    Challenge,
    ChallengeInvitation,
    CompletedQuest,
    CoopQuest,
    CoopQuestParticipant,
    DailySteps,
    DailyBonus,
    FriendRequest,
    Friendship,
    GameEvent,
    PushDevice,
    Quest,
    SeasonalRewardClaim,
    User,
    UserClassProgress,
    WeeklyRewardClaim,
)
from app import crud
from app.services import notification_service

TRACKED_OBJECTIVES = {"steps", "quests_completed", "xp_gained"}
STREAK_MILESTONES = (3, 7, 14, 30)
REMINDER_TTL_SECONDS = 12 * 60 * 60


def _language(user: User | None) -> str:
    if user and user.language_preference == "en":
        return "en"
    return "ru"


def _localize(language: str, ru: str, en: str) -> str:
    return en if language == "en" else ru


def _objective_label(objective_type: str, language: str) -> str:
    labels = {
        "steps": {"ru": "шаги", "en": "steps"},
        "quests_completed": {"ru": "задания", "en": "tasks"},
        "xp_gained": {"ru": "опыт", "en": "XP"},
    }
    payload = labels.get(objective_type, {"ru": objective_type, "en": objective_type})
    return payload["en"] if language == "en" else payload["ru"]


def _main_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _week_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    current = now or utc_now()
    # Rolling 7-day window is more stable for player perception than calendar weeks.
    week_start_date = current.date() - timedelta(days=6)
    week_start = datetime.combine(week_start_date, time.min)
    return week_start, current


def _week_end(week_start: datetime) -> datetime:
    return week_start + timedelta(days=7)


def _current_weekly_claim(db: Session, user_id: int, week_start: datetime) -> WeeklyRewardClaim | None:
    return (
        db.query(WeeklyRewardClaim)
        .filter(WeeklyRewardClaim.user_id == user_id, WeeklyRewardClaim.week_start_at == week_start)
        .first()
    )


def _current_seasonal_claim(db: Session, user_id: int, event_id: int) -> SeasonalRewardClaim | None:
    return (
        db.query(SeasonalRewardClaim)
        .filter(SeasonalRewardClaim.user_id == user_id, SeasonalRewardClaim.event_id == event_id)
        .first()
    )


def _active_event(db: Session) -> GameEvent | None:
    return (
        db.query(GameEvent)
        .filter(GameEvent.status == "active")
        .order_by(GameEvent.end_at.asc())
        .first()
    )


def _event_payload(event: GameEvent | None) -> dict[str, Any]:
    if not event or not event.payload_json:
        return {}
    try:
        payload = json.loads(event.payload_json)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _weekly_focus_tiers(role: dict[str, Any]) -> list[dict[str, Any]]:
    weekly_focus = role["weekly_focus"]
    tiers = weekly_focus.get("tiers") or []
    if tiers:
        return tiers
    return [
        {
            "target": int(weekly_focus["target"]),
            "reward_xp": int(weekly_focus["reward_xp"]),
            "reward_crystals": int(weekly_focus["reward_crystals"]),
            "title": {"ru": "Недельная награда", "en": "Weekly reward"},
        }
    ]


def _tier_title(tier: dict[str, Any], index: int, language: str) -> str:
    title = tier.get("title") or {}
    if language == "en" and title.get("en"):
        return title["en"]
    if title.get("ru"):
        return title["ru"]
    return f"Tier {index}" if language == "en" else f"Этап {index}"


def _claimed_tier_count(claim: WeeklyRewardClaim | None, total_tiers: int) -> int:
    if not claim:
        return 0
    return max(0, min(int(getattr(claim, "claimed_tier_count", 0) or 0), total_tiers))


def _build_weekly_tiers(
    *,
    current_value: int,
    tiers: list[dict[str, Any]],
    claimed_tier_count: int,
    language: str,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    payloads: list[dict[str, Any]] = []
    next_tier: dict[str, Any] | None = None

    for index, tier in enumerate(tiers, start=1):
        target_value = int(tier["target"])
        claimed = index <= claimed_tier_count
        complete = current_value >= target_value
        claimable = complete and not claimed and index == claimed_tier_count + 1
        payload = {
            "index": index,
            "title": _tier_title(tier, index, language),
            "target": target_value,
            "progress": current_value,
            "remaining": max(target_value - current_value, 0),
            "progress_percent": min(round((current_value / target_value) * 100, 1) if target_value else 0.0, 100.0),
            "complete": complete,
            "claimed": claimed,
            "claimable": claimable,
            "reward": _tier_reward_payload(tier),
        }
        if next_tier is None and not claimed:
            next_tier = payload
        payloads.append(payload)

    return payloads, next_tier


def _seasonal_focus_for_role(event: GameEvent, role: dict[str, Any], class_name: str | None) -> dict[str, Any]:
    seasonal_focus = dict(role.get("seasonal_focus") or {})
    payload = _event_payload(event)
    class_tracks = payload.get("class_tracks") or {}
    override = class_tracks.get(class_name or "") or payload.get("default_track") or {}
    if not isinstance(override, dict):
        override = {}

    merged = dict(seasonal_focus)
    for key in ("objective_type", "target", "tiers"):
        if override.get(key) is not None:
            merged[key] = override[key]

    label = dict(seasonal_focus.get("label") or {})
    override_label = override.get("label") or {}
    if isinstance(override_label, dict):
        label.update({key: value for key, value in override_label.items() if value})
    merged["label"] = label

    reward_identity = dict(seasonal_focus.get("reward_identity") or {})
    override_reward_identity = override.get("reward_identity") or {}
    if isinstance(override_reward_identity, dict):
        reward_identity.update({key: value for key, value in override_reward_identity.items() if value})
    merged["reward_identity"] = reward_identity

    return merged


def _tier_reward_payload(tier: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "xp": int(tier["reward_xp"]),
        "crystals": int(tier["reward_crystals"]),
    }
    if tier.get("chest_name"):
        payload["chest_name"] = tier["chest_name"]
    return payload


def _objective_progress(db: Session, user_id: int, objective_type: str, start_at: datetime, end_at: datetime) -> int:
    if objective_type == "steps":
        return int(
            db.query(func.coalesce(func.sum(DailySteps.steps), 0))
            .filter(DailySteps.user_id == user_id, DailySteps.date >= start_at, DailySteps.date <= end_at)
            .scalar()
            or 0
        )
    if objective_type == "xp_gained":
        return int(
            db.query(func.coalesce(func.sum(CompletedQuest.xp_earned), 0))
            .filter(CompletedQuest.user_id == user_id, CompletedQuest.completed_at >= start_at, CompletedQuest.completed_at <= end_at)
            .scalar()
            or 0
        )
    return int(
        db.query(func.count(CompletedQuest.id))
        .filter(CompletedQuest.user_id == user_id, CompletedQuest.completed_at >= start_at, CompletedQuest.completed_at <= end_at)
        .scalar()
        or 0
    )


def _weekly_progress(db: Session, user_id: int, objective_type: str, start_at: datetime, end_at: datetime) -> int:
    return _objective_progress(db, user_id, objective_type, start_at, end_at)


def get_streak_summary(db: Session, user: User) -> dict[str, Any]:
    language = _language(user)
    progress = _main_progress(db, user.id)
    current_streak = int(getattr(progress, "streak", 0) or 0)
    next_milestone = next((value for value in STREAK_MILESTONES if value > current_streak), STREAK_MILESTONES[-1])
    remaining_days = max(next_milestone - current_streak, 0)

    if current_streak <= 0:
        description = _localize(
            language,
            "Серия еще не началась. Закрой сегодня хотя бы одно подтверждаемое задание.",
            "Your streak has not started yet. Finish at least one verified task today.",
        )
    elif remaining_days == 0:
        description = _localize(
            language,
            f"Серия держится уже {current_streak} дн. Пора закреплять ритм.",
            f"Your streak is already {current_streak} days long. Time to keep the rhythm.",
        )
    else:
        description = _localize(
            language,
            f"До следующей отметки серии осталось {remaining_days} дн.",
            f"{remaining_days} days left until the next streak milestone.",
        )

    return {
        "title": _localize(language, "Серия входа", "Login streak"),
        "description": description,
        "current": current_streak,
        "next_milestone": next_milestone,
        "days_to_next": remaining_days,
    }


def get_weekly_goal_summary(db: Session, user: User) -> dict[str, Any] | None:
    progress = _main_progress(db, user.id)
    if not progress:
        return None

    language = _language(user)
    role = get_class_role(progress.class_name)
    weekly_focus = role["weekly_focus"]
    start_at, end_at = _week_window()
    week_end = _week_end(start_at)
    current_value = _weekly_progress(db, user.id, weekly_focus["objective_type"], start_at, end_at)
    existing_claim = _current_weekly_claim(db, user.id, start_at)
    tiers = _weekly_focus_tiers(role)
    claimed_tier_count = _claimed_tier_count(existing_claim, len(tiers))
    tier_payloads, next_tier = _build_weekly_tiers(
        current_value=current_value,
        tiers=tiers,
        claimed_tier_count=claimed_tier_count,
        language=language,
    )
    claimed_this_week = claimed_tier_count > 0
    all_tiers_claimed = claimed_tier_count >= len(tiers)
    claimable = any(tier["claimable"] for tier in tier_payloads)

    if all_tiers_claimed:
        state_message = _localize(
            language,
            "Все недельные рубежи уже забраны. Держи темп до следующей недели.",
            "All weekly tiers are already claimed. Keep your pace for the next week.",
        )
    elif claimable:
        state_message = _localize(
            language,
            f"Готов рубеж: {next_tier['title']}. Можно забрать следующую награду.",
            f"{next_tier['title']} is ready. You can claim the next reward now.",
        )
    elif next_tier and claimed_tier_count > 0:
        state_message = _localize(
            language,
            f"Рубеж {claimed_tier_count} из {len(tiers)} уже забран. До {next_tier['title']} осталось {next_tier['remaining']}.",
            f"Tier {claimed_tier_count} of {len(tiers)} is already claimed. {next_tier['remaining']} left until {next_tier['title']}.",
        )
    else:
        state_message = _localize(
            language,
            "Доведи недельный фокус до следующего рубежа и забери усиленную награду.",
            "Finish your weekly focus up to the next tier and claim an upgraded reward.",
        )

    target_value = int(next_tier["target"]) if next_tier else int(tiers[-1]["target"])
    progress_percent = float(next_tier["progress_percent"]) if next_tier else 100.0
    reward_preview = next_tier["reward"] if next_tier else tier_payloads[-1]["reward"]

    return {
        "title": _localize(language, "Недельный фокус", "Weekly focus"),
        "description": weekly_focus["label"]["en"] if language == "en" else weekly_focus["label"]["ru"],
        "objective_type": weekly_focus["objective_type"],
        "objective_label": _objective_label(weekly_focus["objective_type"], language),
        "progress": current_value,
        "target": target_value,
        "progress_percent": progress_percent,
        "reward_preview": reward_preview,
        "period_started_at": start_at.isoformat(),
        "period_ends_at": week_end.isoformat(),
        "claimed_this_week": claimed_this_week,
        "claimed_at": existing_claim.claimed_at.isoformat() if existing_claim else None,
        "claimable": claimable,
        "state_message": state_message,
        "claimed_tier_count": claimed_tier_count,
        "total_tiers": len(tiers),
        "all_tiers_claimed": all_tiers_claimed,
        "next_tier_index": next_tier["index"] if next_tier else None,
        "next_tier_title": next_tier["title"] if next_tier else None,
        "tiers": tier_payloads,
    }


def get_active_event_summary(db: Session, user: User) -> dict[str, Any] | None:
    active_event = _active_event(db)
    if active_event:
        return {
            "title": active_event.title,
            "description": active_event.description,
            "status": active_event.status,
            "season_key": active_event.season_key,
            "start_at": active_event.start_at.isoformat() if active_event.start_at else None,
            "end_at": active_event.end_at.isoformat() if active_event.end_at else None,
        }

    upcoming_event = (
        db.query(GameEvent)
        .filter(GameEvent.status == "scheduled")
        .order_by(GameEvent.start_at.asc())
        .first()
    )
    if upcoming_event is None:
        return None

    return {
        "title": upcoming_event.title,
        "description": upcoming_event.description,
        "status": upcoming_event.status,
        "season_key": upcoming_event.season_key,
        "start_at": upcoming_event.start_at.isoformat() if upcoming_event.start_at else None,
        "end_at": upcoming_event.end_at.isoformat() if upcoming_event.end_at else None,
    }


def get_seasonal_goal_summary(db: Session, user: User) -> dict[str, Any] | None:
    progress = _main_progress(db, user.id)
    if not progress:
        return None

    active_event = _active_event(db)
    if active_event is None:
        return None

    role = get_class_role(progress.class_name)
    seasonal_focus = _seasonal_focus_for_role(active_event, role, progress.class_name)
    tiers = seasonal_focus.get("tiers") or []
    if not tiers:
        return None

    language = _language(user)
    now = utc_now()
    progress_value = _objective_progress(
        db,
        user.id,
        seasonal_focus["objective_type"],
        active_event.start_at,
        min(active_event.end_at, now),
    )
    existing_claim = _current_seasonal_claim(db, user.id, active_event.id)
    claimed_tier_count = _claimed_tier_count(existing_claim, len(tiers))
    tier_payloads, next_tier = _build_weekly_tiers(
        current_value=progress_value,
        tiers=tiers,
        claimed_tier_count=claimed_tier_count,
        language=language,
    )
    claimable = any(tier["claimable"] for tier in tier_payloads)
    all_tiers_claimed = claimed_tier_count >= len(tiers)

    if all_tiers_claimed:
        state_message = _localize(
            language,
            "Все сезонные рубежи уже забраны. Можно продолжать сезон ради лидербордов и друзей.",
            "All seasonal tiers are already claimed. Keep pushing the season for leaderboards and friends.",
        )
    elif claimable:
        state_message = _localize(
            language,
            f"Сезонный рубеж {next_tier['title']} готов. Забери награду и продолжай забег.",
            f"Seasonal tier {next_tier['title']} is ready. Claim it and keep the run going.",
        )
    elif next_tier and claimed_tier_count > 0:
        state_message = _localize(
            language,
            f"До рубежа {next_tier['title']} осталось {next_tier['remaining']}. Сезон уже разогнан.",
            f"{next_tier['remaining']} left until {next_tier['title']}. Your season is already rolling.",
        )
    else:
        state_message = _localize(
            language,
            "Начни сезонный рывок и закрой первый рубеж, чтобы открыть редкие награды класса.",
            "Start your seasonal push and clear the first tier to unlock class rewards.",
        )

    reward_preview = next_tier["reward"] if next_tier else tier_payloads[-1]["reward"]
    target_value = int(next_tier["target"]) if next_tier else int(tiers[-1]["target"])
    progress_percent = float(next_tier["progress_percent"]) if next_tier else 100.0
    reward_identity = seasonal_focus.get("reward_identity") or {}
    focus_label = seasonal_focus["label"]["en"] if language == "en" else seasonal_focus["label"]["ru"]
    reward_identity_text = reward_identity.get("en") if language == "en" and reward_identity.get("en") else reward_identity.get("ru")

    return {
        "event_id": active_event.id,
        "event_title": active_event.title,
        "event_description": active_event.description,
        "season_key": active_event.season_key,
        "title": _localize(language, "Сезонный поход", "Seasonal campaign"),
        "description": reward_identity_text or focus_label,
        "objective_type": seasonal_focus["objective_type"],
        "objective_label": _objective_label(seasonal_focus["objective_type"], language),
        "focus_label": focus_label,
        "progress": progress_value,
        "target": target_value,
        "progress_percent": progress_percent,
        "reward_preview": reward_preview,
        "reward_identity": reward_identity_text,
        "period_started_at": active_event.start_at.isoformat() if active_event.start_at else None,
        "period_ends_at": active_event.end_at.isoformat() if active_event.end_at else None,
        "claimed_this_season": claimed_tier_count > 0,
        "claimed_at": existing_claim.claimed_at.isoformat() if existing_claim else None,
        "claimable": claimable,
        "state_message": state_message,
        "claimed_tier_count": claimed_tier_count,
        "total_tiers": len(tiers),
        "all_tiers_claimed": all_tiers_claimed,
        "next_tier_index": next_tier["index"] if next_tier else None,
        "next_tier_title": next_tier["title"] if next_tier else None,
        "tiers": tier_payloads,
    }


def get_social_pulse(db: Session, user: User) -> dict[str, Any]:
    language = _language(user)
    friends_count = int(
        db.query(func.count(Friendship.id)).filter(Friendship.user_id == user.id).scalar() or 0
    )
    pending_friend_requests = int(
        db.query(func.count(FriendRequest.id))
        .filter(FriendRequest.receiver_id == user.id, FriendRequest.status == "pending")
        .scalar()
        or 0
    )
    pending_challenge_invitations = int(
        db.query(func.count(ChallengeInvitation.id))
        .filter(ChallengeInvitation.receiver_id == user.id, ChallengeInvitation.status == "pending")
        .scalar()
        or 0
    )
    active_duels = int(
        db.query(func.count(Challenge.id))
        .filter(
            or_(Challenge.creator_id == user.id, Challenge.opponent_id == user.id),
            Challenge.challenge_type.in_(["pvp", "duel"]),
            Challenge.status.in_(["pending", "active"]),
        )
        .scalar()
        or 0
    )
    active_coop = int(
        db.query(func.count(CoopQuest.id))
        .join(CoopQuestParticipant, CoopQuestParticipant.coop_quest_id == CoopQuest.id)
        .filter(CoopQuestParticipant.user_id == user.id, CoopQuest.status.in_(["scheduled", "active"]))
        .scalar()
        or 0
    )

    if pending_friend_requests or pending_challenge_invitations:
        description = _localize(
            language,
            f"Есть новые приглашения: друзья {pending_friend_requests}, челленджи {pending_challenge_invitations}.",
            f"You have new invites: friends {pending_friend_requests}, challenges {pending_challenge_invitations}.",
        )
    elif active_duels or active_coop:
        description = _localize(
            language,
            f"Активно дуэлей: {active_duels}, кооперативных целей: {active_coop}.",
            f"Active duels: {active_duels}, coop goals: {active_coop}.",
        )
    else:
        description = _localize(
            language,
            f"Друзей в сети прогресса: {friends_count}. Самое время звать в кооп.",
            f"Progress-network friends: {friends_count}. Good time to invite someone to coop.",
        )

    return {
        "title": _localize(language, "Социальный пульс", "Social pulse"),
        "description": description,
        "friends_count": friends_count,
        "pending_friend_requests": pending_friend_requests,
        "pending_challenge_invitations": pending_challenge_invitations,
        "active_duels": active_duels,
        "active_coop": active_coop,
    }


def get_class_role_summary(db: Session, user: User) -> dict[str, Any] | None:
    progress = _main_progress(db, user.id)
    if not progress:
        return None
    return build_class_role_summary(progress.class_name, _language(user))


def claim_weekly_goal_reward(db: Session, user: User) -> dict[str, Any]:
    progress = _main_progress(db, user.id)
    if not progress:
        raise ValueError("Character progress not found")

    week_start, _ = _week_window()
    week_end = _week_end(week_start)
    role = get_class_role(progress.class_name)
    weekly_focus = role["weekly_focus"]
    tiers = _weekly_focus_tiers(role)
    existing_claim = _current_weekly_claim(db, user.id, week_start)
    claimed_tier_count = _claimed_tier_count(existing_claim, len(tiers))

    if claimed_tier_count >= len(tiers):
        raise ValueError("All weekly rewards already claimed")

    next_tier = tiers[claimed_tier_count]
    progress_value = _weekly_progress(db, user.id, weekly_focus["objective_type"], week_start, utc_now())
    target_value = int(next_tier["target"])
    if progress_value < target_value:
        raise ValueError("Next weekly tier not completed yet")

    reward_xp = int(next_tier["reward_xp"])
    reward_crystals = int(next_tier["reward_crystals"])
    tier_index = claimed_tier_count + 1
    claimed_at = utc_now()

    old_level = progress.level
    progress.crystals += reward_crystals
    progress, level_ups, final_xp = crud.add_xp_and_stats(db, progress, reward_xp, "epic")
    progress.last_activity = claimed_at

    if existing_claim:
        claim = existing_claim
    else:
        claim = WeeklyRewardClaim(
            user_id=user.id,
            class_name=progress.class_name,
            objective_type=weekly_focus["objective_type"],
            progress_value=progress_value,
            target_value=target_value,
            reward_xp=reward_xp,
            reward_crystals=reward_crystals,
            claimed_tier_count=0,
            week_start_at=week_start,
            week_end_at=week_end,
            claimed_at=claimed_at,
        )
        db.add(claim)

    claim.class_name = progress.class_name
    claim.objective_type = weekly_focus["objective_type"]
    claim.progress_value = progress_value
    claim.target_value = target_value
    claim.reward_xp = reward_xp
    claim.reward_crystals = reward_crystals
    claim.claimed_tier_count = tier_index
    claim.week_end_at = week_end
    claim.claimed_at = claimed_at
    db.commit()
    db.refresh(progress)

    return {
        "success": True,
        "class_name": progress.class_name,
        "objective_type": weekly_focus["objective_type"],
        "progress": progress_value,
        "target": target_value,
        "reward_xp": final_xp,
        "reward_crystals": reward_crystals,
        "claimed_at": claim.claimed_at.isoformat(),
        "claimed_tier_count": claim.claimed_tier_count,
        "tier_index": tier_index,
        "tier_title": _tier_title(next_tier, tier_index, _language(user)),
        "tiers_remaining": max(len(tiers) - claim.claimed_tier_count, 0),
        "all_tiers_claimed": claim.claimed_tier_count >= len(tiers),
        "new_level": progress.level,
        "old_level": old_level,
        "level_ups": level_ups,
        "current_xp": progress.current_xp,
        "next_level_xp": crud.calculate_next_level_xp(progress.level),
    }


def claim_seasonal_goal_reward(db: Session, user: User) -> dict[str, Any]:
    progress = _main_progress(db, user.id)
    if not progress:
        raise ValueError("Character progress not found")

    active_event = _active_event(db)
    if active_event is None:
        raise ValueError("No active seasonal event")

    role = get_class_role(progress.class_name)
    seasonal_focus = _seasonal_focus_for_role(active_event, role, progress.class_name)
    tiers = seasonal_focus.get("tiers") or []
    if not tiers:
        raise ValueError("Seasonal track is not configured")

    existing_claim = _current_seasonal_claim(db, user.id, active_event.id)
    claimed_tier_count = _claimed_tier_count(existing_claim, len(tiers))
    if claimed_tier_count >= len(tiers):
        raise ValueError("All seasonal rewards already claimed")

    next_tier = tiers[claimed_tier_count]
    progress_value = _objective_progress(
        db,
        user.id,
        seasonal_focus["objective_type"],
        active_event.start_at,
        min(active_event.end_at, utc_now()),
    )
    target_value = int(next_tier["target"])
    if progress_value < target_value:
        raise ValueError("Next seasonal tier not completed yet")

    reward_xp = int(next_tier["reward_xp"])
    reward_crystals = int(next_tier["reward_crystals"])
    reward_chest_name = next_tier.get("chest_name")
    tier_index = claimed_tier_count + 1
    claimed_at = utc_now()

    old_level = progress.level
    progress.crystals += reward_crystals
    progress, level_ups, final_xp = crud.add_xp_and_stats(db, progress, reward_xp, "epic")
    progress.last_activity = claimed_at

    chest_reward = None
    if reward_chest_name:
        inventory_item = grant_chest_to_user(db, user.id, reward_chest_name)
        chest_reward = build_chest_grant_payload(
            inventory_item,
            reward_chest_name,
            source=f"seasonal_event:{active_event.season_key or active_event.id}",
        )

    if existing_claim:
        claim = existing_claim
    else:
        claim = SeasonalRewardClaim(
            user_id=user.id,
            event_id=active_event.id,
            class_name=progress.class_name,
            objective_type=seasonal_focus["objective_type"],
            progress_value=progress_value,
            target_value=target_value,
            reward_xp=reward_xp,
            reward_crystals=reward_crystals,
            reward_chest_name=reward_chest_name,
            claimed_tier_count=0,
            claimed_at=claimed_at,
        )
        db.add(claim)

    claim.class_name = progress.class_name
    claim.objective_type = seasonal_focus["objective_type"]
    claim.progress_value = progress_value
    claim.target_value = target_value
    claim.reward_xp = reward_xp
    claim.reward_crystals = reward_crystals
    claim.reward_chest_name = reward_chest_name
    claim.claimed_tier_count = tier_index
    claim.claimed_at = claimed_at

    db.commit()
    db.refresh(progress)

    return {
        "success": True,
        "event_id": active_event.id,
        "season_key": active_event.season_key,
        "class_name": progress.class_name,
        "objective_type": seasonal_focus["objective_type"],
        "progress": progress_value,
        "target": target_value,
        "reward_xp": final_xp,
        "reward_crystals": reward_crystals,
        "reward_chest": chest_reward,
        "claimed_at": claim.claimed_at.isoformat(),
        "claimed_tier_count": claim.claimed_tier_count,
        "tier_index": tier_index,
        "tier_title": _tier_title(next_tier, tier_index, _language(user)),
        "tiers_remaining": max(len(tiers) - claim.claimed_tier_count, 0),
        "all_tiers_claimed": claim.claimed_tier_count >= len(tiers),
        "new_level": progress.level,
        "old_level": old_level,
        "level_ups": level_ups,
        "current_xp": progress.current_xp,
        "next_level_xp": crud.calculate_next_level_xp(progress.level),
    }


def _open_verified_quest_count(db: Session, user_id: int) -> int:
    now = utc_now()
    return int(
        db.query(func.count(Quest.id))
        .filter(
            Quest.user_id == user_id,
            Quest.is_completed == False,
            Quest.objective_type.in_(TRACKED_OBJECTIVES),
            or_(Quest.expires_at == None, Quest.expires_at >= now),
        )
        .scalar()
        or 0
    )


def _recent_activity_at(db: Session, user_id: int) -> datetime | None:
    last_completed = (
        db.query(func.max(CompletedQuest.completed_at)).filter(CompletedQuest.user_id == user_id).scalar()
    )
    last_bonus = db.query(func.max(DailyBonus.claimed_at)).filter(DailyBonus.user_id == user_id).scalar()
    candidates = [value for value in [last_completed, last_bonus] if value is not None]
    if not candidates:
        return None
    return max(candidates)


def _reminder_key(user_id: int) -> str:
    return f"engagement:activity-reminder:{user_id}"


def queue_activity_reminders(db: Session) -> list[int]:
    now = utc_now()
    users = (
        db.query(User)
        .join(PushDevice, PushDevice.user_id == User.id)
        .filter(User.is_active == True, PushDevice.is_active == True)
        .distinct()
        .all()
    )

    queued_for: list[int] = []
    for user in users:
        cache_key = _reminder_key(user.id)
        if cache_get_json(cache_key):
            continue

        social_pulse = get_social_pulse(db, user)
        verified_quests = _open_verified_quest_count(db, user.id)
        last_activity = _recent_activity_at(db, user.id)
        idle_for_hours = (now - last_activity).total_seconds() / 3600 if last_activity else 999.0
        language = _language(user)

        title: str | None = None
        body: str | None = None
        payload: dict[str, Any] | None = None

        weekly_goal = get_weekly_goal_summary(db, user)
        seasonal_goal = get_seasonal_goal_summary(db, user)

        if social_pulse["pending_friend_requests"] or social_pulse["pending_challenge_invitations"]:
            title = _localize(language, "Команда ждет тебя", "Your party is waiting")
            body = _localize(
                language,
                "У тебя есть новые приглашения. Зайди и ответь друзьям или соперникам.",
                "You have new invites waiting. Jump in and respond to friends or rivals.",
            )
            payload = {"kind": "social_invites"}
        elif seasonal_goal and seasonal_goal["claimable"]:
            title = _localize(language, "Готов сезонный рубеж", "Seasonal tier is ready")
            body = _localize(
                language,
                f"Сезонный рубеж {seasonal_goal.get('next_tier_title') or seasonal_goal['title']} уже готов. Забери награду и не теряй темп.",
                f"{seasonal_goal.get('next_tier_title') or seasonal_goal['title']} is ready. Claim it and keep the momentum.",
            )
            payload = {
                "kind": "seasonal_reward",
                "event_id": seasonal_goal.get("event_id"),
                "tier_index": seasonal_goal.get("next_tier_index"),
                "tier_title": seasonal_goal.get("next_tier_title"),
            }
        elif weekly_goal and weekly_goal["claimable"]:
            title = _localize(language, "Готова недельная награда", "Weekly reward is ready")
            body = _localize(
                language,
                f"Рубеж {weekly_goal.get('next_tier_title') or weekly_goal['title']} уже готов. Забери следующую награду героя.",
                f"{weekly_goal.get('next_tier_title') or weekly_goal['title']} is ready. Claim the next hero reward.",
            )
            payload = {
                "kind": "weekly_reward",
                "tier_index": weekly_goal.get("next_tier_index"),
                "tier_title": weekly_goal.get("next_tier_title"),
            }
        elif verified_quests > 0 and idle_for_hours >= 10:
            title = _localize(language, "Незавершенные квесты", "Unfinished quests")
            body = _localize(
                language,
                f"На сегодня еще осталось {verified_quests} подтверждаемых квестов. Серия может вырасти.",
                f"You still have {verified_quests} verified quests left today. Your streak can grow.",
            )
            payload = {"kind": "verified_quests", "quest_count": verified_quests}
        elif (social_pulse["active_duels"] or social_pulse["active_coop"]) and idle_for_hours >= 12:
            title = _localize(language, "Активности в прогрессе", "Active progress battles")
            body = _localize(
                language,
                "У тебя есть активные дуэли или кооперативные цели. Самое время вернуться в ритм.",
                "You have active duels or coop goals waiting. Time to get back in rhythm.",
            )
            payload = {"kind": "social_active"}

        if not title or not body:
            continue

        queued = notification_service.notify_activity_reminder(
            db,
            user_id=user.id,
            title=title,
            body=body,
            payload=payload,
        )
        if queued:
            cache_set_json(cache_key, {"queued_at": now.isoformat(), "payload": payload or {}}, ttl=REMINDER_TTL_SECONDS)
            queued_for.append(user.id)

    return queued_for
