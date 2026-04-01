from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import crud
from app.core.cache import invalidate_leaderboard_cache
from app.models import Quest, User
from app.schemas import QuestCreate
import app.services.goal_service as goal_service
import app.services.social_service as social_service
import app.services.notification_service as notification_service
import app.services.weight_management_service as weight_management_service
from app.text_utils import normalize_item_model, normalize_nested_strings


def _serialize_item_reward(item) -> dict:
    normalize_item_model(item)
    stats = []
    if getattr(item, "strength_bonus", 0):
        stats.append(f"+{int(item.strength_bonus)} к силе")
    if getattr(item, "agility_bonus", 0):
        stats.append(f"+{int(item.agility_bonus)} к ловкости")
    if getattr(item, "intellect_bonus", 0):
        stats.append(f"+{int(item.intellect_bonus)} к интеллекту")
    if getattr(item, "stamina_bonus", 0):
        stats.append(f"+{int(item.stamina_bonus)} к выносливости")
    if getattr(item, "xp_bonus", 0):
        stats.append(f"+{int(item.xp_bonus * 100)}% к опыту")
    if getattr(item, "crystal_bonus", 0):
        stats.append(f"+{int(item.crystal_bonus * 100)}% к золоту")
    if getattr(item, "critical_bonus", 0):
        stats.append(f"+{int(item.critical_bonus * 100)}% к криту")
    if getattr(item, "luck_bonus", 0):
        stats.append(f"+{int(item.luck_bonus * 100)}% к удаче")
    if getattr(item, "weapon_stats", None):
        stats.append(f"Урон {item.weapon_stats.damage_min}-{item.weapon_stats.damage_max}")
    if getattr(item, "armor_stats", None):
        stats.append(f"Броня +{item.armor_stats.armor_value}")

    return normalize_nested_strings(
        {
            "id": item.id,
            "name": item.name,
            "icon": item.icon,
            "rarity": item.rarity,
            "required_level": item.required_level,
            "description": item.description,
            "stats": stats,
        }
    )


def _serialize_completion_result(result: dict) -> dict:
    payload = dict(result)
    chest_item = payload.get("chest_item")
    if chest_item and isinstance(chest_item, dict) and chest_item.get("item") is not None:
        item = chest_item.get("item")
        if not isinstance(item, dict):
            payload["chest_item"] = {
                "item": _serialize_item_reward(item),
                "rarity": chest_item.get("rarity"),
                "level": chest_item.get("level"),
                "inventory_id": chest_item.get("inventory_id"),
                "chest_name": chest_item.get("chest_name"),
                "source": chest_item.get("source"),
            }
    return normalize_nested_strings(payload)


