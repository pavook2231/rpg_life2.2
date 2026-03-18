import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTranslation } from "../context/LocalizationContext";
import { getClassIcon, getClassLabel, normalizeDisplayText } from "../lib/gameUi";
import { Avatar } from "./Avatar";
import { GameIcon } from "./GameIcon";
import { XPBar } from "./XPBar";
import { radii, shadows, useThemeColors, useThemeMode } from "./theme";

type Props = {
  name: string;
  heroClass?: string | null;
  level?: number;
  currentXp?: number;
  nextLevelXp?: number;
  gold?: number;
  streak?: number;
  subtitle?: string;
  healthCurrent?: number | null;
  healthMax?: number | null;
  isWounded?: boolean;
  penaltyQuestsRemaining?: number;
  rewardPenaltyPercent?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProfileHeroCard({
  name,
  heroClass,
  level = 1,
  currentXp = 0,
  nextLevelXp = 100,
  gold = 0,
  streak = 0,
  subtitle,
  healthCurrent,
  healthMax,
  isWounded = false,
  penaltyQuestsRemaining = 0,
  rewardPenaltyPercent = 0,
  style,
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const t = useTranslation();
  const safeName = normalizeDisplayText(name || t("screens.home.heroName"));
  const classLabel = getClassLabel(heroClass ?? "warrior", t);
  const hasHealth = typeof healthCurrent === "number" && typeof healthMax === "number" && healthMax > 0;
  const safeHealthCurrent = hasHealth ? Math.max(0, Math.round(healthCurrent ?? 0)) : 0;
  const safeHealthMax = hasHealth ? Math.max(1, Math.round(healthMax ?? 1)) : 1;
  const healthPercent = hasHealth ? Math.max(0, Math.min(100, Math.round((safeHealthCurrent * 100) / safeHealthMax))) : 100;
  const healthColor = colors.hp;
  const penaltyPercent = Math.max(0, Math.round(rewardPenaltyPercent));
  const healthStateLabel = isWounded ? "Ранен" : healthPercent <= 35 ? "Опасно" : healthPercent <= 70 ? "Нестабильно" : "Стабильно";

  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.identityWrap}>
          <Avatar icon={getClassIcon(heroClass ?? "warrior")} size={99} />
          <View style={styles.copyWrap}>
            <Text style={styles.nameText}>{safeName}</Text>
            <Text style={styles.metaText}>{subtitle || classLabel}</Text>
          </View>
        </View>

        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeLabel}>{t("screens.profile.level")}</Text>
          <Text style={styles.levelBadgeValue}>{level}</Text>
        </View>
      </View>

      <XPBar current={currentXp} total={nextLevelXp} color={colors.gold} glow label={t("screens.profile.heroProgress")} />

      {hasHealth ? (
        <View style={styles.healthPanel}>
          <View style={styles.healthHeader}>
            <View style={styles.healthTitleWrap}>
              <View style={[styles.healthIconWrap, { backgroundColor: `${healthColor}22` }]}>
                <GameIcon name="heart-plus" size={16} color={healthColor} />
              </View>
              <View style={styles.healthCopy}>
                <Text style={styles.healthLabel}>HP</Text>
                <Text style={styles.healthMeta}>{healthStateLabel}</Text>
              </View>
            </View>

            <Text style={[styles.healthValue, { color: healthColor }]}>
              {safeHealthCurrent}/{safeHealthMax}
            </Text>
          </View>

          <XPBar current={safeHealthCurrent} total={safeHealthMax} color={healthColor} compact />

          {isWounded ? (
            <View style={styles.warningRow}>
              <GameIcon name="alert-circle" size={15} color={colors.primary} />
              <Text style={styles.warningText}>
                -{penaltyPercent}% к наградам, пока герой не восстановится. Осталось квестов: {penaltyQuestsRemaining}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <View style={styles.metricIconWrap}>
            <GameIcon name="cash" size={16} color={colors.gold} />
          </View>
          <View style={styles.metricCopy}>
            <Text style={styles.metricLabel}>{t("screens.profile.gold")}</Text>
            <Text style={styles.metricValue}>{gold}</Text>
          </View>
        </View>

        <View style={styles.metricChip}>
          <View style={styles.metricIconWrap}>
            <GameIcon name="fire" size={16} color={colors.primary} />
          </View>
          <View style={styles.metricCopy}>
            <Text style={styles.metricLabel}>{t("screens.profile.streak")}</Text>
            <Text style={styles.metricValue}>{streak}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.34)" : "rgba(245,158,11,0.28)",
    backgroundColor: themeMode === "light" ? "rgba(255, 250, 240, 0.94)" : "rgba(15, 20, 34, 0.86)",
    padding: 14,
    gap: 12,
    ...shadows.card,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  identityWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  copyWrap: {
    flex: 1,
    gap: 4,
  },
  nameText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25,
    flexShrink: 1,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  levelBadge: {
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.34)" : "rgba(245,158,11,0.3)",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.14)",
    gap: 2,
  },
  levelBadgeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  levelBadgeValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  healthPanel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
    backgroundColor: themeMode === "light" ? "rgba(253,231,231,0.92)" : "rgba(38,10,16,0.72)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  healthTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  healthIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  healthCopy: {
    flex: 1,
    minWidth: 0,
  },
  healthLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  healthMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  healthValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.md,
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.28)" : "rgba(245,158,11,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warningText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricChip: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.8)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(9,14,25,0.72)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  });
}
