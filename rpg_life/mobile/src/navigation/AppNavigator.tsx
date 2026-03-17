import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { CharacterScreen } from "../screens/CharacterScreen";
import { CoopQuestsScreen } from "../screens/CoopQuestsScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { HelpScreen } from "../screens/HelpScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { LoadingScreen } from "../screens/LoadingScreen";
import { QuestsScreen } from "../screens/QuestsScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShopScreen } from "../screens/ShopScreen";
import { fetchChallengeInvitations } from "../api/social";
import { GameIcon } from "../ui";
import { radii, useThemeColors, useThemeMode } from "../ui/theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const { rewards } = useGame();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [hasPendingCoopInvitation, setHasPendingCoopInvitation] = useState(false);
  const [pendingCoopInvitationCount, setPendingCoopInvitationCount] = useState(0);
  const [tabBounceSeed, setTabBounceSeed] = useState<Record<string, number>>({});

  const rewardBadgeCount = useMemo(() => {
    let count = 0;
    if (rewards?.daily_bonus?.can_claim) count += 1;
    if (rewards?.weekly_goal?.claimable) count += 1;
    if (rewards?.seasonal_goal?.claimable) count += 1;
    count += rewards?.available_achievements?.length ?? 0;
    return count;
  }, [rewards?.available_achievements?.length, rewards?.daily_bonus?.can_claim, rewards?.seasonal_goal?.claimable, rewards?.weekly_goal?.claimable]);

  const invitationBadgeCount = (rewards?.social_pulse?.pending_friend_requests ?? 0) + (rewards?.social_pulse?.pending_challenge_invitations ?? 0);

  useEffect(() => {
    let cancelled = false;

    async function resolveCoopTabVisibility() {
      const hasActiveCoop = (rewards?.social_pulse?.active_coop ?? 0) > 0;
      const hasPendingInvitations = (rewards?.social_pulse?.pending_challenge_invitations ?? 0) > 0;

      if (hasActiveCoop) {
        setHasPendingCoopInvitation(true);
        setPendingCoopInvitationCount(0);
        return;
      }

      if (!hasPendingInvitations) {
        setHasPendingCoopInvitation(false);
        setPendingCoopInvitationCount(0);
        return;
      }

      try {
        const payload = await fetchChallengeInvitations("pending");
        if (!cancelled) {
          const coopInvitations = (payload.invitations ?? []).filter((invitation) => invitation.challenge_type === "coop");
          setHasPendingCoopInvitation(coopInvitations.length > 0);
          setPendingCoopInvitationCount(coopInvitations.length);
        }
      } catch {
        if (!cancelled) {
          setHasPendingCoopInvitation(false);
          setPendingCoopInvitationCount(0);
        }
      }
    }

    void resolveCoopTabVisibility();

    return () => {
      cancelled = true;
    };
  }, [rewards?.social_pulse?.active_coop, rewards?.social_pulse?.pending_challenge_invitations]);

  function triggerTabBounce(routeName: string) {
    setTabBounceSeed((prev) => ({
      ...prev,
      [routeName]: (prev[routeName] ?? 0) + 1,
    }));
  }

  function buildTabListeners(routeName: string) {
    return ({ navigation }: { navigation: { isFocused: () => boolean } }) => ({
      tabPress: () => {
        if (navigation.isFocused()) {
          triggerTabBounce(routeName);
        }
      },
    });
  }

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.backgroundRaised },
        headerTintColor: colors.text,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        listeners={buildTabListeners("Home")}
        options={{
          title: t("navigation.home"),
          tabBarBadge: rewardBadgeCount > 0 ? String(rewardBadgeCount) : undefined,
          tabBarIcon: ({ focused }) => <TabIcon name="home-variant" focused={focused} trigger={tabBounceSeed.Home ?? 0} />,
        }}
      />
      <Tabs.Screen
        name="Quests"
        component={QuestsScreen}
        listeners={buildTabListeners("Quests")}
        options={{
          title: t("navigation.quests"),
          tabBarIcon: ({ focused }) => <TabIcon name="notebook-outline" focused={focused} trigger={tabBounceSeed.Quests ?? 0} />,
        }}
      />
      {hasPendingCoopInvitation ? (
        <Tabs.Screen
          name="CoopQuests"
          component={CoopQuestsScreen}
          listeners={buildTabListeners("CoopQuests")}
          options={{
            title: t("navigation.coopTasks"),
            tabBarBadge: pendingCoopInvitationCount > 0 ? String(pendingCoopInvitationCount) : undefined,
            tabBarIcon: ({ focused }) => <TabIcon name="account-multiple" focused={focused} trigger={tabBounceSeed.CoopQuests ?? 0} />,
          }}
        />
      ) : null}
      <Tabs.Screen
        name="Character"
        component={CharacterScreen}
        listeners={buildTabListeners("Character")}
        options={{
          title: t("navigation.character"),
          tabBarIcon: ({ focused }) => <TabIcon name="shield-account" focused={focused} trigger={tabBounceSeed.Character ?? 0} />,
        }}
      />
      <Tabs.Screen
        name="Shop"
        component={ShopScreen}
        listeners={buildTabListeners("Shop")}
        options={{
          title: t("navigation.shop"),
          tabBarIcon: ({ focused }) => <TabIcon name="storefront-outline" focused={focused} trigger={tabBounceSeed.Shop ?? 0} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={CharacterScreen}
        listeners={buildTabListeners("Profile")}
        options={{
          title: t("navigation.profile"),
          tabBarBadge: invitationBadgeCount > 0 ? String(invitationBadgeCount) : undefined,
          tabBarIcon: ({ focused }) => <TabIcon name="account-circle-outline" focused={focused} trigger={tabBounceSeed.Profile ?? 0} />,
        }}
      />
    </Tabs.Navigator>
  );
}

