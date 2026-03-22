import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getClassIcon, normalizeDisplayText } from "../../../lib/gameUi";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { radii, useThemeColors, useThemeMode } from "../../../ui/theme";
import type { UserSearchResult } from "../types";
import { formatIdentityLabel, formatLastActive, formatPresenceLabel } from "../utils";

type Props = {
  user: UserSearchResult;
  t: (key: string, params?: Record<string, string | number>) => string;
  sending?: boolean;
  responding?: boolean;
  onAdd: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onInspect?: () => void;
};

const PODIUM_COLORS: Record<number, { border: string; backgroundLight: string; backgroundDark: string }> = {
  1: { border: "#f59e0b", backgroundLight: "rgba(255,244,214,0.98)", backgroundDark: "rgba(84,54,9,0.72)" },
  2: { border: "#94a3b8", backgroundLight: "rgba(245,247,250,0.98)", backgroundDark: "rgba(36,46,62,0.72)" },
  3: { border: "#c97316", backgroundLight: "rgba(252,239,226,0.98)", backgroundDark: "rgba(73,38,17,0.72)" },
};

function formatValue(value?: number | null) {
  return Math.max(0, Math.trunc(Number(value || 0))).toLocaleString();
}

export function FriendSearchResultCard({
  user,
  t,
  sending = false,
  responding = false,
  onAdd,
  onAccept,
  onDecline,
  onInspect,
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const identityLabel = formatIdentityLabel(user.username, user.friend_id);
  const lastActiveLabel = formatLastActive(user.last_active_at);
  const level = user.level ?? 1;
  const surface = user.rank ? PODIUM_COLORS[user.rank] : undefined;
  const ratingValue = formatValue(user.score ?? user.power_rating);
  const rankLabel = user.rank ? `#${user.rank}` : user.rating_rank ? `#${user.rating_rank}` : "—";
  const goalSummary = user.goal_title
    ? `${user.goal_title}${typeof user.goal_progress_percent === "number" ? ` • ${user.goal_progress_percent}%` : ""}`
    : null;

  return (
    <Card
      tone={surface ? "accent" : "default"}
      style={
        surface
          ? {
              borderColor: surface.border,
              backgroundColor: themeMode === "light" ? surface.backgroundLight : surface.backgroundDark,
            }
          : undefined
      }
    >
      <View style={styles.topRow}>
        <View style={styles.identityWrap}>
          <Avatar icon={getClassIcon(user.class_name)} size={54} />
          <View style={styles.copyWrap}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{normalizeDisplayText(user.name) || "Игрок"}</Text>
              {user.rank ? (
                <View style={[styles.rankBadge, surface ? { borderColor: surface.border } : null]}>
                  <Text style={styles.rankBadgeText}>{rankLabel}</Text>
                </View>
              ) : null}
            </View>
            {identityLabel ? <Text style={styles.metaText}>{identityLabel}</Text> : null}
            <Text style={styles.metaText}>
              Ур. {level} • {formatPresenceLabel(user.presence_status, t)}
              {user.presence_status === "offline" && lastActiveLabel ? ` • был ${lastActiveLabel}` : ""}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
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

      {user.status === "none" ? (
        <Button
          label={sending ? "Отправляем..." : "Добавить в друзья"}
          icon="account-plus-outline"
          onPress={onAdd}
          loading={sending}
          disabled={sending}
        />
      ) : null}

      {user.status === "friend" ? (
        <View style={styles.stateBadge}>
          <Text style={styles.stateText}>Уже в друзьях</Text>
        </View>
      ) : null}

      {user.status === "outgoing_pending" ? (
        <View style={styles.stateBadge}>
          <Text style={styles.stateText}>Заявка уже отправлена</Text>
        </View>
      ) : null}

      {user.status === "incoming_pending" ? (
        <View style={styles.actionRow}>
          <Button
            label="Принять"
            icon="check-circle-outline"
            onPress={onAccept ?? (() => undefined)}
            loading={responding}
            disabled={responding || !onAccept}
            style={styles.actionButton}
          />
          <Button
            label="Отклонить"
            icon="close-circle-outline"
            onPress={onDecline ?? (() => undefined)}
            disabled={responding || !onDecline}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>
      ) : null}

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
      alignItems: "center",
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
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    nameText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      flexShrink: 1,
    },
    rankBadge: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.28)",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    rankBadgeText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
    },
    metaText: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
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
    stateBadge: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.26)" : "rgba(245,158,11,0.18)",
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    stateText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minWidth: 140,
    },
  });
}
