import { apiRequest } from "./client";
import { fetchWithTtlCache, queueIfOffline } from "../lib/offline";
import {
  buyShopItem as buyCanonicalShopItem,
  equipInventoryItem as equipCanonicalInventoryItem,
  fetchEquipmentOverview as fetchCanonicalEquipmentOverview,
  fetchInventory as fetchCanonicalInventory,
  fetchInventoryItemDetail as fetchCanonicalInventoryItemDetail,
  fetchShop as fetchCanonicalShop,
  openChest as openCanonicalChest,
  refreshShop as refreshCanonicalShop,
  sellInventoryItem as sellCanonicalInventoryItem,
  unequipInventoryItem as unequipCanonicalInventoryItem,
} from "../features/items/itemService";
import { normalizeChestRewardItem } from "../features/items/itemStore";
import type {
  InventoryItem as CanonicalInventoryItem,
  ShopItemPayload as CanonicalShopItemPayload,
  ShopPayload as CanonicalShopPayload,
  ShopPurchasePayload as CanonicalShopPurchasePayload,
} from "../features/items/types";

export type SecondarySkillItem = {
  id: "discipline" | "focus" | "energy" | "charisma" | "luck";
  value: number;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
  effect: Record<string, number>;
  source: Record<string, number>;
};

export type SecondarySkillsPayload = {
  skills: SecondarySkillItem[];
  summary: {
    total_power: number;
    dominant_skill?: SecondarySkillItem["id"] | null;
    streak?: number;
    completed_quests?: number;
  };
};

export type HealthStatePayload = {
  max_health: number;
  current_health: number;
  health_percent: number;
  is_wounded: boolean;
  wounded_until?: string | null;
  penalty_quests_remaining: number;
  reward_penalty_percent: number;
  last_health_decay_at?: string | null;
};

export type StepsSyncPayload = {
  steps: number;
  previous_steps: number;
  delta: number;
  synced_at?: string | null;
  day_started_at: string;
  source: string;
};

export type LeaderboardPeriod = "all_time" | "weekly" | "season";
export type LeaderboardScope = "global" | "friends";
export type LeaderboardMetric = "power" | "level" | "quests" | "steps" | "challenge_wins";

export type LeaderboardEntry = {
  user_id: number;
  name: string;
  username?: string | null;
  friend_id?: string | null;
  rank: number;
  score: number;
  level: number;
  current_xp?: number | null;
  power_rating?: number | null;
  quests_completed: number;
  steps: number;
  challenge_wins: number;
  class_display_name?: string | null;
  class_name?: string | null;
  class_level?: number | null;
  goal_type?: string | null;
  goal_progress_percent?: number | null;
  goal_cycle_xp?: number | null;
  goal_target_xp?: number | null;
  is_current_user?: boolean;
};

