import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./en.json";
import ru from "./ru.json";

export type Language = "ru" | "en";
export type TranslationParams = Record<string, string | number>;

export const LANGUAGE_STORAGE_KEY = "@rpg_life/language";

const DEFAULT_LANGUAGE: Language = "ru";
const translations = { ru, en } as const;
function resolveTranslation(language: Language, key: string): string | null {
  const segments = key.split(".");
  let value: unknown = translations[language];

  for (const segment of segments) {
    if (!value || typeof value !== "object" || !(segment in value)) {
      return null;
    }
    value = (value as Record<string, unknown>)[segment];
  }

  return typeof value === "string" ? value : null;
}

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, paramKey) => {
    return params[paramKey]?.toString() ?? `{${paramKey}}`;
  });
}

export function translateStatic(language: Language, key: string, params?: TranslationParams) {
  const value = resolveTranslation(language, key) ?? resolveTranslation(DEFAULT_LANGUAGE, key);
  return value ? interpolate(value, params) : key;
}

export async function getStoredLanguage(): Promise<Language> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "ru" || stored === "en") {
      return stored;
    }
  } catch {
    // Ignore storage issues and fall back to the default locale.
  }

  return DEFAULT_LANGUAGE;
}

export async function translateStored(key: string, params?: TranslationParams) {
  const language = await getStoredLanguage();
  return translateStatic(language, key, params);
}

export default translations;
