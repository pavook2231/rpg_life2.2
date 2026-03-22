import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getClassIcon, getClassLabel, normalizeDisplayText } from "../../../lib/gameUi";
import { Avatar, Card, useThemeColors, useThemeMode } from "../../../ui";
import type { LeaderboardEntry } from "../types";
import { formatIdentityLabel, formatRankLabel, formatScore, translateOrFallback } from "../utils";

type Props = {
  entry: LeaderboardEntry;
  t: (key: string, params?: Record<string, string | number>) => string;
  isCurrentUser?: boolean;
  onPress?: () => void;
};

export function LeaderboardRowCard({ entry, t, isCurrentUser = false, onPress }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const identityLabel = formatIdentityLabel(entry.username, entry.friend_id);
  const content = (
    <Card style={[styles.card, isCurrentUser ? styles.cardCurrent : null]} tone={isCurrentUser ? "accent" : "default"}>
      <View style={styles.row}>
        <View style={[styles.rankPill, isCurrentUser ? styles.rankPillCurrent : null]}>
          <Text style={[styles.rankText, isCurrentUser ? styles.rankTextCurrent : null]}>{formatRankLabel(entry.rank)}</Text>
        </View>

        <Avatar icon={getClassIcon(entry.class_name)} size={48} />

        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {normalizeDisplayText(entry.name)}
            </Text>
            {isCurrentUser ? <Text style={styles.youLabel}>Вы</Text> : null}
          </View>
          {identityLabel ? (
            <Text style={styles.identity} numberOfLines={1}>
              {identityLabel}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {getClassLabel(entry.class_name, t)} | {translateOrFallback(t, "screens.leaderboard.fields.level", "Уровень")} {entry.class_level ?? entry.level}
          </Text>
          {entry.goal_title ? (
            <Text style={styles.goal} numberOfLines={1}>
              {entry.goal_title}
              {typeof entry.goal_progress_percent === "number" ? ` • ${entry.goal_progress_percent}%` : ""}
            </Text>
          ) : null}
        </View>

        <View style={styles.scoreWrap}>
          <Text style={styles.scoreValue}>{formatScore(entry.score)}</Text>
          <Text style={styles.scoreLabel}>{translateOrFallback(t, "screens.profile.rating", "Рейтинг")}</Text>
          {onPress ? <Text style={styles.inspectHint}>Осмотреть</Text> : null}
        </View>
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    card: {
      paddingVertical: 12,
    },
    cardCurrent: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "rgba(255,248,235,0.96)" : "rgba(58,44,19,0.72)",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rankPill: {
      minWidth: 54,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: themeMode === "light" ? "rgba(15,23,42,0.06)" : "rgba(148,163,184,0.1)",
    },
    rankPillCurrent: {
      backgroundColor: colors.primary,
    },
    rankText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    rankTextCurrent: {
      color: colors.background,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      flexShrink: 1,
    },
    youLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    identity: {
      color: colors.textMuted,
      fontSize: 12,
    },
    meta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    goal: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "700",
    },
    scoreWrap: {
      alignItems: "flex-end",
      minWidth: 84,
      gap: 2,
    },
    scoreValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    scoreLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    inspectHint: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
    },
  });
}