export type LeaderboardResponse = {
  metric: string;
  period: LeaderboardPeriod;
  period_started_at?: string | null;
  period_ends_at?: string | null;
  event_id?: number | null;
  season_key?: string | null;
  items: LeaderboardEntry[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
};

export type LeaderboardMeResponse = {
  scope: LeaderboardScope;
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  period_started_at?: string | null;
  period_ends_at?: string | null;
  event_id?: number | null;
  season_key?: string | null;
  item: LeaderboardEntry;
};

export type SocialPulseIdentity = {
  user_id: number;
  name: string;
  username?: string | null;
  friend_id?: string | null;
  score?: number | null;
  gap_steps?: number | null;
  quests_completed?: number | null;
};

export type SocialPulseItem = {
  kind: string;
  title: string;
  description: string;
  action?: string | null;
  action_label?: string | null;
};

export type DailyLimitsPayload = {
  completed_total: number;
  total_cap: number;
  completed_system: number;
  system_cap: number;
  completed_custom: number;
  custom_cap: number;
  remaining_total: number;
  remaining_system: number;
  remaining_custom: number;
};

export type ProfilePayload = {
  user: {
    id: number;
    email: string;
    name: string | null;
    username?: string | null;
    friend_id?: string | null;
    birth_year: number | null;
    gender: string | null;
    goal_type?: string | null;
    goal_term_months?: number | null;
    goal_cycle_xp?: number | null;
    goal_target_xp?: number | null;
    goal_progress_percent?: number | null;
    created_at?: string | null;
  };
  goal?: GoalStatePayload;
  health?: HealthStatePayload;
  classes: Array<{
    id: number;
    class_name: string;
    display_name: string | null;
    level: number;
    current_xp: number;
    crystals: number;
    strength?: number;
    agility?: number;
    intellect?: number;
    stamina?: number;
    max_health?: number;
    current_health?: number;
    streak?: number;
  }>;
  secondary_skills?: SecondarySkillsPayload;
};

export type CharacterProfilePayload = {
  has_character: boolean;
  character?: {
    id: number;
    name: string;
    level: number;
    class: string;
    current_xp: number;
    next_level_xp: number;
    xp_percent: number;
    streak: number;
    crystals: number;
    strength: number;
    agility: number;
    intellect: number;
    stamina?: number;
    goal_cycle_xp?: number;
    goal_target_xp?: number;
    goal_progress_percent?: number;
    health?: HealthStatePayload;
  };
  health?: HealthStatePayload;
  secondary_skills?: SecondarySkillsPayload;
};

export type QuestItem = {
  id: number;
  title: string;
  description: string;
  xp_reward: number;
  crystal_reward: number;
  rarity: string;
  quest_type: string;
  quest_bucket?: "daily" | "weekly" | "long_term";
  goal_type?: string | null;
  goal_id?: string | null;
  difficulty_level?: "easy" | "medium" | "hard";
  goal_progress_percent?: number;
  is_universal?: boolean;
  is_accepted?: boolean;
  objective_type?: string | null;
  objective_label?: string | null;
  target_value?: number | null;
  progress_value?: number | null;
  supports_live_progress?: boolean;
  tracking_mode?: "verified" | "manual";
  can_complete?: boolean;
  is_completed: boolean;
  expires_at?: string | null;
};

export type GoalTemplatePayload = {
  goals: Array<{
    id: string;
    title: string;
    description: string;
    result_example: string;
    icon: string;
    accent_color: string;
    recommended_term_months: number;
    is_primary: boolean;
  }>;
  terms: Array<{
    months: number;
    title: string;
    title_ru?: string;
    tempo: string;
  }>;
};

export type GoalStatePayload = {
  goal_id: string;
  goal_type: string;
  goal_title: string;
  goal_description: string;
  goal_icon: string;
  goal_accent_color: string;
  goal_term_months: number;
  goal_cycle_index: number;
  goal_cycle_xp?: number;
  goal_target_xp?: number;
  goal_progress_percent: number;
  goal_started_at: string;
  goal_deadline_at: string;
  goal_days_passed: number;
  goal_days_total: number;
  goal_days_remaining: number;
  phase: number;
  daily_limits?: DailyLimitsPayload;
  health?: HealthStatePayload;
};

export type InventoryItem = CanonicalInventoryItem;

export type ChallengeItem = {
  id: number;
  title: string;
  description?: string;
  challenge_type: string;
  activity_type: string;
  goal: number;
  status: string;
  reward: {
    xp: number;
    crystals: number;
  };
  opponent?: {
    id: number | null;
    name: string | null;
  } | null;
  creator?: {
    id: number;
    name: string;
  };
  start_time?: string | null;
  end_time?: string | null;
  role?: string;
};

export type AchievementItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "earned" | "available" | "locked";
  xp_reward: number;
  crystal_reward: number;
  theme?: "sport" | "books" | "work" | "self" | "finance" | string;
  background_key?: string;
  tier?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  animated_background?: boolean;
  earned_at?: string | null;
};

