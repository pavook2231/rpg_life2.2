import { apiRequest } from "./client";
import { apiRootRequest } from "./client";
import { fetchWithCache, queueIfOffline } from "../lib/offline";
import {
  mapChestRewardToCatalog,
  mapInventoryDetailToCatalog,
  mapInventoryEntryToCatalog,
  mapPayloadItemToCatalog,
  mapShopItemToCatalog,
} from "../lib/itemCatalog";

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

export type InventoryItem = {
  id: number;
  item_id: number;
  quantity: number;
  is_equipped: boolean;
  acquired_at?: string | null;
  item: {
    id?: number;
    name: string;
    description?: string;
    rarity: string;
    icon: string;
    type: string;
    subclass?: string | null;
    slot: string | null;
    strength_bonus?: number;
    agility_bonus?: number;
    intellect_bonus?: number;
    stamina_bonus?: number;
    xp_bonus?: number;
    crystal_bonus?: number;
    health_bonus?: number;
    required_level?: number;
    required_class?: string | null;
    set_name?: string | null;
  };
  weapon_stats?: {
    damage_min: number;
    damage_max: number;
    speed?: number;
    dps?: number;
  } | null;
  armor_stats?: {
    armor_value: number;
    slot?: string;
  } | null;
};

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

export type ShopItemPayload = {
  id: number;
  name: string;
  description: string;
  type: string;
  slot?: string | null;
  subclass?: string | null;
  icon: string;
  rarity: string;
  price_crystals: number;
  required_level: number;
  chest_name?: string;
  stats?: Record<string, number>;
  weapon_stats?: {
    damage_min: number;
    damage_max: number;
  } | null;
  armor_stats?: {
    armor_value: number;
  } | null;
};

export type ShopPurchasePayload = {
  ok: boolean;
  kind: "item" | "chest";
  chest_name?: string;
  inventory_id?: number;
  chest_item?: {
    id?: number | null;
    name: string;
    rarity: string;
    icon: string;
  } | null;
};

export type ShopPayload = {
  items: ShopItemPayload[];
  crystals: number;
  character_level: number;
  refresh_cost: number;
  refresh_cooldown_seconds: number;
  refresh_available_at?: string | null;
  refresh_remaining_seconds: number;
  can_refresh: boolean;
  next_rotation_at: string;
};

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

