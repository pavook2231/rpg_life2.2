from datetime import datetime, timedelta
from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, model_validator

from app.core.dates import utc_now


class ChestOpenSchema(BaseModel):
    chest_id: int | None = None
    chest_name: str | None = None
    inventory_id: int | None = None

    @model_validator(mode="after")
    def validate_selector(self):
        if self.chest_id is None and not self.chest_name and self.inventory_id is None:
            raise ValueError("Either chest_id, chest_name or inventory_id must be provided")
        return self


class BossProgressSchema(BaseModel):
    boss_id: int | None = None
    progress: int = Field(..., gt=0)


class BossCompleteSchema(BaseModel):
    boss_id: int | None = None


class FriendAddSchema(BaseModel):
    friend_id: int


class BetaChallengeCreateSchema(BaseModel):
    opponent_id: int
    type: str = Field(validation_alias=AliasChoices("type", "objective_type"))
    target_value: int = Field(..., gt=0, validation_alias=AliasChoices("target_value", "goal"))
    start_date: datetime | None = None
    end_date: datetime | None = None
    duration_hours: int | None = None
    reward_gold: int = Field(100, ge=0, validation_alias=AliasChoices("reward_gold", "reward_crystals"))
    reward_chest: bool = True
    reward_xp: int = 0
    title: str | None = None
    description: str = ""

    @model_validator(mode="after")
    def normalize_legacy_payload(self):
        if self.type in {"tasks", "quests_completed", "workouts"}:
            normalized_type = "tasks"
        elif self.type == "steps":
            normalized_type = "steps"
        else:
            raise ValueError("Challenge type must be one of: steps, tasks")
        object.__setattr__(self, "type", normalized_type)

        if self.end_date is None:
            if self.duration_hours is None:
                raise ValueError("Either end_date or duration_hours must be provided")
            start_date = self.start_date or utc_now()
            object.__setattr__(self, "start_date", start_date)
            object.__setattr__(self, "end_date", start_date + timedelta(hours=self.duration_hours))
        if self.start_date is not None and self.end_date is not None and self.end_date <= self.start_date:
            raise ValueError("end_date must be later than start_date")
        return self


class BetaChallengeProgressSchema(BaseModel):
    challenge_id: int
    progress: int = Field(..., gt=0)


class BetaChallengeFinishSchema(BaseModel):
    challenge_id: int
