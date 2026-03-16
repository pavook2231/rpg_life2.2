from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import crud
from app.achievements import ACHIEVEMENTS, build_achievement_stats, evaluate_achievement, get_earned_achievement_map
from app.core.dates import utc_now
from app.models import Quest, User, UserAchievement
from app.schemas import OnboardingSchema, ProfileUpdateSchema
import app.services.goal_service as goal_service
from app.text_utils import normalize_nested_strings, repair_mojibake


def get_dashboard_context(db: Session, current_user: User, class_name: str) -> dict:
    progress = crud.get_active_class_progress(db, current_user.id, class_name)
    if not progress:
        raise HTTPException(status_code=404, detail="Этот класс еще не открыт")

    today_start = datetime.combine(utc_now().date(), datetime.min.time())
    quests = (
        db.query(Quest)
        .filter(Quest.class_progress_id == progress.id)
        .filter(~Quest.quest_type.in_(["boss_daily", "boss_weekly", "boss_challenge"]))
        .filter(or_(Quest.is_completed == False, Quest.completed_at >= today_start))
        .order_by(Quest.created_at.desc())
        .all()
    )

    next_xp = crud.calculate_next_level_xp(progress.level)
    xp_percent = (progress.current_xp / next_xp) * 100 if next_xp > 0 else 0
    unlocked_classes = crud.get_all_unlocked_classes(db, current_user.id)
    bonus_info = crud.get_daily_bonus_info(db, current_user.id)
    encounters = crud.get_dashboard_encounters(db, current_user.id)

    progress.display_name = repair_mojibake(progress.display_name)
    progress.class_name = repair_mojibake(progress.class_name)

    for cls in unlocked_classes:
        cls.display_name = repair_mojibake(getattr(cls, "display_name", None))
        cls.class_name = repair_mojibake(getattr(cls, "class_name", None))

    for quest in quests:
        quest.title = repair_mojibake(quest.title)
        quest.description = repair_mojibake(quest.description)
        quest.icon = repair_mojibake(quest.icon)
        quest.rarity = repair_mojibake(quest.rarity)

    for boss_quest in encounters["boss_quests"]:
        boss_quest.title = repair_mojibake(boss_quest.title)
        boss_quest.description = repair_mojibake(boss_quest.description)
        boss_quest.icon = repair_mojibake(boss_quest.icon)
        boss_quest.rarity = repair_mojibake(boss_quest.rarity)
        boss_quest.objective_label = crud.describe_objective(boss_quest.objective_type)
        boss_quest.progress_value = crud.get_objective_progress(
            db, current_user.id, boss_quest.objective_type, boss_quest.created_at, boss_quest.expires_at
        )
        boss_quest.supports_live_progress = boss_quest.progress_value is not None
        if boss_quest.supports_live_progress and boss_quest.target_value:
            boss_quest.progress_percent = min(100, int((boss_quest.progress_value / boss_quest.target_value) * 100))
            boss_quest.can_complete = boss_quest.progress_value >= boss_quest.target_value
        else:
            boss_quest.progress_percent = None
            boss_quest.can_complete = True

    for challenge in encounters["challenges"]:
        challenge.title = repair_mojibake(challenge.title)
        challenge.description = repair_mojibake(challenge.description)
        challenge.challenge_type = repair_mojibake(challenge.challenge_type)
        challenge.objective_label = crud.describe_objective(challenge.objective_type)
        challenge.current_value = (
            crud.get_objective_progress(db, current_user.id, challenge.objective_type, challenge.start_at, challenge.end_at)
            or 0
        )
        challenge.progress_percent = min(100, int((challenge.current_value / max(challenge.target_value, 1)) * 100))
        participant_scores = []
        for participant in challenge.participants:
            participant_name = repair_mojibake(participant.user.name) or repair_mojibake(participant.user.email)
            participant_score = (
                crud.get_objective_progress(db, participant.user_id, challenge.objective_type, challenge.start_at, challenge.end_at)
                or 0
            )
            participant_scores.append({"name": participant_name, "value": participant_score})
        participant_scores.sort(key=lambda item: item["value"], reverse=True)
        challenge.leader_name = participant_scores[0]["name"] if participant_scores else "Нет данных"
        challenge.leader_value = participant_scores[0]["value"] if participant_scores else 0

    for challenge in encounters["public_challenges"]:
        challenge.title = repair_mojibake(challenge.title)
        challenge.description = repair_mojibake(challenge.description)
        challenge.challenge_type = repair_mojibake(challenge.challenge_type)
        challenge.objective_label = crud.describe_objective(challenge.objective_type)
        challenge.participants_count = len(challenge.participants)
        challenge.creator_display = repair_mojibake(challenge.creator.name) or repair_mojibake(challenge.creator.email)

    for opponent in encounters["opponents"]:
        opponent.name = repair_mojibake(opponent.name)
        opponent.email = repair_mojibake(opponent.email)

    return {
        "progress": progress,
        "quests": quests,
        "xp_percentage": xp_percent,
        "current_class": class_name,
        "unlocked_classes": unlocked_classes,
        "next_level_xp": next_xp,
        "can_claim_bonus": bonus_info.get("available", False),
        "boss_quests": encounters["boss_quests"],
        "active_challenges": encounters["challenges"],
        "public_challenges": encounters["public_challenges"],
        "challenge_opponents": encounters["opponents"],
    }


def get_profile_context(db: Session, current_user: User) -> dict:
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    if not classes:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    return {"character": classes[0], "all_classes": classes, "user": current_user}


