from pydantic import BaseModel, field_validator


SUPPORTED_SOCIAL_PROVIDERS = {"google", "telegram", "vk"}


class SocialAuthProviderSchema(BaseModel):
    id: str
    label: str
    kind: str
    enabled: bool
    configured: bool
    mobile_client_id: str | None = None
    browser_login_path: str | None = None


class SocialAuthExchangeSchema(BaseModel):
    provider: str
    id_token: str | None = None
    access_token: str | None = None
    authorization_code: str | None = None
    init_data: str | None = None
    bridge_ticket: str | None = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in SUPPORTED_SOCIAL_PROVIDERS:
            raise ValueError("Unsupported social auth provider")
        return normalized
