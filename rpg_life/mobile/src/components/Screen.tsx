import React, { ReactNode, useMemo } from "react";
import { ImageBackground, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../theme/gameTheme";
import { useThemeColors, useThemeMode } from "../ui/theme";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scrollable?: boolean;
  showHeader?: boolean;
};

// Replace `null` with `require("../../assets/backgrounds/app-bg.png")`
// after adding your full-screen background image.
const APP_BACKGROUND_ASSET: number | null = require("../../assets/backgrounds/app-bg.png");

export function Screen({ title, subtitle, children, scrollable = true, showHeader = true }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const contentStyle = [
    styles.content,
    {
      paddingTop: spacing.md + Math.max(insets.top * 0.25, 0),
      paddingBottom: spacing.md + insets.bottom + 72,
    },
  ];

  const content = (
    <>
      {showHeader ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {APP_BACKGROUND_ASSET ? (
        <ImageBackground source={APP_BACKGROUND_ASSET} style={styles.background} imageStyle={styles.backgroundImage}>
          <View style={styles.overlay}>
            {scrollable ? (
              <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="always">
                {content}
              </ScrollView>
            ) : (
              <View style={contentStyle}>{content}</View>
            )}
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.fallbackBackground}>
          <View style={styles.bgOrbTop} />
          <View style={styles.bgOrbBottom} />
          {scrollable ? (
            <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="always">
              {content}
            </ScrollView>
          ) : (
            <View style={contentStyle}>{content}</View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    background: {
      flex: 1,
    },
    backgroundImage: {
      resizeMode: "cover",
    },
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    fallbackBackground: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.md,
      gap: spacing.sm,
      flexGrow: 1,
    },
    header: {
      gap: 4,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: 0.2,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    bgOrbTop: {
      position: "absolute",
      top: -40,
      right: -20,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: themeMode === "light" ? "rgba(201, 173, 123, 0.18)" : "rgba(98, 208, 255, 0.12)",
    },
    bgOrbBottom: {
      position: "absolute",
      bottom: 40,
      left: -50,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: themeMode === "light" ? "rgba(255, 210, 135, 0.18)" : "rgba(248, 201, 92, 0.08)",
    },
  });
}
