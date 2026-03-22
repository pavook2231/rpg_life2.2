import type { LeaderboardMetric, LeaderboardScope } from "../../api/game";

export const LEADERBOARD_PAGE_SIZE = 20;
export const LEADERBOARD_METRIC: LeaderboardMetric = "power";
export const META_SEPARATOR = " | ";

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
  return parts.length ? parts.join(META_SEPARATOR) : null;
}

export function formatRankLabel(rank?: number | null) {
  return rank ? `#${rank}` : "—";
}

export function formatScore(value?: number | null) {
  return Math.max(0, Math.trunc(Number(value || 0))).toLocaleString();
}

export function getScopeLabel(
  scope: LeaderboardScope,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (scope === "friends") {
    return translateOrFallback(t, "screens.friends.tabs.friends", "Друзья");
  }
  return translateOrFallback(t, "screens.friends.tabs.global", "Глобальный");
}
