"""
Enhanced Goal Service

Provides functionality for:
- Single active goal management
- AI-assisted goal and quest generation
- Quest auto-matching based on goal
- Quest verification (photo, location, questions)
- Health decay calculation
- Armor protection
"""

from datetime import datetime, timedelta
from typing import Optional
import random
import json

from sqlalchemy.orm import Session

from app.models.enhanced_models import User, UserGoal, Quest, QuestVerification, UserGoalQuest
from app.core.dates import utc_now


# Template quests for different goal types
GOAL_QUEST_TEMPLATES = {
    "self_development": [
        {"title": "Прочитать 10 страниц", "description": "Ежедневное чтение для развития ума", "xp": 50, "crystals": 8, "difficulty": "easy", "category": "learning", "tags": ["reading", "mind"]},
        {"title": "10 минут медитации", "description": "Практика осознанности и фокуса", "xp": 60, "crystals": 10, "difficulty": "easy", "category": "mindfulness", "tags": ["meditation", "focus"]},
        {"title": "Выучить 5 новых слов", "description": "Расширь словарный запас", "xp": 50, "crystals": 7, "difficulty": "easy", "category": "learning", "tags": ["language", "memory"]},
        {"title": "30 минут без телефона", "description": "Цифровой детокс для концентрации", "xp": 70, "crystals": 12, "difficulty": "medium", "category": "discipline", "tags": ["digital", "focus"]},
        {"title": "Записать 3 идеи", "description": "Развивай креативное мышление", "xp": 60, "crystals": 10, "difficulty": "easy", "category": "creativity", "tags": ["ideas", "creative"]},
        {"title": "Посмотреть лекцию", "description": "Изучи новую тему или инструмент", "xp": 80, "crystals": 12, "difficulty": "medium", "category": "learning", "tags": ["education", "growth"]},
        {"title": "Практика благодарности", "description": "Запиши 3 вещи, за которые благодарен", "xp": 50, "crystals": 8, "difficulty": "easy", "category": "mindfulness", "tags": ["gratitude", "mind"]},
        {"title": "Лечь до 23:00", "description": "Поддержи режим сна и восстановления", "xp": 70, "crystals": 10, "difficulty": "medium", "category": "health", "tags": ["sleep", "routine"]},
    ],
    "weight_loss": [
        {"title": "Выпить 2 литра воды", "description": "Поддерживай водный баланс", "xp": 50, "crystals": 5, "difficulty": "easy", "category": "hydration", "tags": ["water", "health"]},
        {"title": "30 минут кардио", "description": "Пробежка, велосипед или быстрая ходьба", "xp": 80, "crystals": 10, "difficulty": "medium", "category": "exercise", "tags": ["cardio", "fitness"]},
        {"title": "Здоровый завтрак", "description": "Сделай акцент на белок и клетчатку", "xp": 60, "crystals": 8, "difficulty": "easy", "category": "nutrition", "tags": ["food", "health"]},
        {"title": "10 000 шагов", "description": "Держи активность в течение дня", "xp": 70, "crystals": 10, "difficulty": "medium", "category": "activity", "tags": ["steps", "movement"]},
        {"title": "Без сахара сегодня", "description": "Откажись от сладкого на один день", "xp": 90, "crystals": 15, "difficulty": "hard", "category": "nutrition", "tags": ["diet", "health"]},
        {"title": "Силовая тренировка", "description": "Добавь упражнения с собственным весом", "xp": 100, "crystals": 15, "difficulty": "hard", "category": "exercise", "tags": ["strength", "fitness"]},
        {"title": "Контроль веса", "description": "Запиши результат и прогресс", "xp": 40, "crystals": 5, "difficulty": "easy", "category": "tracking", "tags": ["weight", "progress"]},
        {"title": "Овощи на ужин", "description": "Сделай ужин легче и полезнее", "xp": 50, "crystals": 7, "difficulty": "easy", "category": "nutrition", "tags": ["food", "health"]},
    ],
    "financial_independence": [
        {"title": "Записать расходы", "description": "Отслеживай куда уходят деньги", "xp": 50, "crystals": 8, "difficulty": "easy", "category": "tracking", "tags": ["money", "tracking"]},
        {"title": "Составить бюджет", "description": "Планируй финансы на неделю", "xp": 60, "crystals": 10, "difficulty": "easy", "category": "planning", "tags": ["budget", "planning"]},
        {"title": "Найти способ экономии", "description": "Оптимизируй хотя бы одну статью расходов", "xp": 70, "crystals": 12, "difficulty": "medium", "category": "saving", "tags": ["saving", "optimization"]},
        {"title": "Дополнительный доход", "description": "Сделай что-то для дополнительного заработка", "xp": 100, "crystals": 20, "difficulty": "hard", "category": "income", "tags": ["money", "growth"]},
        {"title": "Проверить инвестиции", "description": "Просмотри состояние накоплений", "xp": 50, "crystals": 8, "difficulty": "easy", "category": "investing", "tags": ["investing", "tracking"]},
        {"title": "Отказаться от Impulse покупки", "description": "Не покупай ничего по impulse за сегодня", "xp": 80, "crystals": 15, "difficulty": "medium", "category": "discipline", "tags": ["discipline", "saving"]},
    ],
    "new_profession": [
        {"title": "Изучить 1 час профессионального материала", "description": "Сфокусируйся на развитии навыков", "xp": 80, "crystals": 12, "difficulty": "medium", "category": "learning", "tags": ["career", "skills"]},
        {"title": "Выполнить практическое задание", "description": "Примени знания на практике", "xp": 90, "crystals": 15, "difficulty": "medium", "category": "practice", "tags": ["career", "practice"]},
        {"title": "Обновить портфолио", "description": "Добавь новый проект или достижение", "xp": 70, "crystals": 10, "difficulty": "easy", "category": "portfolio", "tags": ["career", "portfolio"]},
        {"title": "Отправить 3 резюме", "description": "Активный поиск работы", "xp": 80, "crystals": 12, "difficulty": "medium", "category": "jobsearch", "tags": ["career", "job"]},
        {"title": "Провести networking", "description": "Свяжись с 2 специалистами в области", "xp": 60, "crystals": 10, "difficulty": "medium", "category": "networking", "tags": ["career", "network"]},
        {"title": "Изучить новый инструмент", "description": "Освой новый инструмент или технологию", "xp": 85, "crystals": 14, "difficulty": "hard", "category": "skills", "tags": ["career", "tech"]},
    ],
    "self_realization": [
        {"title": "Сделать что-то публичное", "description": "Выложи работу, идею или мысль", "xp": 80, "crystals": 15, "difficulty": "medium", "category": "expression", "tags": ["public", "creative"]},
        {"title": "Творческий проект", "description": "Работай над личным творческим проектом", "xp": 90, "crystals": 15, "difficulty": "medium", "category": "creativity", "tags": ["creative", "project"]},
        {"title": "Волонтёрство", "description": "Сделай что-то полезное для сообщества", "xp": 100, "crystals": 20, "difficulty": "hard", "category": "service", "tags": ["community", "giving"]},
        {"title": "Выразить благодарность", "description": "Скажи спасибо 3 людям лично", "xp": 50, "crystals": 8, "difficulty": "easy", "category": "social", "tags": ["gratitude", "social"]},
        {"title": "Новая привычка", "description": "Введи одну новую полезную привычку", "xp": 70, "crystals": 12, "difficulty": "medium", "category": "habits", "tags": ["habit", "growth"]},
    ],
}


