import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { type AchievementItem } from "../api/game";
import { Screen } from "../components/Screen";
import { useGame } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { getRarityColor, normalizeDisplayText } from "../lib/gameUi";
import { Card, Modal, radii, useThemeColors, useThemeMode } from "../ui";

function statusLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  status: AchievementItem["status"],
) {
  if (status === "earned") return t("screens.achievements.quick.status.earned");
  if (status === "available") return t("screens.achievements.quick.status.available");
  return t("screens.achievements.quick.status.locked");
}

function themeSurface(theme?: string) {
  if (theme === "sport") return { bg: "#1a2f2b", glow: "rgba(52,211,153,0.24)" };
  if (theme === "books") return { bg: "#25244a", glow: "rgba(129,140,248,0.25)" };
  if (theme === "work") return { bg: "#2b2438", glow: "rgba(168,85,247,0.24)" };
  if (theme === "finance") return { bg: "#312813", glow: "rgba(251,191,36,0.22)" };
  return { bg: "#233247", glow: "rgba(56,189,248,0.25)" };
}

function AchievementVisualTile({
  achievement,
  onPress,
  styles,
  t,
}: {
  achievement: AchievementItem;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  const surface = themeSurface(achievement.theme);
  const borderColor = getRarityColor(achievement.tier ?? achievement.status);

  useEffect(() => {
    if (!achievement.animated_background) {
      pulse.setValue(0.45);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [achievement.animated_background, pulse]);

  return (
    <Pressable onPress={onPress} style={[styles.tile, { borderColor, opacity: achievement.status === "locked" ? 0.62 : 1 }]}>
      <View style={[styles.tileBanner, { backgroundColor: surface.bg }]}>
        <Animated.View style={[styles.tileGlow, { backgroundColor: surface.glow, opacity: pulse }]} />
        <Text style={styles.tileIcon}>{achievement.icon}</Text>
      </View>
      <View style={styles.tileBody}>
        <View style={styles.tileHeader}>
          <Text style={styles.tileTitle} numberOfLines={2}>
            {normalizeDisplayText(achievement.title)}
          </Text>
          <Text style={[styles.tierBadge, { color: borderColor }]}>
            {statusLabel(t, achievement.status)}
          </Text>
        </View>
        <Text style={styles.tileDescription} numberOfLines={2}>
          {normalizeDisplayText(achievement.description)}
        </Text>
        <Text style={styles.rewardText}>
          {t("screens.achievements.quick.rewardLine", {
            xp: achievement.xp_reward,
            gold: achievement.crystal_reward,
          })}
        </Text>
      </View>
    </Pressable>
  );
}

export function AchievementsScreen() {
  const { achievements } = useGame();
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementItem | null>(null);

  const sortedAchievements = useMemo(() => {
    const statusWeight: Record<AchievementItem["status"], number> = {
      earned: 0,
      available: 1,
      locked: 2,
    };
    return [...(achievements ?? [])].sort((left, right) => {
      const statusDelta = statusWeight[left.status] - statusWeight[right.status];
      if (statusDelta !== 0) return statusDelta;
      return (right.xp_reward ?? 0) - (left.xp_reward ?? 0);
    });
  }, [achievements]);

  const earnedCount = sortedAchievements.filter((entry) => entry.status === "earned").length;
  const totalCount = sortedAchievements.length;

  return (
    <Screen title={t("screens.achievements.title")} subtitle={t("screens.achievements.quick.subtitle")}>
      <Card tone="accent">
        <Text style={styles.summaryTitle}>{t("screens.achievements.quick.progressTitle")}</Text>
        <Text style={styles.summaryMeta}>
          {t("screens.achievements.quick.progressMeta", { earned: earnedCount, total: totalCount })}
        </Text>
      </Card>

      <View style={styles.list}>
        {sortedAchievements.map((achievement) => (
          <AchievementVisualTile
            key={achievement.id}
            achievement={achievement}
            onPress={() => setSelectedAchievement(achievement)}
            styles={styles}
            t={t}
          />
        ))}
      </View>

      <Modal
        visible={Boolean(selectedAchievement)}
        title={normalizeDisplayText(selectedAchievement?.title ?? "")}
        subtitle={
          selectedAchievement
            ? t("screens.achievements.quick.modalRewardLine", {
                status: statusLabel(t, selectedAchievement.status),
                xp: selectedAchievement.xp_reward,
                gold: selectedAchievement.crystal_reward,
              })
            : undefined
        }
        description={normalizeDisplayText(selectedAchievement?.description ?? "")}
        onClose={() => setSelectedAchievement(null)}
      >
        {selectedAchievement ? (
          <View style={styles.modalBody}>
            <Text style={styles.modalIcon}>{selectedAchievement.icon}</Text>
            <Text style={styles.modalLine}>
              {t("screens.achievements.quick.themeLine", {
                value: selectedAchievement.theme ?? t("screens.achievements.quick.themeFallback"),
              })}
            </Text>
            <Text style={styles.modalLine}>
              {t("screens.achievements.quick.tierLine", {
                value: selectedAchievement.tier ?? t("screens.achievements.quick.tierFallback"),
              })}
            </Text>
            {selectedAchievement.earned_at ? (
              <Text style={styles.modalLine}>
                {t("screens.achievements.quick.dateLine", { value: selectedAchievement.earned_at })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    summaryTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    summaryMeta: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    list: {
      gap: 9,
    },
    tile: {
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: "hidden",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(8,13,22,0.92)",
    },
    tileBanner: {
      height: 88,
      alignItems: "center",
      justifyContent: "center",
    },
    tileGlow: {
      position: "absolute",
      width: 170,
      height: 170,
      borderRadius: 85,
    },
    tileIcon: {
      fontSize: 42,
    },
    tileBody: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 5,
    },
    tileHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
      alignItems: "flex-start",
    },
    tileTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      flex: 1,
    },
    tierBadge: {
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    tileDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    rewardText: {
      color: themeMode === "light" ? "#7a4b12" : "#fde68a",
      fontSize: 12,
      fontWeight: "800",
    },
    modalBody: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    modalIcon: {
      fontSize: 56,
    },
    modalLine: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
