import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useGame } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { buildDerivedStats } from "../lib/gameRules";
import { getClassIcon, getClassLabel, normalizeDisplayText } from "../lib/gameUi";
import { Avatar } from "./Avatar";
import { GameIcon } from "./GameIcon";
import { radii, shadows, useThemeColors, useThemeMode } from "./theme";
import { XPBar } from "./XPBar";

type CharacterHeaderProps = {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

type MetricProps = {
  icon: string;
  label: string;
  value: string | number;
  compact?: boolean;
};

function MetricPill({ icon, label, value, compact = false }: MetricProps) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  return (
    <View style={[styles.metricPill, compact ? styles.metricPillCompact : null]}>
      <View style={styles.metricIconWrap}>
        <GameIcon name={icon} size={15} color={colors.primary} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function CharacterHeader({ compact = false, style }: CharacterHeaderProps) {
  const t = useTranslation();
  const { language } = useLocalization();
  const { hero, equipment, profile } = useGame();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const isEn = language === "en";

  const stats = useMemo(
    () => buildDerivedStats(equipment?.class_info, equipment?.equipment_totals, equipment?.reward_effects),
    [equipment],
  );

  const heroName = normalizeDisplayText(hero?.name ?? equipment?.class_info?.display_name ?? t("screens.home.heroName"));
  const heroLevel = hero?.level ?? equipment?.class_info?.level ?? 1;
  const heroClass = hero?.class ?? equipment?.class_info?.class_name;
  const heroStreak = hero?.streak ?? 0;
  const gold = hero?.crystals ?? equipment?.class_info?.crystals ?? 0;
  const xpCurrent = hero?.current_xp ?? equipment?.class_info?.current_xp ?? 0;
  const xpTotal = hero?.next_level_xp ?? 120;
  const goalPercent = profile?.goal?.goal_progress_percent ?? 0;
  const goalPointsLabel = profile?.goal ? `${profile.goal.goal_progress_percent}/100` : isEn ? "No goal" : "Нет цели";
  const setBonusCount = equipment?.set_bonuses?.length ?? 0;
  const goalLabel = profile?.goal?.goal_title
    ? normalizeDisplayText(profile.goal.goal_title)
    : isEn
      ? "No active goal"
      : "Нет активной цели";
  const classLabel = getClassLabel(heroClass, t);

  const metrics = [
    { icon: "shield", label: t("screens.character.stats.armor"), value: stats.armor },
    { icon: "flash", label: t("screens.character.stats.crit"), value: `${stats.crit}%` },
    { icon: "fire", label: isEn ? "Streak" : "Серия", value: heroStreak },
    { icon: "star-four-points", label: isEn ? "Sets" : "Сеты", value: setBonusCount },
  ];

  return (
    <View style={[styles.container, compact ? styles.containerCompact : null, style]}>
      <View style={[styles.topRow, compact ? styles.topRowCompact : null]}>
        <View style={styles.identityBlock}>
          <Avatar icon={getClassIcon(heroClass)} size={compact ? 56 : 72} />
          <View style={styles.identityCopy}>
            <View style={[styles.nameRow, compact ? styles.nameRowCompact : null]}>
              <Text style={styles.heroName} numberOfLines={1}>
                {heroName}
              </Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>
                  {t("common.levelShort")} {heroLevel}
                </Text>
              </View>
            </View>
            <Text style={styles.heroMeta}>
              {classLabel}
              {profile?.goal ? ` • ${goalPercent}%` : ""}
            </Text>
            <View style={[styles.goalBadge, compact ? styles.goalBadgeCompact : null]}>
              <GameIcon name="flag-checkered" size={14} color={colors.primary} />
              <Text style={styles.goalBadgeText} numberOfLines={1}>
                {goalLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.walletPanel, compact ? styles.walletPanelCompact : null]}>
          <Text style={styles.walletLabel}>{isEn ? "Gold" : "Золото"}</Text>
          <View style={styles.walletValueRow}>
            <GameIcon name="cash" size={16} color={colors.gold} />
            <Text style={styles.walletValue}>{gold}</Text>
          </View>
          {!compact ? (
            <Text style={styles.walletSubtext}>
              {isEn ? "Goal progress" : "Прогресс цели"}: {goalPointsLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <XPBar current={xpCurrent} total={xpTotal} label={`${t("screens.home.levelProgress")} • ${heroLevel}`} color={colors.gold} glow={!compact} />

      <View style={[styles.metricRow, compact ? styles.metricRowCompact : null]}>
        {metrics.map((metric) => (
          <MetricPill key={metric.label} icon={metric.icon} label={metric.label} value={metric.value} compact={compact} />
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: themeMode === "light" ? "#fffaf0" : "#171f31",
    padding: 14,
    gap: 12,
    overflow: "hidden",
    ...shadows.card,
  },
  containerCompact: {
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  topRowCompact: {
    flexDirection: "column",
  },
  identityBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  identityCopy: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameRowCompact: {
    flexWrap: "wrap",
  },
  heroName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    flexShrink: 1,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.34)" : "rgba(245,158,11,0.24)",
  },
  levelBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  goalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: themeMode === "light" ? "rgba(239,231,215,0.94)" : "rgba(11,18,32,0.66)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.84)" : "rgba(255,255,255,0.08)",
  },
  goalBadgeCompact: {
    width: "100%",
  },
  goalBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  walletPanel: {
    minWidth: 120,
    alignItems: "flex-end",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: themeMode === "light" ? "rgba(14,165,233,0.12)" : "rgba(56,189,248,0.08)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(14,165,233,0.28)" : "rgba(56,189,248,0.2)",
  },
  walletPanelCompact: {
    width: "100%",
    alignItems: "flex-start",
  },
  walletLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  walletValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  walletSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricRowCompact: {
    gap: 6,
  },
  metricPill: {
    minWidth: 120,
    flexGrow: 1,
    flexBasis: "22%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(11,18,32,0.82)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.84)" : "rgba(255,255,255,0.08)",
  },
  metricPillCompact: {
    minWidth: 96,
    flexBasis: "48%",
    paddingVertical: 8,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  });
}
