from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

import redis
from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app import crud
from app.core.cache import invalidate_leaderboard_cache
from app.core.dates import utc_now
from app.models import (
    Challenge,
    ChallengeInvitation,
    ChallengeParticipant,
    CompletedQuest,
    CoopQuest,
    CoopQuestParticipant,
    DailySteps,
    FriendRequest,
    Friendship,
    GameEvent,
    User,
    UserClassProgress,
)
from app.user_identity import normalize_username_lookup, parse_public_user_id
from . import notification_service

from app.core.config import REDIS_URL

logger = logging.getLogger(__name__)

SUPPORTED_OBJECTIVES = {"steps", "workouts", "quests_completed"}
LEADERBOARD_METRICS = {"level", "quests", "steps", "challenge_wins"}
LEADERBOARD_PERIODS = {"all_time", "weekly", "season"}
MAX_FRIENDS = 50


def _get_redis_client():
    """Get Redis client for caching"""
    try:
        return redis.from_url(REDIS_URL)
    except Exception:
        logger.warning("Redis not available, skipping cache")
        return None


def _cached_user_stats_map(
    db: Session,
    user_ids: list[int],
    *,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
) -> dict[int, dict]:
    """Get user stats with Redis caching"""
    if not user_ids:
        return {}

    redis_client = _get_redis_client()
    window_key = f"{started_at.isoformat() if started_at else 'all'}:{ended_at.isoformat() if ended_at else 'all'}"
    cache_key = f"user_stats:{','.join(map(str, sorted(user_ids)))}:{window_key}"

    # Try to get from cache
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                payload = json.loads(cached)
                return {int(user_id): stats for user_id, stats in payload.items()}
        except Exception:
            logger.warning("Failed to get stats from cache")

    # Compute stats
    stats_map = _compute_user_stats_map(db, user_ids, started_at=started_at, ended_at=ended_at)

    # Cache for 5 minutes
    if redis_client:
        try:
            redis_client.setex(cache_key, 300, json.dumps(stats_map))
        except Exception:
            logger.warning("Failed to cache stats")

    return stats_map


def _compute_user_stats_map(
    db: Session,
    user_ids: list[int],
    *,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
) -> dict[int, dict]:
    if not user_ids:
        return {}

    # Fall back to multiple aggregated queries for cross-DB compatibility
    level_rows = (
        db.query(UserClassProgress.user_id, func.max(UserClassProgress.level))
        .filter(UserClassProgress.user_id.in_(user_ids))
        .group_by(UserClassProgress.user_id)
        .all()
    )
    quest_query = db.query(CompletedQuest.user_id, func.count(CompletedQuest.id)).filter(CompletedQuest.user_id.in_(user_ids))
    if started_at:
        quest_query = quest_query.filter(CompletedQuest.completed_at >= started_at)
    if ended_at:
        quest_query = quest_query.filter(CompletedQuest.completed_at <= ended_at)
    quest_rows = quest_query.group_by(CompletedQuest.user_id).all()

    step_query = db.query(DailySteps.user_id, func.sum(DailySteps.steps)).filter(DailySteps.user_id.in_(user_ids))
    if started_at:
        step_query = step_query.filter(DailySteps.date >= started_at)
    if ended_at:
        step_query = step_query.filter(DailySteps.date <= ended_at)
    step_rows = step_query.group_by(DailySteps.user_id).all()

    resolved_at_expr = func.coalesce(Challenge.resolved_at, Challenge.end_at)
    win_query = (
        db.query(Challenge.winner_id, func.count(Challenge.id))
        .filter(
            Challenge.winner_id.in_(user_ids),
            Challenge.challenge_type == "pvp",
            Challenge.status == "resolved",
        )
    )
    if started_at:
        win_query = win_query.filter(resolved_at_expr >= started_at)
    if ended_at:
        win_query = win_query.filter(resolved_at_expr <= ended_at)
    win_rows = win_query.group_by(Challenge.winner_id).all()

    stats_map = {user_id: {"level": 1, "quests_completed": 0, "steps": 0, "challenge_wins": 0} for user_id in user_ids}
    for user_id, value in level_rows:
        stats_map[user_id]["level"] = int(value or 1)
    for user_id, value in quest_rows:
        stats_map[user_id]["quests_completed"] = int(value or 0)
    for user_id, value in step_rows:
        stats_map[user_id]["steps"] = int(value or 0)
    for user_id, value in win_rows:
        stats_map[user_id]["challenge_wins"] = int(value or 0)
    return stats_map


def _pagination_meta(page: int, page_size: int, total: int) -> dict:
    return {
        "page": page,
        "page_size": page_size,
        "total_items": total,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def _paginate(items: list, page: int, page_size: int) -> dict:
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "pagination": _pagination_meta(page, page_size, total),
    }


def _is_friend(db: Session, user_id: int, other_user_id: int) -> bool:
    return (
        db.query(Friendship)
        .filter(Friendship.user_id == user_id, Friendship.friend_id == other_user_id)
        .first()
        is not None
    )


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Игрок не найден")
    return user


