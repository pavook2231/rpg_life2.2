import type {
  FriendItem,
  FriendRequestItem,
  FriendSearchStatus,
  PresenceStatus,
  SocialUserPreview,
  UserSearchResult,
} from "./types";

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

function asPresenceStatus(value: unknown): PresenceStatus {
  return value === "online" ? "online" : "offline";
}

function asFriendSearchStatus(value: unknown): FriendSearchStatus {
  if (value === "friend" || value === "outgoing_pending" || value === "incoming_pending") {
    return value;
  }
  return "none";
}

function warnInvalid(kind: string, payload: unknown) {
  console.warn(`[friends] dropped invalid ${kind}`, payload);
}

export function sanitizeSocialUserPreview(payload: unknown): SocialUserPreview | null {
  const record = asRecord(payload);
  if (!record) {
    warnInvalid("social-user", payload);
    return null;
  }

  const id = asNumber(record.id, NaN);
  if (!Number.isFinite(id) || id <= 0) {
    warnInvalid("social-user", payload);
    return null;
  }

  return {
    id,
    name: typeof record.name === "string" && record.name.trim() ? record.name : "Игрок",
    username: asOptionalString(record.username),
    friend_id: asOptionalString(record.friend_id),
    class_name: asOptionalString(record.class_name),
    class_display_name: asOptionalString(record.class_display_name),
    level: asOptionalNumber(record.level),
    current_xp: asOptionalNumber(record.current_xp),
    power_rating: asOptionalNumber(record.power_rating),
    goal_type: asOptionalString(record.goal_type),
    goal_title: asOptionalString(record.goal_title),
    goal_progress_percent: asOptionalNumber(record.goal_progress_percent),
    goal_cycle_xp: asOptionalNumber(record.goal_cycle_xp),
    goal_target_xp: asOptionalNumber(record.goal_target_xp),
    presence_status: asPresenceStatus(record.presence_status),
    last_active_at: asOptionalString(record.last_active_at),
  };
}

export function sanitizeFriendItem(payload: unknown): FriendItem | null {
  const record = asRecord(payload);
  const user = sanitizeSocialUserPreview(payload);
  if (!record || !user) {
    warnInvalid("friend", payload);
    return null;
  }

  const statsRecord = asRecord(record.stats) ?? {};
  return {
    ...user,
    friends_since: asOptionalString(record.friends_since) ?? "",
    rating_rank: asOptionalNumber(record.rating_rank),
    stats: {
      level: asNumber(statsRecord.level, user.level ?? 1),
      quests_completed: asNumber(statsRecord.quests_completed, 0),
      steps: asNumber(statsRecord.steps, 0),
      challenge_wins: asNumber(statsRecord.challenge_wins, 0),
    },
  };
}

export function sanitizeFriendRequestItem(payload: unknown): FriendRequestItem | null {
  const record = asRecord(payload);
  if (!record) {
    warnInvalid("friend-request", payload);
    return null;
  }

  const id = asNumber(record.id, NaN);
  const user = sanitizeSocialUserPreview(record.user);
  if (!Number.isFinite(id) || id <= 0 || !user) {
    warnInvalid("friend-request", payload);
    return null;
  }

  return {
    id,
    status: record.status === "accepted" || record.status === "declined" ? record.status : "pending",
    direction: record.direction === "incoming" ? "incoming" : "outgoing",
    created_at: asOptionalString(record.created_at),
    responded_at: asOptionalString(record.responded_at),
    user,
  };
}

export function sanitizeUserSearchResult(payload: unknown): UserSearchResult | null {
  const record = asRecord(payload);
  const user = sanitizeSocialUserPreview(payload);
  if (!record || !user) {
    warnInvalid("search-result", payload);
    return null;
  }

  return {
    ...user,
    status: asFriendSearchStatus(record.status),
    request_id: asOptionalNumber(record.request_id),
    rank: asOptionalNumber(record.rank),
    rating_rank: asOptionalNumber(record.rating_rank),
    score: asOptionalNumber(record.score),
    is_current_user: record.is_current_user === true,
  };
}

export function sanitizeFriendItems(items: unknown): FriendItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(sanitizeFriendItem).filter((item): item is FriendItem => Boolean(item));
}

export function sanitizeFriendRequestItems(items: unknown): FriendRequestItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(sanitizeFriendRequestItem).filter((item): item is FriendRequestItem => Boolean(item));
}

export function sanitizeUserSearchResults(items: unknown): UserSearchResult[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(sanitizeUserSearchResult).filter((item): item is UserSearchResult => Boolean(item));
}
