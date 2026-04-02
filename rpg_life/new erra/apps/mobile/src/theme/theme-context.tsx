import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors, radius, spacing } from "./tokens";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  themePreference: ThemePreference;
  themeName: ResolvedTheme;
  colors: typeof lightColors;
  spacing: typeof spacing;
  radius: typeof radius;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  preference,
  children
}: PropsWithChildren<{ preference: ThemePreference }>) {
  const systemTheme = useColorScheme();
  const themeName: ResolvedTheme =
    preference === "system" ? (systemTheme === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference: preference,
      themeName,
      colors: themeName === "dark" ? darkColors : lightColors,
      spacing,
      radius
    }),
    [preference, themeName]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme должен использоваться внутри ThemeProvider");
  }
  return context;
}