def _activity_progress(db: Session, user_id: int, objective_type: str, start_at: datetime, end_at: datetime) -> int:
    if objective_type == "steps":
        return (
            db.query(func.sum(DailySteps.steps))
            .filter(DailySteps.user_id == user_id, DailySteps.date >= start_at, DailySteps.date <= end_at)
            .scalar()
            or 0
        )
    if objective_type == "workouts":
        return (
            db.query(CompletedQuest)
            .filter(
                CompletedQuest.user_id == user_id,
                CompletedQuest.completed_at >= start_at,
                CompletedQuest.completed_at <= end_at,
            )
            .count()
        )
    return (
        db.query(CompletedQuest)
        .filter(
            CompletedQuest.user_id == user_id,
            CompletedQuest.completed_at >= start_at,
            CompletedQuest.completed_at <= end_at,
        )
        .count()
    )


def _friend_ids(db: Session, user_id: int) -> list[int]:
    rows = db.query(Friendship.friend_id).filter(Friendship.user_id == user_id).all()
    return [friend_id for (friend_id,) in rows]


def _public_search_name(user: User) -> str:
    if user.name and user.name.strip():
        return user.name.strip()
    return f"Игрок #{user.id}"


def _leaderboard_period_payload(db: Session, period: str) -> dict:
    if period not in LEADERBOARD_PERIODS:
        raise HTTPException(status_code=400, detail="Unsupported leaderboard period")

    now = utc_now()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "weekly":
        started_at = day_start - timedelta(days=6)
        return {
            "period": period,
            "started_at": started_at,
            "stats_end_at": now,
            "display_ends_at": now,
            "event_id": None,
            "season_key": None,
        }

    if period == "season":
        active_event = (
            db.query(GameEvent)
            .filter(GameEvent.status == "active", GameEvent.event_type == "season")
            .order_by(GameEvent.end_at.asc())
            .first()
        )
        if active_event:
            return {
                "period": period,
                "started_at": active_event.start_at or (day_start - timedelta(days=29)),
                "stats_end_at": now,
                "display_ends_at": active_event.end_at or now,
                "event_id": active_event.id,
                "season_key": active_event.season_key,
            }
        started_at = day_start - timedelta(days=29)
        return {
            "period": period,
            "started_at": started_at,
            "stats_end_at": now,
            "display_ends_at": now,
            "event_id": None,
            "season_key": None,
        }

    return {
        "period": period,
        "started_at": None,
        "stats_end_at": None,
        "display_ends_at": now,
        "event_id": None,
        "season_key": None,
    }


