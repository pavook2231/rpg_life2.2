from __future__ import annotations

import logging
import random
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.beta_content import BETA_ITEMS, CHEST_CATALOG, beta_boss_catalog
from app.chest_items import build_chest_grant_payload, grant_chest_to_user
from app.core.dates import utc_now
from app.item_service import sync_catalog_items
from app.models import (
    Boss,
    Challenge,
    ChallengeParticipant,
    Chest,
    Friendship,
    Item,
    User,
    UserBoss,
    UserClassProgress,
    UserInventory,
    UserItem,
)
from app.stat_effects import StatEffects
from . import inventory_service, notification_service

logger = logging.getLogger(__name__)

CHEST_RARITY_WEIGHTS: dict[str, list[tuple[str, float]]] = {
    "COMMON_CHEST": [
        ("common", 72.0),
        ("uncommon", 22.0),
        ("rare", 5.0),
        ("epic", 1.0),
        ("legendary", 0.0),
    ],
    "RARE_CHEST": [
        ("common", 35.0),
        ("uncommon", 38.0),
        ("rare", 20.0),
        ("epic", 6.0),
        ("legendary", 1.0),
    ],
    "EPIC_CHEST": [
        ("common", 15.0),
        ("uncommon", 34.0),
        ("rare", 30.0),
        ("epic", 16.0),
        ("legendary", 5.0),
    ],
    "LEGENDARY_CHEST": [
        ("common", 0.0),
        ("uncommon", 20.0),
        ("rare", 35.0),
        ("epic", 30.0),
        ("legendary", 15.0),
    ],
}
RARITY_FALLBACK_ORDER = ["legendary", "epic", "rare", "uncommon", "common"]
TASK_CHALLENGE_OBJECTIVE = "quests_completed"
CHALLENGE_TYPE_BETA = "beta_duel"
DEFAULT_CHALLENGE_REWARD_CHEST = "RARE_CHEST"
BETA_SLOT_LIMITS = {
    "head": 5,
    "chest": 5,
    "shoulders": 5,
    "pants": 5,
    "legs": 5,
}


def _get_main_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _serialize_item(item: Item) -> dict:
    payload = inventory_service.serialize_item_payload(item)
    payload["power"] = item.power
    return payload


def _serialize_chest(chest: Chest) -> dict:
    return {
        "id": chest.id,
        "name": chest.name,
        "rarity": chest.rarity,
        "gold_cost": chest.gold_cost,
        "created_at": chest.created_at.isoformat() if chest.created_at else None,
    }


def _serialize_boss_progress(user_boss: UserBoss) -> dict:
    boss = user_boss.boss
    return {
        "id": boss.id,
        "name": boss.name,
        "description": boss.description,
        "requirement_type": boss.requirement_type,
        "requirement_value": boss.requirement_value,
        "reward_gold": boss.reward_gold,
        "reward_chest": boss.reward_chest,
        "progress": user_boss.progress,
        "completed": user_boss.completed,
    }


def _challenge_type_to_objective(challenge_type: str) -> str:
    return "steps" if challenge_type == "steps" else TASK_CHALLENGE_OBJECTIVE


def _challenge_objective_to_type(objective_type: str) -> str:
    return "steps" if objective_type == "steps" else "tasks"


def _validate_beta_catalog_definition() -> None:
    if len(BETA_ITEMS) != 25:
        raise RuntimeError(f"Beta catalog must contain exactly 25 items, got {len(BETA_ITEMS)}")

    counts = {slot: 0 for slot in BETA_SLOT_LIMITS}
    for payload in BETA_ITEMS:
        slot = payload["slot"]
        if slot not in counts:
            raise RuntimeError(f"Unsupported beta slot: {slot}")
        counts[slot] += 1

    for slot, expected_count in BETA_SLOT_LIMITS.items():
        if counts[slot] != expected_count:
            raise RuntimeError(f"Beta catalog must contain {expected_count} items for slot '{slot}', got {counts[slot]}")