export function fetchProfile() {
  return fetchWithCache("profile", () => apiRequest<ProfilePayload>("/profile"));
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

export function fetchCharacterProfile() {
  return fetchWithCache("character-profile", () => apiRequest<CharacterProfilePayload>("/character/profile"));
}

export function fetchDailyQuests(page = 1, limit = 20, bucket?: "daily" | "weekly" | "long_term") {
  const bucketPart = bucket ? `&bucket=${bucket}` : "";
  return fetchWithCache(`daily-quests:${page}:${limit}:${bucket ?? "all"}`, () =>
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

export function createCustomQuest(payload: { title: string; description: string; xp_reward: number; icon: string }) {
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
              ...(mapChestRewardToCatalog({
                name: payload.loot_drop.name ?? "Награда",
                icon: payload.loot_drop.icon ?? undefined,
              }) as { name: string; icon?: string; rarity?: string }),
            }
          : payload.loot_drop,
        daily_chest: payload.daily_chest?.item
          ? {
              ...payload.daily_chest,
              item: {
                ...payload.daily_chest.item,
                ...(mapChestRewardToCatalog({
                  name: payload.daily_chest.item.name ?? "Награда",
                  icon: payload.daily_chest.item.icon ?? undefined,
                }) as { name: string; icon?: string; rarity?: string }),
              },
            }
          : payload.daily_chest,
        chest_item: payload.chest_item?.item
          ? {
              ...payload.chest_item,
              item: {
                ...payload.chest_item.item,
                ...(mapChestRewardToCatalog({
                  name: payload.chest_item.item.name ?? "Награда",
                  icon: payload.chest_item.item.icon ?? undefined,
                }) as { name: string; icon?: string; rarity?: string }),
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

export function fetchInventory(page = 1, limit = 20) {
  return fetchWithCache(`inventory:${page}:${limit}`, async () => {
    const payload = await apiRequest<{
      items: InventoryItem[];
      pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
      };
    }>(`/inventory?page=${page}&limit=${limit}`);

    return {
      ...payload,
      items: (payload.items ?? []).map((item) => mapInventoryEntryToCatalog(item)),
    };
  });
}

export function fetchInventoryItemDetail(inventoryId: number) {
  return apiRequest<{
    inventory_id: number;
    is_equipped: boolean;
    sell_price: number;
    item: InventoryItem["item"];
    weapon_stats?: InventoryItem["weapon_stats"];
    armor_stats?: InventoryItem["armor_stats"];
  }>(`/inventory/${inventoryId}`).then((payload) => mapInventoryDetailToCatalog(payload));
}

export function equipInventoryItem(inventoryId: number, slot: string, classProgressId?: number) {
  return apiRequest("/inventory/equip", {
    method: "POST",
    body: JSON.stringify({
      inventory_id: inventoryId,
      slot,
      class_progress_id: classProgressId ?? null
    })
  });
}

export function unequipInventoryItem(inventoryId: number) {
  return apiRequest("/inventory/unequip", {
    method: "POST",
    body: JSON.stringify({ inventory_id: inventoryId })
  });
}

export function sellInventoryItem(inventoryId: number) {
  return apiRequest<{ ok: boolean; crystals_earned?: number }>("/inventory/sell", {
    method: "POST",
    body: JSON.stringify({ inventory_id: inventoryId })
  });
}

export function fetchEquipmentOverview() {
  return fetchWithCache("equipment-overview", async () => {
    const payload = await apiRequest<{
      class_info: {
        id: number;
        class_name: string;
        display_name: string | null;
        level: number;
        current_xp: number;
        crystals: number;
        strength: number;
        agility: number;
        intellect: number;
        stamina: number;
      };
      equipment_totals: {
        strength: number;
        agility: number;
        intellect: number;
        stamina: number;
        critical_chance: number;
        luck: number;
        health: number;
        armor: number;
        damage_min: number;
        damage_max: number;
        dps: number;
      };
      reward_effects: {
        xp_bonus_percent: number;
        gold_bonus_percent: number;
        crit_reward_chance_percent: number;
        loot_bonus_percent: number;
        armor_reduction_percent?: number;
        system_daily_cap?: number;
      };
      equipment: Array<{
        slot: string;
        inventory_id: number;
        item: InventoryItem["item"];
        weapon_stats?: InventoryItem["weapon_stats"];
        armor_stats?: InventoryItem["armor_stats"];
      }>;
      bag_items: InventoryItem[];
      set_bonuses?: Array<{
        set_name: string;
        name: string;
        description: string;
        active_pieces: number;
        bonus: Record<string, number>;
      }>;
      secondary_skills?: SecondarySkillsPayload;
    }>("/character/equipment");

    return {
      ...payload,
      equipment: (payload.equipment ?? []).map((entry) => {
        const mappedItem = mapPayloadItemToCatalog(entry.item);
        return {
          ...entry,
          item: mappedItem,
          weapon_stats: entry.weapon_stats,
          armor_stats: entry.armor_stats,
        };
      }),
      bag_items: (payload.bag_items ?? []).map((entry) => mapInventoryEntryToCatalog(entry)),
    };
  });
}

export function fetchChallenges(page = 1, limit = 20) {
  return fetchWithCache(`challenges:${page}:${limit}`, () => apiRequest<{
    items: ChallengeItem[];
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  }>(`/challenges?page=${page}&limit=${limit}`));
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

export function fetchLeaderboard(metric = "level", scope = "global", page = 1, limit = 20) {
  return fetchWithCache(`leaderboard:${metric}:${scope}:${page}:${limit}`, () => apiRequest<{
    metric: string;
    items: Array<{
      user_id: number;
      name: string;
      rank: number;
      score: number;
      level: number;
      quests_completed: number;
      steps: number;
      challenge_wins: number;
    }>;
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  }>(`/leaderboard?metric=${metric}&scope=${scope}&page=${page}&limit=${limit}`));
}

export function fetchRewardsSummary() {
  return fetchWithCache("rewards-summary", () => apiRequest<RewardsSummaryPayload>("/rewards/summary"));
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

export function fetchAchievements() {
  return fetchWithCache("achievements", () => apiRequest<{
    achievements: AchievementItem[];
    character: {
      level: number;
      streak: number;
    };
    total_completed: number;
  }>("/achievements"));
}

export function fetchShop() {
  return fetchWithCache("shop", async () => {
    const payload = await apiRequest<ShopPayload>("/shop");
    return {
      ...payload,
      items: (payload.items ?? []).map((item) => mapShopItemToCatalog(item)),
    };
  });
}

export function refreshShop() {
  return apiRequest<ShopPayload>("/shop/refresh", {
    method: "POST",
  }).then((payload) => ({
    ...payload,
    items: (payload.items ?? []).map((item) => mapShopItemToCatalog(item)),
  }));
}

export function buyShopItem(itemId: number) {
  return apiRequest<ShopPurchasePayload>("/shop/buy", {
    method: "POST",
    body: JSON.stringify({ item_id: itemId })
  });
}

export function openChest(payload: { inventory_id?: number | null; chest_id?: number | null; chest_name?: string | null }) {
  return queueIfOffline(
    () =>
      apiRootRequest<{
        item: {
          id: number;
          name: string;
          slot?: string | null;
          rarity: string;
          icon: string;
          power?: number | null;
        };
        rarity: string;
        chest_name?: string;
        chest_rarity?: string;
        luck_bonus_percent?: number;
        opened_from_inventory?: boolean;
      }>("/chests/open", {
        method: "POST",
        body: JSON.stringify(payload),
      }).then((result) => ({
        ...result,
        item: mapChestRewardToCatalog(result.item),
      })),
    { type: "open_chest", payload },
  );
}

export function updateProfile(payload: {
  name?: string;
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