def send_friend_request(db: Session, current_user: User, receiver_id: int) -> dict:
    if receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя добавить себя в друзья")
    receiver = _get_user_or_404(db, receiver_id)

    if len(_friend_ids(db, current_user.id)) >= MAX_FRIENDS:
        raise HTTPException(status_code=400, detail=f"Максимум {MAX_FRIENDS} друзей")

    if _is_friend(db, current_user.id, receiver.id):
        raise HTTPException(status_code=400, detail="Игрок уже в друзьях")

    existing = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.status == "pending",
            or_(
                and_(FriendRequest.requester_id == current_user.id, FriendRequest.receiver_id == receiver.id),
                and_(FriendRequest.requester_id == receiver.id, FriendRequest.receiver_id == current_user.id),
            ),
        )
        .first()
    )
    if existing and existing.status == "pending":
        raise HTTPException(status_code=400, detail="Запрос в друзья уже существует")

    request = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.requester_id == current_user.id,
            FriendRequest.receiver_id == receiver.id,
        )
        .first()
    )
    if request:
        # Re-open the archived request instead of creating a duplicate pair row.
        request.status = "pending"
        request.created_at = utc_now()
        request.responded_at = None
    else:
        request = FriendRequest(requester_id=current_user.id, receiver_id=receiver.id, status="pending")
        db.add(request)
    db.commit()
    db.refresh(request)
    try:
        notification_service.notify_friend_invitation(
            db,
            receiver_id=receiver.id,
            sender=current_user,
            request_id=request.id,
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to queue friend invitation notification: request_id=%s", request.id)
    return {
        "ok": True,
        "request": {
            "id": request.id,
            "status": request.status,
            "receiver": {
                "id": receiver.id,
                "name": receiver.name or receiver.email,
                "username": receiver.username,
                "friend_id": crud.user_friend_id(receiver),
            },
            "created_at": request.created_at.isoformat(),
        },
    }


def respond_friend_request(db: Session, current_user: User, request_id: int, action: str) -> dict:
    request = (
        db.query(FriendRequest)
        .options(joinedload(FriendRequest.requester), joinedload(FriendRequest.receiver))
        .filter(FriendRequest.id == request_id, FriendRequest.receiver_id == current_user.id)
        .first()
    )
    if not request or request.status != "pending":
        raise HTTPException(status_code=404, detail="Запрос не найден")

    request.status = "accepted" if action == "accept" else "declined"
    request.responded_at = utc_now()

    if action == "accept":
        if len(_friend_ids(db, request.requester_id)) >= MAX_FRIENDS:
            raise HTTPException(status_code=400, detail=f"У отправителя максимум {MAX_FRIENDS} друзей")
        if len(_friend_ids(db, request.receiver_id)) >= MAX_FRIENDS:
            raise HTTPException(status_code=400, detail=f"У вас максимум {MAX_FRIENDS} друзей")

        pair = {(request.requester_id, request.receiver_id), (request.receiver_id, request.requester_id)}
        existing_pairs = {
            (row.user_id, row.friend_id)
            for row in db.query(Friendship)
            .filter(
                Friendship.user_id.in_([request.requester_id, request.receiver_id]),
                Friendship.friend_id.in_([request.requester_id, request.receiver_id]),
            )
            .all()
        }
        for user_id, friend_id in pair:
            if (user_id, friend_id) not in existing_pairs:
                db.add(Friendship(user_id=user_id, friend_id=friend_id))

    db.commit()
    if action == "accept":
        invalidate_leaderboard_cache()
    return {"ok": True, "request_id": request.id, "status": request.status}


def _serialize_friend_request(request: FriendRequest, current_user_id: int) -> dict:
    is_incoming = request.receiver_id == current_user_id
    other_user = request.requester if is_incoming else request.receiver
    return {
        "id": request.id,
        "status": request.status,
        "direction": "incoming" if is_incoming else "outgoing",
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "responded_at": request.responded_at.isoformat() if request.responded_at else None,
        "user": {
            "id": other_user.id,
            "name": other_user.name or other_user.email,
            "username": other_user.username,
            "friend_id": crud.user_friend_id(other_user),
            "email": other_user.email,
        },
    }


def list_friend_requests(db: Session, current_user: User, status: str = "pending") -> dict:
    crud.backfill_missing_usernames(db)
    rows = (
        db.query(FriendRequest)
        .options(joinedload(FriendRequest.requester), joinedload(FriendRequest.receiver))
        .filter(
            FriendRequest.status == status,
            or_(
                FriendRequest.requester_id == current_user.id,
                FriendRequest.receiver_id == current_user.id,
            ),
        )
        .order_by(FriendRequest.created_at.desc())
        .all()
    )
    items = [_serialize_friend_request(row, current_user.id) for row in rows]
    return {"items": items}


def list_friends(
    db: Session,
    current_user: User,
    page: int,
    page_size: int,
    search: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
) -> dict:
    crud.backfill_missing_usernames(db)
    query = (
        db.query(Friendship)
        .options(joinedload(Friendship.friend))
        .filter(Friendship.user_id == current_user.id)
    )
    if search:
        normalized_search = normalize_username_lookup(search)
        public_user_id = parse_public_user_id(search)
        search_filters = []
        if normalized_search:
            search_filters.append(func.lower(func.coalesce(User.username, "")).like(f"%{normalized_search}%"))
        if public_user_id:
            search_filters.append(User.id == public_user_id)
        if search_filters:
            query = query.join(Friendship.friend).filter(or_(*search_filters))

    rows = query.all()
    friend_ids = [row.friend_id for row in rows]
    stats_map = _cached_user_stats_map(db, friend_ids)

    items = []
    for row in rows:
        friend = row.friend
        stats = stats_map.get(friend.id, {})
        items.append(
            {
                "id": friend.id,
                "name": friend.name or friend.email,
                "username": friend.username,
                "friend_id": crud.user_friend_id(friend),
                "email": friend.email,
                "stats": stats,
                "friends_since": row.created_at.isoformat(),
            }
        )

    reverse = sort_order == "desc"
    if sort_by in {"name", "created_at"}:
        key = (lambda item: item["name"].lower()) if sort_by == "name" else (lambda item: item["friends_since"])
        items.sort(key=key, reverse=reverse)
    elif sort_by in {"level", "quests_completed", "steps", "challenge_wins"}:
        items.sort(key=lambda item: item["stats"].get(sort_by, 0), reverse=reverse)

    return _paginate(items, page, page_size)


def search_users(db: Session, current_user: User, query: str, page: int, page_size: int) -> dict:
    crud.backfill_missing_usernames(db)
    normalized_query = normalize_username_lookup(query)
    raw_query = query.lower().strip().lstrip("@")
    public_user_id = parse_public_user_id(query)
    search_filters = []
    if normalized_query:
        search_filters.append(func.lower(func.coalesce(User.username, "")).like(f"%{normalized_query}%"))
    if public_user_id:
        search_filters.append(User.id == public_user_id)
    if not search_filters:
        return _paginate([], page, page_size)
    rows = (
        db.query(User)
        .filter(
            User.is_active == True,
            User.id != current_user.id,
            or_(*search_filters),
        )
        .all()
    )

    friend_ids = set(_friend_ids(db, current_user.id))
    outgoing_pending_requests = {
        req.receiver_id: req for req in db.query(FriendRequest)
        .filter(
            FriendRequest.requester_id == current_user.id,
            FriendRequest.status == "pending",
        )
        .all()
    }
    incoming_pending_requests = {
        req.requester_id: req for req in db.query(FriendRequest)
        .filter(
            FriendRequest.receiver_id == current_user.id,
            FriendRequest.status == "pending",
        )
        .all()
    }

    items = []
    for user in rows:
        if user.id in friend_ids:
            continue  # Already friends
        public_name = _public_search_name(user)
        username_value = (user.username or "").lower()
        friend_id = crud.user_friend_id(user)
        username_match = username_value.find(normalized_query) if normalized_query else -1
        friend_id_match = (friend_id or "").lower().find(raw_query) if raw_query else -1
        if public_user_id and user.id == public_user_id:
            match_rank = -1
        elif normalized_query and username_value == normalized_query:
            match_rank = 0
        elif username_match == 0:
            match_rank = 1
        elif username_match >= 0:
            match_rank = 2
        elif friend_id_match >= 0:
            match_rank = 3
        else:
            match_rank = 20_000
        status = "none"
        request_id = None
        if user.id in outgoing_pending_requests:
            status = "outgoing_pending"
            request_id = outgoing_pending_requests[user.id].id
        elif user.id in incoming_pending_requests:
            status = "incoming_pending"
            request_id = incoming_pending_requests[user.id].id

        items.append({
            "id": user.id,
            "name": public_name,
            "username": user.username,
            "friend_id": friend_id,
            "status": status,
            "request_id": request_id,
            "_match_rank": match_rank,
        })

    items.sort(key=lambda item: (item["_match_rank"], item["name"].lower()))
    for item in items:
        item.pop("_match_rank", None)

    return _paginate(items, page, page_size)


def create_pvp_challenge(db: Session, current_user: User, payload) -> dict:
    if payload.objective_type not in SUPPORTED_OBJECTIVES:
        raise HTTPException(status_code=400, detail="Неподдерживаемый тип активности")
    opponent = _get_user_or_404(db, payload.opponent_id)
    if opponent.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя вызвать самого себя")
    if not _is_friend(db, current_user.id, opponent.id):
        raise HTTPException(status_code=400, detail="PvP доступен только между друзьями")

    challenge = Challenge(
        creator_id=current_user.id,
        opponent_id=opponent.id,
        title=payload.title or f"PvP: {payload.objective_type}",
        description=payload.description,
        challenge_type="pvp",
        objective_type=payload.objective_type,
        target_value=payload.goal,
        reward_xp=payload.reward_xp,
        reward_crystals=payload.reward_crystals,
        status="pending",
        start_at=utc_now(),
        end_at=utc_now() + timedelta(hours=payload.duration_hours),
    )
    db.add(challenge)
    db.flush()
    db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=current_user.id, is_creator=True))
    db.commit()
    db.refresh(challenge)
    return {"ok": True, "challenge": _serialize_challenge(challenge, current_user.id)}


