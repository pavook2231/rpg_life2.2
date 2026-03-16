import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useTranslation } from "../context/LocalizationContext";
import { radii, useThemeColors } from "./theme";

type Props = {
  current: number;
  total: number;
  color?: string;
  label?: string;
  compact?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function XPBar({ current, total, color, label, compact = false, glow = false, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const barColor = color ?? colors.xp;
  const t = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useSharedValue(0);
  const safeTotal = Math.max(total, 1);
  const clampedProgress = Math.max(0, Math.min(1, current / safeTotal));

  useEffect(() => {
    if (!trackWidth) return;
    fillWidth.value = withTiming(trackWidth * clampedProgress, { duration: 450 });
  }, [clampedProgress, fillWidth, trackWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={style}>
      {!compact ? (
        <View style={styles.header}>
          <Text style={styles.label}>{label ?? t("common.xp")}</Text>
          <Text style={styles.meta}>
            {current}/{total}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.shell,
          compact ? styles.compactShell : null,
          glow ? styles.glowShell : null,
          { borderColor: glow ? barColor : colors.border, shadowColor: barColor },
        ]}
      >
        <View style={[styles.track, compact ? styles.compactTrack : null]} onLayout={handleTrackLayout}>
          <Animated.View style={[styles.fill, { backgroundColor: barColor }, animatedStyle]} />
          <View pointerEvents="none" style={styles.shine} />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  label: {
    color: colors.text,
    fontWeight: "800",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  shell: {
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  compactShell: {
    borderRadius: radii.pill,
  },
  glowShell: {
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  track: {
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundInset,
    overflow: "hidden",
    position: "relative",
  },
  compactTrack: {
    height: 10,
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  shine: {
    position: "absolute",
    top: 1,
    left: 2,
    right: 2,
    height: "40%",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  });
}
