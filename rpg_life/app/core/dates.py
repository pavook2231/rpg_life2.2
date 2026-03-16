from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return naive UTC datetime while avoiding deprecated utcnow()."""
    return datetime.now(UTC).replace(tzinfo=None)