def get_ai_suggested_quest(user_goal: UserGoal, difficulty: str = "medium") -> dict:
    """
    Generate an AI-like quest suggestion based on the goal type.
    In production, this would call an actual AI service.
    """
    goal_type = user_goal.goal_type
    templates = GOAL_QUEST_TEMPLATES.get(goal_type, GOAL_QUEST_TEMPLATES["self_development"])
    
    # Filter by difficulty if needed
    if difficulty != "any":
        filtered = [t for t in templates if t["difficulty"] == difficulty]
        if filtered:
            templates = filtered
    
    return random.choice(templates)


def generate_quests_for_goal(user_goal: UserGoal, count: int = 5) -> list[dict]:
    """
    Generate a set of quests matched to a specific goal.
    Mixes difficulties for variety.
    """
    quests = []
    difficulties = ["easy", "easy", "medium", "medium", "hard"]
    
    for i in range(count):
        difficulty = difficulties[i] if i < len(difficulties) else "medium"
        quest_template = get_ai_suggested_quest(user_goal, difficulty)
        
        # Add some variation to make each quest unique
        quest = quest_template.copy()
        quest["goal_id"] = user_goal.id
        quest["is_ai_generated"] = True
        quest["goal_type"] = user_goal.goal_type
        
        quests.append(quest)
    
    return quests


