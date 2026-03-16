from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from fastapi.responses import RedirectResponse
from urllib.parse import quote

from app import auth
from app.api.dependencies import enforce_rate_limit
from app.core.config import SOCIAL_AUTH_REDIRECT_SCHEME
from app.core.database import get_db
from app.core.responses import success_response
from app.models import User
from app.schemas import (
    ChallengeCreateSchema,
    ChangePasswordSchema,
    CraftRecipeSchema,
    InventoryActionSchema,
    LoginRequestSchema,
    SocialAuthExchangeSchema,
    PushDeviceRegisterSchema,
    PushDeviceUnregisterSchema,
    QuestCreate,
    GoalSelectSchema,
    QuestReplaceSchema,
    RecoverAccountSchema,
    RefreshTokenSchema,
    ProfileUpdateSchema,
    ShopPurchaseSchema,
    UpgradeItemSchema,
    UserCreate,
)
from app.services import auth_service, character_service, crafting_service, mobile_service, multiplayer_service, notification_service, quest_service

router = APIRouter(prefix="/api/v1", tags=["РњРѕР±РёР»СЊРЅРѕРµ API"])


@router.get("/auth/telegram/bridge", summary="Telegram auth bridge", include_in_schema=False)
async def auth_telegram_bridge(request: Request):
    query_string = request.url.query
    target_base = f"{SOCIAL_AUTH_REDIRECT_SCHEME}://auth/telegram"

    if not query_string:
        return RedirectResponse(url=f"{target_base}?error=telegram_auth_payload_missing", status_code=302)

    if "hash=" not in query_string:
        return RedirectResponse(url=f"{target_base}?error=telegram_auth_hash_missing", status_code=302)

    return RedirectResponse(url=f"{target_base}?init_data={quote(query_string, safe='')}", status_code=302)


@router.get("", summary="РљРѕСЂРµРЅСЊ API")
async def api_root():
    return success_response({"service": "RPG Life API", "status": "ok"}, "API РґРѕСЃС‚СѓРїРЅРѕ")


