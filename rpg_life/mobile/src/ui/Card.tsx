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
      padding: 14,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.62)" : "rgba(255,255,255,0.08)",
      gap: 10,
      ...shadows.card,
    },
    default: {},
    accent: {
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.4)" : "rgba(245,158,11,0.22)",
      backgroundColor: themeMode === "light" ? "rgba(244,230,204,0.92)" : "rgba(44,33,18,0.76)",
    },
    success: {
      borderColor: themeMode === "light" ? "rgba(22,163,74,0.3)" : "rgba(34,197,94,0.22)",
      backgroundColor: themeMode === "light" ? "rgba(228,246,233,0.92)" : "rgba(23,49,38,0.76)",
    },
    danger: {
      borderColor: themeMode === "light" ? "rgba(220,38,38,0.28)" : "rgba(239,68,68,0.22)",
      backgroundColor: themeMode === "light" ? "rgba(253,231,231,0.92)" : "rgba(53,26,29,0.76)",
    },
    subtle: {
      backgroundColor: themeMode === "light" ? "rgba(240,229,211,0.9)" : "rgba(23,34,53,0.68)",
    },
  });
}
