from app.schemas.auth_schema import UserCreate, UserLogin
from app.schemas.character_schema import ClassUnlockSchema, OnboardingSchema, ProfileUpdateSchema
from app.schemas.inventory_schema import EquipmentSlotActionSchema, InventoryActionSchema, ShopPurchaseSchema
from app.schemas.mobile_schema import LoginRequestSchema, RefreshTokenSchema
from app.schemas.quest_schema import ChallengeCreateSchema, QuestCreate
from app.schemas.social_schema import (
    ChallengeDecisionSchema,
    CoopQuestCreateSchema,
    EventCreateSchema,
    FriendRequestCreateSchema,
    FriendRequestRespondSchema,
    PaginationParams,
    PvpChallengeCreateSchema,
)
