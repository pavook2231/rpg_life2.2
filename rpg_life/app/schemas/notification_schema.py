from typing import Literal

from pydantic import BaseModel, Field


class PushDeviceRegisterSchema(BaseModel):
    push_token: str = Field(..., min_length=1, max_length=512)
    platform: Literal["ios", "android", "unknown"] = "unknown"
    device_name: str | None = Field(default=None, max_length=200)
    app_version: str | None = Field(default=None, max_length=50)


class PushDeviceUnregisterSchema(BaseModel):
    push_token: str = Field(..., min_length=1, max_length=512)