def respond_pvp_challenge(db: Session, current_user: User, challenge_id: int, action: str) -> dict:
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.creator), joinedload(Challenge.opponent), selectinload(Challenge.participants))
        .filter(Challenge.id == challenge_id, Challenge.challenge_type == "pvp", Challenge.opponent_id == current_user.id)
        .first()
    )
    if not challenge or challenge.status != "pending":
        raise HTTPException(status_code=404, detail="Челлендж не найден")

    challenge.responded_at = utc_now()
    if action == "accept":
        challenge.status = "active"
        challenge.accepted_at = challenge.responded_at
        challenge.start_at = challenge.responded_at
        exists = any(participant.user_id == current_user.id for participant in challenge.participants)
        if not exists:
            db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=current_user.id, is_creator=False))
    else:
        challenge.status = "declined"

    db.commit()
    db.refresh(challenge)
    return {"ok": True, "challenge": _serialize_challenge(challenge, current_user.id)}


def _serialize_challenge(challenge: Challenge, current_user_id: int | None = None) -> dict:
    creator_name = challenge.creator.name or challenge.creator.email if challenge.creator else None
    opponent_name = challenge.opponent.name or challenge.opponent.email if challenge.opponent else None
    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "challenge_type": challenge.challenge_type,
        "activity_type": challenge.objective_type,
        "goal": challenge.target_value,
        "reward": {"xp": challenge.reward_xp, "crystals": challenge.reward_crystals},
        "status": challenge.status,
        "start_time": challenge.start_at.isoformat() if challenge.start_at else None,
        "end_time": challenge.end_at.isoformat() if challenge.end_at else None,
        "creator": {"id": challenge.creator_id, "name": creator_name},
        "opponent": {"id": challenge.opponent_id, "name": opponent_name} if challenge.opponent_id else None,
        "winner_id": challenge.winner_id,
        "role": (
            "creator"
            if current_user_id and challenge.creator_id == current_user_id
            else "opponent"
            if current_user_id and challenge.opponent_id == current_user_id
            else "spectator"
        ),
    }


