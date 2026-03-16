import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "dark" | "light";

export type AppPreferences = {
  notificationsEnabled: boolean;
  themeMode: ThemeMode;
  homeIntroCollapsed: boolean;
};

const STORAGE_KEY = "@rpg_life/app_preferences";

const DEFAULT_PREFERENCES: AppPreferences = {
  notificationsEnabled: true,
  themeMode: "dark",
  homeIntroCollapsed: false,
};

export async function getAppPreferences() {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_PREFERENCES;
  }

  try {
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(rawValue) as Partial<AppPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveAppPreferences(preferences: AppPreferences) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
