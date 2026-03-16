from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app import auth
from app.api.dependencies import verify_csrf_token
from app.core.database import get_db
from app.models import User
from app.schemas.beta_schema import (
    BetaChallengeFinishSchema,
    BetaChallengeProgressSchema,
    BossCompleteSchema,
    BossProgressSchema,
    ChestOpenSchema,
    FriendAddSchema,
)
from app.services import beta_service, social_service

router = APIRouter()


@router.post("/chests/open")
async def open_chest(
    payload: ChestOpenSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return beta_service.open_chest(db, current_user, payload)


@router.get("/bosses")
async def get_bosses(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return beta_service.list_bosses(db, current_user)


@router.get("/bosses/current")
async def get_current_boss(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return beta_service.get_current_boss(db, current_user)


@router.post("/bosses/progress")
async def progress_boss(
    payload: BossProgressSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return beta_service.update_boss_progress(db, current_user, payload)


@router.post("/bosses/complete")
async def complete_boss(
    payload: BossCompleteSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return beta_service.complete_boss(db, current_user, payload)


@router.post("/friends/add")
async def add_friend(
    payload: FriendAddSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return social_service.send_friend_request(db, current_user, payload.friend_id)


@router.post("/challenge/progress")
async def progress_challenge(
    payload: BetaChallengeProgressSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return beta_service.update_challenge_progress(db, current_user, payload)


@router.post("/challenge/finish")
async def finish_challenge(
    payload: BetaChallengeFinishSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return beta_service.finish_challenge(db, current_user, payload)
