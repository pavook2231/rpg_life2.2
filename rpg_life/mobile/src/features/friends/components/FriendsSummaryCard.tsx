import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { radii, useThemeColors, useThemeMode } from "../../../ui/theme";
import { translateOrFallback } from "../utils";

type Props = {
  t: (key: string, params?: Record<string, string | number>) => string;
  friendsCount: number;
  incomingCount: number;
  outgoingCount: number;
  identityLabel?: string | null;
  onFindFriends: () => void;
  onShareIdentity?: () => void;
};

export function FriendsSummaryCard({
  t,
  friendsCount,
  incomingCount,
  outgoingCount,
  identityLabel,
  onFindFriends,
  onShareIdentity,
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <Card tone="accent">
      <Text style={styles.title}>Круг поддержки</Text>
      <Text style={styles.description}>
        Быстрый доступ к друзьям, заявкам и поиску игроков по username. Все данные обновляются напрямую из API.
      </Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>{translateOrFallback(t, "screens.friends.myFriends", "Мои друзья")}</Text>
          <Text style={styles.metricValue}>{friendsCount}</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>Входящие</Text>
          <Text style={styles.metricValue}>{incomingCount}</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>Исходящие</Text>
          <Text style={styles.metricValue}>{outgoingCount}</Text>
        </View>
      </View>

      {identityLabel ? (
        <View style={styles.identityPanel}>
          <Text style={styles.identityLabel}>Твой код для друзей</Text>
          <Text style={styles.identityValue}>{identityLabel}</Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Button
          label={translateOrFallback(t, "common.findFriends", "Найти друзей")}
          icon="account-plus-outline"
          onPress={onFindFriends}
          style={styles.actionButton}
        />
        {identityLabel && onShareIdentity ? (
          <Button
            label={translateOrFallback(t, "screens.friends.shareIdentityAction", "Поделиться кодом")}
            icon="share-variant-outline"
            onPress={onShareIdentity}
            variant="secondary"
            style={styles.actionButton}
          />
        ) : null}
      </View>
    </Card>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    metricsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metricChip: {
      minWidth: 94,
      flexGrow: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.24)" : "rgba(245,158,11,0.18)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.9)" : "rgba(11,18,32,0.72)",
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
    },
    metricLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    metricValue: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    identityPanel: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    identityLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    identityValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minWidth: 150,
    },
  });
}
