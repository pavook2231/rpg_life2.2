import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTranslation } from "../context/LocalizationContext";
import { GameIcon } from "./GameIcon";
import { colors } from "./theme";

type Props = {
  icon: string;
  size?: number;
  label?: string;
  level?: number;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ icon, size = 84, label, level, style }: Props) {
  const t = useTranslation();
  const shellSize = size;
  const coreSize = Math.round(size * 0.72);

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.shell, { width: shellSize, height: shellSize, borderRadius: shellSize / 3 }]}>
        <View style={[styles.core, { width: coreSize, height: coreSize, borderRadius: coreSize / 3 }]}>
          <GameIcon name={icon} size={size * 0.42} color={colors.text} />
        </View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {typeof level === "number" ? <Text style={styles.level}>{t("common.levelShort")} {level}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 8,
  },
  shell: {
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  core: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
  },
  level: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