export type QuestCompletionPayload = {
  queued?: boolean;
  goal_progress_percent?: number;
  goal_cycle_xp?: number;
  goal_target_xp?: number;
  new_level?: number;
  new_xp?: number;
  next_level_xp?: number;
  xp_percentage?: number;
  new_crystals?: number;
  xp_earned?: number;
  crystals_earned?: number;
  reward_penalty_applied?: boolean;
  daily_limits?: DailyLimitsPayload;
  health?: HealthStatePayload;
  achievements?: Array<{
    title?: string | null;
    description?: string | null;
    icon?: string | null;
    tier?: "common" | "uncommon" | "rare" | "epic" | "legendary" | null;
  }> | null;
  loot_drop?: {
    name?: string | null;
    description?: string | null;
    icon?: string | null;
  } | null;
  daily_chest?: {
    item?: {
      name?: string | null;
      description?: string | null;
      icon?: string | null;
    } | null;
  } | null;
  chest_item?: {
    item?: {
      name?: string | null;
      description?: string | null;
      icon?: string | null;
    } | null;
  } | null;
  level_ups?: unknown[] | null;
};

export type ShopItemPayload = CanonicalShopItemPayload;
export type ShopPurchasePayload = CanonicalShopPurchasePayload;
export type ShopPayload = CanonicalShopPayload;

export type RewardsSummaryPayload = {
  daily_bonus: {
    available: boolean;
    can_claim: boolean;
    current_day: number;
    bonus_xp: number;
    bonus_crystals: number;
    max_day?: number;
    message: string;
  };
  available_achievements: Array<{ id: string; title: string }>;
  last_bonus_claimed_at?: string | null;
  streak_summary?: {
    title: string;
    description: string;
    current: number;
    next_milestone: number;
    days_to_next: number;
  } | null;
  weekly_goal?: {
    title: string;
    description: string;
    objective_type: string;
    objective_label: string;
    progress: number;
    target: number;
    progress_percent: number;
    reward_preview: {
      xp: number;
      crystals: number;
    };
    period_started_at?: string | null;
    period_ends_at?: string | null;
    claimed_this_week?: boolean;
    claimed_at?: string | null;
    claimable?: boolean;
    state_message?: string;
    claimed_tier_count?: number;
    total_tiers?: number;
    all_tiers_claimed?: boolean;
    next_tier_index?: number | null;
    next_tier_title?: string | null;
    tiers?: Array<{
      index: number;
      title: string;
      target: number;
      progress: number;
      remaining: number;
      progress_percent: number;
      complete: boolean;
      claimed: boolean;
      claimable: boolean;
      reward: {
        xp: number;
        crystals: number;
      };
    }>;
  } | null;
  seasonal_goal?: {
    event_id: number;
    event_title: string;
    event_description: string;
    season_key?: string | null;
    title: string;
    description: string;
    objective_type: string;
    objective_label: string;
    focus_label: string;
    progress: number;
    target: number;
    progress_percent: number;
    reward_preview: {
      xp: number;
      crystals: number;
      chest_name?: string;
    };
    reward_identity?: string | null;
    period_started_at?: string | null;
    period_ends_at?: string | null;
    claimed_this_season?: boolean;
    claimed_at?: string | null;
    claimable?: boolean;
    state_message?: string;
    claimed_tier_count?: number;
    total_tiers?: number;
    all_tiers_claimed?: boolean;
    next_tier_index?: number | null;
    next_tier_title?: string | null;
    tiers?: Array<{
      index: number;
      title: string;
      target: number;
      progress: number;
      remaining: number;
      progress_percent: number;
      complete: boolean;
      claimed: boolean;
      claimable: boolean;
      reward: {
        xp: number;
        crystals: number;
        chest_name?: string;
      };
    }>;
  } | null;
  active_event?: {
    title: string;
    description: string;
    status: string;
    season_key?: string | null;
    start_at?: string | null;
    end_at?: string | null;
  } | null;
  social_pulse?: {
    title: string;
    description: string;
    friends_count: number;
    pending_friend_requests: number;
    pending_challenge_invitations: number;
    active_duels: number;
    active_coop: number;
    weekly_rank?: number | null;
    weekly_total?: number | null;
    closest_friend_ahead?: SocialPulseIdentity | null;
    closest_friend_behind?: SocialPulseIdentity | null;
    primary_action?: string | null;
    primary_action_label?: string | null;
    feed_items?: SocialPulseItem[];
  } | null;
  class_role?: {
    class_name: string;
    name: string;
    title: string;
    description: string;
    weekly_focus_label: string;
    seasonal_focus_label?: string;
    seasonal_reward_identity?: string;
  } | null;
};

