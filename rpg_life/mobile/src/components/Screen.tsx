import { useScrollToTop } from "@react-navigation/native";
import React, { ReactNode, useMemo, useRef } from "react";
import { ImageBackground, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../theme/gameTheme";
import { radii, useThemeColors, useThemeMode } from "../ui/theme";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scrollable?: boolean;
  showHeader?: boolean;
  contentTopOffset?: number;
  contentBottomInset?: number;
};

// Replace `null` with `require("../../assets/backgrounds/app-bg.png")`
// after adding your full-screen background image.
const APP_BACKGROUND_ASSET: number | null = require("../../assets/backgrounds/app-bg.png");

export function Screen({
  title,
  subtitle,
  children,
  scrollable = true,
  showHeader = true,
  contentTopOffset = 0,
  contentBottomInset = 92,
}: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollToTopRef = useRef({
    scrollToTop: () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
  });
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  useScrollToTop(scrollToTopRef);
  const contentStyle = [
    styles.content,
    {
      paddingTop: spacing.sm,
      paddingBottom: insets.bottom + spacing.xl + contentBottomInset,
    },
  ];
  const bodyStyle = [styles.body, { marginTop: contentTopOffset }, !scrollable ? styles.bodyStatic : null];
  const staticContentStyle = [...contentStyle, styles.contentStatic];

  const content = (
    <>
      {showHeader ? (
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={styles.kicker}>RPG LIFE</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={bodyStyle}>{children}</View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {APP_BACKGROUND_ASSET ? (
        <ImageBackground source={APP_BACKGROUND_ASSET} style={styles.background} imageStyle={styles.backgroundImage}>
          <View style={styles.overlay}>
            {scrollable ? (
              <ScrollView ref={scrollRef} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="always">
                {content}
              </ScrollView>
            ) : (
              <View style={staticContentStyle}>{content}</View>
            )}
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.fallbackBackground}>
          <View style={styles.bgOrbTop} />
          <View style={styles.bgOrbBottom} />
          {scrollable ? (
            <ScrollView ref={scrollRef} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="always">
              {content}
            </ScrollView>
          ) : (
            <View style={staticContentStyle}>{content}</View>
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
      paddingHorizontal: spacing.md,
      flexGrow: 1,
    },
    contentStatic: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      gap: 8,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(255,255,255,0.06)",
    },
    kickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    kickerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    kicker: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    body: {
      gap: 14,
    },
    bodyStatic: {
      flex: 1,
      minHeight: 0,
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 0.3,
      lineHeight: 34,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      maxWidth: 560,
    },
    bgOrbTop: {
      position: "absolute",
      top: -30,
      right: -30,
      width: 220,
      height: 220,
      borderRadius: radii.xl,
      backgroundColor: themeMode === "light" ? "rgba(201,173,123,0.14)" : "rgba(245,158,11,0.09)",
    },
    bgOrbBottom: {
      position: "absolute",
      bottom: 80,
      left: -40,
      width: 240,
      height: 240,
      borderRadius: radii.xl,
      backgroundColor: themeMode === "light" ? "rgba(255,210,135,0.14)" : "rgba(56,189,248,0.08)",
    },
  });
}
