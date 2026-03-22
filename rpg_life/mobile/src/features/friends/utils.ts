import { normalizeDisplayText } from "../../lib/gameUi";
import type { PresenceStatus } from "./types";

export function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function formatIdentityLabel(username?: string | null, friendId?: string | null) {
  const parts = [username ? `@${username}` : null, friendId ?? null].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

export function formatPresenceLabel(
  status: PresenceStatus,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (status === "online") {
    return translateOrFallback(t, "screens.home.quick.overview.online", "Онлайн");
  }
  return translateOrFallback(t, "screens.home.quick.overview.offline", "Оффлайн");
}

export function formatLastActive(lastActiveAt?: string | null) {
  if (!lastActiveAt) {
    return null;
  }

  const parsed = new Date(lastActiveAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function safeDisplayName(value?: string | null, fallback = "Игрок") {
  const normalized = normalizeDisplayText(value);
  return normalized || fallback;
}
