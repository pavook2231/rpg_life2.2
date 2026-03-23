import type { LeaderboardEntry, LeaderboardMeResponse, LeaderboardResponse } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function asOptionalNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function warnInvalid(kind: string, payload: unknown) {
  console.warn(`[leaderboard] dropped invalid ${kind}`, payload);
}

export function sanitizeLeaderboardEntry(payload: unknown): LeaderboardEntry | null {
  const record = asRecord(payload);
  if (!record) {
    warnInvalid("entry", payload);
    return null;
  }

  const userId = asNumber(record.user_id, NaN);
  if (!Number.isFinite(userId) || userId <= 0) {
    warnInvalid("entry", payload);
    return null;
  }

  return {
    user_id: userId,
    name: typeof record.name === "string" && record.name.trim() ? record.name : "Игрок",
    username: asOptionalString(record.username),
    friend_id: asOptionalString(record.friend_id),
    rank: asNumber(record.rank, 0),
    score: asNumber(record.score, 0),
    level: asNumber(record.level, 1),
    current_xp: asOptionalNumber(record.current_xp),
    power_rating: asOptionalNumber(record.power_rating),
    quests_completed: asNumber(record.quests_completed, 0),
    steps: asNumber(record.steps, 0),
    challenge_wins: asNumber(record.challenge_wins, 0),
    class_display_name: asOptionalString(record.class_display_name),
    class_name: asOptionalString(record.class_name),
    class_level: asOptionalNumber(record.class_level),
    goal_type: asOptionalString(record.goal_type),
    goal_title: asOptionalString(record.goal_title),
    goal_progress_percent: asOptionalNumber(record.goal_progress_percent),
    goal_cycle_xp: asOptionalNumber(record.goal_cycle_xp),
    goal_target_xp: asOptionalNumber(record.goal_target_xp),
    presence_status: record.presence_status === "online" ? "online" : "offline",
    last_active_at: asOptionalString(record.last_active_at),
    is_current_user: record.is_current_user === true,
  };
}

export function sanitizeLeaderboardEntries(items: unknown): LeaderboardEntry[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(sanitizeLeaderboardEntry).filter((item): item is LeaderboardEntry => Boolean(item));
}

export function sanitizeLeaderboardResponse(payload: LeaderboardResponse): LeaderboardResponse {
  const paginationRecord = asRecord(payload.pagination) ?? {};
  return {
    ...payload,
    items: sanitizeLeaderboardEntries(payload.items),
    pagination: {
      page: asNumber(paginationRecord.page, 1),
      page_size: asNumber(paginationRecord.page_size, 20),
      total_items: asNumber(paginationRecord.total_items, 0),
      total_pages: Math.max(1, asNumber(paginationRecord.total_pages, 1)),
    },
  };
}

export function sanitizeLeaderboardMeResponse(payload: LeaderboardMeResponse): LeaderboardMeResponse | null {
  const item = sanitizeLeaderboardEntry(payload.item);
  if (!item) {
    warnInvalid("me-entry", payload);
    return null;
  }

  return {
    ...payload,
    item,
  };
}
