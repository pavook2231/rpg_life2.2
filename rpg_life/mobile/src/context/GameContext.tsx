import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, Platform } from "react-native";

import {
  type BootstrapPayload,
  type DailyLimitsPayload,
  fetchAchievements,
  fetchBootstrap,
  fetchEquipmentOverview,
  fetchInventory,
  syncTodaySteps,
  type AchievementItem,
  type CharacterProfilePayload,
  type HealthStatePayload,
  type InventoryItem,
  type ProfilePayload,
} from "../api/game";
import { getTodaySteps, watchTodaySteps } from "../lib/pedometer";
import { getLastPedometerSyncState, saveLastPedometerSyncState } from "../storage/pedometerSyncStorage";
import { useAuth } from "./AuthContext";
import { useFeedback } from "./FeedbackContext";
import { useOffline } from "./OfflineContext";
import { useTranslation } from "./LocalizationContext";

type EquipmentOverview = Awaited<ReturnType<typeof fetchEquipmentOverview>>;
type RewardsSummary = BootstrapPayload["rewards_summary"];
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
  tier?: "common" | "uncommon" | "rare" | "epic" | "legendary" | null;
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
  level_ups?: unknown[] | null;
};

type GameContextValue = {
  profile: ProfilePayload | null;
  hero: HeroState;
  equipment: EquipmentOverview | null;
  inventory: InventoryItem[];
  achievements: AchievementItem[];
  rewards: RewardsSummary | null;
  todaySteps: number | null;
  stepSourceLabel: string | null;
  isRefreshing: boolean;
  refreshGame: (forceRefresh?: boolean) => Promise<void>;
  applyQuestResult: (result: QuestCompletionResult) => Promise<void>;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);
const INVENTORY_PAGE_SIZE = 100;