def list_pvp_challenges(
    db: Session,
    current_user: User,
    page: int,
    page_size: int,
    status: str | None = None,
    activity_type: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> dict:
    query = (
        db.query(Challenge)
        .options(joinedload(Challenge.creator), joinedload(Challenge.opponent), joinedload(Challenge.winner))
        .filter(
            Challenge.challenge_type == "pvp",
            or_(Challenge.creator_id == current_user.id, Challenge.opponent_id == current_user.id),
        )
    )
    if status:
        query = query.filter(Challenge.status == status)
    if activity_type:
        query = query.filter(Challenge.objective_type == activity_type)

    sort_map = {
        "created_at": Challenge.created_at,
        "end_time": Challenge.end_at,
        "start_time": Challenge.start_at,
        "goal": Challenge.target_value,
    }
    sort_column = sort_map.get(sort_by, Challenge.created_at)
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [_serialize_challenge(challenge, current_user.id) for challenge in rows]
    return {"items": items, "pagination": _pagination_meta(page, page_size, total)}


def get_pvp_result(db: Session, current_user: User, challenge_id: int) -> dict:
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.creator), joinedload(Challenge.opponent), joinedload(Challenge.winner), selectinload(Challenge.participants))
        .filter(
            Challenge.id == challenge_id,
            Challenge.challenge_type == "pvp",
            or_(Challenge.creator_id == current_user.id, Challenge.opponent_id == current_user.id),
        )
        .first()
    )
    if not challenge:
        raise HTTPException(status_code=404, detail="Челлендж не найден")

    scores = {participant.user_id: participant.result_value for participant in challenge.participants}
    return {
        "ok": True,
        "challenge": _serialize_challenge(challenge, current_user.id),
        "result": {
            "status": challenge.status,
            "winner_id": challenge.winner_id,
            "is_draw": challenge.status == "resolved" and not challenge.winner_id,
            "scores": scores,
            "resolved_at": challenge.resolved_at.isoformat() if challenge.resolved_at else None,
        },
    }


def _reward_user(db: Session, user_id: int, xp: int, crystals: int):
    progress = (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )
    if progress:
        progress.current_xp += xp
        progress.crystals += crystals


def resolve_pvp_challenges(db: Session) -> list[int]:
    now = utc_now()
    pending = (
        db.query(Challenge)
        .filter(Challenge.challenge_type == "pvp", Challenge.status == "pending", Challenge.end_at <= now)
        .all()
    )
    for challenge in pending:
        challenge.status = "expired"
        challenge.resolved_at = now
        challenge.responded_at = now

    due = (
        db.query(Challenge)
        .options(selectinload(Challenge.participants))
        .filter(Challenge.challenge_type == "pvp", Challenge.status == "active", Challenge.end_at <= now)
        .all()
    )
    resolved_ids = []
    for challenge in due:
        participant_ids = {participant.user_id for participant in challenge.participants}
        participant_ids.update([challenge.creator_id, challenge.opponent_id])
        scores = {
            user_id: _activity_progress(db, user_id, challenge.objective_type, challenge.start_at, challenge.end_at)
            for user_id in participant_ids
            if user_id
        }

        for participant in challenge.participants:
            participant.result_value = scores.get(participant.user_id, 0)

        winner_id = None
        if scores:
            max_score = max(scores.values())
            top_users = [user_id for user_id, score in scores.items() if score == max_score]
            if len(top_users) == 1:
                winner_id = top_users[0]
                _reward_user(db, winner_id, challenge.reward_xp, challenge.reward_crystals)

        challenge.winner_id = winner_id
        challenge.status = "resolved"
        challenge.resolved_at = now
        resolved_ids.append(challenge.id)

    if pending or resolved_ids:
        db.commit()
        invalidate_leaderboard_cache()
        for challenge_id in resolved_ids:
            try:
                notification_service.notify_challenge_completed(db, challenge_id=challenge_id)
            except Exception:
                db.rollback()
                logger.exception("Failed to queue PvP challenge notification: challenge_id=%s", challenge_id)
    return resolved_ids


def _serialize_coop_quest(coop_quest: CoopQuest, current_user_id: int | None = None) -> dict:
    participants = sorted(
        coop_quest.participants,
        key=lambda participant: (participant.contribution or 0, participant.user_id == current_user_id),
        reverse=True,
    )
    return {
        "id": coop_quest.id,
        "title": coop_quest.title,
        "description": coop_quest.description,
        "objective_type": coop_quest.objective_type,
        "goal": coop_quest.goal,
        "progress": coop_quest.progress,
        "reward": {"xp": coop_quest.reward_xp, "crystals": coop_quest.reward_crystals},
        "status": coop_quest.status,
        "participants": [
            {
                "user_id": participant.user_id,
                "name": participant.user.name or participant.user.email,
                "contribution": participant.contribution,
                "is_current_user": participant.user_id == current_user_id,
            }
            for participant in participants
        ],
        "start_time": coop_quest.start_at.isoformat(),
        "end_time": coop_quest.end_at.isoformat(),
    }


