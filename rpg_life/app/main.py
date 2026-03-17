import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.requests import Request

from app.api import build_api_router
from app.core.config import (
    APP_ENV,
    CORS_ALLOWED_ORIGINS,
    CORS_ALLOW_ORIGIN_REGEX,
    IS_PRODUCTION,
    REDIS_URL,
    RUN_STARTUP_DATA_REPAIR,
    USE_INTERNAL_SCHEDULER,
    validate_runtime_config,
)
from app.core.database import engine, init_db, normalize_existing_strings
from app.core.rate_limit import RateLimitMiddleware
from app.core.responses import error_payload
from app.scheduler import start_scheduler
from app.services.beta_service import bootstrap_beta_content
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_config()
    init_db()
    db = SessionLocal()
    try:
        bootstrap_beta_content(db)
    finally:
        db.close()
    if RUN_STARTUP_DATA_REPAIR:
        normalize_existing_strings()
    if USE_INTERNAL_SCHEDULER:
        start_scheduler()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="RPG Life API",
        version="3.0.0",
        description="API-first бэкенд для RPG Life (mobile и web).",
        lifespan=lifespan,
    )

    @app.get("/", include_in_schema=False)
    async def root():
        return {"status": "ok"}

    @app.get("/healthz", include_in_schema=False)
    async def healthz():
        return {"status": "ok", "service": "RPG Life API", "env": APP_ENV, "version": app.version}

    @app.get("/readyz", include_in_schema=False)
    async def readyz():
        checks: dict[str, str] = {}

        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            checks["db"] = "ok"
        except Exception:
            checks["db"] = "error"
            return JSONResponse(
                status_code=503,
                content={
                    "status": "error",
                    "checks": checks,
                    "message": "База данных недоступна",
                },
            )

        # В production Redis обязателен (Celery broker/result backend и cache).
        if IS_PRODUCTION:
            try:
                import redis  # type: ignore

                redis_client = redis.from_url(REDIS_URL, decode_responses=True)
                redis_client.ping()
                checks["redis"] = "ok"
            except Exception:
                checks["redis"] = "error"
                return JSONResponse(
                    status_code=503,
                    content={
                        "status": "error",
                        "checks": checks,
                        "message": "Redis недоступен",
                    },
                )
        else:
            checks["redis"] = "пропущено"

        return {"status": "ok", "checks": checks}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOWED_ORIGINS,
        allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware, requests_per_minute=180)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if IS_PRODUCTION:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.exception_handler(FastAPIHTTPException)
    async def http_exception_handler(request: Request, exc: FastAPIHTTPException):
        return JSONResponse(status_code=exc.status_code, content=error_payload(str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        def _serialize_error(obj):
            if isinstance(obj, dict):
                return {k: _serialize_error(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [_serialize_error(item) for item in obj]
            elif isinstance(obj, Exception):
                return str(obj)
            else:
                return obj
        errors = _serialize_error(exc.errors())
        return JSONResponse(status_code=422, content=error_payload("Ошибка валидации", {"errors": errors}))

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            "Необработанная ошибка приложения",
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return JSONResponse(status_code=500, content=error_payload("Внутренняя ошибка сервера"))

    app.include_router(build_api_router())
    return app


app = create_app()
