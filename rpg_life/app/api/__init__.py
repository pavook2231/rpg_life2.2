from fastapi import APIRouter

from .beta_routes import router as beta_router
from .mobile_routes import router as mobile_router
from .quests_routes import router as quests_router
from .social_routes import router as social_router


def build_api_router() -> APIRouter:
    router = APIRouter()
    router.include_router(mobile_router)
    router.include_router(beta_router)
    router.include_router(quests_router)
    router.include_router(social_router)
    return router