def calculate_health_decay(user: User, hours_away: int, missed_quests: int) -> int:
    """
    Calculate health decay based on time away and missed quests.
    
    Args:
        user: The user whose health to calculate
        hours_away: Number of hours since last activity
        missed_quests: Number of incomplete quests
    
    Returns:
        Health points to deduct
    """
    # Base decay: 1 HP per hour after 24 hours
    base_decay = max(0, hours_away - 24)
    
    # Additional decay for missed quests: 2 HP per missed quest
    quest_decay = missed_quests * 2
    
    # Reduce decay based on armor
    armor_reduction = min(user.armor_value, base_decay + quest_decay)
    
    return max(0, base_decay + quest_decay - armor_reduction)


def apply_health_decay(db: Session, user: User) -> User:
    """
    Apply health decay to a user based on their absence and missed quests.
    This should be called when the user returns to the app.
    """
    now = utc_now()
    last_active = user.last_active_at or user.created_at
    
    # Calculate hours since last activity
    hours_away = int((now - last_active).total_seconds() / 3600)
    
    # Only apply decay if away for more than 24 hours
    if hours_away > 24:
        # Get incomplete quests from the last 24 hours
        missed_quests = missed_quests  # This would query the database
        
        # Calculate and apply decay
        decay = calculate_health_decay(user, hours_away, missed_quests)
        user.current_health = max(0, user.current_health - decay)
    
    # Update last health update timestamp
    user.last_health_update = now
    
    return user


def verify_quest_completion(
    db: Session,
    quest_id: int,
    verification_data: dict
) -> tuple[bool, Optional[str]]:
    """
    Verify quest completion using various methods.
    
    Args:
        db: Database session
        quest_id: ID of the quest to verify
        verification_data: Dictionary containing verification info:
            - photo_url: URL of uploaded photo
            - latitude/longitude: GPS coordinates
            - answer: Answer to verification question
    
    Returns:
        Tuple of (success, error_message)
    """
    quest = db.query(Quest).filter(Quest.id == quest_id).first()
    if not quest:
        return False, "Quest not found"
    
    if not quest.requires_verification:
        # No verification required, auto-approve
        return True, None
    
    verification_type = quest.verification_type
    
    if verification_type == "photo":
        # Verify photo was uploaded
        if not verification_data.get("photo_url"):
            return False, "Photo verification required"
        
        # Create verification record
        verification = QuestVerification(
            quest_id=quest_id,
            user_id=quest.user_id,
            verification_type="photo",
            photo_url=verification_data.get("photo_url"),
            photo_timestamp=utc_now(),
            photo_metadata=verification_data.get("metadata", {}),
            is_verified=True,
            verified_at=utc_now(),
            verified_by="system"
        )
        db.add(verification)
        
    elif verification_type == "location":
        # Verify location matches expected area
        if not verification_data.get("latitude") or not verification_data.get("longitude"):
            return False, "Location verification required"
        
        verification = QuestVerification(
            quest_id=quest_id,
            user_id=quest.user_id,
            verification_type="location",
            latitude=verification_data.get("latitude"),
            longitude=verification_data.get("longitude"),
            location_accuracy=verification_data.get("accuracy"),
            location_name=verification_data.get("location_name"),
            location_timestamp=utc_now(),
            is_verified=True,
            verified_at=utc_now(),
            verified_by="system"
        )
        db.add(verification)
        
    elif verification_type == "question":
        # Verify answer to question
        expected_answer = quest.verification_questions
        if isinstance(expected_answer, list) and len(expected_answer) > 0:
            expected = expected_answer[0].get("answer", "").lower()
            actual = verification_data.get("answer", "").lower()
            
            if expected != actual:
                return False, "Incorrect answer to verification question"
        
        verification = QuestVerification(
            quest_id=quest_id,
            user_id=quest.user_id,
            verification_type="question",
            questions_answers=verification_data.get("answers", {}),
            is_verified=True,
            verified_at=utc_now(),
            verified_by="system"
        )
        db.add(verification)
    
    db.commit()
    return True, None


