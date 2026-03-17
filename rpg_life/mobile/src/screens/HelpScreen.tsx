import { useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { useTranslation } from "../context/LocalizationContext";
import { Button, Card, GameIcon, radii, useThemeColors, useThemeMode } from "../ui";

type HelpCard = {
  id: string;
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onPress?: () => void;
};

export function HelpScreen() {
  const navigation = useNavigation<any>();
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  const cards: HelpCard[] = [
    {
      id: "offline",
      icon: "cloud-off-outline",
      title: t("screens.help.quick.offlineTitle"),
      description: t("screens.help.tipOffline"),
      actionLabel: t("screens.help.quick.openSettings"),
      onPress: () => navigation.navigate("Settings"),
    },
    {
      id: "sync",
      icon: "sync-circle",
      title: t("screens.help.quick.syncTitle"),
      description: t("screens.help.tipSync"),
      actionLabel: t("screens.help.quick.openSettings"),
      onPress: () => navigation.navigate("Settings"),
    },
    {
      id: "notifications",
      icon: "bell-ring-outline",
      title: t("screens.help.quick.notificationsTitle"),
      description: t("screens.help.tipNotifications"),
      actionLabel: t("screens.help.quick.openSettings"),
      onPress: () => navigation.navigate("Settings"),
    },
    {
      id: "security",
      icon: "shield-lock-outline",
      title: t("screens.help.quick.securityTitle"),
      description: t("screens.help.tipSecurity"),
      actionLabel: t("screens.help.quick.openSettings"),
      onPress: () => navigation.navigate("Settings"),
    },
  ];

  return (
    <Screen title={t("screens.help.title")} subtitle={t("screens.help.subtitle")}>
      <Card tone="accent">
        <Text style={styles.heroTitle}>{t("screens.help.quick.heroTitle")}</Text>
        <Text style={styles.heroDescription}>{t("screens.help.quick.heroDescription")}</Text>
      </Card>

      <View style={styles.list}>
        {cards.map((card, index) => (
          <Card key={card.id}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <GameIcon name={card.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.copy}>
                <View style={styles.headerRow}>
                  <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={styles.title}>{card.title}</Text>
                </View>
                <Text style={styles.text}>{card.description}</Text>
                {card.actionLabel && card.onPress ? (
                  <Button
                    label={card.actionLabel}
                    onPress={card.onPress}
                    variant="secondary"
                    style={styles.action}
                  />
                ) : null}
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    heroTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    heroDescription: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    list: {
      gap: 12,
    },
    row: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.12)" : "rgba(245,158,11,0.12)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.18)" : "rgba(245,158,11,0.16)",
    },
    copy: {
      flex: 1,
      gap: 8,
    },
    headerRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    index: {
      minWidth: 28,
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    text: {
      color: colors.textMuted,
      lineHeight: 21,
    },
    action: {
      alignSelf: "flex-start",
      minWidth: 160,
      borderRadius: radii.md,
    },
  });
}
