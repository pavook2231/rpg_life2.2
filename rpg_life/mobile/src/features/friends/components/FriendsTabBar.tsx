import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GameIcon } from "../../../ui";
import { radii, useThemeColors, useThemeMode } from "../../../ui/theme";
import type { FriendsTabKey } from "../types";

type Props = {
  activeTab: FriendsTabKey;
  pendingRequestCount: number;
  onChange: (tab: FriendsTabKey) => void;
};

const tabs: Array<{ key: FriendsTabKey; label: string; icon: string }> = [
  { key: "friends", label: "Друзья", icon: "account-multiple" },
  { key: "requests", label: "Заявки", icon: "email-outline" },
  { key: "discover", label: "Поиск", icon: "account-search-outline" },
];

export function FriendsTabBar({ activeTab, pendingRequestCount, onChange }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const showBadge = tab.key === "requests" && pendingRequestCount > 0;

        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, isActive ? styles.tabActive : null]}
            onPress={() => onChange(tab.key)}
          >
            <View style={styles.tabContent}>
              <GameIcon name={tab.icon} size={18} color={isActive ? colors.primary : colors.textDim} />
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>{tab.label}</Text>
            </View>
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 10,
    },
    tab: {
      flex: 1,
      minHeight: 54,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    tabActive: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "rgba(244,230,204,0.96)" : "rgba(44,33,18,0.76)",
    },
    tabContent: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    tabLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "800",
    },
    tabLabelActive: {
      color: colors.primary,
    },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryDark,
      position: "absolute",
      top: 6,
      right: 6,
    },
    badgeText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
    },
  });
}