def create_coop_quest(db: Session, current_user: User, payload) -> dict:
    if payload.objective_type not in SUPPORTED_OBJECTIVES:
        raise HTTPException(status_code=400, detail="Неподдерживаемый тип активности")

    participant_ids = {current_user.id}
    for participant_id in payload.participant_ids:
        if participant_id != current_user.id:
            if not _is_friend(db, current_user.id, participant_id):
                raise HTTPException(status_code=400, detail="В coop можно приглашать только друзей")
            _get_user_or_404(db, participant_id)
            participant_ids.add(participant_id)

    bonus_participants = max(len(participant_ids) - 1, 0)
    reward_multiplier = min(1.0 + (0.15 * bonus_participants), 1.45)
    reward_xp = max(int(round(payload.reward_xp * reward_multiplier)), payload.reward_xp)
    reward_crystals = max(int(round(payload.reward_crystals * reward_multiplier)), payload.reward_crystals)

    coop_quest = CoopQuest(
        title=payload.title,
        description=payload.description,
        objective_type=payload.objective_type,
        goal=payload.goal,
        reward_xp=reward_xp,
        reward_crystals=reward_crystals,
        created_by=current_user.id,
        end_at=utc_now() + timedelta(hours=payload.duration_hours),
    )
    db.add(coop_quest)
    db.flush()

    for participant_id in participant_ids:
        db.add(CoopQuestParticipant(coop_quest_id=coop_quest.id, user_id=participant_id))

    db.commit()
    db.refresh(coop_quest)
    coop_quest = (
        db.query(CoopQuest)
        .options(selectinload(CoopQuest.participants).joinedload(CoopQuestParticipant.user))
        .filter(CoopQuest.id == coop_quest.id)
        .first()
    )
    return {"ok": True, "coop_quest": _serialize_coop_quest(coop_quest, current_user.id)}


def _refresh_coop_progress(db: Session, coop_quest: CoopQuest):
    if coop_quest.status not in {"active", "scheduled"}:
        return
    if coop_quest.status == "scheduled" and coop_quest.start_at <= utc_now():
        coop_quest.status = "active"
    total = 0
    for participant in coop_quest.participants:
        contribution = _activity_progress(
            db,
            participant.user_id,
            coop_quest.objective_type,
            coop_quest.start_at,
            min(coop_quest.end_at, utc_now()),
        )
        participant.contribution = contribution
        total += contribution
    coop_quest.progress = total

    now = utc_now()
    if total >= coop_quest.goal and coop_quest.status != "completed":
        coop_quest.status = "completed"
        coop_quest.completed_at = now
        for participant in coop_quest.participants:
            _reward_user(db, participant.user_id, coop_quest.reward_xp, coop_quest.reward_crystals)
    elif coop_quest.end_at <= now and coop_quest.status == "active":
        coop_quest.status = "failed"


def list_coop_quests(
    db: Session,
    current_user: User,
    page: int,
    page_size: int,
    status: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> dict:
    query = (
        db.query(CoopQuest)
        .options(selectinload(CoopQuest.participants).joinedload(CoopQuestParticipant.user))
        .join(CoopQuestParticipant, CoopQuestParticipant.coop_quest_id == CoopQuest.id)
        .filter(CoopQuestParticipant.user_id == current_user.id)
    )
    if status:
        query = query.filter(CoopQuest.status == status)

    sort_map = {
        "created_at": CoopQuest.created_at,
        "end_time": CoopQuest.end_at,
        "progress": CoopQuest.progress,
        "goal": CoopQuest.goal,
    }
    sort_column = sort_map.get(sort_by, CoopQuest.created_at)
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    for row in rows:
        _refresh_coop_progress(db, row)
    db.commit()
    items = [_serialize_coop_quest(row, current_user.id) for row in rows]
    return {"items": items, "pagination": _pagination_meta(page, page_size, total)}


def create_event(db: Session, payload) -> dict:
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="Дата окончания должна быть позже даты начала")
    event = GameEvent(
        event_type=payload.event_type,
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        payload_json=payload.payload_json,
        season_key=payload.season_key,
        start_at=payload.start_at,
        end_at=payload.end_at,
        status="scheduled",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"ok": True, "event": _serialize_event(event)}


def _serialize_event(event: GameEvent) -> dict:
    try:
        payload = json.loads(event.payload_json or "{}")
    except json.JSONDecodeError:
        payload = {"raw": event.payload_json}
    return {
        "id": event.id,
        "event_type": event.event_type,
        "slug": event.slug,
        "title": event.title,
        "description": event.description,
        "payload": payload,
        "status": event.status,
        "season_key": event.season_key,
        "start_time": event.start_at.isoformat(),
        "end_time": event.end_at.isoformat(),
    }


def list_events(
    db: Session,
    page: int,
    page_size: int,
    event_type: str | None = None,
    status: str | None = None,
    sort_by: str = "start_at",
    sort_order: str = "asc",
) -> dict:
    query = db.query(GameEvent)
    if event_type:
        query = query.filter(GameEvent.event_type == event_type)
    if status:
        query = query.filter(GameEvent.status == status)

    sort_map = {"start_at": GameEvent.start_at, "end_at": GameEvent.end_at, "created_at": GameEvent.created_at}
    sort_column = sort_map.get(sort_by, GameEvent.start_at)
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [_serialize_event(event) for event in rows]
    return {"items": items, "pagination": _pagination_meta(page, page_size, total)}


def sync_game_events(db: Session) -> list[int]:
    now = utc_now()
    scheduled = db.query(GameEvent).filter(GameEvent.status == "scheduled", GameEvent.start_at <= now).all()
    completed = db.query(GameEvent).filter(GameEvent.status == "active", GameEvent.end_at <= now).all()

    changed_ids = []
    for event in scheduled:
        event.status = "active"
        changed_ids.append(event.id)
    for event in completed:
        event.status = "completed"
        changed_ids.append(event.id)
    if changed_ids:
        db.commit()
    return changed_ids