export type BootstrapPayload = {
  profile: ProfilePayload;
  character_profile: CharacterProfilePayload;
  rewards_summary: RewardsSummaryPayload;
};

type CachedRequestOptions = {
  forceRefresh?: boolean;
};

const CACHE_TTL = {
  profile: 15_000,
  characterProfile: 15_000,
  dailyQuests: 20_000,
  inventory: 45_000,
  equipmentOverview: 30_000,
  challenges: 30_000,
  leaderboard: 45_000,
  rewardsSummary: 20_000,
  achievements: 5 * 60_000,
  shop: 30_000,
} as const;

export function fetchProfile(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("profile", () => apiRequest<ProfilePayload>("/profile"), {
    ttlMs: CACHE_TTL.profile,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchBootstrap(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("bootstrap", () => apiRequest<BootstrapPayload>("/bootstrap"), {
    ttlMs: CACHE_TTL.profile,
    forceRefresh: options.forceRefresh,
  });
}

export function syncTodaySteps(steps: number, dayStartedAt: string, source = "device") {
  return apiRequest<StepsSyncPayload>("/steps/sync", {
    method: "POST",
    body: JSON.stringify({
      steps,
      day_started_at: dayStartedAt,
      source,
    }),
  });
}

export function fetchCharacterProfile(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("character-profile", () => apiRequest<CharacterProfilePayload>("/character/profile"), {
    ttlMs: CACHE_TTL.characterProfile,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchDailyQuests(page = 1, limit = 20, bucket?: "daily" | "weekly" | "long_term", options: CachedRequestOptions = {}) {
  const bucketPart = bucket ? `&bucket=${bucket}` : "";
  return fetchWithTtlCache(`daily-quests:${page}:${limit}:${bucket ?? "all"}`, () =>
    apiRequest<{
      items: QuestItem[];
      goal?: GoalStatePayload;
      pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
      };
    }>(`/quests/daily?page=${page}&limit=${limit}${bucketPart}`),
    {
      ttlMs: CACHE_TTL.dailyQuests,
      forceRefresh: options.forceRefresh,
    },
  );
}

export function regenerateTodayQuests() {
  return apiRequest<{ ok: boolean; generated_for: number }>("/quests/regenerate-today", {
    method: "POST",
  });
}

export function fetchGoalTemplates() {
  return apiRequest<GoalTemplatePayload>("/goals/templates", { authenticated: false });
}

export function fetchCurrentGoal() {
  return apiRequest<GoalStatePayload>("/goals/current");
}

export function selectGoal(payload: { goal_type: string; goal_term_months: number; start_new_cycle?: boolean }) {
  return apiRequest<GoalStatePayload>("/goals/select", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function acceptQuest(questId: number) {
  return apiRequest<QuestItem>(`/quests/${questId}/accept`, { method: "POST" });
}

export function replaceQuest(questId: number, source: "base" | "ai" = "ai") {
  return apiRequest<QuestItem>(`/quests/${questId}/replace`, {
    method: "POST",
    body: JSON.stringify({ source }),
  });
}

export function createCustomQuest(payload: { title: string; description: string; icon: string }) {
  return apiRequest<{ ok: boolean; quest: QuestItem }>("/quests", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function completeQuest(questId: number) {
  return queueIfOffline(
    async () => {
      const payload = await apiRequest<QuestCompletionPayload>(`/quests/${questId}/complete`, { method: "POST" });
      return {
        ...payload,
        loot_drop: payload.loot_drop
          ? {
              ...payload.loot_drop,
              ...normalizeChestRewardItem({
                name: payload.loot_drop.name ?? "Награда",
                icon: payload.loot_drop.icon ?? undefined,
              }),
            }
          : payload.loot_drop,
        daily_chest: payload.daily_chest?.item
          ? {
              ...payload.daily_chest,
              item: {
                ...payload.daily_chest.item,
                ...normalizeChestRewardItem({
                  name: payload.daily_chest.item.name ?? "Награда",
                  icon: payload.daily_chest.item.icon ?? undefined,
                }),
              },
            }
          : payload.daily_chest,
        chest_item: payload.chest_item?.item
          ? {
              ...payload.chest_item,
              item: {
                ...payload.chest_item.item,
                ...normalizeChestRewardItem({
                  name: payload.chest_item.item.name ?? "Награда",
                  icon: payload.chest_item.item.icon ?? undefined,
                }),
              },
            }
          : payload.chest_item,
      };
    },
    { type: "complete_quest", payload: { questId } },
  );
}

export function deleteQuest(questId: number) {
  return apiRequest(`/quests/${questId}/delete`, { method: "POST" });
}

export function fetchInventory(page = 1, limit = 20, options: CachedRequestOptions = {}) {
  return fetchCanonicalInventory(page, limit, options);
}

export function fetchInventoryItemDetail(inventoryId: number) {
  return fetchCanonicalInventoryItemDetail(inventoryId);
}

export function equipInventoryItem(inventoryId: number, slot: string, classProgressId?: number) {
  return equipCanonicalInventoryItem(inventoryId, slot, classProgressId);
}

export function unequipInventoryItem(inventoryId: number) {
  return unequipCanonicalInventoryItem(inventoryId);
}

export function sellInventoryItem(inventoryId: number) {
  return sellCanonicalInventoryItem(inventoryId);
}

export function fetchEquipmentOverview(options: CachedRequestOptions = {}) {
  return fetchCanonicalEquipmentOverview(options);
}

export function fetchChallenges(page = 1, limit = 20, options: CachedRequestOptions = {}) {
  return fetchWithTtlCache(`challenges:${page}:${limit}`, () => apiRequest<{
    items: ChallengeItem[];
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  }>(`/challenges?page=${page}&limit=${limit}`), {
    ttlMs: CACHE_TTL.challenges,
    forceRefresh: options.forceRefresh,
  });
}

export function createChallenge(payload: {
  title: string;
  description: string;
  challenge_type: "duel" | "open" | "boss";
  objective_type: "steps" | "quests_completed" | "xp_gained";
  target_value: number;
  duration_days: number;
  opponent_id?: number | null;
  reward_xp: number;
  reward_crystals: number;
  reward_chest: boolean;
}) {
  return apiRequest("/challenges", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function joinChallenge(challengeId: number) {
  return apiRequest(`/challenges/${challengeId}/join`, { method: "POST" });
}

export function fetchLeaderboard(
  metric: LeaderboardMetric = "power",
  scope: LeaderboardScope = "global",
  page = 1,
  limit = 20,
  period: LeaderboardPeriod = "all_time",
  options: CachedRequestOptions = {},
) {
  return fetchWithTtlCache(`leaderboard:${metric}:${scope}:${period}:${page}:${limit}`, () => apiRequest<LeaderboardResponse>(
    `/leaderboard?metric=${metric}&scope=${scope}&period=${period}&page=${page}&limit=${limit}`
  ), {
    ttlMs: CACHE_TTL.leaderboard,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchFriendsLeaderboardPage(
  metric: LeaderboardMetric = "power",
  page = 1,
  limit = 20,
  period: LeaderboardPeriod = "all_time",
  options: CachedRequestOptions = {},
) {
  return fetchWithTtlCache(`leaderboard:${metric}:friends:${period}:${page}:${limit}`, () => apiRequest<LeaderboardResponse>(
    `/leaderboard/friends?metric=${metric}&period=${period}&page=${page}&limit=${limit}`
  ), {
    ttlMs: CACHE_TTL.leaderboard,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchLeaderboardMe(
  scope: LeaderboardScope = "global",
  metric: LeaderboardMetric = "power",
  period: LeaderboardPeriod = "all_time",
  options: CachedRequestOptions = {},
) {
  return fetchWithTtlCache(`leaderboard:${metric}:${scope}:${period}:me`, () => apiRequest<LeaderboardMeResponse>(
    `/leaderboard/me?scope=${scope}&metric=${metric}&period=${period}`
  ), {
    ttlMs: CACHE_TTL.leaderboard,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchRewardsSummary(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("rewards-summary", () => apiRequest<RewardsSummaryPayload>("/rewards/summary"), {
    ttlMs: CACHE_TTL.rewardsSummary,
    forceRefresh: options.forceRefresh,
  });
}

export function claimDailyBonus() {
  return queueIfOffline(
    () => apiRequest("/rewards/daily-bonus/claim", { method: "POST" }),
    { type: "claim_daily_bonus", payload: {} },
  );
}

export function claimWeeklyGoalReward() {
  return queueIfOffline(
    () =>
      apiRequest<{
        success: boolean;
        class_name: string;
        objective_type: string;
        progress: number;
        target: number;
        reward_xp: number;
        reward_crystals: number;
        claimed_at: string;
        claimed_tier_count?: number;
        tier_index?: number;
        tier_title?: string;
        tiers_remaining?: number;
        all_tiers_claimed?: boolean;
        new_level?: number | null;
        old_level?: number | null;
        level_ups?: number[] | null;
        current_xp?: number | null;
        next_level_xp?: number | null;
      }>("/rewards/weekly-goal/claim", { method: "POST" }),
    { type: "claim_weekly_reward", payload: {} },
  );
}

export function claimSeasonalGoalReward() {
  return queueIfOffline(
    () =>
      apiRequest<{
        success: boolean;
        event_id: number;
        season_key?: string | null;
        class_name: string;
        objective_type: string;
        progress: number;
        target: number;
        reward_xp: number;
        reward_crystals: number;
        reward_chest?: {
          chest_name?: string;
          inventory_id?: number;
          item?: {
            name?: string | null;
            description?: string | null;
            icon?: string | null;
          } | null;
        } | null;
        claimed_at: string;
        claimed_tier_count?: number;
        tier_index?: number;
        tier_title?: string;
        tiers_remaining?: number;
        all_tiers_claimed?: boolean;
        new_level?: number | null;
        old_level?: number | null;
        level_ups?: number[] | null;
        current_xp?: number | null;
        next_level_xp?: number | null;
      }>("/rewards/seasonal-goal/claim", { method: "POST" }),
    { type: "claim_seasonal_reward", payload: {} },
  );
}

export function fetchAchievements(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("achievements", () => apiRequest<{
    achievements: AchievementItem[];
    character: {
      level: number;
      streak: number;
    };
    total_completed: number;
  }>("/achievements"), {
    ttlMs: CACHE_TTL.achievements,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchShop(options: CachedRequestOptions = {}) {
  return fetchCanonicalShop(options);
}

export function refreshShop() {
  return refreshCanonicalShop();
}

export function buyShopItem(itemId: number) {
  return buyCanonicalShopItem(itemId);
}

export function openChest(payload: { inventory_id?: number | null; chest_id?: number | null; chest_name?: string | null }) {
  return openCanonicalChest(payload);
}

export function updateProfile(payload: {
  name?: string;
  username?: string;
  birth_year?: number;
  gender?: string;
  character_name?: string;
  goal_type?: string;
  goal_term_months?: number;
  start_new_goal_cycle?: boolean;
}) {
  return apiRequest("/profile/update", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
