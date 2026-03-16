from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.auth_schema import UserCreate


class LoginRequestSchema(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenSchema(BaseModel):
    refresh_token: str


class ChangePasswordSchema(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return value


class RecoverAccountSchema(BaseModel):
    email: EmailStr