def resolve_coop_quests(db: Session) -> list[int]:
    quests = (
        db.query(CoopQuest)
        .options(selectinload(CoopQuest.participants))
        .filter(CoopQuest.status.in_(["active", "scheduled"]))
        .all()
    )
    changed_ids = []
    for coop_quest in quests:
        before_status = coop_quest.status
        _refresh_coop_progress(db, coop_quest)
        if coop_quest.status != before_status or coop_quest.progress:
            changed_ids.append(coop_quest.id)
    if changed_ids:
        db.commit()
        invalidate_leaderboard_cache()
    return changed_ids


def _build_leaderboard_items(db: Session, user_ids: list[int], metric: str, period: str) -> dict:
    period_payload = _leaderboard_period_payload(db, period)
    if not user_ids:
        return {
            "items": [],
            "period": period_payload["period"],
            "period_started_at": period_payload["started_at"].isoformat() if period_payload["started_at"] else None,
            "period_ends_at": period_payload["display_ends_at"].isoformat() if period_payload["display_ends_at"] else None,
            "event_id": period_payload["event_id"],
            "season_key": period_payload["season_key"],
        }
    crud.backfill_missing_usernames(db)

    # Load base users
    users = db.query(User).filter(User.id.in_(user_ids)).all()

    # Load stats and character/class info
    stats_map = _cached_user_stats_map(
        db,
        user_ids,
        started_at=period_payload["started_at"],
        ended_at=period_payload["stats_end_at"],
    )

    # Determine each user's main class (highest level unlocked)
    class_rows = (
        db.query(
            UserClassProgress.user_id,
            UserClassProgress.class_name,
            UserClassProgress.display_name,
            UserClassProgress.level,
        )
        .filter(UserClassProgress.user_id.in_(user_ids), UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.user_id, UserClassProgress.level.desc())
        .all()
    )
    class_map: dict[int, dict] = {}
    for row in class_rows:
        if row.user_id not in class_map:
            class_map[row.user_id] = {
                "class_name": row.class_name,
                "class_display_name": row.display_name,
                "class_level": row.level,
            }

    items = []
    for user in users:
        stats = stats_map.get(user.id, {})
        character = class_map.get(user.id, {})

        items.append(
            {
                "user_id": user.id,
                "name": _public_search_name(user),
                "username": user.username,
                "friend_id": crud.user_friend_id(user),
                "level": stats.get("level", 1),
                "quests_completed": stats.get("quests_completed", 0),
                "steps": stats.get("steps", 0),
                "challenge_wins": stats.get("challenge_wins", 0),
                "class_name": character.get("class_name"),
                "class_display_name": character.get("class_display_name"),
                "class_level": character.get("class_level"),
                "goal_type": getattr(user, "selected_goal_type", None),
                "goal_progress_percent": getattr(user, "goal_progress_percent", 0),
                "goal_cycle_xp": getattr(user, "goal_cycle_xp", 0),
                "goal_target_xp": getattr(user, "goal_target_xp", 0),
                "score": stats.get(
                    {
                        "level": "level",
                        "quests": "quests_completed",
                        "steps": "steps",
                        "challenge_wins": "challenge_wins",
                    }[metric],
                    0,
                ),
            }
        )

    items.sort(key=lambda item: (item["score"], item["level"], item["quests_completed"]), reverse=True)
    for index, item in enumerate(items, start=1):
        item["rank"] = index
    return {
        "items": items,
        "period": period_payload["period"],
        "period_started_at": period_payload["started_at"].isoformat() if period_payload["started_at"] else None,
        "period_ends_at": period_payload["display_ends_at"].isoformat() if period_payload["display_ends_at"] else None,
        "event_id": period_payload["event_id"],
        "season_key": period_payload["season_key"],
    }


def get_global_leaderboard(db: Session, metric: str, page: int, page_size: int, period: str = "all_time") -> dict:
    if metric not in LEADERBOARD_METRICS:
        raise HTTPException(status_code=400, detail="Неподдерживаемый рейтинг")
    if period not in LEADERBOARD_PERIODS:
        raise HTTPException(status_code=400, detail="Unsupported leaderboard period")
    user_ids = [user_id for (user_id,) in db.query(User.id).filter(User.is_active == True).all()]
    payload = _build_leaderboard_items(db, user_ids, metric, period)
    return {
        "metric": metric,
        "period": payload["period"],
        "period_started_at": payload["period_started_at"],
        "period_ends_at": payload["period_ends_at"],
        "event_id": payload["event_id"],
        "season_key": payload["season_key"],
        **_paginate(payload["items"], page, page_size),
    }


def get_friends_leaderboard(
    db: Session,
    current_user: User,
    metric: str,
    page: int,
    page_size: int,
    period: str = "all_time",
) -> dict:
    if metric not in LEADERBOARD_METRICS:
        raise HTTPException(status_code=400, detail="Неподдерживаемый рейтинг")
    if period not in LEADERBOARD_PERIODS:
        raise HTTPException(status_code=400, detail="Unsupported leaderboard period")
    user_ids = list({_id for _id in _friend_ids(db, current_user.id) + [current_user.id]})
    payload = _build_leaderboard_items(db, user_ids, metric, period)
    return {
        "metric": metric,
        "period": payload["period"],
        "period_started_at": payload["period_started_at"],
        "period_ends_at": payload["period_ends_at"],
        "event_id": payload["event_id"],
        "season_key": payload["season_key"],
        **_paginate(payload["items"], page, page_size),
    }


