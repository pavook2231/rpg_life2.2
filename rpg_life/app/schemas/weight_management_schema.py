from typing import Any

from pydantic import BaseModel, field_validator


SUPPORTED_WEIGHT_GOAL_TYPES = {"lose", "maintain", "gain"}
SUPPORTED_ACTIVITY_LEVELS = {"sedentary", "light", "moderate", "high", "very_high"}
SUPPORTED_SEX_VALUES = {"male", "female", "other"}


class WeightAnamnesisSchema(BaseModel):
    sex: str
    height_cm: int
    weight_kg: float
    goal_type: str
    daily_activity_level: str
    timezone_name: str | None = None

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, value: str) -> str:
        cleaned = str(value or "").strip().lower()
        if cleaned not in SUPPORTED_SEX_VALUES:
            raise ValueError("Unsupported sex value")
        return cleaned

    @field_validator("height_cm", "weight_kg")
    @classmethod
    def validate_positive_number(cls, value: float | int) -> float | int:
        if float(value or 0) <= 0:
            raise ValueError("Value must be greater than zero")
        return value

    @field_validator("goal_type")
    @classmethod
    def validate_goal_type(cls, value: str) -> str:
        cleaned = str(value or "").strip().lower()
        if cleaned not in SUPPORTED_WEIGHT_GOAL_TYPES:
            raise ValueError("Unsupported goal type")
        return cleaned

    @field_validator("daily_activity_level")
    @classmethod
    def validate_activity_level(cls, value: str) -> str:
        cleaned = str(value or "").strip().lower()
        if cleaned not in SUPPORTED_ACTIVITY_LEVELS:
            raise ValueError("Unsupported activity level")
        return cleaned


class WeightBaselineSchema(BaseModel):
    measurements: dict[str, float] | None = None
    target_weight_kg: float | None = None
    kilos_to_lose: float | None = None

    @field_validator("measurements")
    @classmethod
    def validate_measurements(cls, value: dict[str, float] | None) -> dict[str, float] | None:
        if value is None:
            return value
        cleaned: dict[str, float] = {}
        for key, raw in value.items():
            name = str(key or "").strip()
            if not name:
                raise ValueError("Measurement name is required")
            numeric = float(raw)
            if numeric <= 0:
                raise ValueError("Measurements must be greater than zero")
            cleaned[name] = numeric
        return cleaned

    @field_validator("target_weight_kg", "kilos_to_lose")
    @classmethod
    def validate_optional_positive(cls, value: float | None) -> float | None:
        if value is None:
            return value
        if float(value) <= 0:
            raise ValueError("Value must be greater than zero")
        return float(value)


class WeeklyReviewSubmitSchema(BaseModel):
    current_weight_kg: float | None = None
    motivation_self_rating: int | None = None
    difficulty_self_rating: int | None = None

    @field_validator("current_weight_kg")
    @classmethod
    def validate_current_weight(cls, value: float | None) -> float | None:
        if value is None:
            return value
        if float(value) <= 0:
            raise ValueError("Weight must be greater than zero")
        return float(value)

    @field_validator("motivation_self_rating", "difficulty_self_rating")
    @classmethod
    def validate_rating(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if int(value) < 1 or int(value) > 5:
            raise ValueError("Rating must be between 1 and 5")
        return int(value)


class WeightProgramPayload(BaseModel):
    payload: dict[str, Any]
