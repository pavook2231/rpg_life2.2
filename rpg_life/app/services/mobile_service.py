from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app import crud
from app.achievements import ACHIEVEMENTS
from app.core.cache import cache_get_json, cache_set_json
from app.core.dates import utc_now
from app.item_service import SET_BONUSES, calculate_set_bonus
from app.models import DailyBonus, DailySteps, Item, User, UserClassProgress, UserInventory
from app.stat_effects import StatEffects
from app.services import character_service, engagement_service, health_service, inventory_service, quest_service, social_service
from app.text_utils import normalize_item_model, normalize_nested_strings


def get_profile(db: Session, current_user: User) -> dict:
    health_context = health_service.sync_character_health(db, current_user.id)
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "birth_year": current_user.birth_year,
            "gender": current_user.gender,
            "goal_type": current_user.selected_goal_type,
            "goal_term_months": current_user.goal_term_months,
            "goal_cycle_xp": getattr(current_user, "goal_cycle_xp", 0),
            "goal_target_xp": getattr(current_user, "goal_target_xp", 0),
            "goal_progress_percent": current_user.goal_progress_percent,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "goal": quest_service.get_goal_state(db, current_user),
        "health": health_context["health"],
        "classes": [
            {
                "id": progress.id,
                "class_name": progress.class_name,
                "display_name": progress.display_name,
                "level": progress.level,
                "current_xp": progress.current_xp,
                "crystals": progress.crystals,
                "strength": progress.strength,
                "agility": progress.agility,
                "intellect": progress.intellect,
                "stamina": getattr(progress, "stamina", 0),
                "max_health": getattr(progress, "max_health", 100),
                "current_health": getattr(progress, "current_health", 100),
                "streak": progress.streak,
            }
            for progress in classes
        ],
    }


def get_character_profile(db: Session, current_user: User) -> dict:
    health_context = health_service.sync_character_health(db, current_user.id)
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    if not classes:
        return {"has_character": False}
    main_char = classes[0]
    next_level_xp = crud.calculate_next_level_xp(main_char.level)
    xp_percent = (main_char.current_xp / next_level_xp * 100) if next_level_xp > 0 else 0
    return {
        "has_character": True,
        "character": {
            "id": main_char.id,
            "name": getattr(main_char, "display_name", main_char.class_name),
            "level": main_char.level,
            "class": main_char.class_name,
            "streak": main_char.streak,
            "crystals": main_char.crystals,
            "goal_cycle_xp": getattr(current_user, "goal_cycle_xp", 0),
            "goal_target_xp": getattr(current_user, "goal_target_xp", 0),
            "goal_progress_percent": current_user.goal_progress_percent or 0,
            "strength": main_char.strength,
            "agility": main_char.agility,
            "intellect": main_char.intellect,
            "stamina": getattr(main_char, "stamina", 0),
            "current_xp": main_char.current_xp,
            "next_level_xp": next_level_xp,
            "xp_percent": xp_percent,
            "health": health_context["health"],
        },
        "health": health_context["health"],
    }


def sync_today_steps(
    db: Session,
    current_user: User,
    steps: int,
    day_started_at: str | None = None,
    source: str = "device",
) -> dict:
    normalized_steps = max(0, int(steps or 0))
    now = utc_now()

    if day_started_at:
        try:
            day_start = datetime.fromisoformat(day_started_at.replace("Z", "+00:00"))
            if day_start.tzinfo is not None:
                day_start = day_start.astimezone().replace(tzinfo=None)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Invalid day_started_at") from error
    else:
        day_start = datetime(now.year, now.month, now.day)

    day_end = day_start + timedelta(days=1)

    main_progress = (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == current_user.id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )

    record = (
        db.query(DailySteps)
        .filter(
            DailySteps.user_id == current_user.id,
            DailySteps.date >= day_start,
            DailySteps.date < day_end,
        )
        .order_by(DailySteps.date.desc())
        .first()
    )

    previous_steps = int(record.steps or 0) if record else 0

    if record is None:
        record = DailySteps(
            user_id=current_user.id,
            class_progress_id=main_progress.id if main_progress else None,
            steps=normalized_steps,
            date=day_start,
            synced_at=now,
            source=source,
        )
        db.add(record)
    else:
        record.steps = max(previous_steps, normalized_steps)
        record.synced_at = now
        record.source = source
        if main_progress and not record.class_progress_id:
            record.class_progress_id = main_progress.id

    db.commit()
    db.refresh(record)

    return {
        "steps": int(record.steps or 0),
        "previous_steps": previous_steps,
        "delta": max(0, int(record.steps or 0) - previous_steps),
        "synced_at": record.synced_at.isoformat() if record.synced_at else None,
        "day_started_at": day_start.isoformat(),
        "source": source,
    }


