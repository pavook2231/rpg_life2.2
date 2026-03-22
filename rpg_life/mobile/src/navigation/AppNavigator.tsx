import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { useGameInventoryEquipment, useGameProgress } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { CharacterScreen } from "../screens/CharacterScreen";
import { CoopQuestsScreen } from "../screens/CoopQuestsScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { GoalSelectScreen } from "../screens/GoalSelectScreen";
import { HelpScreen } from "../screens/HelpScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { LoadingScreen } from "../screens/LoadingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { QuestsScreen } from "../screens/QuestsScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShopScreen } from "../screens/ShopScreen";
import { SocialProfileScreen } from "../screens/SocialProfileScreen";
import { getNavigationUnlockState } from "../lib/navigationUnlocks";
import { fetchChallengeInvitations } from "../api/social";
import { getGoalSetupPending } from "../storage/beginnerOnboardingStorage";
import { GameIcon } from "../ui";
import { radii, useThemeColors, useThemeMode } from "../ui/theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const { profile, hero, rewards } = useGameProgress();
  const { equipment, inventory } = useGameInventoryEquipment();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [pendingCoopInvitationCount, setPendingCoopInvitationCount] = useState(0);
  const [tabBounceSeed, setTabBounceSeed] = useState<Record<string, number>>({});
  const handledGoalRedirectUserRef = useRef<number | null>(null);
  const unlockState = useMemo(
    () =>
      getNavigationUnlockState({
        profile,
        hero,
        equipment,
        inventory,
        rewards,
      }),
    [equipment, hero, inventory, profile, rewards],
  );

  const homeBadgeCount = useMemo(() => {
    let count = 0;
    if (rewards?.daily_bonus?.can_claim) count += 1;
    if (rewards?.weekly_goal?.claimable) count += 1;
    if (rewards?.seasonal_goal?.claimable) count += 1;
    return count;
  }, [rewards?.daily_bonus?.can_claim, rewards?.seasonal_goal?.claimable, rewards?.weekly_goal?.claimable]);

  useEffect(() => {
    let active = true;
    const userId = profile?.user?.id ?? null;

    if (!userId || handledGoalRedirectUserRef.current === userId) {
      return () => {
        active = false;
      };
    }

    getGoalSetupPending(userId)
      .then((pending) => {
        if (!active) {
          return;
        }
        handledGoalRedirectUserRef.current = userId;
        if (pending) {
          navigation.navigate("GoalSelect");
        }
      })
      .catch(() => {
        if (active) {
          handledGoalRedirectUserRef.current = userId;
        }
      });

    return () => {
      active = false;
    };
  }, [navigation, profile?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function resolveCoopBadge() {
      const hasPendingInvitations = (rewards?.social_pulse?.pending_challenge_invitations ?? 0) > 0;

      if (!unlockState.coopUnlocked) {
        setPendingCoopInvitationCount(0);
        return;
      }

      if (!hasPendingInvitations) {
        setPendingCoopInvitationCount(0);
        return;
      }

      try {
        const payload = await fetchChallengeInvitations("pending");
        if (!cancelled) {
          const coopInvitations = (payload.invitations ?? []).filter((invitation) => invitation.challenge_type === "coop");
          setPendingCoopInvitationCount(coopInvitations.length);
        }
      } catch {
        if (!cancelled) {
          setPendingCoopInvitationCount(0);
        }
      }
    }

    void resolveCoopBadge();

    return () => {
      cancelled = true;
    };
  }, [rewards?.social_pulse?.pending_challenge_invitations, unlockState.coopUnlocked]);

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
          tabBarBadge: homeBadgeCount > 0 ? String(homeBadgeCount) : undefined,
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
      <Tabs.Screen
        name="Character"
        component={CharacterScreen}
        listeners={buildTabListeners("Character")}
        options={{
          title: t("navigation.character"),
          tabBarIcon: ({ focused }) => <TabIcon name="shield-account" focused={focused} trigger={tabBounceSeed.Character ?? 0} />,
        }}
      />
      {unlockState.shopUnlocked ? (
        <Tabs.Screen
          name="Shop"
          component={ShopScreen}
          listeners={buildTabListeners("Shop")}
          options={{
            title: t("navigation.shop"),
            tabBarIcon: ({ focused }) => <TabIcon name="storefront-outline" focused={focused} trigger={tabBounceSeed.Shop ?? 0} />,
          }}
        />
      ) : null}
      {unlockState.coopUnlocked ? (
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
        name="Profile"
        component={ProfileScreen}
        listeners={buildTabListeners("Profile")}
        options={{
          title: t("navigation.profile"),
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
  const [mode, setMode] = useState<"login" | "register">("login");

  if (mode === "register") {
    return <RegisterScreen onBackToLogin={() => setMode("login")} />;
  }

  return <LoginScreen onShowRegister={() => setMode("register")} />;
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
          <Stack.Screen name="GoalSelect" component={GoalSelectScreen} options={{ title: "Выбор цели" }} />
          <Stack.Screen name="QuestBoard" component={QuestsScreen} options={{ title: "Доска заданий" }} />
          <Stack.Screen name="RewardScreen" component={AchievementsScreen} options={{ title: "Награды" }} />
          <Stack.Screen name="SkillTree" component={CharacterScreen} options={{ title: "Навыки" }} />
          <Stack.Screen name="Stats" component={CharacterScreen} options={{ title: "Статы" }} />
          <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: t("screens.friends.title") }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: t("screens.leaderboard.title") }} />
          <Stack.Screen name="PlayerProfile" component={SocialProfileScreen} options={{ title: "Профиль игрока" }} />
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