def _ensure_beta_catalog(db: Session) -> None:
    _validate_beta_catalog_definition()
    changed = False

    existing_chests = {chest.name: chest for chest in db.query(Chest).all()}
    for payload in CHEST_CATALOG:
        chest = existing_chests.get(payload["name"])
        if chest is None:
            db.add(Chest(**payload))
            changed = True
            continue
        for field in ("rarity", "gold_cost"):
            if getattr(chest, field) != payload[field]:
                setattr(chest, field, payload[field])
                changed = True

    beta_item_names = [payload["name"] for payload in BETA_ITEMS]
    existing_items = {
        item.name: item
        for item in db.query(Item).filter(Item.name.in_(beta_item_names)).all()
    }
    for payload in BETA_ITEMS:
        item = existing_items.get(payload["name"])
        if item is None:
            db.add(
                Item(
                    name=payload["name"],
                    description=payload["description"],
                    type=payload["type"],
                    subclass=payload["subclass"],
                    slot=payload["slot"],
                    rarity=payload["rarity"],
                    icon=payload["icon"],
                    power=payload["power"],
                    is_beta_item=True,
                    price_crystals=payload["price_crystals"],
                    required_level=1,
                )
            )
            changed = True
            continue
        for field in ("description", "type", "subclass", "slot", "rarity", "icon", "power", "price_crystals"):
            if getattr(item, field) != payload[field]:
                setattr(item, field, payload[field])
                changed = True
        if not item.is_beta_item:
            item.is_beta_item = True
            changed = True

    existing_bosses = {boss.name: boss for boss in db.query(Boss).all()}
    for payload in beta_boss_catalog():
        boss = existing_bosses.get(payload["name"])
        if boss is None:
            db.add(Boss(**payload))
            changed = True
            continue
        for field in ("description", "requirement_type", "requirement_value", "reward_gold", "reward_chest"):
            if getattr(boss, field) != payload[field]:
                setattr(boss, field, payload[field])
                changed = True

    if changed:
        db.commit()


def bootstrap_beta_content(db: Session) -> None:
    _ensure_beta_catalog(db)


def _draw_rarity(chest_name: str, luck_bonus: float = 0.0) -> str:
    base_weights = CHEST_RARITY_WEIGHTS.get(chest_name, CHEST_RARITY_WEIGHTS["COMMON_CHEST"])
    clamped_luck = max(0.0, min(luck_bonus, 0.55))

    adjusted: list[tuple[str, float]] = []
    for rarity, weight in base_weights:
        next_weight = float(weight)
        if rarity == "common":
            next_weight -= clamped_luck * 14
        elif rarity == "uncommon":
            next_weight -= clamped_luck * 9
        elif rarity == "rare":
            next_weight += clamped_luck * 8
        elif rarity == "epic":
            next_weight += clamped_luck * 10
        elif rarity == "legendary":
            next_weight += clamped_luck * 5
        adjusted.append((rarity, max(0.0, next_weight)))

    total = sum(weight for _, weight in adjusted)
    if total <= 0:
        adjusted = base_weights
        total = sum(weight for _, weight in adjusted)

    roll = random.uniform(0, total)
    threshold = 0.0
    for rarity, weight in adjusted:
        threshold += weight
        if roll <= threshold:
            return rarity
    return "common"


