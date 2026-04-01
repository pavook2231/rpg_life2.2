import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.goals import SUPPORTED_GOAL_TERMS, normalize_goal_type
from app.user_identity import normalize_username, username_matches_rules, username_validation_error


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: Optional[str] = None
    birth_year: Optional[int] = None
    gender: str = "unspecified"
    character_class: str = "mage"
    language_preference: str = "ru"
    goal_type: str = "lose"
    goal_term_months: int = 6

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Пароль должен быть минимум 8 символов")
        if not re.search(r"[A-Za-zА-Яа-я]", value):
            raise ValueError("Пароль должен содержать хотя бы одну букву")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Имя должно быть минимум 2 символа")
        if cleaned[0].isdigit():
            raise ValueError("Имя не может начинаться с цифры")
        return cleaned

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = normalize_username(value)
        if not normalized or not username_matches_rules(normalized):
            raise ValueError(username_validation_error())
        return normalized

    @field_validator("birth_year")
    @classmethod
    def validate_birth_year(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        current_year = datetime.now().year
        if value < 1950 or value > current_year - 10:
            raise ValueError(f"Год должен быть от 1950 до {current_year - 10}")
        return value

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, value: str) -> str:
        if value not in {"male", "female", "nonbinary", "unspecified"}:
            raise ValueError("Неверное значение пола")
        return value

    @field_validator("character_class")
    @classmethod
    def validate_class(cls, value: str) -> str:
        if value not in {"warrior", "archer", "mage"}:
            raise ValueError("Неверный класс персонажа")
        return value

    @field_validator("language_preference")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if value not in {"ru", "en"}:
            raise ValueError("Неподдерживаемый язык")
        return value

    @field_validator("goal_type")
    @classmethod
    def validate_goal_type(cls, value: str) -> str:
        normalized = normalize_goal_type(value)
        if not normalized:
            raise ValueError("Неверная жизненная цель")
        return normalized

    @field_validator("goal_term_months")
    @classmethod
    def validate_goal_term_months(cls, value: int) -> int:
        if value not in SUPPORTED_GOAL_TERMS:
            raise ValueError("Срок цели должен быть 3, 6 или 9 месяцев")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str
