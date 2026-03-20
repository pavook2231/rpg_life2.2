import json
import time
from threading import Lock

from app.core.config import REDIS_URL


class InMemoryCache:
    def __init__(self):
        self._store = {}
        self._lock = Lock()

    def get(self, key: str):
        with self._lock:
            payload = self._store.get(key)
            if not payload:
                return None
            expires_at, value = payload
            if expires_at < time.time():
                self._store.pop(key, None)
                return None
            return value

    def setex(self, key: str, ttl: int, value: str):
        with self._lock:
            self._store[key] = (time.time() + ttl, value)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def delete_prefix(self, prefix: str):
        with self._lock:
            keys = [key for key in self._store if key.startswith(prefix)]
            for key in keys:
                self._store.pop(key, None)


def _build_client():
    if not REDIS_URL:
        return InMemoryCache(), False
    try:
        import redis  # type: ignore

        client = redis.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        return client, True
    except Exception:
        return InMemoryCache(), False


cache_client, redis_enabled = _build_client()


def cache_get_json(key: str):
    value = cache_client.get(key)
    if not value:
        return None
    if isinstance(value, str):
        return json.loads(value)
    return value


def cache_set_json(key: str, payload, ttl: int = 60):
    serialized = json.dumps(payload, default=str)
    cache_client.setex(key, ttl, serialized)


def cache_delete(key: str):
    cache_client.delete(key)


def cache_delete_prefix(prefix: str):
    if redis_enabled:
        for key in cache_client.scan_iter(f"{prefix}*"):
            cache_client.delete(key)
    else:
        cache_client.delete_prefix(prefix)


def invalidate_leaderboard_cache():
    # Leaderboard payloads depend on both rendered leaderboard pages and cached aggregated user stats.
    cache_delete_prefix("leaderboard:")
    cache_delete_prefix("user_stats:")


def invalidate_profile_cache():
    cache_delete_prefix("profile:")


def set_temporary_event_state(event_key: str, payload, ttl: int = 3600):
    cache_set_json(f"event:{event_key}", payload, ttl)


def get_temporary_event_state(event_key: str):
    return cache_get_json(f"event:{event_key}")
