import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useTranslation } from "../context/LocalizationContext";
import { getRarityLabel, normalizeDisplayText } from "../lib/gameUi";
import { Button } from "./Button";
import { Card } from "./Card";
import { radii, rarityColors, useThemeColors, useThemeMode } from "./theme";

type Action = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
};

type Props = {
  title: string;
  description: string;
  rarity?: string | null;
  badgeLabel?: string;
  rewardXp: number;
  rewardGold: number;
  progressLabel?: string;
  trackingLabel?: string;
  completed?: boolean;
  primaryAction?: Action;
  secondaryAction?: Action;
  style?: StyleProp<ViewStyle>;
  delay?: number;
};

function cleanQuestTitle(title: string) {
  return normalizeDisplayText(title).replace(/^(AI:\s*|Фокус AI:\s*|Фокус:\s*)/i, "");
}

export function QuestCard({
  title,
  description,
  rarity,
  badgeLabel,
  rewardXp,
  rewardGold,
  progressLabel,
  trackingLabel,
  completed = false,
  primaryAction,
  secondaryAction,
  style,
  delay = 0,
}: Props) {
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(220)}>
      <Card
        style={[
          styles.card,
          { borderLeftWidth: 4, borderLeftColor: rarityColors[rarity ?? "common"] ?? rarityColors.common },
          completed ? styles.completed : null,
          style,
        ]}
        tone={completed ? "subtle" : "default"}
      >
        <View style={styles.header}>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={2}>
              {cleanQuestTitle(title)}
            </Text>

            <View style={styles.metaRow}>
              {badgeLabel ? <Text style={styles.metaChip}>{normalizeDisplayText(badgeLabel)}</Text> : null}
              {trackingLabel ? <Text style={[styles.metaChip, styles.metaChipSecondary]}>{normalizeDisplayText(trackingLabel)}</Text> : null}
              <Text style={styles.rarityText}>{getRarityLabel(rarity, t)}</Text>
            </View>
          </View>

          <View style={styles.rewardPanel}>
            <Text style={styles.rewardXp}>{rewardXp} XP</Text>
            <Text style={styles.rewardGold}>{rewardGold} {t("common.gold")}</Text>
          </View>
        </View>

        {progressLabel ? (
          <Text style={styles.progress} numberOfLines={1}>
            {normalizeDisplayText(progressLabel)}
          </Text>
        ) : null}

        <Text style={styles.description} numberOfLines={2}>
          {normalizeDisplayText(description)}
        </Text>

        <View style={styles.actions}>
          {primaryAction ? (
            <Button
              label={primaryAction.label}
              onPress={primaryAction.onPress}
              variant={primaryAction.variant}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
              style={styles.actionButton}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              variant={secondaryAction.variant}
              disabled={secondaryAction.disabled}
              loading={secondaryAction.loading}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  card: {
    gap: 8,
    paddingVertical: 12,
  },
  completed: {
    opacity: 0.58,
  },
  header: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  metaChip: {
    color: themeMode === "light" ? "#7a4b12" : "#fde68a",
    backgroundColor: themeMode === "light" ? "#f2dfbf" : "#3f2b08",
    borderRadius: radii.sm,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "900",
  },
  metaChipSecondary: {
    color: themeMode === "light" ? "#0c4a6e" : "#bfdbfe",
    backgroundColor: themeMode === "light" ? "#dbeafe" : "#11243a",
  },
  rarityText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
  },
  rewardPanel: {
    minWidth: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.84)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(8,13,23,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "flex-end",
    gap: 1,
  },
  rewardXp: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  rewardGold: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  progress: {
    color: themeMode === "light" ? "#334155" : "#c7d2fe",
    fontSize: 12,
    fontWeight: "700",
  },
  description: {
    color: colors.textMuted,
    lineHeight: 17,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: 118,
  },
  });
}
