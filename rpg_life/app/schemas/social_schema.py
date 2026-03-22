from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20
    sort_by: str = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"

    @field_validator("page", "page_size")
    @classmethod
    def validate_positive(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Значение должно быть положительным")
        return min(value, 100)


class FriendRequestCreateSchema(BaseModel):
    receiver_id: int


class FriendRequestRespondSchema(BaseModel):
    request_id: int
    action: Literal["accept", "decline"] = "accept"


class PvpChallengeCreateSchema(BaseModel):
    opponent_id: int
    objective_type: Literal["steps", "workouts", "quests_completed"]
    goal: int = Field(..., gt=0)
    duration_hours: int = Field(24, ge=1, le=24 * 30)
    reward_xp: int = Field(100, ge=0)
    reward_crystals: int = Field(25, ge=0)
    title: Optional[str] = None
    description: str = ""


class ChallengeDecisionSchema(BaseModel):
    challenge_id: int
    action: Literal["accept", "decline"]


class CoopQuestCreateSchema(BaseModel):
    title: str
    description: str = ""
    objective_type: Literal["steps", "workouts", "quests_completed"]
    goal: int = Field(..., gt=0)
    duration_hours: int = Field(24, ge=1, le=24 * 30)
    reward_xp: int = Field(150, ge=0)
    reward_crystals: int = Field(50, ge=0)
    participant_ids: list[int] = Field(default_factory=list)


class EventCreateSchema(BaseModel):
    event_type: Literal["world_boss", "season", "limited_time"]
    slug: str
    title: str
    description: str = ""
    payload_json: str = "{}"
    season_key: Optional[str] = None
    start_at: datetime
    end_at: datetime


class ChallengeInvitationCreateSchema(BaseModel):
    receiver_id: int
    challenge_type: Literal["pvp", "coop"]
    title: str
    description: str = ""
    objective_type: Literal["steps", "workouts", "quests_completed"]
    goal: int = Field(..., gt=0)
    reward_xp: int = Field(0, ge=0)
    reward_crystals: int = Field(0, ge=0)


class ChallengeInvitationRespondSchema(BaseModel):
    invitation_id: int
    action: Literal["accept", "decline"]
