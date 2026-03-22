import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  type BootstrapPayload,
  type DailyLimitsPayload,
  fetchAchievements,
  fetchBootstrap,
  syncTodaySteps,
  type AchievementItem,
  type CharacterProfilePayload,
  type HealthStatePayload,
  type ProfilePayload,
} from "../api/game";
import { fetchEquipmentOverview, fetchInventory } from "../features/items/itemService";
import type { InventoryItem } from "../features/items/types";
import { getTodayStepsSnapshot, type StepTrackingState, watchTodaySteps } from "../lib/pedometer";
import { getLastPedometerSyncState, saveLastPedometerSyncState } from "../storage/pedometerSyncStorage";
import { useAuth } from "./AuthContext";
import { useFeedback } from "./FeedbackContext";
import { useOffline } from "./OfflineContext";
import { useTranslation } from "./LocalizationContext";

type EquipmentOverview = Awaited<ReturnType<typeof fetchEquipmentOverview>>;
type RewardsSummary = BootstrapPayload["rewards_summary"];
type HeroState = CharacterProfilePayload["character"] | null;
type GameSnapshot = {
  profile: ProfilePayload | null;
  hero: HeroState;
  equipment: EquipmentOverview | null;
  inventory: InventoryItem[];
  achievements: AchievementItem[];
  rewards: RewardsSummary | null;
};

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
  isDataConsistent: boolean;
  dataConsistencyError: string | null;
  todaySteps: number | null;
  stepSourceLabel: string | null;
  stepTrackingStatus: StepTrackingState | "sync_deferred" | null;
  isRefreshing: boolean;
  refreshGame: (forceRefresh?: boolean) => Promise<void>;
  applyQuestResult: (result: QuestCompletionResult) => Promise<void>;
};

type GameProgressContextValue = Pick<
  GameContextValue,
  | "profile"
  | "hero"
  | "rewards"
  | "isDataConsistent"
  | "dataConsistencyError"
  | "todaySteps"
  | "stepSourceLabel"
  | "stepTrackingStatus"
  | "isRefreshing"
  | "refreshGame"
  | "applyQuestResult"
>;

type GameInventoryContextValue = Pick<
  GameContextValue,
  "equipment" | "inventory" | "isDataConsistent" | "dataConsistencyError" | "refreshGame"
>;
type GameAchievementsContextValue = Pick<GameContextValue, "achievements">;

const GameContext = createContext<GameContextValue | undefined>(undefined);
const GameProgressContext = createContext<GameProgressContextValue | undefined>(undefined);
const GameInventoryContext = createContext<GameInventoryContextValue | undefined>(undefined);
const GameAchievementsContext = createContext<GameAchievementsContextValue | undefined>(undefined);
const INVENTORY_PAGE_SIZE = 100;
const EMPTY_GAME_SNAPSHOT: GameSnapshot = {
  profile: null,
  hero: null,
  equipment: null,
  inventory: [],
  achievements: [],
  rewards: null,
};

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