def complete_quest(db: Session, user_id: int, quest_id: int):
    quest = db.query(Quest).filter(Quest.id == quest_id, Quest.user_id == user_id).first()
    if not quest:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    if not quest.is_completed and getattr(quest, "is_accepted", True) is False:
        raise HTTPException(status_code=400, detail="Сначала прими задание")

    try:
        result = crud.complete_quest(db, user_id, quest_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not result:
        raise HTTPException(status_code=404, detail="Задание не найдено или уже выполнено")

    current_user = db.query(User).filter(User.id == user_id).first()
    # Notify friends about achievement
    friend_ids = social_service._friend_ids(db, user_id)
    if friend_ids and current_user:
        notification_service.notify_friend_achievement(
            db, friend_ids=friend_ids, achiever=current_user, quest_title=quest.title
        )

    if current_user and getattr(quest, "domain", None) == weight_management_service.QUEST_DOMAIN:
        weight_management_service.post_complete_program_quest(db, current_user, quest)
    else:
        goal_service.apply_goal_progress_on_completion(db, user_id, quest_id)
    invalidate_leaderboard_cache()
    payload = _serialize_completion_result(result)
    if current_user:
        goal_state = goal_service.get_user_goal_state(db, current_user)
        payload["goal_progress_percent"] = goal_state["goal_progress_percent"]
        payload["goal_cycle_xp"] = goal_state.get("goal_cycle_xp")
        payload["goal_target_xp"] = goal_state.get("goal_target_xp")
        payload["daily_limits"] = goal_state.get("daily_limits")
    return payload


def get_classes_payload(db: Session, user_id: int) -> dict:
    classes = crud.get_all_unlocked_classes(db, user_id)
    should_unlock_new = len(classes) == 1 and classes[0].level >= 10
    return {
        "classes": [
            {
                "id": c.id,
                "name": c.class_name,
                "level": c.level,
                "unlocked": c.is_unlocked,
                "display_name": getattr(c, "display_name", c.class_name),
            }
            for c in classes
        ],
        "can_unlock_new": should_unlock_new,
    }


def create_custom_quest(db: Session, current_user: User, quest_data: QuestCreate):
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    if not classes:
        raise HTTPException(status_code=404, detail="No available classes")
    try:
        quest = crud.create_custom_quest(db, current_user.id, classes[0].id, quest_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "ok": True,
        "quest": {
            "id": quest.id,
            "title": quest.title,
            "description": quest.description,
            "xp_reward": quest.xp_reward,
            "crystal_reward": quest.crystal_reward,
            "rarity": quest.rarity or "common",
            "quest_type": quest.quest_type or "daily",
            "quest_bucket": "daily",
            "goal_type": quest.goal_type,
            "goal_id": quest.goal_id,
            "difficulty_level": quest.difficulty_level or "easy",
            "goal_progress_percent": 0,
            "is_universal": False,
            "is_accepted": True,
            "objective_type": quest.objective_type,
            "objective_label": crud.describe_objective(quest.objective_type) if quest.objective_type else None,
            "target_value": int(quest.target_value) if quest.target_value is not None else None,
            "progress_value": None,
            "supports_live_progress": False,
            "tracking_mode": "manual",
            "can_complete": True,
            "is_completed": bool(quest.is_completed),
            "expires_at": quest.expires_at.isoformat() if quest.expires_at else None,
        },
    }


def delete_quest(db: Session, user_id: int, quest_id: int) -> dict:
    success = crud.delete_quest(db, user_id, quest_id)
    if not success:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    return {"ok": True}


def get_daily_bonus_info(db: Session, user_id: int):
    return crud.get_daily_bonus_info(db, user_id)


def claim_daily_bonus(db: Session, user_id: int):
    result = crud.claim_daily_bonus(db, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="Daily bonus is not available yet")
    return result


def get_user_stats(db: Session, user_id: int):
    return crud.get_user_stats(db, user_id)


def get_daily_quests(
    db: Session,
    user_id: int,
    page: int = 1,
    limit: int = 20,
    sort: str = "created_at",
    bucket: str | None = None,
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"items": [], "pagination": {"page": page, "limit": limit, "total_items": 0, "total_pages": 1}}
    payload = weight_management_service.ensure_program_quests(db, user)
    payload["pagination"]["page"] = page
    payload["pagination"]["limit"] = limit
    return normalize_nested_strings(payload)


def regenerate_today_quests(db: Session, user_id: int) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"ok": True, "generated_for": 0}
    payload = weight_management_service.ensure_program_quests(db, user)
    return {"ok": True, "generated_for": len(payload.get("items", []))}


def regenerate_ai_goal_quests(db: Session, user: User) -> dict:
    payload = weight_management_service.ensure_program_quests(db, user)
    return {"ok": True, "generated_for": len(payload.get("items", []))}


def get_goal_templates() -> dict:
    return goal_service.get_goal_templates_payload()


def get_goal_state(db: Session, user: User) -> dict:
    return goal_service.get_user_goal_state(db, user)


def select_goal(db: Session, user: User, goal_type: str, goal_term_months: int, start_new_cycle: bool = True) -> dict:
    try:
        return goal_service.set_user_goal(
            db,
            user,
            goal_type=goal_type,
            goal_term_months=goal_term_months,
            start_new_cycle=start_new_cycle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def accept_goal_quest(db: Session, user: User, quest_id: int) -> dict:
    raise HTTPException(status_code=400, detail="Детерминированные program-квесты не требуют принятия")


def replace_goal_quest(db: Session, user: User, quest_id: int, source: str = "base") -> dict:
    raise HTTPException(status_code=400, detail="Детерминированные program-квесты нельзя заменять")
