import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { claimDailyBonus, claimSeasonalGoalReward, claimWeeklyGoalReward } from "../api/game";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useFeedback } from "../context/FeedbackContext";
import { useGameInventoryEquipment, useGameProgress } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { useOffline } from "../context/OfflineContext";
import { buildDerivedStats } from "../lib/gameRules";
import { getNextHealthDecayLabel } from "../lib/healthUi";
import { getNavigationUnlockState } from "../lib/navigationUnlocks";
import { clearGoalSetupPending, getGoalSetupPending } from "../storage/beginnerOnboardingStorage";
import { getLastDailyBonusPromptDay, saveLastDailyBonusPromptDay } from "../storage/dailyBonusPromptStorage";
import { Button, Card, GameIcon, LoadingAnimation, ProfileHeroCard, radii, useThemeColors, useThemeMode } from "../ui";

type InfoItemProps = {
  icon: string;
  title: string;
  description: string;
};

function getLocalDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function InfoItem({ icon, title, description }: InfoItemProps) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <View style={styles.infoItem}>
      <View style={styles.infoIconWrap}>
        <GameIcon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoDescription}>{description}</Text>
      </View>
    </View>
  );
}

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const t = useTranslation();
  const { language } = useLocalization();
  const {
    hero,
    profile,
    rewards,
    refreshGame,
    isRefreshing,
    isDataConsistent,
    dataConsistencyError,
    todaySteps,
    stepSourceLabel,
    stepTrackingStatus,
  } = useGameProgress();
  const { equipment, inventory } = useGameInventoryEquipment();
  const { pushToast } = useFeedback();
  const { isOnline, pendingActionsCount } = useOffline();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const isCompactLayout = width < 430;
  const [isClaimingDailyBonus, setIsClaimingDailyBonus] = useState(false);
  const [isClaimingWeeklyReward, setIsClaimingWeeklyReward] = useState(false);
  const [isClaimingSeasonalReward, setIsClaimingSeasonalReward] = useState(false);
  const [showDailyBonusModal, setShowDailyBonusModal] = useState(false);
  const [goalSetupPending, setGoalSetupPending] = useState<boolean | null>(null);
  const dailyBonus = rewards?.daily_bonus ?? null;
  const weeklyGoal = rewards?.weekly_goal ?? null;
  const seasonalGoal = rewards?.seasonal_goal ?? null;
  const unlockState = useMemo(
    () =>
      getNavigationUnlockState({
        profile,
        hero,
        equipment,
        inventory,
        rewards,
      }),
    [equipment, hero, inventory, profile, rewards],
  );

  const derivedStats = useMemo(
    () => buildDerivedStats(equipment?.class_info, equipment?.equipment_totals, equipment?.reward_effects),
    [equipment],
  );

  const goal = profile?.goal ?? null;
  const dailyLimits = goal?.daily_limits ?? null;
  const healthState = hero?.health ?? profile?.health ?? null;
  const nextDecayLabel = getNextHealthDecayLabel(healthState?.last_health_decay_at, language);
  const systemCompleted = dailyLimits?.completed_system ?? 0;
  const systemCap = dailyLimits?.system_cap ?? derivedStats.systemDailyCap;
  const totalCompleted = dailyLimits?.completed_total ?? 0;
  const totalCap = dailyLimits?.total_cap ?? 20;
  const needsGoalSetup = goalSetupPending === true || !goal;

  useEffect(() => {
    let active = true;

    if (!profile?.user?.id) {
      setGoalSetupPending(null);
      return () => {
        active = false;
      };
    }

    getGoalSetupPending(profile.user.id)
      .then((pending) => {
        if (active) {
          setGoalSetupPending(pending);
        }
      })
      .catch(() => {
        if (active) {
          setGoalSetupPending(false);
        }
      });

    return () => {
      active = false;
    };
  }, [profile?.user?.id]);

  useEffect(() => {
    if (!profile?.user?.id || goalSetupPending !== true || !unlockState.hasQuestProgress) {
      return;
    }

    clearGoalSetupPending(profile.user.id)
      .then(() => setGoalSetupPending(false))
      .catch(() => undefined);
  }, [goalSetupPending, profile?.user?.id, unlockState.hasQuestProgress]);
  const contextAction = needsGoalSetup
    ? {
        label: t("common.createGoal"),
        icon: "flag-checkered",
        onPress: () => navigation.navigate("GoalSelect"),
      }
    : unlockState.inventoryResolved && !unlockState.hasInventoryItems && unlockState.shopUnlocked
      ? {
          label: t("screens.home.shop"),
          icon: "storefront-outline",
          onPress: () => navigation.navigate("Shop"),
        }
      : unlockState.inventoryResolved && unlockState.hasInventoryItems && !unlockState.hasEquippedItems
        ? {
            label: t("screens.home.character"),
            icon: "shield-account",
            onPress: () => navigation.navigate("Character"),
          }
        : unlockState.shopUnlocked
          ? {
              label: t("screens.home.shop"),
              icon: "storefront-outline",
              onPress: () => navigation.navigate("Shop"),
            }
          : null;
  const firstWeekProgram = [
    {
      title: translateOrFallback(t, "screens.home.quick.programDayOneTitle", "Определи направление"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDayOneDescription",
        "Выбери цель, чтобы приложение собрало понятный план и первые задания под нее.",
      ),
    },
    {
      title: translateOrFallback(t, "screens.home.quick.programDayTwoTitle", "Сделай первый шаг"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDayTwoDescription",
        "Закрой хотя бы один квест, чтобы запустить реальный прогресс по цели.",
      ),
    },
    {
      title: translateOrFallback(t, "screens.home.quick.programDayThreeTitle", "Забери первую награду"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDayThreeDescription",
        "Первая награда должна ощущаться как маленькая победа, а не просто как цифра.",
      ),
    },
    {
      title: translateOrFallback(t, "screens.home.quick.programDayFourTitle", "Открой первое улучшение"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDayFourDescription",
        "Покупка первого предмета связывает задания с ростом героя.",
      ),
    },
    {
      title: translateOrFallback(t, "screens.home.quick.programDayFiveTitle", "Экипируй усиление"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDayFiveDescription",
        "После экипировки прогресс становится наглядным: растут статы и отдача от действий.",
      ),
    },
    {
      title: translateOrFallback(t, "screens.home.quick.programDaySixTitle", "Добавь поддержку"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDaySixDescription",
        "Один друг делает ритм заметнее: проще держать темп и возвращаться в приложение.",
      ),
    },
    {
      title: translateOrFallback(t, "screens.home.quick.programDaySevenTitle", "Собери свой ритм"),
      description: translateOrFallback(
        t,
        "screens.home.quick.programDaySevenDescription",
        "На седьмой день уже должно быть понятно, что двигает цель именно у тебя.",
      ),
    },
  ];
  const onboardingSteps = [
    {
      key: "goal",
      icon: "flag-checkered",
      done: !needsGoalSetup,
      title: translateOrFallback(t, "screens.home.quick.onboardingGoalTitle", "Выбери цель"),
      description: translateOrFallback(
        t,
        "screens.home.quick.onboardingGoalDescription",
        "После этого приложение начнет давать более точные задания и понятный прогресс.",
      ),
      actionLabel: t("common.createGoal"),
      onPress: () => navigation.navigate("GoalSelect"),
    },
    {
      key: "quest",
      icon: "notebook-outline",
      done: unlockState.hasQuestProgress,
      title: translateOrFallback(t, "screens.home.quick.onboardingQuestTitle", "Закрой первое задание"),
      description: translateOrFallback(
        t,
        "screens.home.quick.onboardingQuestDescription",
        "Первое выполненное задание запускает настоящий цикл прогресса.",
      ),
      actionLabel: t("screens.home.toQuests"),
      onPress: () => navigation.navigate("Quests"),
    },
    {
      key: "item",
      icon: "storefront-outline",
      done: unlockState.hasInventoryItems,
      title: translateOrFallback(t, "screens.home.quick.onboardingItemTitle", "Получи первый предмет"),
      description: translateOrFallback(
        t,
        "screens.home.quick.onboardingItemDescription",
        "Первый предмет связывает задания с развитием героя и делает прогресс заметным.",
      ),
      actionLabel: t("screens.home.shop"),
      onPress: () => navigation.navigate("Shop"),
    },
    {
      key: "equip",
      icon: "shield-account",
      done: unlockState.hasEquippedItems,
      title: translateOrFallback(t, "screens.home.quick.onboardingEquipTitle", "Экипируй первый предмет"),
      description: translateOrFallback(
        t,
        "screens.home.quick.onboardingEquipDescription",
        "После экипировки бонусы к статам и наградам начинают работать сразу.",
      ),
      actionLabel: t("screens.home.character"),
      onPress: () => navigation.navigate("Character"),
    },
  ];
  const onboardingCompletedCount = onboardingSteps.filter((step) => step.done).length;
  const nextOnboardingStep = onboardingSteps.find((step) => !step.done) ?? null;
  const showOnboardingRoadmap = onboardingCompletedCount < onboardingSteps.length;
  const showAdvancedHome = !showOnboardingRoadmap && unlockState.hasQuestProgress;
  const showDeepGuideCards = showAdvancedHome && unlockState.hasEquippedItems;
  const showFirstWinCard =
    !needsGoalSetup &&
    unlockState.hasQuestProgress &&
    unlockState.inventoryResolved &&
    !unlockState.hasInventoryItems;
  const currentProgramDay = Math.min(firstWeekProgram.length, Math.max(1, onboardingCompletedCount + 1));
  const currentProgramFocus = firstWeekProgram[currentProgramDay - 1];
  const stepStatusDetails =
    stepTrackingStatus === "connected"
      ? {
          icon: "shoe-print",
          title: translateOrFallback(t, "screens.home.quick.stepStatusConnectedTitle", "Шаги подключены"),
          description: translateOrFallback(
            t,
            "screens.home.quick.stepStatusConnectedDescription",
            "Шагомер работает и обновляет прогресс в течение дня.",
          ),
        }
      : stepTrackingStatus === "sync_deferred"
        ? {
            icon: "cloud-sync-outline",
            title: translateOrFallback(t, "screens.home.quick.stepStatusDeferredTitle", "Синк отложен"),
            description: translateOrFallback(
              t,
              "screens.home.quick.stepStatusDeferredDescription",
              "Шаги считаются локально и отправятся на сервер, когда соединение стабилизируется.",
            ),
          }
        : stepTrackingStatus === "permission_required"
          ? {
              icon: "shield-alert-outline",
              title: translateOrFallback(t, "screens.home.quick.stepStatusPermissionTitle", "Нужен доступ к шагам"),
              description: translateOrFallback(
                t,
                "screens.home.quick.stepStatusPermissionDescription",
                "Разреши доступ к активности на устройстве, чтобы шаги влияли на задания и прогресс.",
              ),
            }
          : {
              icon: "alert-circle-outline",
              title: translateOrFallback(t, "screens.home.quick.stepStatusUnavailableTitle", "Шаги пока недоступны"),
              description: translateOrFallback(
                t,
                "screens.home.quick.stepStatusUnavailableDescription",
                "Источник шагов временно недоступен. Базовый прогресс все равно можно вести через задания.",
              ),
            };
  const todayPlan = needsGoalSetup
    ? {
        title: translateOrFallback(t, "screens.home.quick.todayPlanNoGoalTitle", "Сначала выбери цель"),
        description: translateOrFallback(
          t,
          "screens.home.quick.todayPlanNoGoalDescription",
          "Без цели приложению сложнее подбирать полезные задания и показывать реальный прогресс.",
        ),
        actionLabel: t("common.createGoal"),
        onPress: () => navigation.navigate("GoalSelect"),
        icon: "flag-checkered",
      }
    : dailyBonus?.available
      ? {
          title: translateOrFallback(t, "screens.home.quick.todayPlanRewardTitle", "Забери награду дня"),
          description: translateOrFallback(
            t,
            "screens.home.quick.todayPlanRewardDescription",
            "Ежедневная награда уже доступна. Забери её сейчас, чтобы не откладывать прогресс.",
          ),
          actionLabel: t("screens.home.quick.claimReward"),
          onPress: handleClaimBonus,
          icon: "gift-open-outline",
        }
      : !unlockState.hasQuestProgress
        ? {
            title: translateOrFallback(t, "screens.home.quick.todayPlanFirstQuestTitle", "Начни день с первого квеста"),
            description: translateOrFallback(
              t,
              "screens.home.quick.todayPlanFirstQuestDescription",
              "Закрой хотя бы одно задание сегодня, чтобы запустить прогресс по цели и серию.",
            ),
            actionLabel: t("screens.home.toQuests"),
            onPress: () => navigation.navigate("Quests"),
            icon: "notebook-outline",
          }
        : unlockState.inventoryResolved && !unlockState.hasInventoryItems
            ? {
                title: translateOrFallback(t, "screens.home.quick.todayPlanFirstItemTitle", "Открой магазин и возьми первый предмет"),
                description: translateOrFallback(
                  t,
                  "screens.home.quick.todayPlanFirstItemDescription",
                  "Первая покупка связывает задания с прогрессом героя: у тебя появляется экипировка и заметный рост характеристик.",
                ),
                actionLabel: t("screens.home.shop"),
                onPress: () => navigation.navigate("Shop"),
                icon: "storefront-outline",
              }
            : unlockState.inventoryResolved && !unlockState.hasEquippedItems
              ? {
                  title: translateOrFallback(t, "screens.home.quick.todayPlanEquipTitle", "Экипируй первый предмет"),
                  description: translateOrFallback(
                    t,
                    "screens.home.quick.todayPlanEquipDescription",
                    "После экипировки предмет начинает реально усиливать героя: растут характеристики, награды и выживаемость.",
                  ),
                  actionLabel: t("screens.home.character"),
                  onPress: () => navigation.navigate("Character"),
                  icon: "shield-account",
                }
        : systemCompleted < systemCap
          ? {
              title: translateOrFallback(t, "screens.home.quick.todayPlanKeepGoingTitle", "Хороший темп, продолжай"),
              description: translateOrFallback(
                t,
                "screens.home.quick.todayPlanKeepGoingDescription",
                `Сегодня уже закрыто ${systemCompleted}/${systemCap}. Если добьёшь лимит, прогресс по цели пойдёт быстрее.`,
                {
                  completed: systemCompleted,
                  total: systemCap,
                },
              ),
              actionLabel: t("screens.home.toQuests"),
              onPress: () => navigation.navigate("Quests"),
              icon: "run-fast",
            }
          : {
              title: translateOrFallback(t, "screens.home.quick.todayPlanReviewTitle", "Проверь героя и закрепи результат"),
              description: translateOrFallback(
                t,
                "screens.home.quick.todayPlanReviewDescription",
                "Сегодняшний минимум уже сделан. Зайди в персонажа, посмотри экипировку и подготовь следующий шаг по цели.",
              ),
              actionLabel: t("screens.home.character"),
              onPress: () => navigation.navigate("Character"),
              icon: "shield-account",
            };

  React.useEffect(() => {
    const shouldPrompt = dailyBonus?.can_claim && dailyBonus?.available;
    if (!shouldPrompt) {
      setShowDailyBonusModal(false);
      return;
    }

    const todayKey = getLocalDayKey();
    getLastDailyBonusPromptDay()
      .then((lastPromptDay) => {
        if (lastPromptDay !== todayKey) {
          setShowDailyBonusModal(true);
          return saveLastDailyBonusPromptDay(todayKey);
        }
      })
      .catch(() => undefined);
  }, [dailyBonus?.available, dailyBonus?.can_claim]);

  const statItems = [
    {
      key: "strength",
      icon: "strength",
      title: t("screens.home.stats.strength.title"),
      description: `Сила увеличивает дневной лимит системных квестов. Сейчас: +${Math.floor((derivedStats.strength ?? 0) / 10)} квестов.`,
    },
    {
      key: "intellect",
      icon: "intellect",
      title: t("screens.home.stats.intellect.title"),
      description: t("screens.home.quick.stats.intellect", { value: derivedStats.xpBonusPercent }),
    },
    {
      key: "agility",
      icon: "agility",
      title: t("screens.home.stats.agility.title"),
      description: t("screens.home.quick.stats.agility", { value: derivedStats.goldBonusPercent }),
    },
    {
      key: "stamina",
      icon: "stamina",
      title: t("screens.home.stats.stamina.title"),
      description: t("screens.home.quick.stats.stamina", { value: healthState?.max_health ?? derivedStats.health }),
    },
    {
      key: "crit",
      icon: "crit",
      title: t("screens.home.stats.crit.title"),
      description: t("screens.home.quick.stats.crit", { value: derivedStats.critRewardChancePercent }),
    },
    {
      key: "luck",
      icon: "luck",
      title: t("screens.home.stats.luck.title"),
      description: t("screens.home.quick.stats.luck", { value: derivedStats.lootChancePercent }),
    },
    {
      key: "armor",
      icon: "armor",
      title: t("screens.home.stats.armor.title"),
      description: t("screens.home.quick.stats.armor", { value: derivedStats.armorReductionPercent }),
    },
  ];
  const howItWorksItems = [
    {
      icon: "flag-checkered",
      title: translateOrFallback(t, "screens.home.quick.onboardingGoalTitle", "Выбери цель"),
      description: translateOrFallback(
        t,
        "screens.home.quick.onboardingGoalDescription",
        "Цель задает направление: под нее подбираются задания и считается прогресс.",
      ),
    },
    {
      icon: "notebook-outline",
      title: translateOrFallback(t, "screens.home.features.quests.title", "Задания"),
      description: translateOrFallback(
        t,
        "screens.home.features.quests.description",
        "Выполняй задания каждый день, чтобы получать опыт, золото и двигаться к цели.",
      ),
    },
    {
      icon: "storefront-outline",
      title: translateOrFallback(t, "screens.home.features.inventory.title", "Инвентарь и экипировка"),
      description: translateOrFallback(
        t,
        "screens.home.features.inventory.description",
        "Предметы покупаются или выпадают из наград, а потом усиливают героя через экипировку.",
      ),
    },
  ];
  const equipmentGuideItems = [
    {
      icon: "shield-account",
      title: translateOrFallback(t, "screens.home.quick.itemsBoostTitle", "Экипировка усиливает героя"),
      description: translateOrFallback(
        t,
        "screens.home.quick.itemsBoostDescription",
        "Предметы повышают характеристики, броню, крит и удачу. Чем лучше экипировка, тем полезнее каждый квест.",
      ),
    },
    {
      icon: "storefront-outline",
      title: translateOrFallback(t, "screens.home.quick.itemsSourceTitle", "Откуда берутся предметы"),
      description: translateOrFallback(
        t,
        "screens.home.quick.itemsSourceDescription",
        "Предметы можно купить в магазине или получить из наград, а затем надеть на персонажа.",
      ),
    },
    {
      icon: "heart-plus",
      title: translateOrFallback(t, "screens.home.quick.healthRecoverTitle", "Зачем следить за здоровьем"),
      description: translateOrFallback(
        t,
        "screens.home.quick.healthRecoverDescription",
        "Заходи регулярно, выполняй задания и держи броню на персонаже, чтобы не терять темп прогресса.",
      ),
    },
  ];

  async function handleClaimBonus() {
    try {
      setIsClaimingDailyBonus(true);
      const result = await claimDailyBonus();
      if ((result as { queued?: boolean })?.queued) {
        await pushToast({
          title: t("offline.queuedActionTitle"),
          description: t("offline.dailyBonusQueuedDescription"),
          icon: "clock-outline",
          tone: "info",
        });
        return;
      }

      await pushToast({
        title: t("screens.home.dailyRewardObtained"),
        description: t("screens.home.dailyRewardDescription", {
          xp: dailyBonus?.bonus_xp ?? 0,
          gold: dailyBonus?.bonus_crystals ?? 0,
        }),
        icon: "gift-open-outline",
        tone: "reward",
      }, { sound: "item" });
      setShowDailyBonusModal(false);
      await saveLastDailyBonusPromptDay(getLocalDayKey());
      await refreshGame();
    } catch (error) {
      await pushToast({
        title: t("screens.home.rewardTitle"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsClaimingDailyBonus(false);
    }
  }

  async function handleClaimWeeklyReward() {
    try {
      setIsClaimingWeeklyReward(true);
      const result = await claimWeeklyGoalReward();
      if ((result as { queued?: boolean })?.queued) {
        await pushToast({
          title: t("offline.queuedActionTitle"),
          description: t("offline.weeklyRewardQueuedDescription"),
          icon: "clock-outline",
          tone: "info",
        });
        return;
      }

      await pushToast({
        title: t("screens.home.weeklyRewardObtained"),
        description: t("screens.home.weeklyRewardDescription", {
          xp: result.reward_xp ?? 0,
          gold: result.reward_crystals ?? 0,
        }),
        icon: "calendar-check",
        tone: "reward",
      }, { sound: "level", haptic: "level", durationMs: 2500 });
      await refreshGame();
    } catch (error) {
      await pushToast({
        title: t("screens.home.weeklyRewardTitle"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsClaimingWeeklyReward(false);
    }
  }

  async function handleClaimSeasonalReward() {
    try {
      setIsClaimingSeasonalReward(true);
      const result = await claimSeasonalGoalReward();
      if ((result as { queued?: boolean })?.queued) {
        await pushToast({
          title: t("offline.queuedActionTitle"),
          description: t("screens.home.quick.seasonalQueuedDescription"),
          icon: "clock-outline",
          tone: "info",
        });
        return;
      }

      await pushToast({
        title: t("screens.home.quick.seasonalRewardObtained"),
        description: result.reward_chest?.chest_name
          ? t("screens.home.quick.seasonalRewardWithChest", {
              xp: result.reward_xp ?? 0,
              gold: result.reward_crystals ?? 0,
              chest: result.reward_chest.chest_name,
            })
          : t("screens.home.quick.seasonalRewardWithoutChest", {
              xp: result.reward_xp ?? 0,
              gold: result.reward_crystals ?? 0,
            }),
        icon: "trophy-variant",
        tone: "reward",
      }, { sound: "level", haptic: "level", durationMs: 2500 });
      await refreshGame();
    } catch (error) {
      await pushToast({
        title: t("screens.home.quick.seasonalRewardTitle"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsClaimingSeasonalReward(false);
    }
  }

  if (!hero && isRefreshing) {
    return (
      <Screen title={t("screens.home.title")} subtitle={t("screens.loading.subtitle")} scrollable={false}>
        <LoadingAnimation label={t("screens.home.syncMessage")} />
      </Screen>
    );
  }

  return (
    <Screen title={t("screens.home.title")} subtitle={t("screens.home.quick.subtitle")}>
      <Modal visible={showDailyBonusModal} transparent animationType="fade" onRequestClose={() => setShowDailyBonusModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.dailyRewardIconWrap}>
              <GameIcon name="gift-open-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>{t("screens.home.rewardTitle")}</Text>
            <Text style={styles.modalDescription}>{dailyBonus?.message ?? t("screens.home.dailyRewardDescription", { xp: 0, gold: 0 })}</Text>
            <Text style={styles.modalRewardMeta}>
              {t("screens.home.dailyRewardDescription", {
                xp: dailyBonus?.bonus_xp ?? 0,
                gold: dailyBonus?.bonus_crystals ?? 0,
              })}
            </Text>
            <View style={styles.modalActions}>
              <Button
                label={t("common.cancel")}
                variant="secondary"
                onPress={() => setShowDailyBonusModal(false)}
                style={styles.modalActionButton}
              />
              <Button
                label={isClaimingDailyBonus ? t("common.loading") : t("screens.home.quick.claimReward")}
                icon="gift-open-outline"
                onPress={handleClaimBonus}
                variant="gold"
                loading={isClaimingDailyBonus}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {!isOnline || pendingActionsCount > 0 ? (
        <StateBlock
          tone="info"
          icon={isOnline ? "cloud-sync-outline" : "cloud-off-outline"}
          title={isOnline ? t("offline.syncingTitle") : t("offline.offlineTitle")}
          description={
            isOnline
              ? t("offline.syncingDescription", { count: pendingActionsCount })
              : t("offline.offlineDescription", { count: pendingActionsCount })
          }
        />
      ) : null}

      {!isDataConsistent && dataConsistencyError ? (
        <StateBlock
          tone="warning"
          icon="alert-circle"
          title={translateOrFallback(t, "screens.home.quick.syncDataErrorTitle", "Данные героя требуют повторной синхронизации")}
          description={dataConsistencyError}
          actionLabel={t("common.retry")}
          onAction={() => void refreshGame(true)}
        />
      ) : null}

      {showAdvancedHome ? (
      <Card tone="subtle">
        <View style={styles.stepsCardHeader}>
          <View style={styles.stepsTitleWrap}>
            <Text style={styles.cardTitle}>{translateOrFallback(t, "screens.home.quick.stepsCardTitle", "Шагомер")}</Text>
            <Text style={styles.stepsCardMeta}>
              {stepSourceLabel ?? translateOrFallback(t, "screens.quests.quick.stepsSourceFallback", "Шаги с устройства")}
            </Text>
          </View>
          <View style={styles.stepsValueWrap}>
            <Text style={styles.stepsValue}>{todaySteps ?? 0}</Text>
            <Text style={styles.stepsValueLabel}>
              {translateOrFallback(t, "screens.home.quick.todayStepsLabel", language === "ru" ? "сегодня" : "today")}
            </Text>
          </View>
        </View>
        <Text style={styles.stepsDescription}>
          {todaySteps != null
            ? translateOrFallback(
                t,
                "screens.home.quick.stepsCardDescription",
                "Шаги отслеживаются в реальном времени и влияют на задания, прогресс и социальные рейтинги.",
              )
            : translateOrFallback(
                t,
                "screens.home.quick.stepsCardUnavailable",
                "Шаги пока недоступны. Проверь разрешения активности и доступ к источнику шагов на устройстве.",
              )}
        </Text>
        <Button
          label={t("screens.home.toQuests")}
          icon="run-fast"
          variant="secondary"
          onPress={() => navigation.navigate("Quests")}
        />
      </Card>
      ) : null}

      <ProfileHeroCard
        name={hero?.name ?? t("screens.home.heroName")}
        heroClass={hero?.class}
        level={hero?.level ?? 1}
        currentXp={hero?.current_xp ?? 0}
        nextLevelXp={hero?.next_level_xp ?? 120}
        gold={hero?.crystals ?? 0}
        streak={hero?.streak ?? 0}
        healthCurrent={healthState?.current_health ?? null}
        healthMax={healthState?.max_health ?? null}
        isWounded={healthState?.is_wounded ?? false}
        penaltyQuestsRemaining={healthState?.penalty_quests_remaining ?? 0}
        rewardPenaltyPercent={healthState?.reward_penalty_percent ?? 0}
        subtitle={t("screens.home.quick.heroSubtitle")}
      />

      <Card tone="accent">
        <View style={styles.goalHeader}>
          <View style={styles.goalCopy}>
            <Text style={styles.cardTitle}>{t("screens.home.quick.goalTitle")}</Text>
            <Text style={styles.goalTitle}>
              {needsGoalSetup
                ? translateOrFallback(t, "screens.home.quick.goalSetupTitle", "Выбери первую цель")
                : goal?.goal_title ?? t("screens.home.quick.goalEmptyTitle")}
            </Text>
            <Text style={styles.goalText}>
              {needsGoalSetup
                ? translateOrFallback(
                    t,
                    "screens.home.quick.goalSetupDescription",
                    "С этого начнется понятный маршрут: приложение соберет первые задания и покажет, как ты двигаешься вперед.",
                  )
                : goal
                ? t("screens.home.quick.goalSummary", {
                    progress: goal.goal_progress_percent,
                    days: goal.goal_days_remaining,
                    completed: totalCompleted,
                    total: totalCap,
                  })
                : t("screens.home.quick.goalEmptyDescription")}
            </Text>
          </View>

          <View style={styles.goalMetaPanel}>
            <Text style={styles.goalMetaLabel}>
              {needsGoalSetup
                ? translateOrFallback(t, "screens.home.quick.programLabel", "Первые 7 дней")
                : t("screens.home.quick.dailyTasks")}
            </Text>
            <Text style={styles.goalMetaValue}>
              {needsGoalSetup ? `${currentProgramDay}/7` : `${systemCompleted}/${systemCap}`}
            </Text>
          </View>
        </View>

        <View style={[styles.quickActionsRow, isCompactLayout ? styles.quickActionsRowCompact : null]}>
          <Button label={t("screens.home.toQuests")} icon="notebook-outline" onPress={() => navigation.navigate("Quests")} style={styles.primaryAction} />
          <Button label={t("screens.home.character")} icon="shield-account" onPress={() => navigation.navigate("Character")} variant="secondary" style={styles.secondaryAction} />
          {contextAction ? (
            <Button
              label={contextAction.label}
              icon={contextAction.icon}
              onPress={contextAction.onPress}
              variant="secondary"
              style={styles.secondaryAction}
            />
          ) : null}
        </View>
      </Card>

      {showOnboardingRoadmap ? (
        <Card tone="accent">
          <Text style={styles.eyebrow}>
            {translateOrFallback(t, "screens.home.quick.programLabel", "Первые 7 дней")}
          </Text>
          <Text style={styles.cardTitle}>{translateOrFallback(t, "screens.home.quick.onboardingTitle", "Первые шаги")}</Text>
          <Text style={styles.bonusText}>
            {translateOrFallback(
              t,
              "screens.home.quick.onboardingDescription",
              "Сначала пройди базовый путь: цель, первое задание, первая награда и первое усиление. Потом откроются остальные системы.",
            )}
          </Text>
          <InfoItem icon="calendar-star" title={`День ${currentProgramDay}: ${currentProgramFocus.title}`} description={currentProgramFocus.description} />
          <InfoItem icon={stepStatusDetails.icon} title={stepStatusDetails.title} description={stepStatusDetails.description} />
          <Text style={styles.rewardMeta}>
              {translateOrFallback(
                t,
                "screens.home.quick.onboardingProgress",
                `РћС‚РєСЂС‹С‚Рѕ ${onboardingCompletedCount}/${onboardingSteps.length}`,
                { completed: onboardingCompletedCount, total: onboardingSteps.length },
              )}
            </Text>
          <View style={styles.roadmapList}>
            {onboardingSteps.map((step) => {
              const isActive = nextOnboardingStep?.key === step.key;

              return (
                <View key={step.key} style={[styles.roadmapItem, isActive ? styles.roadmapItemActive : null]}>
                  <View
                    style={[
                      styles.roadmapIconWrap,
                      step.done ? styles.roadmapIconWrapDone : null,
                      isActive ? styles.roadmapIconWrapActive : null,
                    ]}
                  >
                    <GameIcon
                      name={step.done ? "check-circle-outline" : step.icon}
                      size={18}
                      color={step.done || isActive ? colors.primary : colors.textDim}
                    />
                  </View>
                  <View style={styles.roadmapCopy}>
                    <Text style={styles.roadmapTitle}>{step.title}</Text>
                    <Text style={styles.roadmapDescription}>{step.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Button
            label={nextOnboardingStep?.actionLabel ?? t("screens.home.toQuests")}
            icon={nextOnboardingStep?.icon ?? "notebook-outline"}
            onPress={nextOnboardingStep?.onPress ?? (() => navigation.navigate("Quests"))}
            variant="secondary"
          />
        </Card>
      ) : null}

      <Card tone="subtle">
        <Text style={styles.cardTitle}>{t("screens.home.aboutTitle")}</Text>
        <Text style={styles.bonusText}>{t("screens.home.aboutText")}</Text>
        <View style={styles.roadmapList}>
          {howItWorksItems.map((item) => (
            <InfoItem key={item.title} icon={item.icon} title={item.title} description={item.description} />
          ))}
        </View>
      </Card>

      {showDeepGuideCards ? (
        <Card tone="subtle">
          <Text style={styles.cardTitle}>{t("screens.home.statsTitle")}</Text>
          <Text style={styles.bonusText}>{t("screens.home.statsIntro")}</Text>
          <View style={styles.statsGrid}>
            {statItems.map((item) => (
              <View key={item.key} style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconWrap}>
                    <GameIcon name={item.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.statName}>{item.title}</Text>
                </View>
                <Text style={styles.statText}>{item.description}</Text>
              </View>
            ))}
          </View>
          <View style={styles.roadmapList}>
            {equipmentGuideItems.map((item) => (
              <InfoItem key={item.title} icon={item.icon} title={item.title} description={item.description} />
            ))}
          </View>
        </Card>
      ) : null}

      {false ? (
        <Card tone={nextOnboardingStep ? "accent" : "subtle"}>
          <Text style={styles.eyebrow}>
            {translateOrFallback(t, "screens.home.quick.programLabel", "Первые 7 дней")}
          </Text>
          <Text style={styles.cardTitle}>{translateOrFallback(t, "screens.home.quick.onboardingTitle", "Первые шаги")}</Text>
          <Text style={styles.bonusText}>
            {translateOrFallback(
              t,
              "screens.home.quick.onboardingDescription",
              "Сначала пройди базовый путь: цель, первое задание, первая награда и первое усиление. Потом откроются остальные системы.",
            )}
          </Text>
          <InfoItem icon="calendar-star" title={`День ${currentProgramDay}: ${currentProgramFocus.title}`} description={currentProgramFocus.description} />
          <InfoItem icon={stepStatusDetails.icon} title={stepStatusDetails.title} description={stepStatusDetails.description} />
          <Text style={styles.rewardMeta}>
              {translateOrFallback(
                t,
                "screens.home.quick.onboardingProgress",
                `Открыто ${onboardingCompletedCount}/${onboardingSteps.length}`,
                { completed: onboardingCompletedCount, total: onboardingSteps.length },
              )}
            </Text>
          <View style={styles.roadmapList}>
            {onboardingSteps.map((step) => {
              const isActive = nextOnboardingStep?.key === step.key;

              return (
                <View key={step.key} style={[styles.roadmapItem, isActive ? styles.roadmapItemActive : null]}>
                  <View
                    style={[
                      styles.roadmapIconWrap,
                      step.done ? styles.roadmapIconWrapDone : null,
                      isActive ? styles.roadmapIconWrapActive : null,
                    ]}
                  >
                    <GameIcon
                      name={step.done ? "check-circle-outline" : step.icon}
                      size={18}
                      color={step.done || isActive ? colors.primary : colors.textDim}
                    />
                  </View>
                  <View style={styles.roadmapCopy}>
                    <Text style={styles.roadmapTitle}>{step.title}</Text>
                    <Text style={styles.roadmapDescription}>{step.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          {nextOnboardingStep ? (
            <Button
              label={nextOnboardingStep?.actionLabel ?? t("screens.home.toQuests")}
              icon={nextOnboardingStep?.icon ?? "notebook-outline"}
              onPress={nextOnboardingStep?.onPress ?? (() => navigation.navigate("Quests"))}
              variant="secondary"
            />
          ) : null}
        </Card>
      ) : null}

      {showFirstWinCard ? (
        <Card tone="accent">
          <Text style={styles.eyebrow}>
            {translateOrFallback(t, "screens.home.quick.firstWinLabel", "Первый результат")}
          </Text>
          <Text style={styles.cardTitle}>
            {translateOrFallback(t, "screens.home.quick.firstWinTitle", "Прогресс уже запущен")}
          </Text>
          <Text style={styles.bonusText}>
            {translateOrFallback(
              t,
              "screens.home.quick.firstWinDescription",
              "Ты уже закрыл первое задание. Теперь пора закрепить результат наградой или первым предметом, чтобы путь стал ощутимым.",
            )}
          </Text>
          <View style={styles.firstWinStats}>
            <View style={styles.firstWinStatChip}>
              <GameIcon name="star-four-points-outline" size={16} color={colors.primary} />
              <Text style={styles.firstWinStatText}>XP: {hero?.current_xp ?? 0}</Text>
            </View>
            <View style={styles.firstWinStatChip}>
              <GameIcon name="currency-usd" size={16} color={colors.gold} />
              <Text style={styles.firstWinStatText}>{t("common.gold")}: {hero?.crystals ?? 0}</Text>
            </View>
          </View>
          <Button
            label={unlockState.shopUnlocked ? t("screens.home.shop") : t("screens.home.toQuests")}
            icon={unlockState.shopUnlocked ? "storefront-outline" : "notebook-outline"}
            onPress={() => navigation.navigate(unlockState.shopUnlocked ? "Shop" : "Quests")}
          />
        </Card>
      ) : null}

      {!showOnboardingRoadmap ? (
        <Card tone="subtle">
        <Text style={styles.eyebrow}>
          {translateOrFallback(t, "screens.home.quick.dailyCheckinLabel", "Ежедневный фокус")}
        </Text>
        <Text style={styles.bonusText}>
          {translateOrFallback(
            t,
            "screens.home.quick.dailyCheckinPrompt",
            "Что сегодня реально двигает твою цель вперед?",
          )}
        </Text>
        <Text style={styles.cardTitle}>{translateOrFallback(t, "screens.home.quick.todayPlanTitle", "Что сделать дальше")}</Text>
        <InfoItem icon={todayPlan.icon} title={todayPlan.title} description={todayPlan.description} />
        <InfoItem icon={stepStatusDetails.icon} title={stepStatusDetails.title} description={stepStatusDetails.description} />
        <Button label={todayPlan.actionLabel} icon={todayPlan.icon} onPress={todayPlan.onPress} variant="secondary" />
        </Card>
      ) : null}

      {showAdvancedHome && weeklyGoal ? (
        <Card tone={weeklyGoal.claimable ? "accent" : "subtle"}>
          <Text style={styles.cardTitle}>{t("screens.home.weeklyRewardTitle")}</Text>
          <Text style={styles.bonusText}>{weeklyGoal.title}</Text>
          <Text style={styles.rewardMeta}>
            {weeklyGoal.progress}/{weeklyGoal.target} | {weeklyGoal.progress_percent}% | {weeklyGoal.state_message}
          </Text>
          <Text style={styles.rewardMeta}>
            {t("screens.home.quick.weeklyRewardSummary", {
              xp: weeklyGoal.reward_preview.xp,
              gold: weeklyGoal.reward_preview.crystals,
            })}
          </Text>
          {weeklyGoal.claimable ? (
            <Button
              label={isClaimingWeeklyReward ? t("common.loading") : t("screens.home.claimWeekly")}
              icon="calendar-check"
              onPress={handleClaimWeeklyReward}
              loading={isClaimingWeeklyReward}
            />
          ) : null}
        </Card>
      ) : null}

      {showAdvancedHome && seasonalGoal ? (
        <Card tone={seasonalGoal.claimable ? "accent" : "subtle"}>
          <Text style={styles.cardTitle}>{t("screens.home.quick.seasonalRewardTitle")}</Text>
          <Text style={styles.bonusText}>{seasonalGoal.title}</Text>
          <Text style={styles.rewardMeta}>
            {seasonalGoal.progress}/{seasonalGoal.target} | {seasonalGoal.progress_percent}% | {seasonalGoal.state_message}
          </Text>
          <Text style={styles.rewardMeta}>
            {seasonalGoal.reward_preview.chest_name
              ? t("screens.home.quick.seasonalPreviewWithChest", {
                  xp: seasonalGoal.reward_preview.xp,
                  gold: seasonalGoal.reward_preview.crystals,
                  chest: seasonalGoal.reward_preview.chest_name,
                })
              : t("screens.home.quick.seasonalPreviewWithoutChest", {
                  xp: seasonalGoal.reward_preview.xp,
                  gold: seasonalGoal.reward_preview.crystals,
                })}
          </Text>
          <View style={[styles.quickActionsRow, isCompactLayout ? styles.quickActionsRowCompact : null]}>
            {seasonalGoal.claimable ? (
              <Button
                label={t("screens.home.quick.claimSeasonal")}
                icon="trophy-variant"
                onPress={handleClaimSeasonalReward}
                style={styles.primaryAction}
                loading={isClaimingSeasonalReward}
              />
            ) : null}
            <Button
              label={t("screens.home.quick.toEvents")}
              icon="notebook-outline"
              variant="secondary"
              onPress={() => navigation.navigate("Quests")}
              style={seasonalGoal.claimable ? styles.secondaryAction : styles.primaryAction}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    overviewCard: {
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.84)" : "rgba(11,17,31,0.62)",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: themeMode === "light" ? "rgba(17,24,39,0.34)" : "rgba(2,6,16,0.76)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: 460,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.34)" : "rgba(245,158,11,0.22)",
      backgroundColor: colors.card,
      padding: 20,
      gap: 12,
      alignItems: "center",
    },
    dailyRewardIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.14)" : "rgba(245,158,11,0.14)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.24)" : "rgba(245,158,11,0.22)",
    },
    modalTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    modalDescription: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    modalRewardMeta: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    modalActions: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
      marginTop: 4,
    },
    modalActionButton: {
      flex: 1,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    overviewRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    overviewChip: {
      flexGrow: 1,
      minWidth: 92,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.22)" : "rgba(255,255,255,0.08)",
      backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.94)" : "rgba(8,13,23,0.72)",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    overviewLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    overviewValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    goalHeader: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    goalCopy: {
      flex: 1,
      gap: 4,
    },
    goalTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    goalText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    goalMetaPanel: {
      minWidth: 110,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.35)" : "rgba(245,158,11,0.24)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.78)" : "rgba(11,18,32,0.72)",
      paddingHorizontal: 10,
      paddingVertical: 10,
      alignItems: "center",
      gap: 4,
    },
    goalMetaLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
    },
    goalMetaValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    quickActionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    quickActionsRowCompact: {
      flexWrap: "wrap",
    },
    roadmapList: {
      gap: 10,
    },
    roadmapItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(8,13,23,0.78)",
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    roadmapItemActive: {
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.34)" : "rgba(245,158,11,0.24)",
      backgroundColor: themeMode === "light" ? "rgba(255,246,228,0.96)" : "rgba(20,28,46,0.88)",
    },
    roadmapIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: themeMode === "light" ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.14)",
    },
    roadmapIconWrapDone: {
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.14)",
    },
    roadmapIconWrapActive: {
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.18)" : "rgba(245,158,11,0.16)",
    },
    roadmapCopy: {
      flex: 1,
      gap: 3,
    },
    roadmapTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    roadmapDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    stepsCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    stepsTitleWrap: {
      flex: 1,
      gap: 4,
    },
    stepsCardMeta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    stepsValueWrap: {
      minWidth: 96,
      alignItems: "flex-end",
      gap: 2,
    },
    stepsValue: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 30,
    },
    stepsValueLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    stepsDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    primaryAction: {
      flex: 1.15,
      minWidth: 120,
    },
    secondaryAction: {
      flex: 1,
      minWidth: 112,
    },
    feedList: {
      gap: 10,
    },
    feedItem: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(8,13,23,0.78)",
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 10,
    },
    feedCopy: {
      gap: 4,
    },
    feedTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    feedDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    feedActionChip: {
      alignSelf: "flex-start",
      borderRadius: 999,
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.14)" : "rgba(245,158,11,0.16)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.24)" : "rgba(245,158,11,0.22)",
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    feedActionText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statCard: {
      minWidth: 140,
      flexGrow: 1,
      flexBasis: "45%",
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(8,13,23,0.78)",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
    },
    statName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    statText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    infoItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    infoIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
    },
    infoCopy: {
      flex: 1,
      gap: 2,
    },
    infoTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    infoDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    bonusText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    rewardMeta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    firstWinStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    firstWinStatChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
    },
    firstWinStatText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
  });
}
