from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.goals import SUPPORTED_GOAL_TERMS, normalize_goal_type


def _validate_person_name(value: Optional[str], label: str) -> Optional[str]:
    if value is None:
        return value
    cleaned = value.strip()
    if len(cleaned) < 2:
        raise ValueError(f"{label} должно быть минимум 2 символа")
    if cleaned[0].isdigit():
        raise ValueError(f"{label} не может начинаться с цифры")
    return cleaned


def _validate_birth_year(value: Optional[int]) -> Optional[int]:
    if value is None:
        return value
    current_year = datetime.now().year
    if value < 1950 or value > current_year - 10:
        raise ValueError(f"Год должен быть от 1950 до {current_year - 10}")
    return value


class OnboardingSchema(BaseModel):
    name: str
    birth_year: int
    character_class: str
    class_name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_person_name(value, "Имя") or value

    @field_validator("birth_year")
    @classmethod
    def validate_birth_year(cls, value: int) -> int:
        return _validate_birth_year(value) or value


class ProfileUpdateSchema(BaseModel):
    name: Optional[str] = None
    birth_year: Optional[int] = None
    gender: Optional[str] = None
    character_name: Optional[str] = None
    character_class: Optional[str] = None
    class_name: Optional[str] = None
    goal_type: Optional[str] = None
    goal_term_months: Optional[int] = None
    start_new_goal_cycle: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_person_name(value, "Имя")

    @field_validator("character_name")
    @classmethod
    def validate_character_name(cls, value: Optional[str]) -> Optional[str]:
        return _validate_person_name(value, "Имя персонажа")

    @field_validator("birth_year")
    @classmethod
    def validate_profile_birth_year(cls, value: Optional[int]) -> Optional[int]:
        return _validate_birth_year(value)

    @field_validator("gender")
    @classmethod
    def validate_profile_gender(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value not in {"male", "female", "nonbinary", "unspecified"}:
            raise ValueError("Неверное значение пола")
        return value

    @field_validator("goal_type")
    @classmethod
    def validate_goal_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_goal_type(value)

    @field_validator("goal_term_months")
    @classmethod
    def validate_goal_term_months(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value not in SUPPORTED_GOAL_TERMS:
            raise ValueError("Срок цели должен быть 3, 6 или 9 месяцев")
        return value


class ClassUnlockSchema(BaseModel):
    class_name: str

    @field_validator("class_name")
    @classmethod
    def validate_class_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Не указан класс")
        return cleaned
