import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../context/LocalizationContext";
import { getClassIcon, getClassLabel } from "../lib/gameUi";
import { Avatar } from "../ui/Avatar";
import { Card } from "../ui/Card";
import { XPBar } from "../ui/XPBar";
import { radii, useThemeColors } from "../ui/theme";

type Props = {
  name: string;
  heroClass: string;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  crystals?: number;
  streak?: number;
};

export function HeroCard({ name, heroClass, level, currentXp, nextLevelXp, crystals = 0, streak = 0 }: Props) {
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Card tone="accent" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Avatar icon={getClassIcon(heroClass)} size={74} />
          <View style={styles.copy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>{getClassLabel(heroClass, t)}</Text>
          </View>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{t("common.levelShort")} {level}</Text>
        </View>
      </View>

      <XPBar current={currentXp} total={nextLevelXp} label={t("screens.character.characterExperience")} color={colors.gold} glow />

      <View style={styles.footer}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{t("screens.profile.gold")}</Text>
          <Text style={styles.badgeValue}>{crystals}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{t("screens.profile.streak")}</Text>
          <Text style={styles.badgeValue}>{streak} {t("screens.profile.days")}</Text>
        </View>
      </View>
    </Card>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  card: {
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  meta: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  levelText: {
    color: colors.background,
    fontWeight: "900",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
  },
  badge: {
    flex: 1,
    backgroundColor: colors.backgroundInset,
    borderRadius: radii.md,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  badgeValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  });
}