async function fetchAllInventory(forceRefresh = false): Promise<InventoryItem[]> {
  const firstPage = await fetchInventory(1, INVENTORY_PAGE_SIZE, { forceRefresh });
  const items = [...(firstPage.items ?? [])];
  const totalPages = Math.max(firstPage.pagination?.total_pages ?? 1, 1);

  if (totalPages === 1) {
    return items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchInventory(index + 2, INVENTORY_PAGE_SIZE, { forceRefresh })),
  );

  for (const page of remainingPages) {
    items.push(...(page.items ?? []));
  }

  return items;
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDayStartedAt(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [hero, setHero] = useState<HeroState>(null);
  const [equipment, setEquipment] = useState<EquipmentOverview | null>(null);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [stepSourceLabel, setStepSourceLabel] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { pushToast } = useFeedback();
  const { isOnline } = useOffline();
  const wasOnlineRef = useRef(isOnline);
  const backgroundLoadVersionRef = useRef(0);
  const t = useTranslation();

  const loadCoreGame = useCallback(async (forceRefresh = false) => {
    const bootstrapPayload = await fetchBootstrap({ forceRefresh });
    setProfile(bootstrapPayload.profile);
    setHero(bootstrapPayload.character_profile.character ?? null);
    setRewards(bootstrapPayload.rewards_summary ?? null);
  }, []);

  const loadExtendedGame = useCallback(async (forceRefresh = false) => {
    const loadVersion = ++backgroundLoadVersionRef.current;
    const [equipmentPayload, achievementsPayload, inventoryItems] = await Promise.all([
      fetchEquipmentOverview({ forceRefresh }),
      fetchAchievements({ forceRefresh }),
      fetchAllInventory(forceRefresh),
    ]);

    if (backgroundLoadVersionRef.current !== loadVersion) {
      return;
    }

    setEquipment(equipmentPayload);
    setAchievements(achievementsPayload.achievements ?? []);
    setInventory(inventoryItems);
  }, []);

  const refreshGame = useCallback(async (forceRefresh = true) => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadCoreGame(forceRefresh), loadExtendedGame(forceRefresh)]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCoreGame, loadExtendedGame]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setHero(null);
      setEquipment(null);
      setAchievements([]);
      setRewards(null);
      setInventory([]);
      setTodaySteps(null);
      setStepSourceLabel(null);
      backgroundLoadVersionRef.current += 1;
      return;
    }
    loadCoreGame(false)
      .then(() => {
        InteractionManager.runAfterInteractions(() => {
          void loadExtendedGame(false);
        });
      })
      .catch(() => undefined);
  }, [loadCoreGame, loadExtendedGame, user]);

  useEffect(() => {
    const cameBackOnline = !wasOnlineRef.current && isOnline;
    wasOnlineRef.current = isOnline;

    if (user && cameBackOnline) {
      refreshGame(true).catch(() => undefined);
    }
  }, [isOnline, refreshGame, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let stopWatch: (() => void) | null = null;

    async function syncDeviceStepsIfNeeded(steps: number) {
      if (!isOnline) {
        return;
      }

      const normalizedSteps = Math.max(0, Math.floor(Number(steps || 0)));
      const now = new Date();
      const dayKey = localDayKey(now);
      const lastState = await getLastPedometerSyncState();
      const lastSteps = lastState?.dayKey === dayKey ? lastState.steps : 0;

      if (normalizedSteps <= lastSteps || normalizedSteps - lastSteps < 20) {
        return;
      }

      // Determine source based on platform
      const source = Platform.OS === "ios" ? "healthkit" : Platform.OS === "android" ? "googlefit" : "pedometer";

      try {
        await syncTodaySteps(normalizedSteps, localDayStartedAt(now), source);
        await saveLastPedometerSyncState({ dayKey, steps: normalizedSteps });
      } catch {
        // Best-effort sync; step tracking should not break the app when network/api is unavailable.
      }
    }

    async function startStepSync() {
      const sourceLabel =
        Platform.OS === "ios" ? "HealthKit" : Platform.OS === "android" ? "Google Fit" : t("screens.quests.quick.stepsSourceFallback");
      setStepSourceLabel(sourceLabel);

      const initialSteps = await getTodaySteps();
      if (!cancelled && initialSteps != null) {
        setTodaySteps(initialSteps);
        await syncDeviceStepsIfNeeded(initialSteps);
      }

      stopWatch = await watchTodaySteps((steps) => {
        if (!cancelled) {
          setTodaySteps(steps);
          void syncDeviceStepsIfNeeded(steps);
        }
      });
    }

    startStepSync().catch(() => undefined);

    return () => {
      cancelled = true;
      stopWatch?.();
    };
  }, [isOnline, user]);

  const applyQuestResult = useCallback(async (result: QuestCompletionResult) => {
    const queueToast = (toast: Parameters<typeof pushToast>[0], options?: Parameters<typeof pushToast>[1]) => {
      void pushToast(toast, options);
    };
    if (result?.queued) {
      queueToast({
        title: t("offline.queuedActionTitle"),
        description: t("offline.questQueuedDescription"),
        icon: "cloud-upload-outline",
        tone: "info",
      });
      await refreshGame(true);
      return;
    }

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

    await loadCoreGame(true);
    InteractionManager.runAfterInteractions(() => {
      void loadExtendedGame(true);
    });

    queueToast({
      title: t("game.reward.questCompleted"),
      description: t("game.reward.questCompletedDescription", {
        xp: result?.xp_earned ?? 0,
        gold: result?.crystals_earned ?? 0,
      }),
      icon: "sword-cross",
      tone: "success",
    }, { sound: "quest" });

    if (result?.reward_penalty_applied && result.health?.is_wounded) {
      queueToast({
        title: "Награда снижена",
        description: `Из-за ранения награда уменьшена на ${Math.round(result.health.reward_penalty_percent ?? 0)}%. Осталось ${result.health.penalty_quests_remaining} квестов до восстановления.`,
        icon: "heart-broken",
        tone: "warning",
      });
    }

    if (!hero?.health?.is_wounded && result?.health?.is_wounded) {
      queueToast({
        title: "Герой ранен",
        description: "После долгого отсутствия персонаж получил урон. Следи за HP на главной странице.",
        icon: "alert-circle",
        tone: "warning",
      });
    }

    if (hero?.health?.is_wounded && result?.health && !result.health.is_wounded) {
      queueToast({
        title: "Герой восстановился",
        description: "Штраф к наградам снят. Можно снова фармить без потерь.",
        icon: "heart-plus",
        tone: "success",
      });
    }

    if (Array.isArray(result?.achievements)) {
      for (const achievement of result.achievements) {
        const isMajorAchievement = achievement.tier === "epic" || achievement.tier === "legendary";
        queueToast({
          title: t("game.reward.achievementTitle", {
            title: achievement.title ?? t("game.reward.newReward"),
          }),
          description: achievement.description ?? t("game.reward.achievementDescription"),
          icon: achievement.icon ?? "trophy",
          tone: "reward",
        }, {
          sound: "achievement",
          durationMs: isMajorAchievement ? 3400 : 2800,
          variant: isMajorAchievement ? "achievementLegendary" : "achievement",
        });
      }
    }

    const rewardItems = [result?.loot_drop, result?.daily_chest?.item, result?.chest_item?.item].filter(
      (reward): reward is QuestRewardItem => Boolean(reward),
    );

    for (const reward of rewardItems) {
      queueToast({
        title: t("game.reward.itemObtainedTitle", {
          title: reward.name ?? t("game.reward.newReward"),
        }),
        description: reward.description ?? t("game.reward.itemAdded"),
        icon: reward.icon ?? "treasure-chest",
        tone: "reward",
      }, { sound: "item" });
    }

    if (Array.isArray(result?.level_ups) && result.level_ups.length > 0) {
      queueToast({
        title: t("game.reward.levelUpTitle", { level: result.new_level ?? 0 }),
        description: t("game.reward.statsIncreased"),
        icon: "chevron-triple-up",
        tone: "reward",
      }, { sound: "level", haptic: "level", durationMs: 2500 });
    }

  }, [hero?.health?.is_wounded, loadCoreGame, loadExtendedGame, pushToast, refreshGame, t]);

  const value = useMemo(
    () => ({
      profile,
      hero,
      equipment,
      inventory,
      achievements,
      rewards,
      todaySteps,
      stepSourceLabel,
      isRefreshing,
      refreshGame,
      applyQuestResult,
    }),
    [achievements, applyQuestResult, equipment, hero, inventory, isRefreshing, profile, refreshGame, rewards, stepSourceLabel, todaySteps],
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
