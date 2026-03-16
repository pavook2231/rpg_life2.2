import React, { useMemo } from "react";
import { Modal as NativeModal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTranslation } from "../context/LocalizationContext";
import { Button } from "./Button";
import { GameIcon } from "./GameIcon";
import { radii, shadows, useThemeColors, useThemeMode } from "./theme";

type DialogTone = "info" | "success" | "reward" | "warning";
type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost" | "gold";
  icon?: string;
};

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  icon?: string;
  tone?: DialogTone;
  actions?: DialogAction[];
  onClose: () => void;
};

const toneConfig: Record<DialogTone, { backgroundColor: string; borderColor: string; accentColor: string; glowColor: string; defaultIcon: string }> = {
  info: {
    backgroundColor: "#13365b",
    borderColor: "#60a5fa",
    accentColor: "#dbeafe",
    glowColor: "rgba(96,165,250,0.34)",
    defaultIcon: "information-outline",
  },
  success: {
    backgroundColor: "#14532d",
    borderColor: "#4ade80",
    accentColor: "#dcfce7",
    glowColor: "rgba(74,222,128,0.34)",
    defaultIcon: "check-decagram",
  },
  reward: {
    backgroundColor: "#5b3403",
    borderColor: "#fbbf24",
    accentColor: "#fef3c7",
    glowColor: "rgba(251,191,36,0.34)",
    defaultIcon: "treasure-chest",
  },
  warning: {
    backgroundColor: "#7f1d1d",
    borderColor: "#f87171",
    accentColor: "#fee2e2",
    glowColor: "rgba(248,113,113,0.3)",
    defaultIcon: "alert-circle",
  },
};

export function GameDialog({
  visible,
  title,
  description,
  icon,
  tone = "info",
  actions = [],
  onClose,
}: Props) {
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const config = toneConfig[tone];

  return (
    <NativeModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[
            styles.card,
            {
              backgroundColor: config.backgroundColor,
              borderColor: config.borderColor,
              shadowColor: config.borderColor,
            },
          ]}
        >
          <View style={[styles.innerFrame, { borderColor: `${config.accentColor}26` }]} />
          <View style={[styles.glow, { backgroundColor: config.glowColor }]} />

          <Pressable style={styles.closeButton} onPress={onClose}>
            <GameIcon name="close" size={18} color={colors.text} />
          </Pressable>

          <View style={[styles.iconFrame, { borderColor: config.borderColor, backgroundColor: `${config.accentColor}12` }]}>
            <View style={[styles.iconHalo, { backgroundColor: config.glowColor }]} />
            <GameIcon name={icon ?? config.defaultIcon} size={42} color={config.accentColor} />
          </View>

          <View style={styles.copy}>
            <Text style={[styles.title, { color: config.accentColor }]}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>

          <View style={styles.actions}>
            {actions.length ? (
              actions.map((action) => (
                <Button
                  key={`${action.label}-${action.icon ?? "iconless"}`}
                  label={action.label}
                  onPress={action.onPress}
                  icon={action.icon}
                  variant={action.variant ?? "primary"}
                  style={styles.actionButton}
                />
              ))
            ) : (
              <Button label={t("common.close")} onPress={onClose} variant="secondary" icon="close" style={styles.actionButton} />
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </NativeModal>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    maxWidth: 404,
    borderRadius: radii.xl,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 16,
    ...shadows.card,
  },
  innerFrame: {
    position: "absolute",
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  glow: {
    position: "absolute",
    top: -30,
    right: -8,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(241,245,249,0.92)" : "rgba(15,23,42,0.34)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(148,163,184,0.4)" : "rgba(255,255,255,0.12)",
    zIndex: 2,
  },
  iconFrame: {
    alignSelf: "center",
    width: 92,
    height: 92,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconHalo: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    opacity: 0.88,
  },
  copy: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    color: colors.text,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 15,
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    width: "100%",
  },
  });
}