def _require_loot_item(db: Session, user_id: int, rarity: str, level: int) -> Item:
    sync_catalog_items(db)
    max_level = max(1, level + 2)
    rarity_start = RARITY_FALLBACK_ORDER.index(rarity) if rarity in RARITY_FALLBACK_ORDER else len(RARITY_FALLBACK_ORDER) - 1
    rarity_chain = RARITY_FALLBACK_ORDER[rarity_start:]

    owned_item_ids = {
        int(item_id)
        for (item_id,) in db.query(UserInventory.item_id).filter(UserInventory.user_id == user_id).all()
        if item_id is not None
    }

    for index, rarity_key in enumerate(rarity_chain):
        level_limit = 999 if index == 0 else max_level
        candidates = (
            db.query(Item)
            .filter(
                Item.rarity == rarity_key,
                Item.required_level <= level_limit,
                Item.type.in_(["weapon", "armor", "accessory"]),
                Item.is_beta_item == False,
            )
            .order_by(Item.required_level.asc(), Item.id.asc())
            .all()
        )
        random.shuffle(candidates)
        for item in candidates:
            if item.is_unique and item.id in owned_item_ids:
                continue
            return item

    fallback = (
        db.query(Item)
        .filter(Item.type.in_(["weapon", "armor", "accessory"]), Item.required_level <= max_level)
        .order_by(Item.required_level.asc(), Item.id.asc())
        .first()
    )
    if fallback is None:
        raise HTTPException(status_code=500, detail="Loot catalog is empty")
    return fallback


def _grant_item_to_user(db: Session, user_id: int, item: Item) -> None:
    db.add(UserItem(user_id=user_id, item_id=item.id, equipped=False))
    db.add(UserInventory(user_id=user_id, item_id=item.id, quantity=1, is_equipped=False))


def _grant_chest_reward(db: Session, user_id: int, chest_name: str) -> dict:
    _ensure_beta_catalog(db)
    chest = db.query(Chest).filter(Chest.name == chest_name).first()
    if chest is None:
        raise HTTPException(status_code=404, detail="Chest not found")
    inventory_item = grant_chest_to_user(db, user_id, chest_name)
    payload = build_chest_grant_payload(inventory_item, chest_name)
    return {
        "chest": _serialize_chest(chest),
        "item": _serialize_item(inventory_item.item),
        "rarity": chest.rarity,
        "inventory_id": payload["inventory_id"],
        "chest_name": chest_name,
    }


def _resolve_inventory_chest(db: Session, current_user: User, inventory_id: int) -> tuple[Chest, UserInventory]:
    inventory_item = (
        db.query(UserInventory)
        .options(joinedload(UserInventory.item))
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == current_user.id)
        .first()
    )
    if inventory_item is None or inventory_item.item is None:
        raise HTTPException(status_code=404, detail="Chest not found")
    if inventory_item.item.type != "chest":
        raise HTTPException(status_code=400, detail="Selected inventory item is not a chest")

    chest_name = inventory_item.item.subclass or inventory_item.item.name
    chest = db.query(Chest).filter(Chest.name == chest_name).first()
    if chest is None:
        raise HTTPException(status_code=404, detail="Chest not found")
    return chest, inventory_item


def open_chest(db: Session, current_user: User, payload) -> dict:
    _ensure_beta_catalog(db)

    chest = None
    inventory_item = None
    progress = _get_main_progress(db, current_user.id)
    player_level = progress.level if progress is not None else 1
    if getattr(payload, "inventory_id", None) is not None:
        chest, inventory_item = _resolve_inventory_chest(db, current_user, payload.inventory_id)
    elif payload.chest_id is not None:
        chest = db.query(Chest).filter(Chest.id == payload.chest_id).first()
    elif payload.chest_name:
        chest = db.query(Chest).filter(Chest.name == payload.chest_name).first()
    if chest is None:
        raise HTTPException(status_code=404, detail="Chest not found")

    if inventory_item is None:
        if progress is None:
            raise HTTPException(status_code=400, detail="Character not found")
        if progress.crystals < chest.gold_cost:
            raise HTTPException(status_code=400, detail="Not enough gold")
        progress.crystals -= chest.gold_cost

    reward_effects = StatEffects.build_reward_effects(db, current_user.id)
    luck_bonus = float(reward_effects.get("loot_bonus", 0.0) or 0.0)
    try:
        rarity = _draw_rarity(chest.name, luck_bonus=luck_bonus)
    except TypeError:
        try:
            rarity = _draw_rarity(chest.name)
        except TypeError:
            rarity = _draw_rarity()
    item = _require_loot_item(db, current_user.id, rarity, player_level)
    _grant_item_to_user(db, current_user.id, item)

    if inventory_item is not None:
        if (inventory_item.quantity or 1) > 1:
            inventory_item.quantity -= 1
            db.add(inventory_item)
        else:
            db.delete(inventory_item)

    db.commit()

    return {
        "item": _serialize_item(item),
        "rarity": rarity,
        "chest_name": chest.name,
        "chest_rarity": chest.rarity,
        "luck_bonus_percent": round(luck_bonus * 100, 1),
        "opened_from_inventory": inventory_item is not None,
    }


