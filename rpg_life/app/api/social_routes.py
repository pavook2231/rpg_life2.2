from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app import auth
from app.api.dependencies import enforce_rate_limit, require_admin_user, verify_csrf_token
from app.core.database import get_db
from app.models import User
from app.schemas import (
    ChallengeDecisionSchema,
    ChallengeCreateSchema,
    ChallengeInvitationCreateSchema,
    ChallengeInvitationRespondSchema,
    CoopQuestCreateSchema,
    EventCreateSchema,
    FriendRequestCreateSchema,
    FriendRequestRespondSchema,
)
from app.schemas.beta_schema import BetaChallengeCreateSchema
from app.services import beta_service, multiplayer_service, social_service

router = APIRouter(prefix="/api/v1/social", tags=["Социальные функции"])


@router.post("/api/challenges")
async def api_create_challenge(
    request: Request,
    challenge_data: ChallengeCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return multiplayer_service.create_challenge(db, current_user.id, challenge_data)


@router.post("/api/challenges/{challenge_id}/join")
async def api_join_challenge(
    challenge_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return multiplayer_service.join_challenge(db, challenge_id, current_user.id)


@router.post("/friends/request")
async def send_friend_request(
    request: Request,
    payload: FriendRequestCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    await enforce_rate_limit(request, bucket="social-friend-request", limit=10, window_seconds=60)
    return social_service.send_friend_request(db, current_user, payload.receiver_id)


@router.post("/friends/add")
async def add_friend(
    request: Request,
    payload: FriendRequestCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    await enforce_rate_limit(request, bucket="social-friend-request", limit=10, window_seconds=60)
    return social_service.send_friend_request(db, current_user, payload.receiver_id)


@router.post("/friends/accept")
async def respond_friend_request(
    request: Request,
    payload: FriendRequestRespondSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    await enforce_rate_limit(request, bucket="social-friend-response", limit=20, window_seconds=60)
    return social_service.respond_friend_request(db, current_user, payload.request_id, payload.action)


@router.post("/friends/decline")
async def decline_friend_request(
    request: Request,
    payload: FriendRequestRespondSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    await enforce_rate_limit(request, bucket="social-friend-response", limit=20, window_seconds=60)
    return social_service.respond_friend_request(db, current_user, payload.request_id, "decline")


@router.get("/friends")
async def get_friends(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return social_service.list_friends(db, current_user, page, page_size, search, sort_by, sort_order)


@router.get("/friends/list")
async def list_friends(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return social_service.list_friends(db, current_user, page, page_size, search, sort_by, sort_order)


@router.get("/friends/requests")
async def list_friend_requests(
    status: str = Query("pending"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return social_service.list_friend_requests(db, current_user, status)


@router.get("/friends/search")
async def search_users(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await enforce_rate_limit(request, bucket="social-friend-search", limit=20, window_seconds=60)
    return social_service.search_users(db, current_user, q, page, page_size)


@router.post("/challenge/create")
async def create_pvp_challenge(
    request: Request,
    payload: BetaChallengeCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return beta_service.create_challenge(db, current_user, payload)


@router.post("/challenge/accept")
async def respond_pvp_challenge(
    request: Request,
    payload: ChallengeDecisionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return social_service.respond_pvp_challenge(db, current_user, payload.challenge_id, payload.action)


@router.get("/challenge/list")
async def list_pvp_challenges(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    activity_type: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return beta_service.list_challenges(db, current_user, status, activity_type, page, page_size)


@router.get("/challenge/result")
async def get_pvp_result(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return social_service.get_pvp_result(db, current_user, challenge_id)


@router.get("/leaderboard/global")
async def get_global_leaderboard(
    request: Request,
    metric: str = "power",
    period: str = Query("all_time", pattern="^(all_time|weekly|season)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await enforce_rate_limit(request, bucket="social-leaderboard", limit=60, window_seconds=60)
    return social_service.get_global_leaderboard(db, metric, page, page_size, period, current_user.id)


@router.get("/leaderboard/friends")
async def get_friends_leaderboard(
    request: Request,
    metric: str = "power",
    period: str = Query("all_time", pattern="^(all_time|weekly|season)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await enforce_rate_limit(request, bucket="social-leaderboard", limit=60, window_seconds=60)
    return social_service.get_friends_leaderboard(db, current_user, metric, page, page_size, period)


@router.post("/coop-quests/create")
async def create_coop_quest(
    request: Request,
    payload: CoopQuestCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return social_service.create_coop_quest(db, current_user, payload)


@router.get("/coop-quests/list")
async def list_coop_quests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return social_service.list_coop_quests(db, current_user, page, page_size, status, sort_by, sort_order)


@router.post("/events")
async def create_event(
    payload: EventCreateSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    require_admin_user(current_user)
    return social_service.create_event(db, payload)


@router.get("/events")
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: str | None = None,
    status: str | None = None,
    sort_by: str = "start_at",
    sort_order: str = "asc",
    db: Session = Depends(get_db),
):
    return social_service.list_events(db, page, page_size, event_type, status, sort_by, sort_order)


@router.post("/challenges/invitations")
async def send_challenge_invitation(
    request: Request,
    payload: ChallengeInvitationCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    await enforce_rate_limit(request, bucket="social-challenge-invitation-write", limit=10, window_seconds=60)
    invitation = social_service.send_challenge_invitation(
        db,
        current_user,
        payload.receiver_id,
        payload.challenge_type,
        payload.title,
        payload.description,
        payload.objective_type,
        payload.goal,
        payload.reward_xp,
        payload.reward_crystals,
    )
    return {"message": "Приглашение отправлено", "invitation_id": invitation.id}


@router.post("/challenges/invitations/respond")
async def respond_challenge_invitation(
    request: Request,
    payload: ChallengeInvitationRespondSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    await enforce_rate_limit(request, bucket="social-challenge-invitation-write", limit=20, window_seconds=60)
    result = social_service.respond_challenge_invitation(db, current_user, payload.invitation_id, payload.action)
    return result


@router.get("/challenges/invitations")
async def list_challenge_invitations(
    request: Request,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await enforce_rate_limit(request, bucket="social-challenge-invitation-read", limit=30, window_seconds=60)
    invitations = social_service.list_challenge_invitations(db, current_user, status)
    return {"invitations": invitations}
