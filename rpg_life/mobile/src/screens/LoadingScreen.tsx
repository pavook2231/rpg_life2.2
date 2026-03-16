import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../context/LocalizationContext";
import { LoadingAnimation } from "../ui/LoadingAnimation";
import { XPBar } from "../ui/XPBar";
import { radii, useThemeColors, useThemeMode } from "../ui/theme";

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  useEffect(() => {
    const ticks = [12, 26, 41, 55, 68, 82, 93, 100];
    let index = 0;
    const timer = setInterval(() => {
      setProgress(ticks[index] ?? 100);
      index += 1;
      if (index >= ticks.length) clearInterval(timer);
    }, 460);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.iconShell}>
        <Text style={styles.iconText}>RPG</Text>
      </View>
      <Text style={styles.title}>RPG Life</Text>
      <Text style={styles.subtitle}>{t("screens.loading.subtitle")}</Text>
      <LoadingAnimation size={132} label={t("common.loadingInterface")} />
      <View style={styles.progressWrap}>
        <XPBar current={progress} total={100} color={colors.gold} glow compact />
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  iconShell: {
    width: 104,
    height: 104,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  progressWrap: {
    width: "78%",
    maxWidth: 280,
    marginTop: 6,
    borderRadius: radii.pill,
  },
  });
}
