import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  type DailyLimitsPayload,
  fetchAchievements,
  fetchCharacterProfile,
  fetchEquipmentOverview,
  fetchInventory,
  fetchProfile,
  fetchRewardsSummary,
  type AchievementItem,
  type CharacterProfilePayload,
  type HealthStatePayload,
  type InventoryItem,
  type ProfilePayload,
} from "../api/game";
import { triggerHaptic } from "../lib/haptics";
import { useAuth } from "./AuthContext";
import { useFeedback } from "./FeedbackContext";
import { useOffline } from "./OfflineContext";
import { useTranslation } from "./LocalizationContext";

type EquipmentOverview = Awaited<ReturnType<typeof fetchEquipmentOverview>>;
type RewardsSummary = Awaited<ReturnType<typeof fetchRewardsSummary>>;
type HeroState = CharacterProfilePayload["character"] | null;

type QuestRewardItem = {
  name?: string | null;
  description?: string | null;
  icon?: string | null;
};

type QuestAchievement = {
  title?: string | null;
  description?: string | null;
  icon?: string | null;
};

type QuestCompletionResult = {
  queued?: boolean;
  new_level?: number;
  new_xp?: number;
  next_level_xp?: number;
  xp_percentage?: number;
  new_crystals?: number;
  xp_earned?: number;
  crystals_earned?: number;
  reward_penalty_applied?: boolean;
  daily_limits?: DailyLimitsPayload;
  health?: HealthStatePayload | null;
  achievements?: QuestAchievement[] | null;
  loot_drop?: QuestRewardItem | null;
  daily_chest?: { item?: QuestRewardItem | null } | null;
  chest_item?: { item?: QuestRewardItem | null } | null;
  crafting_reward?: QuestRewardItem | null;
  level_ups?: unknown[] | null;
};

type GameContextValue = {
  profile: ProfilePayload | null;
  hero: HeroState;
  equipment: EquipmentOverview | null;
  inventory: InventoryItem[];
  achievements: AchievementItem[];
  rewards: RewardsSummary | null;
  isRefreshing: boolean;
  refreshGame: () => Promise<void>;
  applyQuestResult: (result: QuestCompletionResult) => Promise<void>;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);
const INVENTORY_PAGE_SIZE = 100;