def _ensure_user_boss_rows(db: Session, user_id: int) -> list[UserBoss]:
    _ensure_beta_catalog(db)
    existing = {row.boss_id: row for row in db.query(UserBoss).filter(UserBoss.user_id == user_id).all()}
    bosses = db.query(Boss).order_by(Boss.id.asc()).all()
    created = False
    for boss in bosses:
        if boss.id not in existing:
            row = UserBoss(user_id=user_id, boss_id=boss.id, progress=0, completed=False)
            db.add(row)
            existing[boss.id] = row
            created = True
    if created:
        db.commit()
    return (
        db.query(UserBoss)
        .options(joinedload(UserBoss.boss))
        .filter(UserBoss.user_id == user_id)
        .order_by(UserBoss.boss_id.asc())
        .all()
    )


def list_bosses(db: Session, current_user: User) -> dict:
    rows = _ensure_user_boss_rows(db, current_user.id)
    return {"bosses": [_serialize_boss_progress(row) for row in rows]}


def get_current_boss(db: Session, current_user: User) -> dict:
    rows = _ensure_user_boss_rows(db, current_user.id)
    current = next((row for row in rows if not row.completed), None)
    return {"boss": _serialize_boss_progress(current) if current else None}


def _get_user_boss(db: Session, user_id: int, boss_id: int | None) -> UserBoss:
    rows = _ensure_user_boss_rows(db, user_id)
    if boss_id is None:
        current = next((row for row in rows if not row.completed), None)
        if current is None:
            raise HTTPException(status_code=404, detail="No active boss found")
        return current
    for row in rows:
        if row.boss_id == boss_id:
            return row
    raise HTTPException(status_code=404, detail="Boss not found")


def update_boss_progress(db: Session, current_user: User, payload) -> dict:
    user_boss = _get_user_boss(db, current_user.id, payload.boss_id)
    if user_boss.completed:
        raise HTTPException(status_code=400, detail="Boss already completed")

    user_boss.progress = min(user_boss.boss.requirement_value, user_boss.progress + payload.progress)
    db.commit()
    db.refresh(user_boss)
    try:
        notification_service.notify_boss_victory(
            db,
            user_id=current_user.id,
            boss_id=user_boss.boss.id,
            boss_name=user_boss.boss.name,
            reward_gold=user_boss.boss.reward_gold,
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to queue boss victory notification: user_id=%s boss_id=%s", current_user.id, user_boss.boss.id)

    return {
        "boss": _serialize_boss_progress(user_boss),
        "can_complete": user_boss.progress >= user_boss.boss.requirement_value,
    }


def complete_boss(db: Session, current_user: User, payload) -> dict:
    user_boss = _get_user_boss(db, current_user.id, payload.boss_id)
    if user_boss.completed:
        raise HTTPException(status_code=400, detail="Boss already completed")
    if user_boss.progress < user_boss.boss.requirement_value:
        raise HTTPException(status_code=400, detail="Boss requirement not met")

    progress = _get_main_progress(db, current_user.id)
    if progress is None:
        raise HTTPException(status_code=400, detail="Character not found")

    user_boss.completed = True
    user_boss.completed_at = utc_now()
    progress.crystals += user_boss.boss.reward_gold

    chest_reward = None
    if user_boss.boss.reward_chest:
        chest_reward = _grant_chest_reward(db, current_user.id, user_boss.boss.reward_chest)

    db.commit()
    db.refresh(user_boss)

    return {
        "boss": _serialize_boss_progress(user_boss),
        "reward": {
            "gold": user_boss.boss.reward_gold,
            "chest": chest_reward,
        },
    }


def _serialize_challenge(challenge: Challenge, current_user_id: int) -> dict:
    participants = {participant.user_id: participant.result_value for participant in challenge.participants}
    return {
        "id": challenge.id,
        "creator_id": challenge.creator_id,
        "opponent_id": challenge.opponent_id,
        "type": _challenge_objective_to_type(challenge.objective_type),
        "target_value": challenge.target_value,
        "start_date": challenge.start_at.isoformat() if challenge.start_at else None,
        "end_date": challenge.end_at.isoformat() if challenge.end_at else None,
        "winner_id": challenge.winner_id,
        "status": challenge.status,
        "reward": {
            "gold": challenge.reward_crystals,
            "chest": DEFAULT_CHALLENGE_REWARD_CHEST if challenge.reward_chest else None,
        },
        "progress": participants,
        "is_creator": challenge.creator_id == current_user_id,
    }


def _require_friendship(db: Session, user_id: int, friend_id: int) -> None:
    friendship = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == user_id,
            Friendship.friend_id == friend_id,
            or_(Friendship.status == "accepted", Friendship.status.is_(None)),
        )
        .first()
    )
    if friendship is None:
        raise HTTPException(status_code=400, detail="Opponent must be an accepted friend")


