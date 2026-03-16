import "react-native-reanimated";
import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LocalizationProvider } from "./src/context/LocalizationContext";
import { AppPreferencesProvider } from "./src/context/AppPreferencesContext";
import { FeedbackProvider } from "./src/context/FeedbackContext";
import { AuthProvider } from "./src/context/AuthContext";
import { GameProvider } from "./src/context/GameContext";
import { OfflineProvider } from "./src/context/OfflineContext";
import { PushNotificationsProvider } from "./src/context/PushNotificationsContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useThemeColors, useThemeMode } from "./src/ui/theme";

function ThemedNavigationRoot() {
  const themeMode = useThemeMode();
  const colors = useThemeColors();

  const navigationTheme = {
    ...NavigationDefaultTheme,
    dark: themeMode === "dark",
    colors: {
      ...NavigationDefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.backgroundRaised,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={themeMode === "light" ? "dark" : "light"} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocalizationProvider>
        <AppPreferencesProvider>
          <FeedbackProvider>
            <AuthProvider>
              <OfflineProvider>
                <PushNotificationsProvider>
                  <GameProvider>
                    <ThemedNavigationRoot />
                  </GameProvider>
                </PushNotificationsProvider>
              </OfflineProvider>
            </AuthProvider>
          </FeedbackProvider>
        </AppPreferencesProvider>
      </LocalizationProvider>
    </SafeAreaProvider>
  );
}
