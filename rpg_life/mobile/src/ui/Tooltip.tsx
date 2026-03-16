import React, { useMemo } from "react";
import { Modal as NativeModal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { radii, useThemeColors, useThemeMode } from "./theme";

type Props = {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
};

export function Tooltip({ visible, title, description, onClose }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  return (
    <NativeModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={ZoomIn.duration(180)} style={styles.tooltip}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </Animated.View>
      </Animated.View>
    </NativeModal>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: themeMode === "light" ? "rgba(31,41,55,0.2)" : "rgba(2, 6, 23, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  tooltip: {
    minWidth: 220,
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  description: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  });
}
