import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { triggerHaptic } from "../lib/haptics";
import { GameIcon } from "./GameIcon";
import { colors, radii, shadows } from "./theme";

type Props = {
  label: string;
  value: string | number;
  icon?: string;
  accent?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  compact?: boolean;
};

function getStatIconSize() {
  return 34;
}

export function StatCard({ label, value, icon, accent = colors.primary, onPress, style, delay = 0, compact = false }: Props) {
  function handlePress() {
    if (!onPress) return;
    void triggerHaptic("press");
    onPress();
  }

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(240)} style={style}>
      <Pressable style={[styles.card, compact ? styles.cardCompact : null, { borderColor: accent }]} onPress={handlePress} disabled={!onPress}>
        {icon ? (
          <View style={[styles.iconBox, compact ? styles.iconBoxCompact : null, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
            <GameIcon name={icon} size={compact ? 24 : getStatIconSize()} color={accent} />
          </View>
        ) : null}
        <Text style={[styles.label, compact ? styles.labelCompact : null]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.value, compact ? styles.valueCompact : null, { color: accent }]} numberOfLines={compact ? 1 : 3}>{value}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    backgroundColor: colors.cardMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    ...shadows.card,
  },
  cardCompact: {
    minHeight: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.backgroundInset,
    borderWidth: 1,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconBoxCompact: {
    width: 30,
    height: 30,
    borderRadius: 9,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  labelCompact: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  valueCompact: {
    fontSize: 15,
    textAlign: "right",
    minWidth: 36,
  },
});