def create_challenge(db: Session, current_user: User, payload) -> dict:
    if payload.opponent_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot challenge yourself")
    opponent = db.query(User).filter(User.id == payload.opponent_id, User.is_active == True).first()
    if opponent is None:
        raise HTTPException(status_code=404, detail="Opponent not found")
    _require_friendship(db, current_user.id, opponent.id)

    start_date = payload.start_date or utc_now()
    if payload.end_date <= start_date:
        raise HTTPException(status_code=400, detail="end_date must be later than start_date")

    active_challenge = (
        db.query(Challenge)
        .filter(
            Challenge.challenge_type == CHALLENGE_TYPE_BETA,
            Challenge.status == "active",
            or_(
                (Challenge.creator_id == current_user.id) & (Challenge.opponent_id == opponent.id),
                (Challenge.creator_id == opponent.id) & (Challenge.opponent_id == current_user.id),
            ),
        )
        .first()
    )
    if active_challenge is not None:
        raise HTTPException(status_code=400, detail="There is already an active challenge with this friend")

    challenge = Challenge(
        creator_id=current_user.id,
        opponent_id=opponent.id,
        title=payload.title or f"Beta challenge: {payload.type}",
        description=payload.description,
        challenge_type=CHALLENGE_TYPE_BETA,
        objective_type=_challenge_type_to_objective(payload.type),
        target_value=payload.target_value,
        reward_xp=0,
        reward_crystals=payload.reward_gold,
        reward_chest=payload.reward_chest,
        status="active",
        start_at=start_date,
        end_at=payload.end_date,
    )
    db.add(challenge)
    db.flush()
    db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=current_user.id, is_creator=True, result_value=0))
    db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=opponent.id, is_creator=False, result_value=0))
    db.commit()
    db.refresh(challenge)
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.creator), joinedload(Challenge.opponent), joinedload(Challenge.winner), joinedload(Challenge.participants))
        .filter(Challenge.id == challenge.id)
        .first()
    )
    return {"challenge": _serialize_challenge(challenge, current_user.id)}


def _award_gold(db: Session, user_id: int, amount: int) -> None:
    progress = _get_main_progress(db, user_id)
    if progress is not None:
        progress.crystals += amount


