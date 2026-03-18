import os
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(dotenv_path=ENV_FILE)


def _env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return [item.strip() for item in raw_value.split(",") if item.strip()]


_TELEGRAM_BOT_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{5,32}$")


def normalize_telegram_bot_username(raw_value: str | None) -> str:
    value = (raw_value or "").strip()
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme:
        host = (parsed.netloc or "").lower()
        if host not in {"t.me", "www.t.me", "telegram.me", "www.telegram.me"}:
            return ""
        value = parsed.path.strip("/")
    else:
        lowered_value = value.lower()
        for prefix in ("t.me/", "www.t.me/", "telegram.me/", "www.telegram.me/"):
            if lowered_value.startswith(prefix):
                value = value[len(prefix):]
                break

    value = value.strip().lstrip("@").strip("/")
    if "/" in value:
        value = value.split("/", 1)[0]

    if not _TELEGRAM_BOT_USERNAME_RE.fullmatch(value):
        return ""
    if not value.lower().endswith("bot"):
        return ""
    return value


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-prod")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_DELTA = timedelta(days=int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "7")))
ALLOW_SQLITE_FALLBACK = _env_bool("ALLOW_SQLITE_FALLBACK", True)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
USE_INTERNAL_SCHEDULER = _env_bool("USE_INTERNAL_SCHEDULER", False)
AUTO_CREATE_TABLES = _env_bool("AUTO_CREATE_TABLES", False)
RUN_STARTUP_DATA_REPAIR = _env_bool("RUN_STARTUP_DATA_REPAIR", not IS_PRODUCTION)

ACCESS_COOKIE_NAME = os.getenv("ACCESS_COOKIE_NAME", "access_token")
CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "csrf_token")
COOKIE_SECURE = _env_bool("COOKIE_SECURE", IS_PRODUCTION)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()

DEFAULT_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]
CORS_ALLOWED_ORIGINS = _env_csv(
    "CORS_ALLOWED_ORIGINS",
    [] if IS_PRODUCTION else DEFAULT_DEV_CORS_ORIGINS,
)
CORS_ALLOW_ORIGIN_REGEX = os.getenv(
    "CORS_ALLOW_ORIGIN_REGEX",
    r"https?://(localhost|127\.0\.0\.1):(3000|8081)$" if not IS_PRODUCTION else "",
).strip() or None
ADMIN_EMAILS = {email.lower() for email in _env_csv("ADMIN_EMAILS", [])}

CACHE_TTL_LEADERBOARD = int(os.getenv("CACHE_TTL_LEADERBOARD", "60"))
CACHE_TTL_PROFILE = int(os.getenv("CACHE_TTL_PROFILE", "45"))
CACHE_TTL_INVENTORY = int(os.getenv("CACHE_TTL_INVENTORY", "30"))
CACHE_TTL_EVENTS = int(os.getenv("CACHE_TTL_EVENTS", "60"))

