import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getClassIcon, getClassLabel, normalizeDisplayText } from "../../../lib/gameUi";
import { Avatar, Card, useThemeColors, useThemeMode } from "../../../ui";
import type { LeaderboardEntry } from "../types";
import { formatIdentityLabel, formatRankLabel, formatScore, translateOrFallback } from "../utils";

type Props = {
  items: LeaderboardEntry[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelect?: (item: LeaderboardEntry) => void;
};

const PODIUM_COLORS = [
  { border: "#f59e0b", backgroundDark: "rgba(84,54,9,0.72)", backgroundLight: "rgba(255,244,214,0.96)" },
  { border: "#94a3b8", backgroundDark: "rgba(36,46,62,0.72)", backgroundLight: "rgba(245,247,250,0.96)" },
  { border: "#c97316", backgroundDark: "rgba(73,38,17,0.72)", backgroundLight: "rgba(252,239,226,0.96)" },
];

export function LeaderboardPodium({ items, t, onSelect }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const topItems = items.slice(0, 3);

  if (topItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.grid}>
      {topItems.map((item, index) => {
        const surface = PODIUM_COLORS[index] ?? PODIUM_COLORS[2];
        const card = (
          <Card
            key={item.user_id}
            style={[
              styles.card,
              {
                borderColor: surface.border,
                backgroundColor: themeMode === "light" ? surface.backgroundLight : surface.backgroundDark,
              },
            ]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{formatRankLabel(item.rank)}</Text>
            </View>
            <Avatar icon={getClassIcon(item.class_name)} size={56} />
            <Text style={styles.name} numberOfLines={1}>
              {normalizeDisplayText(item.name)}
            </Text>
            {formatIdentityLabel(item.username, item.friend_id) ? (
              <Text style={styles.identity} numberOfLines={1}>
                {formatIdentityLabel(item.username, item.friend_id)}
              </Text>
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {getClassLabel(item.class_name, t)} | {translateOrFallback(t, "screens.leaderboard.fields.level", "Уровень")} {item.class_level ?? item.level}
            </Text>
            {item.goal_title ? (
              <Text style={styles.goal} numberOfLines={2}>
                {item.goal_title}
                {typeof item.goal_progress_percent === "number" ? ` • ${item.goal_progress_percent}%` : ""}
              </Text>
            ) : null}
            <Text style={styles.score}>
              {translateOrFallback(t, "screens.profile.rating", "Рейтинг")}: {formatScore(item.score)}
            </Text>
            {item.is_current_user ? <Text style={styles.currentUser}>Вы</Text> : null}
            {onSelect ? <Text style={styles.inspectHint}>Осмотреть</Text> : null}
          </Card>
        );

        if (!onSelect) {
          return card;
        }

        return (
          <Pressable key={item.user_id} style={styles.pressable} onPress={() => onSelect(item)}>
            {card}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    pressable: {
      flexGrow: 1,
      flexBasis: 150,
    },
    card: {
      flexGrow: 1,
      flexBasis: 150,
      alignItems: "center",
      gap: 8,
      paddingTop: 18,
      minHeight: 248,
    },
    rankBadge: {
      position: "absolute",
      top: 10,
      right: 10,
      borderRadius: 999,
      backgroundColor: "rgba(15,23,42,0.16)",
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    rankBadgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      textAlign: "center",
    },
    identity: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
    },
    meta: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
    },
    goal: {
      color: colors.textDim,
      fontSize: 12,
      textAlign: "center",
      fontWeight: "700",
    },
    score: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
    },
    currentUser: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    inspectHint: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
  });
}