@router.post(
    "/auth/login",
    summary="Р’С…РѕРґ",
    description="РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІС‹РґР°С‡Р° access/refresh JWT С‚РѕРєРµРЅРѕРІ РґР»СЏ РјРѕР±РёР»СЊРЅРѕРіРѕ РєР»РёРµРЅС‚Р°.",
)
async def auth_login(request: Request, payload: LoginRequestSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-login", limit=10, window_seconds=60)
    return success_response(auth_service.login_user_tokens(db, payload.email, payload.password), "Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ")


@router.post(
    "/auth/register",
    summary="Р РµРіРёСЃС‚СЂР°С†РёСЏ",
    description="Р РµРіРёСЃС‚СЂР°С†РёСЏ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІС‹РґР°С‡Р° access/refresh JWT С‚РѕРєРµРЅРѕРІ.",
)
async def auth_register(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-register", limit=5, window_seconds=300)
    return success_response(auth_service.register_user_tokens(db, payload), "Р РµРіРёСЃС‚СЂР°С†РёСЏ РІС‹РїРѕР»РЅРµРЅР°", status_code=201)


@router.post(
    "/auth/refresh",
    summary="РћР±РЅРѕРІР»РµРЅРёРµ access С‚РѕРєРµРЅР°",
    description="РћР±РјРµРЅ РІР°Р»РёРґРЅРѕРіРѕ refresh С‚РѕРєРµРЅР° РЅР° РЅРѕРІСѓСЋ РїР°СЂСѓ С‚РѕРєРµРЅРѕРІ.",
)
async def auth_refresh(request: Request, payload: RefreshTokenSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-refresh", limit=20, window_seconds=300)
    return success_response(auth_service.refresh_access_token(db, payload.refresh_token), "РўРѕРєРµРЅ РѕР±РЅРѕРІР»РµРЅ")


@router.get("/auth/providers", summary="Available social auth providers")
async def auth_providers():
    return success_response({"providers": auth_service.get_social_auth_providers()}, "Social auth providers loaded")


@router.post("/auth/social", summary="Social auth sign-in")
async def auth_social(request: Request, payload: SocialAuthExchangeSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket=f"mobile-social-{payload.provider}", limit=10, window_seconds=60)
    return success_response(
        auth_service.authenticate_social_mobile(
            db,
            payload.provider,
            id_token=payload.id_token,
            access_token=payload.access_token,
            authorization_code=payload.authorization_code,
            init_data=payload.init_data,
        ),
        "Social auth completed",
    )


@router.post("/auth/change-password", summary="Change password")
async def auth_change_password(
    payload: ChangePasswordSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        auth_service.change_password(db, current_user, payload.current_password, payload.new_password),
        "Password updated",
    )


@router.post("/auth/recover-account", summary="Recover account")
async def auth_recover_account(request: Request, payload: RecoverAccountSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-recover", limit=5, window_seconds=900)
    return success_response(auth_service.recover_account(db, payload.email), "Recovery request received")


@router.get("/profile", summary="РџСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ")
async def get_profile(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_profile(db, current_user))


@router.post("/notifications/devices/register", summary="Register push device")
async def register_notification_device(
    payload: PushDeviceRegisterSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        notification_service.register_push_device(db, current_user, payload),
        "Push device registered",
    )


@router.post("/notifications/devices/unregister", summary="Unregister push device")
async def unregister_notification_device(
    payload: PushDeviceUnregisterSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        notification_service.unregister_push_device(db, current_user, payload.push_token),
        "Push device unregistered",
    )


@router.get("/character/profile", summary="РџСЂРѕС„РёР»СЊ РїРµСЂСЃРѕРЅР°Р¶Р°")
async def get_character_profile(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_character_profile(db, current_user))


@router.get("/quests/daily", summary="Р•Р¶РµРґРЅРµРІРЅС‹Рµ Р·Р°РґР°РЅРёСЏ")
async def get_daily_quests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "created_at",
    bucket: str | None = Query(default=None, pattern="^(daily|weekly|long_term)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_daily_quests(db, current_user, page, limit, sort, bucket))


@router.post("/quests/regenerate-today", summary="Regenerate today's quests")
async def regenerate_today_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        mobile_service.regenerate_today_quests(db, current_user),
        "Today's quests regenerated",
    )


@router.post("/quests/regenerate-ai", summary="Regenerate quests by AI assistant")
async def regenerate_ai_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        quest_service.regenerate_ai_goal_quests(db, current_user),
        "AI quests regenerated",
    )


@router.get("/goals/templates", summary="Goal cards and term templates")
async def get_goal_templates():
    return success_response(quest_service.get_goal_templates())


@router.get("/goals/current", summary="Current goal state")
async def get_current_goal(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.get_goal_state(db, current_user))


@router.post("/goals/select", summary="Select or change active goal")
async def select_goal(
    payload: GoalSelectSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        quest_service.select_goal(
            db,
            current_user,
            payload.goal_type,
            payload.goal_term_months,
            payload.start_new_cycle,
        ),
        "Goal selected",
    )


@router.get("/inventory", summary="РРЅРІРµРЅС‚Р°СЂСЊ")
async def get_inventory(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "acquired_at",
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_inventory(db, current_user, page, limit, sort))


@router.post("/inventory/equip", summary="Р­РєРёРїРёСЂРѕРІР°С‚СЊ РїСЂРµРґРјРµС‚")
async def equip_inventory_item(
    payload: InventoryActionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        mobile_service.equip_item(db, current_user, payload.inventory_id, payload.slot or "", payload.class_progress_id),
        "РџСЂРµРґРјРµС‚ СЌРєРёРїРёСЂРѕРІР°РЅ",
    )


@router.get("/rewards/summary", summary="РЎРІРѕРґРєР° РЅР°РіСЂР°Рґ")
async def get_rewards_summary(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_rewards_summary(db, current_user))


@router.get("/challenges", summary="РСЃРїС‹С‚Р°РЅРёСЏ")
async def get_challenges(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "created_at",
    status: str | None = None,
    activity_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_challenges(db, current_user, page, limit, status, activity_type, sort))


@router.get("/leaderboard", summary="РўР°Р±Р»РёС†Р° Р»РёРґРµСЂРѕРІ")
async def get_leaderboard(
    scope: str = Query("global", pattern="^(global|friends)$"),
    metric: str = Query("level"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_leaderboard(db, current_user, scope, metric, page, limit))


@router.get("/events", summary="РЎРѕР±С‹С‚РёСЏ")
async def get_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "start_at",
    event_type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_events(db, page, limit, sort, event_type, status))


@router.get("/achievements", summary="Р”РѕСЃС‚РёР¶РµРЅРёСЏ")
async def get_achievements(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_achievements(db, current_user))


@router.get("/shop", summary="РњР°РіР°Р·РёРЅ")
async def get_shop(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_shop(db, current_user))


@router.post("/shop/refresh", summary="Refresh shop")
async def refresh_shop(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.refresh_shop(db, current_user), "Shop refreshed")


@router.get("/crafting", summary="Crafting overview")
async def get_crafting_overview(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(crafting_service.get_crafting_overview(db, current_user))


@router.post("/crafting/craft", summary="Craft recipe")
async def craft_recipe(
    payload: CraftRecipeSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(crafting_service.craft_recipe(db, current_user, payload.recipe_id), "Item crafted")


@router.post("/crafting/upgrade", summary="Upgrade item")
async def upgrade_crafted_item(
    payload: UpgradeItemSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(crafting_service.upgrade_item(db, current_user, payload.inventory_id), "Item upgraded")


@router.post("/shop/buy", summary="РљСѓРїРёС‚СЊ РїСЂРµРґРјРµС‚")
async def buy_shop_item(
    payload: ShopPurchaseSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.buy_shop_item(db, current_user, payload.item_id), "РџРѕРєСѓРїРєР° РІС‹РїРѕР»РЅРµРЅР°")


@router.get("/character/equipment", summary="РћР±Р·РѕСЂ СЌРєРёРїРёСЂРѕРІРєРё")
async def get_equipment_overview(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_equipment_overview(db, current_user))


@router.get("/inventory/{inventory_id}", summary="Р”РµС‚Р°Р»Рё РїСЂРµРґРјРµС‚Р°")
async def get_inventory_item_detail(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_inventory_item_detail(db, current_user, inventory_id))


@router.post("/inventory/sell", summary="РџСЂРѕРґР°С‚СЊ РїСЂРµРґРјРµС‚")
async def sell_inventory_item(
    payload: InventoryActionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.sell_inventory_item(db, current_user, payload.inventory_id), "РџСЂРµРґРјРµС‚ РїСЂРѕРґР°РЅ")


@router.post("/inventory/unequip", summary="РЎРЅСЏС‚СЊ РїСЂРµРґРјРµС‚")
async def unequip_inventory_item(
    payload: InventoryActionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.unequip_inventory_item(db, current_user, payload.inventory_id), "РџСЂРµРґРјРµС‚ СЃРЅСЏС‚")


@router.post("/quests", summary="РЎРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ Р·Р°РґР°РЅРёРµ")
async def create_custom_quest(
    payload: QuestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.create_custom_quest(db, current_user, payload), "Р—Р°РґР°РЅРёРµ СЃРѕР·РґР°РЅРѕ", status_code=201)


@router.post("/quests/{quest_id}/complete", summary="Р—Р°РІРµСЂС€РёС‚СЊ Р·Р°РґР°РЅРёРµ")
async def complete_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.complete_quest(db, current_user.id, quest_id), "Р—Р°РґР°РЅРёРµ РІС‹РїРѕР»РЅРµРЅРѕ")


@router.post("/quests/{quest_id}/accept", summary="Accept quest from swipe card")
async def accept_goal_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.accept_goal_quest(db, current_user, quest_id), "Quest accepted")


@router.post("/quests/{quest_id}/replace", summary="Replace quest from swipe card")
async def replace_goal_quest(
    quest_id: int,
    payload: QuestReplaceSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        quest_service.replace_goal_quest(db, current_user, quest_id, payload.source),
        "Quest replaced",
    )


@router.post("/quests/{quest_id}/delete", summary="РЈРґР°Р»РёС‚СЊ Р·Р°РґР°РЅРёРµ")
async def delete_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.delete_quest(db, current_user.id, quest_id), "Р—Р°РґР°РЅРёРµ СѓРґР°Р»РµРЅРѕ")


@router.post("/rewards/daily-bonus/claim", summary="Р—Р°Р±СЂР°С‚СЊ РµР¶РµРґРЅРµРІРЅС‹Р№ Р±РѕРЅСѓСЃ")
async def claim_daily_bonus(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(quest_service.claim_daily_bonus(db, current_user.id), "Р‘РѕРЅСѓСЃ РїРѕР»СѓС‡РµРЅ")


@router.post("/rewards/weekly-goal/claim", summary="Claim weekly goal reward")
async def claim_weekly_goal_reward(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.claim_weekly_goal_reward(db, current_user), "Weekly reward claimed")


@router.post("/rewards/seasonal-goal/claim", summary="Claim seasonal goal reward")
async def claim_seasonal_goal_reward(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.claim_seasonal_goal_reward(db, current_user), "Seasonal reward claimed")


@router.post("/profile/update", summary="РћР±РЅРѕРІРёС‚СЊ РїСЂРѕС„РёР»СЊ")
async def update_profile(
    payload: ProfileUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(character_service.update_profile(db, current_user.id, payload), "РџСЂРѕС„РёР»СЊ РѕР±РЅРѕРІР»РµРЅ")


@router.post("/challenges", summary="РЎРѕР·РґР°С‚СЊ РїСѓР±Р»РёС‡РЅРѕРµ РёСЃРїС‹С‚Р°РЅРёРµ")
async def create_challenge(
    payload: ChallengeCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(multiplayer_service.create_challenge(db, current_user.id, payload), "РСЃРїС‹С‚Р°РЅРёРµ СЃРѕР·РґР°РЅРѕ", status_code=201)


@router.post("/challenges/{challenge_id}/join", summary="РџСЂРёСЃРѕРµРґРёРЅРёС‚СЊСЃСЏ Рє РёСЃРїС‹С‚Р°РЅРёСЋ")
async def join_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(multiplayer_service.join_challenge(db, challenge_id, current_user.id), "РЈС‡Р°СЃС‚РёРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ")

