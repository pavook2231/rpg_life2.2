import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { colors } from "./theme";
import { XPBar } from "./XPBar";

type Props = {
  label: string;
  value: number;
  max?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatBar({ label, value, max = 100, color = colors.primary, style }: Props) {
  return (
    <View style={style}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <XPBar current={Math.min(value, max)} total={max} color={color} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    color: colors.text,
    fontWeight: "800",
  },
});
