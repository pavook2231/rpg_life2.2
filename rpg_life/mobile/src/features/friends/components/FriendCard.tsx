import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getClassIcon, normalizeDisplayText } from "../../../lib/gameUi";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { radii, useThemeColors, useThemeMode } from "../../../ui/theme";
import type { FriendItem } from "../types";
import { formatIdentityLabel, formatLastActive, formatPresenceLabel, translateOrFallback } from "../utils";

type Props = {
  friend: FriendItem;
  t: (key: string, params?: Record<string, string | number>) => string;
  onInspect?: () => void;
};

function formatValue(value?: number | null) {
  return Math.max(0, Math.trunc(Number(value || 0))).toLocaleString();
}

export function FriendCard({ friend, t, onInspect }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const identityLabel = formatIdentityLabel(friend.username, friend.friend_id);
  const lastActiveLabel = formatLastActive(friend.last_active_at);
  const sinceLabel = friend.friends_since ? new Date(friend.friends_since).toLocaleDateString() : null;
  const presenceLabel = formatPresenceLabel(friend.presence_status, t);
  const level = friend.level ?? friend.stats?.level ?? 1;
  const ratingValue = formatValue(friend.power_rating);
  const rankLabel = friend.rating_rank ? `#${friend.rating_rank}` : "—";
  const goalSummary = friend.goal_title
    ? `${friend.goal_title}${typeof friend.goal_progress_percent === "number" ? ` • ${friend.goal_progress_percent}%` : ""}`
    : null;

  return (
    <Card>
      <View style={styles.topRow}>
        <View style={styles.identityWrap}>
          <Avatar icon={getClassIcon(friend.class_name)} size={56} />
          <View style={styles.copyWrap}>
            <Text style={styles.nameText}>{normalizeDisplayText(friend.name) || "Игрок"}</Text>
            {identityLabel ? <Text style={styles.metaText}>{identityLabel}</Text> : null}
          </View>
        </View>

        <View
          style={[
            styles.presenceBadge,
            friend.presence_status === "online" ? styles.presenceBadgeOnline : styles.presenceBadgeOffline,
          ]}
        >
          <Text
            style={[
              styles.presenceText,
              friend.presence_status === "online" ? styles.presenceTextOnline : styles.presenceTextOffline,
            ]}
          >
            {presenceLabel}
          </Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>{translateOrFallback(t, "screens.leaderboard.metrics.level", "Уровень")}</Text>
          <Text style={styles.statValue}>{level}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Рейтинг</Text>
          <Text style={styles.statValue}>{ratingValue}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Место</Text>
          <Text style={styles.statValue}>{rankLabel}</Text>
        </View>
      </View>

      {goalSummary ? (
        <View style={styles.goalPanel}>
          <Text style={styles.goalLabel}>Цель</Text>
          <Text style={styles.goalValue}>{goalSummary}</Text>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        {sinceLabel ? <Text style={styles.footerText}>Друзья с {sinceLabel}</Text> : null}
        {friend.presence_status === "offline" && lastActiveLabel ? (
          <Text style={styles.footerText}>Был: {lastActiveLabel}</Text>
        ) : null}
      </View>

      {onInspect ? (
        <Button
          label="Осмотреть аккаунт"
          icon="account-search-outline"
          onPress={onInspect}
          variant="secondary"
        />
      ) : null}
    </Card>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    identityWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    copyWrap: {
      flex: 1,
      gap: 4,
    },
    nameText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    metaText: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
    },
    presenceBadge: {
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
    },
    presenceBadgeOnline: {
      borderColor: themeMode === "light" ? "rgba(22,163,74,0.28)" : "rgba(34,197,94,0.24)",
      backgroundColor: themeMode === "light" ? "rgba(220,252,231,0.96)" : "rgba(20,83,45,0.4)",
    },
    presenceBadgeOffline: {
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
    },
    presenceText: {
      fontSize: 12,
      fontWeight: "800",
    },
    presenceTextOnline: {
      color: themeMode === "light" ? "#166534" : "#86efac",
    },
    presenceTextOffline: {
      color: colors.textDim,
    },
    statRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statChip: {
      minWidth: 88,
      flexGrow: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
    },
    statLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    statValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    goalPanel: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    goalLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    goalValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    footerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    footerText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
  });
}
