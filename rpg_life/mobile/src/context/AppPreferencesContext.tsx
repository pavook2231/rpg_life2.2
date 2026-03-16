import React, { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

import { getAppPreferences, saveAppPreferences, type AppPreferences, type ThemeMode } from "../storage/appPreferencesStorage";

type AppPreferencesContextValue = AppPreferences & {
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  setThemeMode: (value: ThemeMode) => Promise<void>;
  setHomeIntroCollapsed: (value: boolean) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>({
    notificationsEnabled: true,
    themeMode: "dark",
    homeIntroCollapsed: false,
  });

  useEffect(() => {
    getAppPreferences().then(setPreferences).catch(() => undefined);
  }, []);

  async function updatePreferences(nextValue: AppPreferences) {
    setPreferences(nextValue);
    await saveAppPreferences(nextValue);
  }

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      ...preferences,
      setNotificationsEnabled: async (value) => {
        await updatePreferences({ ...preferences, notificationsEnabled: value });
      },
      setThemeMode: async (value) => {
        await updatePreferences({ ...preferences, themeMode: value });
      },
      setHomeIntroCollapsed: async (value) => {
        await updatePreferences({ ...preferences, homeIntroCollapsed: value });
      },
    }),
    [preferences],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  }
  return context;
}