def _finish_challenge_internal(db: Session, challenge: Challenge) -> dict | None:
    if challenge.status == "finished":
        return None

    participants = list(challenge.participants)
    if not participants:
        challenge.status = "finished"
        challenge.resolved_at = utc_now()
        return None

    scores = {participant.user_id: participant.result_value for participant in participants}
    max_score = max(scores.values()) if scores else 0
    leaders = [user_id for user_id, score in scores.items() if score == max_score]
    winner_id = leaders[0] if len(leaders) == 1 and max_score >= challenge.target_value else None

    if winner_id is None and utc_now() < challenge.end_at and max_score < challenge.target_value:
        raise HTTPException(status_code=400, detail="Challenge is still active")

    challenge.status = "finished"
    challenge.winner_id = winner_id
    challenge.resolved_at = utc_now()

    reward = None
    if winner_id is not None:
        _award_gold(db, winner_id, challenge.reward_crystals)
        chest_reward = None
        if challenge.reward_chest:
            chest_reward = _grant_chest_reward(db, winner_id, DEFAULT_CHALLENGE_REWARD_CHEST)
        reward = {
            "winner_id": winner_id,
            "gold": challenge.reward_crystals,
            "chest": chest_reward,
        }
    return reward


def update_challenge_progress(db: Session, current_user: User, payload) -> dict:
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.participants))
        .filter(
            Challenge.id == payload.challenge_id,
            Challenge.challenge_type == CHALLENGE_TYPE_BETA,
            Challenge.status == "active",
            or_(Challenge.creator_id == current_user.id, Challenge.opponent_id == current_user.id),
        )
        .first()
    )
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge.start_at and challenge.start_at > utc_now():
        raise HTTPException(status_code=400, detail="Challenge has not started yet")

    participant = next((entry for entry in challenge.participants if entry.user_id == current_user.id), None)
    if participant is None:
        raise HTTPException(status_code=403, detail="You are not a participant")

    participant.result_value += payload.progress
    was_finished = challenge.status == "finished"
    reward = None
    if participant.result_value >= challenge.target_value:
        reward = _finish_challenge_internal(db, challenge)

    db.commit()
    db.refresh(challenge)
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.participants))
        .filter(Challenge.id == challenge.id)
        .first()
    )
    if not was_finished and challenge.status == "finished":
        try:
            notification_service.notify_challenge_completed(db, challenge_id=challenge.id)
        except Exception:
            db.rollback()
            logger.exception("Failed to queue beta challenge notification: challenge_id=%s", challenge.id)
    return {"challenge": _serialize_challenge(challenge, current_user.id), "reward": reward}


def finish_challenge(db: Session, current_user: User, payload) -> dict:
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.participants))
        .filter(
            Challenge.id == payload.challenge_id,
            Challenge.challenge_type == CHALLENGE_TYPE_BETA,
            or_(Challenge.creator_id == current_user.id, Challenge.opponent_id == current_user.id),
        )
        .first()
    )
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    was_finished = challenge.status == "finished"
    reward = _finish_challenge_internal(db, challenge)
    db.commit()
    db.refresh(challenge)
    challenge = (
        db.query(Challenge)
        .options(joinedload(Challenge.participants))
        .filter(Challenge.id == challenge.id)
        .first()
    )
    if not was_finished and challenge.status == "finished":
        try:
            notification_service.notify_challenge_completed(db, challenge_id=challenge.id)
        except Exception:
            db.rollback()
            logger.exception("Failed to queue beta challenge notification: challenge_id=%s", challenge.id)
    return {"challenge": _serialize_challenge(challenge, current_user.id), "reward": reward}


def list_challenges(
    db: Session,
    current_user: User,
    status: str | None = None,
    challenge_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    query = (
        db.query(Challenge)
        .options(joinedload(Challenge.participants))
        .filter(
            Challenge.challenge_type == CHALLENGE_TYPE_BETA,
            or_(Challenge.creator_id == current_user.id, Challenge.opponent_id == current_user.id),
        )
        .order_by(Challenge.created_at.desc())
    )
    if status:
        query = query.filter(Challenge.status == status)
    if challenge_type in {"steps", "tasks"}:
        query = query.filter(Challenge.objective_type == _challenge_type_to_objective(challenge_type))
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [_serialize_challenge(row, current_user.id) for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
    }
