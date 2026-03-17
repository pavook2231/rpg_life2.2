from .auth_schema import UserCreate, UserLogin
from .character_schema import ClassUnlockSchema, OnboardingSchema, ProfileUpdateSchema
from .crafting_schema import CraftRecipeSchema, UpgradeItemSchema
from .inventory_schema import EquipmentSlotActionSchema, InventoryActionSchema, ShopPurchaseSchema
from .mobile_schema import ChangePasswordSchema, LoginRequestSchema, RecoverAccountSchema, RefreshTokenSchema, StepsSyncSchema
from .notification_schema import PushDeviceRegisterSchema, PushDeviceUnregisterSchema
from .oauth_schema import SocialAuthExchangeSchema, SocialAuthProviderSchema
from .quest_schema import ChallengeCreateSchema, GoalSelectSchema, QuestCreate, QuestReplaceSchema
from .social_schema import (
    ChallengeDecisionSchema,
    ChallengeInvitationCreateSchema,
    ChallengeInvitationRespondSchema,
    CoopQuestCreateSchema,
    EventCreateSchema,
    FriendRequestCreateSchema,
    FriendRequestRespondSchema,
    PaginationParams,
    PvpChallengeCreateSchema,
)