function TabIcon({ name, focused, trigger }: { name: string; focused: boolean; trigger: number }) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!focused) {
      return;
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 18,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [focused, glowOpacity, scale, trigger]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[styles.tabIconWrap, focused ? styles.tabIconWrapFocused : null]}>
        <Animated.View pointerEvents="none" style={[styles.tabIconFlash, { opacity: glowOpacity }]} />
        <GameIcon name={name} size={24} color={focused ? colors.primary : colors.textDim} />
      </View>
    </Animated.View>
  );
}

function AuthSwitcher() {
  return <RegisterScreen onBackToLogin={() => {}} />;
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
          <Stack.Screen name="GoalSelect" component={CharacterScreen} options={{ title: "Выбор цели" }} />
          <Stack.Screen name="QuestBoard" component={QuestsScreen} options={{ title: "Доска заданий" }} />
          <Stack.Screen name="RewardScreen" component={AchievementsScreen} options={{ title: "Награды" }} />
          <Stack.Screen name="SkillTree" component={CharacterScreen} options={{ title: "Навыки" }} />
          <Stack.Screen name="Stats" component={CharacterScreen} options={{ title: "Статы" }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: t("screens.leaderboard.title") }} />
          <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: t("screens.friends.title") }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t("screens.settings.title") }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: t("screens.profile.achievements") }} />
          <Stack.Screen name="Help" component={HelpScreen} options={{ title: t("screens.help.title") }} />
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
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 10,
      backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.96)" : "rgba(10,16,29,0.96)",
      borderTopWidth: 1,
      borderTopColor: themeMode === "light" ? "rgba(183,121,31,0.18)" : "rgba(245,158,11,0.12)",
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.18)" : "rgba(255,255,255,0.08)",
      borderRadius: radii.lg,
      elevation: 0,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      height: 72,
      paddingTop: 6,
      paddingBottom: 6,
    },
    tabBarItem: {
      paddingTop: 2,
      paddingBottom: 0,
    },
    tabBarIcon: {
      marginTop: 0,
      marginBottom: 0,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: "700",
      marginTop: 0,
    },
    tabIconWrap: {
      minWidth: 54,
      minHeight: 34,
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 2,
      overflow: "hidden",
    },
    tabIconWrapFocused: {
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.14)",
    },
    tabIconFlash: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.12)",
      borderRadius: radii.md,
    },
  });
}
