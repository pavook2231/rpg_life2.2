import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { claimDailyBonus, claimSeasonalGoalReward, claimWeeklyGoalReward } from "../api/game";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useFeedback } from "../context/FeedbackContext";
import { useGame } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { useOffline } from "../context/OfflineContext";
import { buildDerivedStats } from "../lib/gameRules";
import { getNextHealthDecayLabel } from "../lib/healthUi";
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
  const { hero, profile, equipment, rewards, refreshGame, isRefreshing, todaySteps, stepSourceLabel } = useGame();
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
  const dailyBonus = rewards?.daily_bonus ?? null;
  const weeklyGoal = rewards?.weekly_goal ?? null;
  const seasonalGoal = rewards?.seasonal_goal ?? null;

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
  const todayPlan = !goal
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
      : totalCompleted === 0
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
              title: translateOrFallback(t, "screens.home.quick.todayPlanSocialTitle", "Сравни прогресс с друзьями"),
              description: translateOrFallback(
                t,
                "screens.home.quick.todayPlanSocialDescription",
                "Ты уже закрыл план на сегодня. Можно зайти к друзьям и посмотреть, кого получится обогнать.",
              ),
              actionLabel: translateOrFallback(t, "screens.home.quick.openFriends", "Открыть друзей"),
              onPress: () => navigation.navigate("Friends"),
              icon: "account-multiple-outline",
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
      description: t("screens.home.quick.stats.strength"),
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

      <Card style={styles.overviewCard} animated={false}>
        <Text style={styles.eyebrow}>TODAY</Text>
        <View style={styles.overviewRow}>
          <View style={styles.overviewChip}>
            <Text style={styles.overviewLabel}>{t("screens.home.quick.overview.progress")}</Text>
            <Text style={styles.overviewValue}>
              {totalCompleted}/{totalCap}
            </Text>
          </View>
          <View style={styles.overviewChip}>
            <Text style={styles.overviewLabel}>{t("screens.home.quick.overview.streak")}</Text>
            <Text style={styles.overviewValue}>{hero?.streak ?? 0}</Text>
          </View>
          <View style={styles.overviewChip}>
            <Text style={styles.overviewLabel}>{t("screens.home.quick.overview.status")}</Text>
            <Text style={styles.overviewValue}>
              {isOnline ? t("screens.home.quick.overview.online") : t("screens.home.quick.overview.offline")}
            </Text>
          </View>
        </View>
      </Card>

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
            <Text style={styles.goalTitle}>{goal?.goal_title ?? t("screens.home.quick.goalEmptyTitle")}</Text>
            <Text style={styles.goalText}>
              {goal
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
            <Text style={styles.goalMetaLabel}>{t("screens.home.quick.dailyTasks")}</Text>
            <Text style={styles.goalMetaValue}>
              {systemCompleted}/{systemCap}
            </Text>
          </View>
        </View>

        <View style={[styles.quickActionsRow, isCompactLayout ? styles.quickActionsRowCompact : null]}>
          <Button label={t("screens.home.toQuests")} icon="notebook-outline" onPress={() => navigation.navigate("Quests")} style={styles.primaryAction} />
          <Button label={t("screens.home.character")} icon="shield-account" onPress={() => navigation.navigate("Character")} variant="secondary" style={styles.secondaryAction} />
          <Button label={t("screens.home.shop")} icon="storefront-outline" onPress={() => navigation.navigate("Shop")} variant="secondary" style={styles.secondaryAction} />
        </View>
      </Card>

      {!goal ? (
        <StateBlock
          icon="flag-checkered"
          title={t("screens.home.quick.goalCtaTitle")}
          description={t("screens.home.quick.goalCtaDescription")}
          actionLabel={t("common.createGoal")}
          onAction={() => navigation.navigate("GoalSelect")}
        />
      ) : null}

      <Card tone="subtle">
        <Text style={styles.cardTitle}>{translateOrFallback(t, "screens.home.quick.todayPlanTitle", "Что сделать дальше")}</Text>
        <InfoItem icon={todayPlan.icon} title={todayPlan.title} description={todayPlan.description} />
        <Button label={todayPlan.actionLabel} icon={todayPlan.icon} onPress={todayPlan.onPress} variant="secondary" />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{t("screens.home.statsTitle")}</Text>
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
      </Card>

      <Card tone="subtle">
        <Text style={styles.cardTitle}>{t("screens.home.quick.itemsTitle")}</Text>
        <InfoItem
          icon="shield-sword"
          title={t("screens.home.quick.itemsBoostTitle")}
          description={t("screens.home.quick.itemsBoostDescription")}
        />
        <InfoItem
          icon="treasure-chest"
          title={t("screens.home.quick.itemsSourceTitle")}
          description={t("screens.home.quick.itemsSourceDescription")}
        />
      </Card>

      <Card tone={healthState?.is_wounded ? "danger" : "subtle"}>
        <Text style={styles.cardTitle}>{t("screens.home.quick.healthTitle")}</Text>
        <InfoItem icon="heart-plus" title={t("screens.home.quick.healthDecayTitle")} description={nextDecayLabel} />
        <InfoItem
          icon="alert-circle"
          title={t("screens.home.quick.healthZeroTitle")}
          description={t("screens.home.quick.healthZeroDescription")}
        />
        <InfoItem
          icon="shield-half-full"
          title={t("screens.home.quick.healthRecoverTitle")}
          description={t("screens.home.quick.healthRecoverDescription")}
        />
      </Card>

      {weeklyGoal ? (
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

      {seasonalGoal ? (
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
  });
}