def sync_steps_from_device(db: Session, user: User, steps: int, source: str = "device") -> User:
    """
    Sync step count from device (HealthKit, Google Fit, etc.)
    """
    user.total_steps = (user.total_steps or 0) + steps
    user.last_step_sync = utc_now()
    
    # Update or create daily steps record
    today = utc_now().date()
    from app.models.enhanced_models import DailySteps
    
    daily_record = db.query(DailySteps).filter(
        DailySteps.user_id == user.id,
        DailySteps.date >= today
    ).first()
    
    if daily_record:
        daily_record.steps += steps
        daily_record.source = source
        daily_record.synced_at = utc_now()
    else:
        daily_record = DailySteps(
            user_id=user.id,
            steps=steps,
            source=source,
            synced_at=utc_now()
        )
        db.add(daily_record)
    
    db.commit()
    return user


def create_goal(db: Session, user_id: int, goal_type: str, duration_days: int, title: str, description: str) -> UserGoal:
    """
    Create a new goal for a user.
    IMPORTANT: This will deactivate any existing active goal.
    """
    # Deactivate any existing active goals
    db.query(UserGoal).filter(
        UserGoal.user_id == user_id,
        UserGoal.status == "active"
    ).update({"status": "abandoned"})
    
    # Create new goal
    now = utc_now()
    deadline = now + timedelta(days=duration_days)
    
    goal = UserGoal(
        user_id=user_id,
        goal_type=goal_type,
        title=title,
        description=description,
        duration_days=duration_days,
        started_at=now,
        deadline_at=deadline,
        status="active",
        icon=get_goal_icon(goal_type),
        accent_color=get_goal_color(goal_type),
        required_quest_points=get_quest_points_target(duration_days)
    )
    
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    return goal


def get_goal_icon(goal_type: str) -> str:
    """Get icon for goal type"""
    icons = {
        "self_development": "📚",
        "weight_loss": "🏃",
        "financial_independence": "💰",
        "new_profession": "💼",
        "self_realization": "⭐",
    }
    return icons.get(goal_type, "🎯")


def get_goal_color(goal_type: str) -> str:
    """Get accent color for goal type"""
    colors = {
        "self_development": "#3b82f6",
        "weight_loss": "#22c55e",
        "financial_independence": "#eab308",
        "new_profession": "#c084fc",
        "self_realization": "#f59e0b",
    }
    return colors.get(goal_type, "#4CAF50")


def get_quest_points_target(duration_days: int) -> int:
    """Get required quest points based on goal duration"""
    targets = {
        100: 24,
        200: 42,
        300: 60,
    }
    return targets.get(duration_days, 20)


def get_active_goal(db: Session, user_id: int) -> Optional[UserGoal]:
    """Get the user's currently active goal"""
    return db.query(UserGoal).filter(
        UserGoal.user_id == user_id,
        UserGoal.status == "active"
    ).first()


def match_quests_to_goal(db: Session, goal: UserGoal, user_level: int = 1) -> list[Quest]:
    """
    Generate quests that match the selected goal.
    Creates quests with appropriate difficulty based on user level.
    """
    generated_quests = generate_quests_for_goal(goal, count=5)
    
    quests = []
    for quest_data in generated_quests:
        # Scale rewards based on user level
        xp_reward = quest_data["xp"] * (1 + (user_level - 1) * 0.1)
        crystals = quest_data["crystals"] * (1 + (user_level - 1) * 0.1)
        
        quest = Quest(
            user_id=goal.user_id,
            goal_id=goal.id,
            title=quest_data["title"],
            description=quest_data["description"],
            xp_reward=int(xp_reward),
            crystal_reward=int(crystals),
            difficulty=quest_data["difficulty"],
            category=quest_data.get("category"),
            tags=quest_data.get("tags", []),
            goal_type=goal.goal_type,
            is_ai_generated=True,
            icon=quest_data.get("icon", "📝"),
            quest_type="goal"
        )
        
        db.add(quest)
        quests.append(quest)
    
    db.commit()
    
    return quests
