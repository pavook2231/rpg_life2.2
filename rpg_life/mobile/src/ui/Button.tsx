import React, { useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { triggerHaptic } from "../lib/haptics";
import { GameIcon } from "./GameIcon";
import { radii, shadows, useThemeColors, useThemeMode } from "./theme";

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost" | "gold";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", disabled = false, loading = false, icon, style }: Props) {
  const scale = useSharedValue(1);
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const variantStyles = useMemo(() => createVariantStyles(colors, themeMode), [colors, themeMode]);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={style}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          disabled={isDisabled}
          onPressIn={() => {
            void triggerHaptic("press");
            scale.value = withSpring(0.96, { damping: 14, stiffness: 280 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1.04, { damping: 11, stiffness: 260 }, () => {
              scale.value = withSpring(1, { damping: 15, stiffness: 240 });
            });
          }}
          style={[styles.base, variantStyles[variant], isDisabled ? styles.disabled : null]}
        >
          <View style={[styles.highlight, variant === "gold" ? styles.goldHighlight : styles.defaultHighlight]} />
          <View style={[styles.bottomShade, variant === "gold" ? styles.goldShade : styles.defaultShade]} />
          <View style={styles.content}>
            {loading ? <GameIcon name="loading" size={18} color={colors.text} /> : icon ? <GameIcon name={icon} size={18} color={colors.text} /> : null}
            <Text style={styles.label}>{label}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function createVariantStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    primary: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
    },
    success: {
      backgroundColor: colors.successDark,
      borderColor: colors.success,
    },
    danger: {
      backgroundColor: colors.dangerDark,
      borderColor: colors.danger,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: colors.border,
    },
    gold: {
      backgroundColor: themeMode === "light" ? "#c48a2e" : "#5b3403",
      borderColor: colors.gold,
    },
  });
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    base: {
      minHeight: 48,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: "center",
      overflow: "hidden",
      ...shadows.card,
    },
    highlight: {
      position: "absolute",
      top: 0,
      right: 0,
      left: 0,
      height: "58%",
    },
    defaultHighlight: {
      backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)",
    },
    goldHighlight: {
      backgroundColor: "rgba(255,224,130,0.18)",
    },
    bottomShade: {
      position: "absolute",
      right: 0,
      bottom: 0,
      left: 0,
      height: "46%",
    },
    defaultShade: {
      backgroundColor: themeMode === "light" ? "rgba(71,85,105,0.09)" : "rgba(2,6,23,0.12)",
    },
    goldShade: {
      backgroundColor: themeMode === "light" ? "rgba(124,58,0,0.2)" : "rgba(88,28,0,0.26)",
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      flexWrap: "nowrap",
    },
    disabled: {
      opacity: 0.45,
    },
    label: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 14,
      flexShrink: 1,
      textAlign: "center",
    },
  });
}
