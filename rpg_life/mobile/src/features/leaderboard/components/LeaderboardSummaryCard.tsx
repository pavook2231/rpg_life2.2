import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { LeaderboardEntry, LeaderboardScope } from "../types";
import { formatRankLabel, formatScore, getScopeLabel, translateOrFallback } from "../utils";
import { Card, GameIcon, useThemeColors, useThemeMode } from "../../../ui";

type Props = {
  scope: LeaderboardScope;
  totalPlayers: number;
  meEntry?: LeaderboardEntry | null;
  showCurrentUserPanel: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function LeaderboardSummaryCard({ scope, totalPlayers, meEntry, showCurrentUserPanel, t }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <Card tone="accent" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.kicker}>{getScopeLabel(scope, t)}</Text>
          <Text style={styles.title}>
            {translateOrFallback(t, "screens.leaderboard.title", "Лидерборд")}
          </Text>
        </View>
        <View style={styles.badge}>
          <GameIcon name="trophy-outline" size={18} color={colors.primary} />
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatScore(totalPlayers)}</Text>
          <Text style={styles.metricLabel}>{translateOrFallback(t, "screens.leaderboard.players", "Игроков")}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{meEntry ? formatRankLabel(meEntry.rank) : "—"}</Text>
          <Text style={styles.metricLabel}>{translateOrFallback(t, "screens.leaderboard.myPlace", "Ваше место")}</Text>
        </View>
      </View>

      {showCurrentUserPanel && meEntry ? (
        <View style={styles.mePanel}>
          <Text style={styles.meTitle}>{translateOrFallback(t, "screens.leaderboard.outsideTop", "Ваш результат вне загруженного топа")}</Text>
          <Text style={styles.meMeta}>
            {translateOrFallback(t, "screens.profile.rating", "Рейтинг")}: {formatScore(meEntry.score)}
            {" | "}
            {translateOrFallback(t, "screens.leaderboard.fields.level", "Уровень")}: {meEntry.class_level ?? meEntry.level}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    card: {
      gap: 14,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    titleWrap: {
      gap: 4,
      flex: 1,
    },
    kicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },
    badge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.12)" : "rgba(245,158,11,0.12)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.22)" : "rgba(245,158,11,0.24)",
    },
    metrics: {
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    metric: {
      minWidth: 120,
      flex: 1,
      borderRadius: 16,
      padding: 12,
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.8)" : "rgba(15,23,42,0.26)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.12)" : "rgba(148,163,184,0.16)",
      gap: 4,
    },
    metricValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    mePanel: {
      borderRadius: 16,
      padding: 12,
      backgroundColor: themeMode === "light" ? "rgba(59,130,246,0.08)" : "rgba(37,99,235,0.12)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(37,99,235,0.16)" : "rgba(96,165,250,0.18)",
      gap: 4,
    },
    meTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    meMeta: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
