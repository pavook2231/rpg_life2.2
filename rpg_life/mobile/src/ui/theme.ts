import { useMemo } from "react";

import { useAppPreferences } from "../context/AppPreferencesContext";

export const colors = {
  background: "#0f172a",
  backgroundRaised: "#111c33",
  backgroundInset: "#0b1220",
  card: "#1e293b",
  cardSoft: "#243246",
  cardMuted: "#172235",
  primary: "#f59e0b",
  primaryDark: "#7c4a03",
  success: "#22c55e",
  successDark: "#14532d",
  danger: "#ef4444",
  dangerDark: "#7f1d1d",
  xp: "#3b82f6",
  hp: "#ef4444",
  mana: "#3b82f6",
  gold: "#f59e0b",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  border: "#334155",
  borderSoft: "#475569",
  overlay: "rgba(2, 6, 23, 0.84)",
};

export const lightColors = {
  background: "#f4efe3",
  backgroundRaised: "#fbf7ef",
  backgroundInset: "#efe7d7",
  card: "#fffaf0",
  cardSoft: "#f2e9d9",
  cardMuted: "#f0e5d3",
  primary: "#b7791f",
  primaryDark: "#8b5e18",
  success: "#16a34a",
  successDark: "#166534",
  danger: "#dc2626",
  dangerDark: "#991b1b",
  xp: "#2563eb",
  hp: "#dc2626",
  mana: "#2563eb",
  gold: "#c67a00",
  text: "#1f2937",
  textMuted: "#475569",
  textDim: "#64748b",
  border: "#d6c7aa",
  borderSoft: "#c7b79a",
  overlay: "rgba(255, 248, 235, 0.78)",
} as const;

export type ThemeColors = typeof colors;
export type ThemeMode = "dark" | "light";

const themeMap: Record<ThemeMode, ThemeColors> = {
  dark: colors,
  light: lightColors as ThemeColors,
};

export const rarityColors: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#4ade80",
  rare: "#38bdf8",
  epic: "#c084fc",
  legendary: "#f59e0b",
  immortal: "#a855f7",
  earned: "#f59e0b",
  available: "#38bdf8",
  locked: "#94a3b8",
};

export function getRaritySurface(rarity?: string | null, mode: ThemeMode = "dark") {
  const darkSurfaces: Record<string, { border: string; background: string; accent: string; panel: string; trim: string; glow: string }> = {
    common: {
      border: "#94a3b8",
      background: "#243244",
      accent: "#e2e8f0",
      panel: "rgba(255,255,255,0.08)",
      trim: "rgba(226,232,240,0.14)",
      glow: "rgba(148,163,184,0.28)",
    },
    uncommon: {
      border: "#4ade80",
      background: "#173326",
      accent: "#d1fae5",
      panel: "rgba(34,197,94,0.12)",
      trim: "rgba(209,250,229,0.18)",
      glow: "rgba(74,222,128,0.34)",
    },
    rare: {
      border: "#38bdf8",
      background: "#13324b",
      accent: "#dbeafe",
      panel: "rgba(56,189,248,0.12)",
      trim: "rgba(219,234,254,0.16)",
      glow: "rgba(56,189,248,0.36)",
    },
    epic: {
      border: "#c084fc",
      background: "#312145",
      accent: "#f3e8ff",
      panel: "rgba(192,132,252,0.12)",
      trim: "rgba(243,232,255,0.18)",
      glow: "rgba(192,132,252,0.42)",
    },
    legendary: {
      border: "#f59e0b",
      background: "#4a3112",
      accent: "#fef3c7",
      panel: "rgba(245,158,11,0.12)",
      trim: "rgba(254,243,199,0.18)",
      glow: "rgba(245,158,11,0.44)",
    },
    immortal: {
      border: "#a855f7",
      background: "#331252",
      accent: "#f3e8ff",
      panel: "rgba(168,85,247,0.14)",
      trim: "rgba(243,232,255,0.18)",
      glow: "rgba(168,85,247,0.46)",
    },
  };

  const lightSurfaces: Record<string, { border: string; background: string; accent: string; panel: string; trim: string; glow: string }> = {
    common: {
      border: "#94a3b8",
      background: "#f8f4ea",
      accent: "#334155",
      panel: "rgba(148,163,184,0.08)",
      trim: "rgba(100,116,139,0.22)",
      glow: "rgba(148,163,184,0.18)",
    },
    uncommon: {
      border: "#22c55e",
      background: "#edf9f1",
      accent: "#166534",
      panel: "rgba(34,197,94,0.1)",
      trim: "rgba(22,163,74,0.25)",
      glow: "rgba(34,197,94,0.2)",
    },
    rare: {
      border: "#0ea5e9",
      background: "#edf7fc",
      accent: "#0c4a6e",
      panel: "rgba(14,165,233,0.1)",
      trim: "rgba(3,105,161,0.24)",
      glow: "rgba(14,165,233,0.2)",
    },
    epic: {
      border: "#a855f7",
      background: "#f6f0fc",
      accent: "#6b21a8",
      panel: "rgba(168,85,247,0.1)",
      trim: "rgba(126,34,206,0.24)",
      glow: "rgba(168,85,247,0.22)",
    },
    legendary: {
      border: "#d97706",
      background: "#fcf5e9",
      accent: "#92400e",
      panel: "rgba(217,119,6,0.1)",
      trim: "rgba(180,83,9,0.24)",
      glow: "rgba(217,119,6,0.22)",
    },
    immortal: {
      border: "#9333ea",
      background: "#f6effd",
      accent: "#6b21a8",
      panel: "rgba(147,51,234,0.1)",
      trim: "rgba(107,33,168,0.24)",
      glow: "rgba(147,51,234,0.22)",
    },
  };

  const surfaces = mode === "light" ? lightSurfaces : darkSurfaces;
  return surfaces[rarity ?? "common"] ?? surfaces.common;
}

