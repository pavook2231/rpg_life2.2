import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LocalizationContext";
import { AboutScreen } from "../screens/AboutScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { ChallengeInvitationsScreen } from "../screens/ChallengeInvitationsScreen";
import { CharacterScreen } from "../screens/CharacterScreen";
import { CraftingScreen } from "../screens/CraftingScreen";
import { EventsScreen } from "../screens/EventsScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { HelpScreen } from "../screens/HelpScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ItemSourceLibraryScreen } from "../screens/ItemSourceLibraryScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { LoadingScreen } from "../screens/LoadingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MultiplayerQuestsScreen } from "../screens/MultiplayerQuestsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { QuestsScreen } from "../screens/QuestsScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShopScreen } from "../screens/ShopScreen";
import { GameIcon } from "../ui";
import { radii, useThemeColors, useThemeMode } from "../ui/theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.backgroundRaised },
        headerTintColor: colors.text,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t("navigation.home"), tabBarIcon: ({ focused }) => <TabIcon name="home-variant" focused={focused} /> }} />
      <Tabs.Screen name="Quests" component={QuestsScreen} options={{ title: t("navigation.quests"), tabBarIcon: ({ focused }) => <TabIcon name="notebook-outline" focused={focused} /> }} />
      <Tabs.Screen name="Character" component={CharacterScreen} options={{ title: t("navigation.character"), tabBarIcon: ({ focused }) => <TabIcon name="shield-account" focused={focused} /> }} />
      <Tabs.Screen name="Shop" component={ShopScreen} options={{ title: t("navigation.shop"), tabBarIcon: ({ focused }) => <TabIcon name="storefront-outline" focused={focused} /> }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t("navigation.profile"), tabBarIcon: ({ focused }) => <TabIcon name="account-circle-outline" focused={focused} /> }} />
    </Tabs.Navigator>
  );
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  return (
    <View style={[styles.tabIconWrap, focused ? styles.tabIconWrapFocused : null]}>
      <GameIcon name={name} size={24} color={focused ? colors.primary : colors.textDim} />
    </View>
  );
}

function AuthSwitcher() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return mode === "register" ? <RegisterScreen onBackToLogin={() => setMode("login")} /> : <LoginScreen onShowRegister={() => setMode("register")} />;
}

export function AppNavigator() {
  const { user, isLoading } = useAuth();
  const t = useTranslation();
  const colors = useThemeColors();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.backgroundRaised },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="GoalProgress" component={QuestsScreen} options={{ title: "Прогресс цели" }} />
          <Stack.Screen name="GoalSelect" component={ProfileScreen} options={{ title: "Выбор цели" }} />
          <Stack.Screen name="QuestBoard" component={QuestsScreen} options={{ title: "Доска заданий" }} />
          <Stack.Screen name="RewardScreen" component={AchievementsScreen} options={{ title: "Награды" }} />
          <Stack.Screen name="SkillTree" component={CharacterScreen} options={{ title: "Навыки" }} />
          <Stack.Screen name="Stats" component={CharacterScreen} options={{ title: "Статы" }} />
          <Stack.Screen name="ChallengeInvitations" component={ChallengeInvitationsScreen} options={{ title: t("screens.challengeInvitations.title") }} />
          <Stack.Screen name="MultiplayerQuests" component={MultiplayerQuestsScreen} options={{ title: t("screens.multiplayer.title") }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: t("screens.leaderboard.title") }} />
          <Stack.Screen name="Events" component={EventsScreen} options={{ title: t("screens.events.title") }} />
          <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: t("screens.friends.title") }} />
          <Stack.Screen name="Crafting" component={CraftingScreen} options={{ title: t("screens.crafting.title") }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t("screens.settings.title") }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: t("screens.profile.achievements") }} />
          <Stack.Screen name="Help" component={HelpScreen} options={{ title: t("screens.help.title") }} />
          <Stack.Screen name="About" component={AboutScreen} options={{ title: t("screens.about.title") }} />
          <Stack.Screen name="ItemSourceLibrary" component={ItemSourceLibraryScreen} options={{ title: "Арсенал предметов" }} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthSwitcher} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: colors.backgroundRaised,
      borderTopWidth: 0,
      elevation: 0,
      height: 96,
      paddingTop: 10,
      paddingBottom: 14,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },
    tabIconWrap: {
      minWidth: 56,
      minHeight: 40,
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tabIconWrapFocused: {
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245, 158, 11, 0.14)",
    },
  });
}
