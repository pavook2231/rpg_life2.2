import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, GameIcon, radii, useThemeColors, useThemeMode } from "../ui";

type Tone = "info" | "warning" | "empty";

type Props = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: Tone;
};

export function StateBlock({
  icon = "sparkles",
  title,
  description,
  actionLabel,
  onAction,
  tone = "empty",
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const iconColor = tone === "warning" ? styles.iconWarning.color : tone === "info" ? styles.iconInfo.color : styles.iconEmpty.color;

  return (
    <View style={[styles.wrap, tone === "warning" ? styles.wrapWarning : tone === "info" ? styles.wrapInfo : styles.wrapEmpty]}>
      <View style={[styles.iconWrap, tone === "warning" ? styles.iconWrapWarning : tone === "info" ? styles.iconWrapInfo : styles.iconWrapEmpty]}>
        <GameIcon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={tone === "warning" ? "secondary" : "primary"}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    wrap: {
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: 16,
      gap: 12,
      marginBottom: 12,
    },
    wrapInfo: {
      borderColor: themeMode === "light" ? "rgba(59,130,246,0.18)" : "rgba(96,165,250,0.2)",
      backgroundColor: themeMode === "light" ? "rgba(239,246,255,0.78)" : "rgba(10,23,43,0.62)",
    },
    wrapWarning: {
      borderColor: themeMode === "light" ? "rgba(239,68,68,0.2)" : "rgba(248,113,113,0.24)",
      backgroundColor: themeMode === "light" ? "rgba(254,242,242,0.85)" : "rgba(48,18,24,0.64)",
    },
    wrapEmpty: {
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapInfo: {
      backgroundColor: themeMode === "light" ? "rgba(59,130,246,0.12)" : "rgba(96,165,250,0.14)",
    },
    iconWrapWarning: {
      backgroundColor: themeMode === "light" ? "rgba(239,68,68,0.12)" : "rgba(248,113,113,0.16)",
    },
    iconWrapEmpty: {
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.12)" : "rgba(245,158,11,0.12)",
    },
    iconInfo: {
      color: themeMode === "light" ? "#2563eb" : "#93c5fd",
    },
    iconWarning: {
      color: themeMode === "light" ? "#dc2626" : "#fca5a5",
    },
    iconEmpty: {
      color: colors.primary,
    },
    copy: {
      gap: 4,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    action: {
      alignSelf: "flex-start",
      minWidth: 170,
    },
  });
}