export const palette = {
  bg: colors.background,
  bgElevated: colors.backgroundRaised,
  bgCard: colors.card,
  bgCardAlt: colors.cardMuted,
  stroke: colors.border,
  strokeSoft: colors.borderSoft,
  text: colors.text,
  textMuted: colors.textMuted,
  textDim: colors.textDim,
  primary: colors.primary,
  primaryDeep: colors.primaryDark,
  gold: colors.gold,
  goldDeep: colors.primaryDark,
  success: colors.success,
  successDeep: colors.successDark,
  danger: colors.danger,
  dangerDeep: colors.dangerDark,
  rare: rarityColors.rare,
  epic: rarityColors.epic,
  legendary: rarityColors.legendary,
  common: rarityColors.common,
  overlay: colors.overlay,
  xp: colors.xp,
  hp: colors.hp,
  mana: colors.mana,
};

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return themeMap[mode] ?? themeMap.dark;
}

export function useThemeMode(): ThemeMode {
  const { themeMode } = useAppPreferences();
  return themeMode;
}

export function useThemeColors(): ThemeColors {
  const mode = useThemeMode();
  return useMemo(() => getThemeColors(mode), [mode]);
}

export function useThemePalette() {
  const theme = useThemeColors();
  return useMemo(
    () => ({
      bg: theme.background,
      bgElevated: theme.backgroundRaised,
      bgCard: theme.card,
      bgCardAlt: theme.cardMuted,
      stroke: theme.border,
      strokeSoft: theme.borderSoft,
      text: theme.text,
      textMuted: theme.textMuted,
      textDim: theme.textDim,
      primary: theme.primary,
      primaryDeep: theme.primaryDark,
      gold: theme.gold,
      goldDeep: theme.primaryDark,
      success: theme.success,
      successDeep: theme.successDark,
      danger: theme.danger,
      dangerDeep: theme.dangerDark,
      rare: rarityColors.rare,
      epic: rarityColors.epic,
      legendary: rarityColors.legendary,
      common: rarityColors.common,
      overlay: theme.overlay,
      xp: theme.xp,
      hp: theme.hp,
      mana: theme.mana,
    }),
    [theme],
  );
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#020617",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  glow: {
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
};

export const typography = {
  title: {
    fontSize: 30,
    fontWeight: "900" as const,
    letterSpacing: 0.3,
  },
  heading: {
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
};