def get_achievements_context(db: Session, current_user: User) -> dict:
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    if not classes:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    main_char = classes[0]
    earned_achievements = (
        db.query(UserAchievement)
        .options(joinedload(UserAchievement.achievement))
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    )
    total_completed = db.query(Quest).filter(Quest.user_id == current_user.id, Quest.is_completed == True).count()
    custom_completed = db.query(Quest).filter(
        Quest.user_id == current_user.id, Quest.is_custom == True, Quest.is_completed == True
    ).count()
    boss_completed = db.query(Quest).filter(
        Quest.user_id == current_user.id,
        Quest.quest_type.in_(["boss_daily", "boss_weekly", "boss_challenge"]),
        Quest.is_completed == True,
    ).count()
    immortal_count = db.query(Quest).filter(
        Quest.user_id == current_user.id, Quest.rarity == "immortal", Quest.is_completed == True
    ).count()

    stats = build_achievement_stats(
        classes=classes,
        total_completed=total_completed,
        custom_completed=custom_completed,
        boss_completed=boss_completed,
        immortal_count=immortal_count,
    )
    earned_map = get_earned_achievement_map(earned_achievements)
    achievements = []
    for achievement in ACHIEVEMENTS:
        ach_id = achievement["id"]
        is_earned = ach_id in earned_map
        condition_met = evaluate_achievement(ach_id, stats)
        status = "earned" if is_earned else "available" if condition_met else "locked"
        achievements.append({**achievement, "status": status, "earned_at": earned_map[ach_id].earned_at if is_earned else None})

    return {"achievements": achievements, "character": main_char, "total_completed": total_completed}


def update_profile(db: Session, user_id: int, profile_data: ProfileUpdateSchema) -> dict:
    update_data = profile_data.dict(exclude_unset=True)
    goal_type = update_data.pop("goal_type", None)
    goal_term_months = update_data.pop("goal_term_months", None)
    start_new_goal_cycle = bool(update_data.pop("start_new_goal_cycle", False))

    user = crud.update_user_profile(db, user_id, update_data)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if goal_type or goal_term_months:
        goal_payload = goal_service.set_user_goal(
            db,
            user,
            goal_type=goal_type or user.selected_goal_type,
            goal_term_months=goal_term_months or user.goal_term_months,
            start_new_cycle=start_new_goal_cycle,
        )
        # refresh user after goal update
        user = db.query(User).filter(User.id == user_id).first() or user
    else:
        goal_payload = goal_service.get_user_goal_state(db, user)

    if profile_data.character_name:
        crud.update_character_name(db, user_id, profile_data.character_name)

    classes = crud.get_all_unlocked_classes(db, user_id)
    main_char = classes[0] if classes else None

    return normalize_nested_strings(
        {
            "ok": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "birth_year": user.birth_year,
                "gender": user.gender,
                "goal_type": user.selected_goal_type,
                "goal_term_months": user.goal_term_months,
                "goal_progress_percent": user.goal_progress_percent,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "goal": goal_payload,
            "character": {
                "id": main_char.id,
                "name": getattr(main_char, "display_name", main_char.class_name),
                "class_name": main_char.class_name,
                "level": main_char.level,
            }
            if main_char
            else None,
        }
    )


def apply_onboarding(db: Session, current_user: User, onboarding_data: OnboardingSchema) -> dict:
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    character_class = onboarding_data.character_class
    if not classes:
        crud.create_class_progress(db, current_user.id, character_class, onboarding_data.name)
    else:
        crud.update_character_name(db, current_user.id, onboarding_data.name)
    goal_service.generate_goal_quests_for_user(db, current_user, source="ai", force_regenerate=False)
    return {"ok": True, "class": character_class, "redirect_url": f"/dashboard/{character_class}"}


def get_character_summary(db: Session, current_user: User) -> dict:
    classes = crud.get_all_unlocked_classes(db, current_user.id)
    if not classes:
        return {"has_character": False}
    main_char = classes[0]
    total_quests = db.query(Quest).filter(Quest.user_id == current_user.id, Quest.is_completed == True).count()
    next_level_xp = crud.calculate_next_level_xp(main_char.level)
    xp_percent = (main_char.current_xp / next_level_xp * 100) if next_level_xp > 0 else 0
    return {
        "has_character": True,
        "character": {
            "name": getattr(main_char, "display_name", main_char.class_name),
            "level": main_char.level,
            "class": main_char.class_name,
            "streak": main_char.streak,
            "crystals": main_char.crystals,
            "strength": main_char.strength,
            "agility": main_char.agility,
            "intellect": main_char.intellect,
            "current_xp": main_char.current_xp,
            "next_level_xp": next_level_xp,
            "xp_percent": xp_percent,
        },
        "stats": {"total_quests": total_quests, "unlocked_classes": len(classes)},
    }


def unlock_class(db: Session, user_id: int, class_name: str) -> dict:
    if not class_name:
        raise HTTPException(status_code=400, detail="Не указан класс")
    classes = crud.get_all_unlocked_classes(db, user_id)
    if len(classes) >= 3:
        raise HTTPException(status_code=400, detail="Максимум классов открыто")
    if classes[0].level < 10:
        raise HTTPException(status_code=400, detail="Нужен 10 уровень")
    if any(c.class_name == class_name for c in classes):
        raise HTTPException(status_code=400, detail="Класс уже открыт")
    crud.create_class_progress(db, user_id, class_name, f"Новый {class_name}")
    crud.generate_daily_quests(db, user_id, class_name)
    crud.generate_boss_quests(db, user_id, class_name)
    crud.generate_rare_mission(db, user_id, class_name)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        goal_service.generate_goal_quests_for_user(db, user, source="ai", force_regenerate=False)
    return {"ok": True, "class": class_name, "redirect_url": f"/dashboard/{class_name}"}