async function fetchAllInventory(): Promise<InventoryItem[]> {
  const firstPage = await fetchInventory(1, INVENTORY_PAGE_SIZE);
  const items = [...(firstPage.items ?? [])];
  const totalPages = Math.max(firstPage.pagination?.total_pages ?? 1, 1);

  if (totalPages === 1) {
    return items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchInventory(index + 2, INVENTORY_PAGE_SIZE)),
  );

  for (const page of remainingPages) {
    items.push(...(page.items ?? []));
  }

  return items;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [hero, setHero] = useState<HeroState>(null);
  const [equipment, setEquipment] = useState<EquipmentOverview | null>(null);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { playSound, pushToast } = useFeedback();
  const { isOnline } = useOffline();
  const t = useTranslation();

  const refreshGame = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [
        profilePayload,
        heroPayload,
        equipmentPayload,
        achievementsPayload,
        rewardsPayload,
        inventoryItems,
      ] = await Promise.all([
        fetchProfile(),
        fetchCharacterProfile(),
        fetchEquipmentOverview(),
        fetchAchievements(),
        fetchRewardsSummary(),
        fetchAllInventory(),
      ]);

      setProfile(profilePayload);
      setHero(heroPayload.character ?? null);
      setEquipment(equipmentPayload);
      setAchievements(achievementsPayload.achievements ?? []);
      setRewards(rewardsPayload ?? null);
      setInventory(inventoryItems);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setHero(null);
      setEquipment(null);
      setAchievements([]);
      setRewards(null);
      setInventory([]);
      return;
    }
    refreshGame().catch(() => undefined);
  }, [refreshGame, user]);

  useEffect(() => {
    if (user && isOnline) {
      refreshGame().catch(() => undefined);
    }
  }, [isOnline, refreshGame, user]);

  const applyQuestResult = useCallback(async (result: QuestCompletionResult) => {
    if (result?.queued) {
      pushToast({
        title: t("offline.queuedActionTitle"),
        description: t("offline.questQueuedDescription"),
        icon: "cloud-upload-outline",
        tone: "info",
      });
      await refreshGame();
      return;
    }

    await playSound("quest");

    setHero((current) =>
      current
        ? {
            ...current,
            level: result?.new_level ?? current.level,
            current_xp: result?.new_xp ?? current.current_xp,
            next_level_xp: result?.next_level_xp ?? current.next_level_xp,
            xp_percent: result?.xp_percentage ?? current.xp_percent,
            crystals: result?.new_crystals ?? current.crystals,
          }
        : current,
    );

    pushToast({
      title: t("game.reward.questCompleted"),
      description: t("game.reward.questCompletedDescription", {
        xp: result?.xp_earned ?? 0,
        gold: result?.crystals_earned ?? 0,
      }),
      icon: "sword-cross",
      tone: "success",
    });

    if (result?.reward_penalty_applied && result.health?.is_wounded) {
      pushToast({
        title: "Награда снижена",
        description: `Из-за ранения награда уменьшена на ${Math.round(result.health.reward_penalty_percent ?? 0)}%. Осталось ${result.health.penalty_quests_remaining} квестов до восстановления.`,
        icon: "heart-broken",
        tone: "warning",
      });
    }

    if (!hero?.health?.is_wounded && result?.health?.is_wounded) {
      pushToast({
        title: "Герой ранен",
        description: "После долгого отсутствия персонаж получил урон. Следи за HP на главной странице.",
        icon: "alert-circle",
        tone: "warning",
      });
    }

    if (hero?.health?.is_wounded && result?.health && !result.health.is_wounded) {
      pushToast({
        title: "Герой восстановился",
        description: "Штраф к наградам снят. Можно снова фармить без потерь.",
        icon: "heart-plus",
        tone: "success",
      });
    }

    if (Array.isArray(result?.achievements)) {
      for (const achievement of result.achievements) {
        await playSound("achievement");
        pushToast({
          title: t("game.reward.achievementTitle", {
            title: achievement.title ?? t("game.reward.newReward"),
          }),
          description: achievement.description ?? t("game.reward.achievementDescription"),
          icon: achievement.icon ?? "trophy",
          tone: "reward",
        });
      }
    }

    const rewardItems = [result?.loot_drop, result?.daily_chest?.item, result?.chest_item?.item].filter(
      (reward): reward is QuestRewardItem => Boolean(reward),
    );

    if (result?.crafting_reward) {
      rewardItems.push(result.crafting_reward);
    }

    for (const reward of rewardItems) {
      await playSound("item");
      pushToast({
        title: t("game.reward.itemObtainedTitle", {
          title: reward.name ?? t("game.reward.newReward"),
        }),
        description: reward.description ?? t("game.reward.itemAdded"),
        icon: reward.icon ?? "treasure-chest",
        tone: "reward",
      });
    }

    if (Array.isArray(result?.level_ups) && result.level_ups.length > 0) {
      await playSound("level");
      await triggerHaptic("level");
      pushToast({
        title: t("game.reward.levelUpTitle", { level: result.new_level ?? 0 }),
        description: t("game.reward.statsIncreased"),
        icon: "chevron-triple-up",
        tone: "reward",
      });
    }

    await refreshGame();
  }, [hero?.health?.is_wounded, playSound, pushToast, refreshGame, t]);

  const value = useMemo(
    () => ({
      profile,
      hero,
      equipment,
      inventory,
      achievements,
      rewards,
      isRefreshing,
      refreshGame,
      applyQuestResult,
    }),
    [achievements, applyQuestResult, equipment, hero, inventory, isRefreshing, profile, refreshGame, rewards],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used inside GameProvider");
  }
  return context;
}
