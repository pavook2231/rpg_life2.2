from typing import Optional

from pydantic import BaseModel, field_validator

from app.goals import SUPPORTED_GOAL_TERMS, normalize_goal_type


class QuestCreate(BaseModel):
    title: str
    description: str
    xp_reward: int
    icon: str = "📝"


class GoalSelectSchema(BaseModel):
    goal_type: str
    goal_term_months: int
    start_new_cycle: bool = True

    @field_validator("goal_type")
    @classmethod
    def validate_goal_type(cls, value: str) -> str:
        return normalize_goal_type(value)

    @field_validator("goal_term_months")
    @classmethod
    def validate_goal_term(cls, value: int) -> int:
        if value not in SUPPORTED_GOAL_TERMS:
            raise ValueError("Срок цели должен быть 3, 6 или 9 месяцев")
        return value


class QuestReplaceSchema(BaseModel):
    source: str = "ai"

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if value not in {"base", "ai"}:
            raise ValueError("Источник должен быть base или ai")
        return value


class ChallengeCreateSchema(BaseModel):
    title: str
    description: str = ""
    challenge_type: str = "duel"
    objective_type: str
    target_value: int
    duration_days: int = 1
    opponent_id: Optional[int] = None
    reward_xp: int = 150
    reward_crystals: int = 25
    reward_chest: bool = False

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("Название испытания должно быть минимум 3 символа")
        return cleaned

    @field_validator("challenge_type")
    @classmethod
    def validate_challenge_type(cls, value: str) -> str:
        if value not in {"duel", "open", "boss"}:
            raise ValueError("Недопустимый тип испытания")
        return value

    @field_validator("objective_type")
    @classmethod
    def validate_objective_type(cls, value: str) -> str:
        if value not in {"steps", "quests_completed", "xp_gained"}:
            raise ValueError("Недопустимый тип цели")
        return value

    @field_validator("target_value")
    @classmethod
    def validate_target_value(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Цель должна быть больше нуля")
        return value

    @field_validator("duration_days")
    @classmethod
    def validate_duration_days(cls, value: int) -> int:
        if value < 1 or value > 14:
            raise ValueError("Длительность испытания должна быть от 1 до 14 дней")
        return value
