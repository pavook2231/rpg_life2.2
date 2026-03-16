import type { Language } from "../../locales";

type Copy = {
  ru: string;
  en: string;
};

type ArrayCopy = {
  ru: string[];
  en: string[];
};

export function pickLocalized(language: Language, copy: Copy) {
  return language === "en" ? copy.en : copy.ru;
}

export function pickLocalizedArray(language: Language, copy: ArrayCopy) {
  return language === "en" ? copy.en : copy.ru;
}
