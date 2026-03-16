import { useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { claimDailyBonus } from "../api/game";
import { Screen } from "../components/Screen";
import { useFeedback } from "../context/FeedbackContext";
import { useGame } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { useOffline } from "../context/OfflineContext";
import { buildDerivedStats } from "../lib/gameRules";
import { getNextHealthDecayLabel } from "../lib/healthUi";
import { Button, Card, GameIcon, LoadingAnimation, ProfileHeroCard, radii, useThemeColors, useThemeMode } from "../ui";

type InfoItemProps = {
  icon: string;
  title: string;
  description: string;
};

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

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const t = useTranslation();
  const { language } = useLocalization();
  const { hero, profile, equipment, rewards, refreshGame, isRefreshing } = useGame();
  const { pushToast, playSound } = useFeedback();
  const { isOnline, pendingActionsCount, isSyncing } = useOffline();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const isCompactLayout = width < 430;
  const dailyBonus = rewards?.daily_bonus ?? null;

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
  const statItems = [
    {
      key: "strength",
      icon: "strength",
      title: "Сила",
      description: "Показывает физическую силу героя и помогает носить более мощную экипировку без просадки по эффективности.",
    },
    {
      key: "intellect",
      icon: "intellect",
      title: "Интеллект",
      description: `Даёт больше опыта за задания. Сейчас: +${derivedStats.xpBonusPercent}% XP.`,
    },
    {
      key: "agility",
      icon: "agility",
      title: "Ловкость",
      description: `Увеличивает золото за задания. Сейчас: +${derivedStats.goldBonusPercent}%.`,
    },
    {
      key: "stamina",
      icon: "stamina",
      title: "Выносливость",
      description: `Увеличивает максимум здоровья героя. Сейчас: ${healthState?.max_health ?? derivedStats.health} HP.`,
    },
    {
      key: "crit",
      icon: "crit",
      title: "Крит",
      description: `Даёт шанс удвоить опыт и золото. Сейчас: ${derivedStats.critRewardChancePercent}%.`,
    },
    {
      key: "luck",
      icon: "luck",
      title: "Удача",
      description: `Повышает шанс сундуков и редких предметов. Сейчас: +${derivedStats.lootChancePercent}%.`,
    },
    {
      key: "armor",
      icon: "armor",
      title: "Броня",
      description: `Снижает урон за пропущенные дни. Сейчас защита: ${derivedStats.armorReductionPercent}%.`,
    },
  ];

  async function handleClaimBonus() {
    const result = await claimDailyBonus();
    if ((result as { queued?: boolean })?.queued) {
      pushToast({
        title: t("offline.queuedActionTitle"),
        description: t("offline.dailyBonusQueuedDescription"),
        icon: "clock-outline",
        tone: "info",
      });
      return;
    }

    await playSound("item");
    pushToast({
      title: t("screens.home.dailyRewardObtained"),
      description: t("screens.home.dailyRewardDescription", {
        xp: dailyBonus?.bonus_xp ?? 0,
        gold: dailyBonus?.bonus_crystals ?? 0,
      }),
      icon: "gift-open-outline",
      tone: "reward",
    });
    await refreshGame();
  }

  if (!hero && isRefreshing) {
    return (
      <Screen title={t("screens.home.title")} subtitle={t("screens.loading.subtitle")} scrollable={false}>
        <LoadingAnimation label={t("screens.home.syncMessage")} />
      </Screen>
    );
  }

  return (
    <Screen title={t("screens.home.title")} subtitle="Краткая сводка героя, цели и правил игры">
      {!isOnline || pendingActionsCount > 0 ? (
        <Card tone="subtle">
          <Text style={styles.offlineTitle}>{isOnline ? t("offline.syncingTitle") : t("offline.offlineTitle")}</Text>
          <Text style={styles.offlineText}>
            {isOnline
              ? t("offline.syncingDescription", { count: pendingActionsCount })
              : t("offline.offlineDescription", { count: pendingActionsCount })}
          </Text>
          {isSyncing ? <Text style={styles.offlineMeta}>{t("offline.syncInProgress")}</Text> : null}
        </Card>
      ) : null}

      <ProfileHeroCard
        name={hero?.name ?? "Герой"}
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
        subtitle="Твой текущий статус и боеготовность"
      />

      <Card tone="accent">
        <View style={styles.goalHeader}>
          <View style={styles.goalCopy}>
            <Text style={styles.cardTitle}>Текущая цель</Text>
            <Text style={styles.goalTitle}>{goal?.goal_title ?? "Цель пока не выбрана"}</Text>
            <Text style={styles.goalText}>
              {goal
                ? `${goal.goal_progress_percent}% прогресса • осталось ${goal.goal_days_remaining} дн. • сегодня выполнено ${totalCompleted}/${totalCap} • в списке 10 уникальных заданий`
                : "Выбери жизненную цель в профиле, чтобы система собирала для тебя 10 разных заданий на каждый день."}
            </Text>
          </View>

          <View style={styles.goalMetaPanel}>
            <Text style={styles.goalMetaLabel}>Задания дня</Text>
            <Text style={styles.goalMetaValue}>
              {systemCompleted}/{systemCap}
            </Text>
          </View>
        </View>

        <View style={[styles.quickActionsRow, isCompactLayout ? styles.quickActionsRowCompact : null]}>
          <Button label="К заданиям" icon="notebook-outline" onPress={() => navigation.navigate("Quests")} style={styles.primaryAction} />
          <Button label="Персонаж" icon="shield-account" onPress={() => navigation.navigate("Character")} variant="secondary" style={styles.secondaryAction} />
          <Button label="Магазин" icon="storefront-outline" onPress={() => navigation.navigate("Shop")} variant="secondary" style={styles.secondaryAction} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>За что отвечают характеристики</Text>
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
        <Text style={styles.cardTitle}>Что дают предметы</Text>
        <InfoItem
          icon="shield-sword"
          title="Экипировка усиливает героя"
          description="Предметы повышают характеристики, броню, шанс крита и удачи. Чем лучше шмот, тем выгоднее каждый квест."
        />
        <InfoItem
          icon="treasure-chest"
          title="Предметы нужны не только для красоты"
          description="Их можно купить, выбить из сундуков и надеть на персонажа, чтобы усилить награды и выживаемость."
        />
      </Card>

      <Card tone={healthState?.is_wounded ? "danger" : "subtle"}>
        <Text style={styles.cardTitle}>Как работает здоровье</Text>
        <InfoItem
          icon="heart-plus"
          title="Если долго не заходить, герой теряет HP"
          description={nextDecayLabel}
        />
        <InfoItem
          icon="alert-circle"
          title="Что будет, если здоровье упадет до нуля"
          description="Герой станет раненым: серия сбросится, а награды временно уменьшатся."
        />
        <InfoItem
          icon="shield-half-full"
          title="Как не умереть"
          description="Заходи каждый день, выполняй задания, держи броню на персонаже и закрывай квесты после ранения, чтобы восстановиться."
        />
      </Card>

      {dailyBonus?.available ? (
        <Card tone="success">
          <Text style={styles.cardTitle}>Ежедневная награда</Text>
          <Text style={styles.bonusText}>{dailyBonus.message}</Text>
          <Button label="Забрать награду" icon="gift-open-outline" onPress={handleClaimBonus} variant="success" />
        </Card>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  offlineTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  offlineText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  offlineMeta: {
    color: colors.primary,
    fontWeight: "700",
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
  });
}
