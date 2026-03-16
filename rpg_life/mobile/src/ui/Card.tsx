import React, { ReactNode, useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { radii, shadows, useThemeColors, useThemeMode } from "./theme";

type Tone = "default" | "accent" | "success" | "danger" | "subtle";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
  delay?: number;
  animated?: boolean;
};

export function Card({ children, style, tone = "default", delay = 0, animated = true }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <Animated.View entering={animated ? FadeInUp.delay(delay).duration(280) : undefined}>
      <View style={[styles.base, styles[tone], style]}>{children}</View>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    base: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
      ...shadows.card,
    },
    default: {},
    accent: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "#f4e6cc" : "#2c2112",
    },
    success: {
      borderColor: colors.success,
      backgroundColor: themeMode === "light" ? "#e4f6e9" : "#173126",
    },
    danger: {
      borderColor: colors.danger,
      backgroundColor: themeMode === "light" ? "#fde7e7" : "#351a1d",
    },
    subtle: {
      backgroundColor: colors.cardMuted,
    },
  });
}
