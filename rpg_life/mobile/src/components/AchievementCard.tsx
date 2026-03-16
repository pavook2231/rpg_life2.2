import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLocalization } from "../context/LocalizationContext";
import { radii, shadows, useThemeColors, useThemePalette } from "../ui/theme";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "earned" | "available" | "locked";
  xp_reward: number;
  crystal_reward: number;
  earned_at?: string | null;
};

const artById: Record<string, { glyph: string; accent: string; bg: string }> = {
  first_quest: { glyph: "🌟", accent: "#5ee6a6", bg: "#102b24" },
  quest_master_10: { glyph: "⚔️", accent: "#62d0ff", bg: "#13273a" },
  quest_master_25: { glyph: "📝", accent: "#8ac5ff", bg: "#182941" },
  quest_master_50: { glyph: "🏆", accent: "#f8c95c", bg: "#34280f" },
  level_5: { glyph: "📈", accent: "#62d0ff", bg: "#102638" },
  level_10: { glyph: "💪", accent: "#ffb54a", bg: "#35230d" },
  level_20: { glyph: "🧙", accent: "#b993ff", bg: "#241536" },
  streak_7: { glyph: "🗓️", accent: "#62d0ff", bg: "#12273b" },
  streak_30: { glyph: "🔥", accent: "#ff8a8a", bg: "#341616" },
  crystals_100: { glyph: "💰", accent: "#f8c95c", bg: "#31260d" },
  gold_250: { glyph: "🪙", accent: "#f8c95c", bg: "#37280d" },
  custom_creator_5: { glyph: "🛠️", accent: "#62d0ff", bg: "#13273a" },
  boss_slayer_3: { glyph: "🐉", accent: "#ff8a8a", bg: "#361919" },
  master_warrior: { glyph: "🛡️", accent: "#ffb54a", bg: "#36220f" },
  master_archer: { glyph: "🏹", accent: "#62d0ff", bg: "#13273a" },
  master_mage: { glyph: "🔮", accent: "#b993ff", bg: "#23163a" },
  immortal_hunter: { glyph: "🗡️", accent: "#ff8a8a", bg: "#341616" },
};

function getStatusCopy(
  status: Achievement["status"],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (status === "earned") return t("screens.profile.achievementStatus.earned");
  if (status === "available") return t("screens.profile.achievementStatus.available");
  return t("screens.profile.achievementStatus.locked");
}

function formatEarnedAt(value: string | null | undefined, language: "ru" | "en") {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { language, t } = useLocalization();
  const colors = useThemeColors();
  const palette = useThemePalette();
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);
  const art = artById[achievement.id] ?? { glyph: achievement.icon, accent: "#62d0ff", bg: "#13273a" };
  const borderColor =
    achievement.status === "earned" ? palette.success : achievement.status === "available" ? palette.gold : palette.stroke;
  const stripeColor =
    achievement.status === "earned" ? palette.success : achievement.status === "available" ? palette.gold : palette.textDim;
  const earnedAt = formatEarnedAt(achievement.earned_at, language);

  return (
    <View style={[styles.card, { borderColor, opacity: achievement.status === "locked" ? 0.58 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      <View style={[styles.hero, { backgroundColor: art.bg }]}>
        <Text style={[styles.heroGlyphBack, { color: art.accent }]}>{art.glyph}</Text>
        <View style={[styles.heroBadge, { borderColor: art.accent }]}>
          <Text style={styles.heroBadgeText}>{achievement.icon}</Text>
        </View>
      </View>

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: achievement.status === "locked" ? palette.common : borderColor }]}>{achievement.title}</Text>
          <Text style={styles.status}>{getStatusCopy(achievement.status, t)}</Text>
        </View>
      </View>

      <Text style={styles.description}>{achievement.description}</Text>

      {(achievement.xp_reward > 0 || achievement.crystal_reward > 0) && (
        <View style={styles.rewards}>
          {achievement.xp_reward > 0 ? <Text style={styles.rewardXp}>+{achievement.xp_reward} XP</Text> : null}
          {achievement.crystal_reward > 0 ? <Text style={styles.rewardGold}>+{achievement.crystal_reward} {t("common.gold")}</Text> : null}
        </View>
      )}

      {earnedAt ? <Text style={styles.date}>{earnedAt}</Text> : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, palette: ReturnType<typeof useThemePalette>) {
  return StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: 16,
    gap: 12,
    overflow: "hidden",
    ...shadows.card,
  },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  hero: {
    height: 108,
    borderRadius: radii.md,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroGlyphBack: {
    position: "absolute",
    right: 8,
    top: -8,
    fontSize: 76,
    opacity: 0.22,
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeText: {
    fontSize: 34,
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  status: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  description: {
    color: palette.textMuted,
    lineHeight: 20,
  },
  rewards: {
    flexDirection: "row",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: palette.strokeSoft,
    paddingTop: 10,
  },
  rewardXp: {
    color: palette.primary,
    fontWeight: "800",
  },
  rewardGold: {
    color: palette.gold,
    fontWeight: "800",
  },
  date: {
    textAlign: "right",
    color: palette.textDim,
    fontSize: 12,
    fontStyle: "italic",
  },
  });
}
