from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app import auth
from app.api.dependencies import verify_csrf_token
from app.core.database import get_db
from app.models import User
from app.schemas import QuestCreate
from app.services import quest_service

router = APIRouter()


@router.post("/api/quests/{qid}/complete")
async def api_complete_quest(
    qid: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return quest_service.complete_quest(db, current_user.id, qid)


@router.post("/api/quests")
async def api_create_quest(
    request: Request,
    quest_data: QuestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return quest_service.create_custom_quest(db, current_user, quest_data)


@router.post("/api/quests/{qid}/delete")
async def api_delete_quest(
    qid: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return quest_service.delete_quest(db, current_user.id, qid)


@router.get("/api/daily-bonus")
async def api_daily_bonus_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return quest_service.get_daily_bonus_info(db, current_user.id)


@router.post("/api/daily-bonus/claim")
async def api_claim_daily_bonus(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    await verify_csrf_token(request)
    return quest_service.claim_daily_bonus(db, current_user.id)


@router.get("/api/classes")
async def get_classes_api(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return quest_service.get_classes_payload(db, current_user.id)


@router.get("/api/stats")
async def api_get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return quest_service.get_user_stats(db, current_user.id)