async function fetchGameSnapshot(forceRefresh = false): Promise<GameSnapshot> {
  const [bootstrapPayload, equipmentPayload, achievementsPayload, inventoryPayload] = await Promise.all([
    fetchBootstrap({ forceRefresh }),
    fetchEquipmentOverview({ forceRefresh }),
    fetchAchievements({ forceRefresh }),
    fetchAllInventory(forceRefresh),
  ]);

  return {
    profile: bootstrapPayload.profile,
    hero: bootstrapPayload.character_profile.character ?? null,
    equipment: equipmentPayload,
    inventory: inventoryPayload,
    achievements: achievementsPayload.achievements ?? [],
    rewards: bootstrapPayload.rewards_summary ?? null,
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [gameSnapshot, setGameSnapshot] = useState<GameSnapshot>(EMPTY_GAME_SNAPSHOT);
  const [isDataConsistent, setIsDataConsistent] = useState(true);
  const [dataConsistencyError, setDataConsistencyError] = useState<string | null>(null);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [stepSourceLabel, setStepSourceLabel] = useState<string | null>(null);
  const [stepTrackingStatus, setStepTrackingStatus] = useState<StepTrackingState | "sync_deferred" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { pushToast } = useFeedback();
  const { isOnline } = useOffline();
  const wasOnlineRef = useRef(isOnline);
  const snapshotLoadVersionRef = useRef(0);
  const activeRefreshCountRef = useRef(0);
  const t = useTranslation();
  const { profile, hero, equipment, achievements, rewards, inventory } = gameSnapshot;

  const applyGameSnapshot = useCallback((nextSnapshot: GameSnapshot) => {
    setGameSnapshot(nextSnapshot);
    setIsDataConsistent(true);
    setDataConsistencyError(null);
  }, []);

  const beginRefresh = useCallback(() => {
    activeRefreshCountRef.current += 1;
    setIsRefreshing(true);
  }, []);

  const endRefresh = useCallback(() => {
    activeRefreshCountRef.current = Math.max(0, activeRefreshCountRef.current - 1);
    if (activeRefreshCountRef.current === 0) {
      setIsRefreshing(false);
    }
  }, []);

  const resolveSnapshotError = useCallback(
    (error: unknown) => (error instanceof Error && error.message ? error.message : t("errors.unknownError")),
    [t],
  );

  const loadGameSnapshot = useCallback(
    async (forceRefresh = false, options?: { showErrorToast?: boolean }) => {
      const loadVersion = ++snapshotLoadVersionRef.current;

      try {
        const nextSnapshot = await fetchGameSnapshot(forceRefresh);
        if (snapshotLoadVersionRef.current !== loadVersion) {
          return;
        }

        applyGameSnapshot(nextSnapshot);
      } catch (error) {
        if (snapshotLoadVersionRef.current !== loadVersion) {
          return;
        }

        const message = resolveSnapshotError(error);
        console.warn("[game-context] Failed to load atomic game snapshot", error);
        setIsDataConsistent(false);
        setDataConsistencyError(message);

        if (options?.showErrorToast) {
          void pushToast({
            title: "Данные героя не синхронизированы",
            description: message,
            icon: "alert-circle",
            tone: "warning",
          });
        }

        throw error instanceof Error ? error : new Error(message);
      }
    },
    [applyGameSnapshot, pushToast, resolveSnapshotError],
  );

  const performRefresh = useCallback(
    async (forceRefresh = true, showErrorToast = true) => {
      beginRefresh();
      try {
        await loadGameSnapshot(forceRefresh, { showErrorToast });
      } finally {
        endRefresh();
      }
    },
    [beginRefresh, endRefresh, loadGameSnapshot],
  );

  const refreshGame = useCallback((forceRefresh = true) => performRefresh(forceRefresh, true), [performRefresh]);

  useEffect(() => {
    if (!user) {
      setGameSnapshot(EMPTY_GAME_SNAPSHOT);
      setIsDataConsistent(true);
      setDataConsistencyError(null);
      setTodaySteps(null);
      setStepSourceLabel(null);
      setStepTrackingStatus(null);
      snapshotLoadVersionRef.current += 1;
      activeRefreshCountRef.current = 0;
      setIsRefreshing(false);
      return;
    }
    performRefresh(false, false).catch(() => undefined);
  }, [performRefresh, user]);

  useEffect(() => {
    const cameBackOnline = !wasOnlineRef.current && isOnline;
    wasOnlineRef.current = isOnline;

    if (user && cameBackOnline) {
      performRefresh(true, false).catch(() => undefined);
    }
  }, [isOnline, performRefresh, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let stopWatch: (() => void) | null = null;

    async function syncDeviceStepsIfNeeded(steps: number) {
      const normalizedSteps = Math.max(0, Math.floor(Number(steps || 0)));

      if (!isOnline) {
        if (normalizedSteps >= 0) {
          setStepTrackingStatus("sync_deferred");
        }
        return;
      }

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
        setStepTrackingStatus("connected");
      } catch {
        setStepTrackingStatus("sync_deferred");
      }
    }

    async function startStepSync() {
      const sourceLabel =
        Platform.OS === "ios" ? "HealthKit" : Platform.OS === "android" ? "Google Fit" : t("screens.quests.quick.stepsSourceFallback");
      setStepSourceLabel(sourceLabel);

      const initialSnapshot = await getTodayStepsSnapshot();
      if (!cancelled) {
        setStepTrackingStatus(initialSnapshot.steps != null ? (isOnline ? "connected" : "sync_deferred") : initialSnapshot.state);
        setTodaySteps(initialSnapshot.steps);
      }

      if (!cancelled && initialSnapshot.steps != null) {
        await syncDeviceStepsIfNeeded(initialSnapshot.steps);
      }

      stopWatch = await watchTodaySteps((steps) => {
        if (!cancelled) {
          setTodaySteps(steps);
          setStepTrackingStatus(isOnline ? "connected" : "sync_deferred");
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
    const wasHeroWounded = hero?.health?.is_wounded ?? false;
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
      await refreshGame(true).catch(() => undefined);
      return;
    }

    await performRefresh(true, false).catch(() => undefined);

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

    if (!wasHeroWounded && result?.health?.is_wounded) {
      queueToast({
        title: "Герой ранен",
        description: "После долгого отсутствия персонаж получил урон. Следи за HP на главной странице.",
        icon: "alert-circle",
        tone: "warning",
      });
    }

    if (wasHeroWounded && result?.health && !result.health.is_wounded) {
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

  }, [hero?.health?.is_wounded, performRefresh, pushToast, refreshGame, t]);

  const value = useMemo(
    () => ({
      profile,
      hero,
      equipment,
      inventory,
      achievements,
      rewards,
      isDataConsistent,
      dataConsistencyError,
      todaySteps,
      stepSourceLabel,
      stepTrackingStatus,
      isRefreshing,
      refreshGame,
      applyQuestResult,
    }),
    [
      achievements,
      applyQuestResult,
      dataConsistencyError,
      equipment,
      hero,
      inventory,
      isDataConsistent,
      isRefreshing,
      profile,
      refreshGame,
      rewards,
      stepSourceLabel,
      stepTrackingStatus,
      todaySteps,
    ],
  );

  const progressValue = useMemo(
    () => ({
      profile,
      hero,
      rewards,
      isDataConsistent,
      dataConsistencyError,
      todaySteps,
      stepSourceLabel,
      stepTrackingStatus,
      isRefreshing,
      refreshGame,
      applyQuestResult,
    }),
    [
      applyQuestResult,
      dataConsistencyError,
      hero,
      isDataConsistent,
      isRefreshing,
      profile,
      refreshGame,
      rewards,
      stepSourceLabel,
      stepTrackingStatus,
      todaySteps,
    ],
  );

  const inventoryValue = useMemo(
    () => ({
      equipment,
      inventory,
      isDataConsistent,
      dataConsistencyError,
      refreshGame,
    }),
    [dataConsistencyError, equipment, inventory, isDataConsistent, refreshGame],
  );

  const achievementsValue = useMemo(
    () => ({
      achievements,
    }),
    [achievements],
  );

  return (
    <GameProgressContext.Provider value={progressValue}>
      <GameInventoryContext.Provider value={inventoryValue}>
        <GameAchievementsContext.Provider value={achievementsValue}>
          <GameContext.Provider value={value}>{children}</GameContext.Provider>
        </GameAchievementsContext.Provider>
      </GameInventoryContext.Provider>
    </GameProgressContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used inside GameProvider");
  }
  return context;
}

export function useGameProgress() {
  const context = useContext(GameProgressContext);
  if (!context) {
    throw new Error("useGameProgress must be used inside GameProvider");
  }
  return context;
}

export function useGameInventoryEquipment() {
  const context = useContext(GameInventoryContext);
  if (!context) {
    throw new Error("useGameInventoryEquipment must be used inside GameProvider");
  }
  return context;
}

export function useGameAchievements() {
  const context = useContext(GameAchievementsContext);
  if (!context) {
    throw new Error("useGameAchievements must be used inside GameProvider");
  }
  return context;
}
