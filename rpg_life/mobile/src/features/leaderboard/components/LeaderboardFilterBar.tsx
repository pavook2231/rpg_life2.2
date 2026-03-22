import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LeaderboardScope } from "../types";
import { translateOrFallback } from "../utils";
import { GameIcon, useThemeColors } from "../../../ui";

type Props = {
  scope: LeaderboardScope;
  onChange: (scope: LeaderboardScope) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function LeaderboardFilterBar({ scope, onChange, t }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.chip, scope === "global" ? styles.chipActive : null]}
        onPress={() => onChange("global")}
      >
        <GameIcon name="star-four-points-outline" size={16} color={scope === "global" ? colors.background : colors.primary} />
        <Text style={[styles.chipText, scope === "global" ? styles.chipTextActive : null]}>
          {translateOrFallback(t, "screens.friends.tabs.global", "Глобальный")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.chip, scope === "friends" ? styles.chipActive : null]}
        onPress={() => onChange("friends")}
      >
        <GameIcon name="account-group-outline" size={16} color={scope === "friends" ? colors.background : colors.primary} />
        <Text style={[styles.chipText, scope === "friends" ? styles.chipTextActive : null]}>
          {translateOrFallback(t, "screens.friends.tabs.friends", "Друзья")}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    chip: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    chipTextActive: {
      color: colors.background,
    },
  });
}
