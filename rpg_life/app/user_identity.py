import re

USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 24
PUBLIC_ID_PREFIX = "RPG"

_USERNAME_ALLOWED_RE = re.compile(r"^[a-z][a-z0-9_]{2,23}$")
_NON_USERNAME_CHARS_RE = re.compile(r"[^a-z0-9_]+")
_PUBLIC_ID_RE = re.compile(r"^(?:rpg[-_\s]*)?0*([1-9]\d{0,8})$", re.IGNORECASE)


def build_public_user_id(user_id: int | None) -> str | None:
    if not user_id or user_id <= 0:
        return None
    return f"{PUBLIC_ID_PREFIX}-{user_id:06d}"


def parse_public_user_id(value: str | None) -> int | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.startswith("@"):
        return None
    match = _PUBLIC_ID_RE.match(normalized)
    if not match:
        return None
    return int(match.group(1))


def normalize_username(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = normalize_username_lookup(value)
    if not cleaned:
        return None
    if not cleaned[0].isalpha():
        cleaned = f"hero_{cleaned}"
    cleaned = cleaned[:USERNAME_MAX_LENGTH].strip("_")
    if len(cleaned) < USERNAME_MIN_LENGTH:
        cleaned = f"{cleaned}_hero" if cleaned else "hero"
        cleaned = cleaned[:USERNAME_MAX_LENGTH].strip("_")
    if not cleaned or not cleaned[0].isalpha():
        cleaned = f"hero_{cleaned or 'user'}"
    cleaned = cleaned[:USERNAME_MAX_LENGTH]
    return cleaned if cleaned else None


def normalize_username_lookup(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().lower()
    if cleaned.startswith("@"):
        cleaned = cleaned[1:]
    cleaned = cleaned.replace("-", "_").replace(".", "_").replace(" ", "_")
    cleaned = _NON_USERNAME_CHARS_RE.sub("", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or None


def username_matches_rules(value: str | None) -> bool:
    if value is None:
        return False
    return bool(_USERNAME_ALLOWED_RE.fullmatch(value))


def username_validation_error() -> str:
    return "Username must be 3-24 characters long, start with a letter, and contain only lowercase letters, digits, or underscores"