def get_daily_quests(db: Session, current_user: User, page: int, limit: int, sort: str, bucket: str | None = None) -> dict:
    return quest_service.get_daily_quests(db, current_user.id, page, limit, sort, bucket)


def regenerate_today_quests(db: Session, current_user: User) -> dict:
    return quest_service.regenerate_today_quests(db, current_user.id)


def get_inventory(db: Session, current_user: User, page: int, limit: int, sort: str) -> dict:
    query = (
        db.query(UserInventory)
        .options(
            joinedload(UserInventory.item).joinedload(Item.weapon_stats),
            joinedload(UserInventory.item).joinedload(Item.armor_stats),
        )
        .filter(UserInventory.user_id == current_user.id)
    )
    sort_map = {"acquired_at": UserInventory.acquired_at, "id": UserInventory.id}
    total = query.count()
    rows = (
        query.order_by(sort_map.get(sort, UserInventory.acquired_at).desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    equipped_ids = inventory_service.get_equipped_inventory_ids(db, current_user.id)
    items = []
    for inv in rows:
        normalize_item_model(inv.item)
        items.append(
            normalize_nested_strings(
                {
                    "id": inv.id,
                    "item_id": inv.item_id,
                    "quantity": inv.quantity,
                    "is_equipped": inv.id in equipped_ids,
                    "acquired_at": inv.acquired_at.isoformat() if inv.acquired_at else None,
                    "item": {
                        "id": inv.item.id,
                        "name": inv.item.name,
                        "description": inv.item.description,
                        "type": inv.item.type,
                        "subclass": inv.item.subclass,
                        "slot": inv.item.slot,
                        "rarity": inv.item.rarity,
                        "icon": inv.item.icon,
                        "required_level": inv.item.required_level,
                        "required_class": inv.item.required_class,
                        "strength_bonus": inv.item.strength_bonus,
                        "agility_bonus": inv.item.agility_bonus,
                        "intellect_bonus": inv.item.intellect_bonus,
                        "stamina_bonus": inv.item.stamina_bonus,
                        "xp_bonus": inv.item.xp_bonus,
                        "crystal_bonus": inv.item.crystal_bonus,
                        "health_bonus": inv.item.health_bonus,
                    },
                    "weapon_stats": {
                        "damage_min": inv.item.weapon_stats.damage_min,
                        "damage_max": inv.item.weapon_stats.damage_max,
                        "speed": inv.item.weapon_stats.speed,
                        "dps": inv.item.weapon_stats.dps,
                    }
                    if inv.item.weapon_stats
                    else None,
                    "armor_stats": {
                        "armor_value": inv.item.armor_stats.armor_value,
                        "slot": inv.item.armor_stats.slot,
                    }
                    if inv.item.armor_stats
                    else None,
                }
            )
        )
    return {
        "items": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total,
            "total_pages": max(1, (total + limit - 1) // limit),
        },
    }


def equip_item(db: Session, current_user: User, inventory_id: int, slot: str, class_progress_id: int | None) -> dict:
    return inventory_service.equip_inventory_item(db, current_user, inventory_id, slot, class_progress_id)


def get_rewards_summary(db: Session, current_user: User) -> dict:
    daily_bonus = quest_service.get_daily_bonus_info(db, current_user.id)
    recent_bonus = (
        db.query(DailyBonus)
        .filter(DailyBonus.user_id == current_user.id)
        .order_by(DailyBonus.claimed_at.desc())
        .first()
    )
    streak_summary = engagement_service.get_streak_summary(db, current_user)
    weekly_goal = engagement_service.get_weekly_goal_summary(db, current_user)
    seasonal_goal = engagement_service.get_seasonal_goal_summary(db, current_user)
    active_event = engagement_service.get_active_event_summary(db, current_user)
    social_pulse = engagement_service.get_social_pulse(db, current_user)
    class_role = engagement_service.get_class_role_summary(db, current_user)
    return normalize_nested_strings({
        "daily_bonus": daily_bonus,
        "available_achievements": [{"id": achievement["id"], "title": achievement["title"]} for achievement in ACHIEVEMENTS],
        "last_bonus_claimed_at": recent_bonus.claimed_at.isoformat() if recent_bonus else None,
        "streak_summary": streak_summary,
        "weekly_goal": weekly_goal,
        "seasonal_goal": seasonal_goal,
        "active_event": active_event,
        "social_pulse": social_pulse,
        "class_role": class_role,
    })


def claim_weekly_goal_reward(db: Session, current_user: User) -> dict:
    try:
        return normalize_nested_strings(engagement_service.claim_weekly_goal_reward(db, current_user))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def claim_seasonal_goal_reward(db: Session, current_user: User) -> dict:
    try:
        payload = engagement_service.claim_seasonal_goal_reward(db, current_user)
        reward_chest = payload.get("reward_chest")
        if reward_chest and isinstance(reward_chest, dict) and reward_chest.get("item") is not None:
            item = reward_chest.get("item")
            if not isinstance(item, dict):
                normalize_item_model(item)
                payload["reward_chest"] = {
                    "chest_name": reward_chest.get("chest_name"),
                    "inventory_id": reward_chest.get("inventory_id"),
                    "source": reward_chest.get("source"),
                    "item": {
                        "id": item.id,
                        "name": item.name,
                        "description": item.description,
                        "icon": item.icon,
                        "rarity": item.rarity,
                    },
                }
        return normalize_nested_strings(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def get_leaderboard(db: Session, current_user: User, scope: str, metric: str, page: int, limit: int) -> dict:
    cache_key = f"leaderboard:{scope}:{metric}:{page}:{limit}:{current_user.id}"
    cached = cache_get_json(cache_key)
    if cached:
        return cached
    if scope == "friends":
        payload = social_service.get_friends_leaderboard(db, current_user, metric, page, limit)
    else:
        payload = social_service.get_global_leaderboard(db, metric, page, limit)
    cache_set_json(cache_key, payload, ttl=60)
    return payload


def get_events(db: Session, page: int, limit: int, sort: str, event_type: str | None = None, status: str | None = None) -> dict:
    cache_key = f"events:{page}:{limit}:{sort}:{event_type or 'all'}:{status or 'all'}"
    cached = cache_get_json(cache_key)
    if cached:
        return cached
    payload = social_service.list_events(db, page, limit, event_type, status, sort, "asc")
    cache_set_json(cache_key, payload, ttl=60)
    return payload


def get_challenges(db: Session, current_user: User, page: int, limit: int, status: str | None, activity_type: str | None, sort: str) -> dict:
    return social_service.list_pvp_challenges(db, current_user, page, limit, status, activity_type, sort, "desc")


def get_shop(db: Session, current_user: User) -> dict:
    return normalize_nested_strings(inventory_service.get_shop_context(db, current_user))


def refresh_shop(db: Session, current_user: User) -> dict:
    return normalize_nested_strings(inventory_service.refresh_shop_context(db, current_user))


def buy_shop_item(db: Session, current_user: User, item_id: int) -> dict:
    return normalize_nested_strings(inventory_service.buy_shop_item(db, current_user, item_id))


def get_inventory_item_detail(db: Session, current_user: User, inventory_id: int) -> dict:
    return normalize_nested_strings(inventory_service.get_inventory_item_detail(db, current_user, inventory_id))


def sell_inventory_item(db: Session, current_user: User, inventory_id: int) -> dict:
    return normalize_nested_strings(inventory_service.sell_inventory_item(db, current_user, inventory_id))


def unequip_inventory_item(db: Session, current_user: User, inventory_id: int) -> dict:
    return normalize_nested_strings(inventory_service.unequip_inventory_item(db, current_user, inventory_id))


def get_equipment_overview(db: Session, current_user: User) -> dict:
    context = inventory_service.build_character_inventory_context(db, current_user, None)
    equipment = []
    for slot, entry in context["equipment"].items():
        item = normalize_item_model(entry["item"])
        equipment.append(
            normalize_nested_strings(
                {
                    "slot": slot,
                    "inventory_id": entry["inventory_id"],
                    "item": {
                        "id": item.id,
                        "name": item.name,
                        "description": item.description,
                        "type": item.type,
                        "subclass": item.subclass,
                        "slot": item.slot,
                        "icon": item.icon,
                        "rarity": item.rarity,
                        "strength_bonus": item.strength_bonus,
                        "agility_bonus": item.agility_bonus,
                        "intellect_bonus": item.intellect_bonus,
                        "stamina_bonus": item.stamina_bonus,
                        "xp_bonus": item.xp_bonus,
                        "crystal_bonus": item.crystal_bonus,
                        "health_bonus": item.health_bonus,
                        "required_level": item.required_level,
                    },
                    "weapon_stats": {
                        "damage_min": entry["weapon_stats"].damage_min,
                        "damage_max": entry["weapon_stats"].damage_max,
                        "speed": entry["weapon_stats"].speed,
                        "dps": entry["weapon_stats"].dps,
                    }
                    if entry.get("weapon_stats")
                    else None,
                    "armor_stats": {
                        "armor_value": entry["armor_stats"].armor_value,
                        "slot": entry["armor_stats"].slot,
                    }
                    if entry.get("armor_stats")
                    else None,
                }
            )
        )

    bag_items = []
    for inv in context["bag_items"]:
        item = normalize_item_model(inv.item)
        bag_items.append(
            normalize_nested_strings(
                {
                    "id": inv.id,
                    "quantity": inv.quantity,
                    "acquired_at": inv.acquired_at.isoformat() if inv.acquired_at else None,
                    "item": {
                        "id": item.id,
                        "name": item.name,
                        "description": item.description,
                        "type": item.type,
                        "subclass": item.subclass,
                        "slot": item.slot,
                        "icon": item.icon,
                        "rarity": item.rarity,
                        "strength_bonus": item.strength_bonus,
                        "agility_bonus": item.agility_bonus,
                        "intellect_bonus": item.intellect_bonus,
                        "stamina_bonus": item.stamina_bonus,
                        "xp_bonus": item.xp_bonus,
                        "crystal_bonus": item.crystal_bonus,
                        "health_bonus": item.health_bonus,
                        "required_level": item.required_level,
                    },
                    "weapon_stats": {
                        "damage_min": item.weapon_stats.damage_min,
                        "damage_max": item.weapon_stats.damage_max,
                        "speed": item.weapon_stats.speed,
                        "dps": item.weapon_stats.dps,
                    }
                    if item.weapon_stats
                    else None,
                    "armor_stats": {
                        "armor_value": item.armor_stats.armor_value,
                        "slot": item.armor_stats.slot,
                    }
                    if item.armor_stats
                    else None,
                }
            )
        )

    class_info = context["class_info"]
    set_bonuses_map = calculate_set_bonus(db, current_user.id)
    set_bonuses = []
    for set_name, entry in set_bonuses_map.items():
        set_bonuses.append(
            normalize_nested_strings(
                {
                    "set_name": set_name,
                    "name": entry.get("name"),
                    "description": entry.get("description"),
                    "active_pieces": entry.get("active_pieces", 0),
                    "bonus": entry.get("bonus", {}),
                }
            )
        )
    reward_effects_raw = StatEffects.build_reward_effects(db, current_user.id)
    reward_effects = StatEffects.serialize_reward_effects(reward_effects_raw)
    return normalize_nested_strings(
        {
            "class_info": {
                "id": class_info.id,
                "class_name": class_info.class_name,
                "display_name": class_info.display_name,
                "level": class_info.level,
                "current_xp": class_info.current_xp,
                "crystals": class_info.crystals,
                "strength": class_info.strength,
                "agility": class_info.agility,
                "intellect": class_info.intellect,
                "stamina": getattr(class_info, "stamina", 0),
            },
            "equipment_totals": context["equipment_totals"],
            "reward_effects": reward_effects,
            "equipment": equipment,
            "bag_items": bag_items,
            "set_bonuses": set_bonuses,
        }
    )


def get_achievements(db: Session, current_user: User) -> dict:
    context = character_service.get_achievements_context(db, current_user)
    character = context["character"]
    return normalize_nested_strings(
        {
            "achievements": context["achievements"],
            "character": {
                "id": character.id,
                "class_name": character.class_name,
                "display_name": character.display_name,
                "level": character.level,
                "streak": character.streak,
                "crystals": character.crystals,
            },
            "total_completed": context["total_completed"],
        }
    )