def send_challenge_invitation(
    db: Session,
    sender: User,
    receiver_id: int,
    challenge_type: str,
    title: str,
    description: str,
    objective_type: str,
    goal: int,
    reward_xp: int = 0,
    reward_crystals: int = 0,
) -> ChallengeInvitation:
    if objective_type not in SUPPORTED_OBJECTIVES:
        raise HTTPException(status_code=400, detail="Неподдерживаемый тип цели")
    if challenge_type not in {"pvp", "coop"}:
        raise HTTPException(status_code=400, detail="Неподдерживаемый тип челенджа")

    # Check if receiver is a friend
    if receiver_id not in _friend_ids(db, sender.id):
        raise HTTPException(status_code=400, detail="Можно приглашать только друзей")

    # Check for existing pending invitation
    existing = db.query(ChallengeInvitation).filter(
        ChallengeInvitation.sender_id == sender.id,
        ChallengeInvitation.receiver_id == receiver_id,
        ChallengeInvitation.challenge_type == challenge_type,
    ).first()
    if existing and existing.status != "pending":
        existing.title = title
        existing.description = description
        existing.objective_type = objective_type
        existing.goal = goal
        existing.reward_xp = reward_xp
        existing.reward_crystals = reward_crystals
        existing.status = "pending"
        existing.created_at = utc_now()
        existing.responded_at = None
        db.commit()
        db.refresh(existing)
        notification_service.create_notification(
            db,
            receiver_id,
            "challenge_invitation",
            f"{sender.name} РїСЂРёРіР»Р°С€Р°РµС‚ РІР°СЃ РЅР° С‡РµР»РµРЅРґР¶: {title}",
            {"invitation_id": existing.id, "sender_name": sender.name},
        )
        return existing
    if existing:
        raise HTTPException(status_code=400, detail="Приглашение уже отправлено")

    invitation = ChallengeInvitation(
        sender_id=sender.id,
        receiver_id=receiver_id,
        challenge_type=challenge_type,
        title=title,
        description=description,
        objective_type=objective_type,
        goal=goal,
        reward_xp=reward_xp,
        reward_crystals=reward_crystals,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # Send notification
    notification_service.create_notification(
        db,
        receiver_id,
        "challenge_invitation",
        f"{sender.name} приглашает вас на челендж: {title}",
        {"invitation_id": invitation.id, "sender_name": sender.name},
    )

    return invitation


def respond_challenge_invitation(
    db: Session, user: User, invitation_id: int, action: str
) -> dict:
    if action not in {"accept", "decline"}:
        raise HTTPException(status_code=400, detail="Неверное действие")

    invitation = db.query(ChallengeInvitation).filter(
        ChallengeInvitation.id == invitation_id,
        ChallengeInvitation.receiver_id == user.id,
        ChallengeInvitation.status == "pending",
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")

    invitation.status = "accepted" if action == "accept" else "declined"
    invitation.responded_at = utc_now()
    db.commit()

    if action == "accept":
        # Create actual challenge
        if invitation.challenge_type == "pvp":
            challenge = Challenge(
                creator_id=invitation.sender_id,
                opponent_id=user.id,
                title=invitation.title,
                description=invitation.description,
                challenge_type="pvp",
                objective_type=invitation.objective_type,
                target_value=invitation.goal,
                reward_xp=invitation.reward_xp,
                reward_crystals=invitation.reward_crystals,
                status="active",
                end_at=utc_now() + timedelta(days=7),  # 7 days default
            )
            db.add(challenge)
            db.flush()  # Get ID

            # Add participants
            db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=invitation.sender_id, is_creator=True))
            db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=user.id, is_creator=False))
            db.commit()
            return {"message": "Челендж принят", "challenge_id": challenge.id}
        elif invitation.challenge_type == "coop":
            # Create coop quest
            coop_quest = CoopQuest(
                title=invitation.title,
                description=invitation.description,
                objective_type=invitation.objective_type,
                goal=invitation.goal,
                reward_xp=invitation.reward_xp,
                reward_crystals=invitation.reward_crystals,
                created_by=invitation.sender_id,
                end_at=utc_now() + timedelta(days=7),
            )
            db.add(coop_quest)
            db.flush()  # Get ID

            # Add participants
            db.add(CoopQuestParticipant(coop_quest_id=coop_quest.id, user_id=invitation.sender_id))
            db.add(CoopQuestParticipant(coop_quest_id=coop_quest.id, user_id=user.id))
            db.commit()
            return {"message": "Совместный квест создан", "coop_quest_id": coop_quest.id}

    return {"message": "Приглашение отклонено"}


def list_challenge_invitations(db: Session, user: User, status: str | None = None) -> list[ChallengeInvitation]:
    query = db.query(ChallengeInvitation).filter(ChallengeInvitation.receiver_id == user.id)
    if status:
        query = query.filter(ChallengeInvitation.status == status)
    return query.order_by(ChallengeInvitation.created_at.desc()).all()
