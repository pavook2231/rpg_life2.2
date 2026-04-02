import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { LoginScreen } from "../features/auth/LoginScreen";
import { RegisterScreen } from "../features/auth/RegisterScreen";
import { HomeScreen } from "../features/dashboard/HomeScreen";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { ProgressScreen } from "../features/progress/ProgressScreen";
import { QuestsScreen } from "../features/quests/QuestsScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { useSession } from "../lib/session-context";
import { ThemeProvider, useAppTheme } from "../theme/theme-context";

type AuthMode = "register" | "login";
type MainTab = "home" | "quests" | "progress" | "profile" | "settings";

const tabs: { key: MainTab; label: string }[] = [
  { key: "home", label: "Главная" },
  { key: "quests", label: "Квесты" },
  { key: "progress", label: "Прогресс" },
  { key: "profile", label: "Профиль" },
  { key: "settings", label: "Настройки" }
];

export function RootApp() {
  const { session } = useSession();

  return (
    <ThemeProvider preference={session?.preferences.theme ?? "system"}>
      <RootContent />
    </ThemeProvider>
  );
}

function RootContent() {
  const { session } = useSession();
  const { themeName } = useAppTheme();
  const [authMode, setAuthMode] = useState<AuthMode>("register");

  if (!session) {
    return (
      <>
        <StatusBar style={themeName === "dark" ? "light" : "dark"} />
        {authMode === "register" ? (
          <RegisterScreen onSwitchToLogin={() => setAuthMode("login")} />
        ) : (
          <LoginScreen onSwitchToRegister={() => setAuthMode("register")} />
        )}
      </>
    );
  }

  return <AuthenticatedShell />;
}

function AuthenticatedShell() {
  const { colors, spacing, radius, themeName } = useAppTheme();
  const styles = createStyles(colors, spacing, radius);
  const [activeTab, setActiveTab] = useState<MainTab>("home");

  const currentScreen = useMemo(() => {
    switch (activeTab) {
      case "quests":
        return <QuestsScreen />;
      case "progress":
        return <ProgressScreen />;
      case "profile":
        return <ProfileScreen />;
      case "settings":
        return <SettingsScreen />;
      case "home":
      default:
        return <HomeScreen />;
    }
  }, [activeTab]);

  return (
    <View style={styles.app}>
      <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      <View style={styles.content}>{currentScreen}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  spacing: ReturnType<typeof useAppTheme>["spacing"],
  radius: ReturnType<typeof useAppTheme>["radius"]
) =>
  StyleSheet.create({
    app: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      flex: 1
    },
    tabBar: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface
    },
    tabButton: {
      minWidth: 64,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted
    },
    tabButtonActive: {
      backgroundColor: colors.accent
    },
    tabLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700"
    },
    tabLabelActive: {
      color: "#fff8f2"
    }
  });