ENABLE_PUSH_DISPATCH = _env_bool("ENABLE_PUSH_DISPATCH", True)
ENABLE_ACCOUNT_RECOVERY = _env_bool("ENABLE_ACCOUNT_RECOVERY", False)
EXPO_PUSH_ENDPOINT = os.getenv("EXPO_PUSH_ENDPOINT", "https://exp.host/--/api/v2/push/send").strip()
EXPO_PUSH_ACCESS_TOKEN = os.getenv("EXPO_PUSH_ACCESS_TOKEN", "").strip()
PUSH_QUEUE_BATCH_SIZE = int(os.getenv("PUSH_QUEUE_BATCH_SIZE", "50"))
PUSH_QUEUE_MAX_ATTEMPTS = int(os.getenv("PUSH_QUEUE_MAX_ATTEMPTS", "5"))
PUSH_QUEUE_RETRY_DELAY_SECONDS = int(os.getenv("PUSH_QUEUE_RETRY_DELAY_SECONDS", "60"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
OPENAI_QUEST_REWRITE_ENABLED = _env_bool("OPENAI_QUEST_REWRITE_ENABLED", True)
OPENAI_QUEST_MODEL = os.getenv("OPENAI_QUEST_MODEL", "gpt-5-mini").strip() or "gpt-5-mini"
OPENAI_QUEST_TIMEOUT_SECONDS = float(os.getenv("OPENAI_QUEST_TIMEOUT_SECONDS", "20"))
QUEST_TEXT_PROVIDER = os.getenv("QUEST_TEXT_PROVIDER", "free").strip().lower() or "free"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1").strip().rstrip("/")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "").strip()
OLLAMA_QUEST_MODEL = os.getenv("OLLAMA_QUEST_MODEL", "qwen2.5:7b-instruct").strip() or "qwen2.5:7b-instruct"
OLLAMA_QUEST_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_QUEST_TIMEOUT_SECONDS", str(OPENAI_QUEST_TIMEOUT_SECONDS)))

SOCIAL_AUTH_REDIRECT_SCHEME = os.getenv("SOCIAL_AUTH_REDIRECT_SCHEME", "rpglife").strip()
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")

GOOGLE_AUTH_ENABLED = _env_bool("GOOGLE_AUTH_ENABLED", False)
GOOGLE_AUTH_MOBILE_CLIENT_ID = os.getenv("GOOGLE_AUTH_MOBILE_CLIENT_ID", "").strip()
GOOGLE_AUTH_ANDROID_CLIENT_ID = os.getenv("GOOGLE_AUTH_ANDROID_CLIENT_ID", "").strip()
GOOGLE_AUTH_IOS_CLIENT_ID = os.getenv("GOOGLE_AUTH_IOS_CLIENT_ID", "").strip()
GOOGLE_AUTH_WEB_CLIENT_ID = os.getenv("GOOGLE_AUTH_WEB_CLIENT_ID", "").strip()
GOOGLE_AUTH_CLIENT_SECRET = os.getenv("GOOGLE_AUTH_CLIENT_SECRET", "").strip()
GOOGLE_AUTH_MAX_AGE_SECONDS = int(os.getenv("GOOGLE_AUTH_MAX_AGE_SECONDS", "900"))
GOOGLE_AUTH_ACCEPTED_CLIENT_IDS = tuple(
    dict.fromkeys(
        client_id
        for client_id in (
            GOOGLE_AUTH_MOBILE_CLIENT_ID,
            GOOGLE_AUTH_ANDROID_CLIENT_ID,
            GOOGLE_AUTH_IOS_CLIENT_ID,
            GOOGLE_AUTH_WEB_CLIENT_ID,
        )
        if client_id
    )
)

VK_AUTH_ENABLED = _env_bool("VK_AUTH_ENABLED", False)
VK_AUTH_APP_ID = os.getenv("VK_AUTH_APP_ID", "").strip()
VK_AUTH_SCOPE = os.getenv("VK_AUTH_SCOPE", "email").strip() or "email"
VK_AUTH_DOMAIN = os.getenv("VK_AUTH_DOMAIN", "id.vk.com").strip().rstrip("/")
VK_AUTH_MAX_AGE_SECONDS = int(os.getenv("VK_AUTH_MAX_AGE_SECONDS", "900"))
SOCIAL_BRIDGE_TICKET_MAX_AGE_SECONDS = int(os.getenv("SOCIAL_BRIDGE_TICKET_MAX_AGE_SECONDS", "300"))

YANDEX_AUTH_ENABLED = _env_bool("YANDEX_AUTH_ENABLED", False)
YANDEX_AUTH_MOBILE_CLIENT_ID = os.getenv("YANDEX_AUTH_MOBILE_CLIENT_ID", "").strip()
YANDEX_AUTH_CLIENT_SECRET = os.getenv("YANDEX_AUTH_CLIENT_SECRET", "").strip()

TELEGRAM_AUTH_ENABLED = _env_bool("TELEGRAM_AUTH_ENABLED", False)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_BOT_USERNAME_RAW = os.getenv("TELEGRAM_BOT_USERNAME", "").strip()
TELEGRAM_BOT_USERNAME = normalize_telegram_bot_username(TELEGRAM_BOT_USERNAME_RAW)
TELEGRAM_AUTH_MAX_AGE_SECONDS = int(os.getenv("TELEGRAM_AUTH_MAX_AGE_SECONDS", "900"))

XP_BASE = 500
XP_MULTIPLIER = 1.5


def get_xp_for_level(level: int) -> int:
    return int(XP_BASE * (level ** XP_MULTIPLIER))


def get_total_xp_for_level(level: int) -> int:
    total = 0
    for current_level in range(1, level):
        total += get_xp_for_level(current_level)
    return total


CLASS_GROWTH = {
    "warrior": {"strength": 1.2, "agility": 0.6, "intellect": 0.4, "stamina": 1.0},
    "archer": {"strength": 0.4, "agility": 1.2, "intellect": 0.6, "stamina": 0.8},
    "mage": {"strength": 0.4, "agility": 0.6, "intellect": 1.2, "stamina": 0.7},
}

STAT_EFFECTS = {
    "strength_xp_bonus": 0.05,
    "agility_crystal_chance": 0.02,
    "intellect_xp_bonus": 0.05,
    "intellect_cost_reduction": 0.01,
}

QUEST_RARITY = {
    "common": {"name": "Обычный", "color": "#A0A0A0", "xp_base": 20, "count_ratio": 1.0},
    "uncommon": {"name": "Необычный", "color": "#50C878", "xp_base": 30, "count_ratio": 0.8},
    "rare": {"name": "Редкий", "color": "#1E90FF", "xp_base": 50, "count_ratio": 0.6},
    "mythic": {"name": "Мифический", "color": "#800080", "xp_base": 100, "count_ratio": 0.4},
    "legendary": {"name": "Легендарный", "color": "#FFA500", "xp_base": 150, "count_ratio": 0.2},
    "immortal": {"name": "Бессмертный", "color": "#E0115F", "xp_base": 250, "count_ratio": 0.1},
}

MAX_CUSTOM_QUESTS_PER_DAY = 10


def validate_runtime_config() -> None:
    if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
        raise RuntimeError("COOKIE_SAMESITE должен быть одним из: lax, strict, none")

    if IS_PRODUCTION:
        if USE_INTERNAL_SCHEDULER:
            raise RuntimeError("В production параметр USE_INTERNAL_SCHEDULER должен быть выключен")
        if AUTO_CREATE_TABLES:
            raise RuntimeError("В production параметр AUTO_CREATE_TABLES должен быть выключен")
        if ALLOW_SQLITE_FALLBACK:
            raise RuntimeError("В production параметр ALLOW_SQLITE_FALLBACK должен быть выключен")
        if SECRET_KEY == "change-me-in-prod":
            raise RuntimeError("В production параметр SECRET_KEY должен быть переопределен")
        if len(SECRET_KEY) < 32:
            raise RuntimeError("В production параметр SECRET_KEY должен быть не короче 32 символов")
        if COOKIE_SAMESITE == "none" and not COOKIE_SECURE:
            raise RuntimeError("Если COOKIE_SAMESITE = 'none', то COOKIE_SECURE должен быть true")
