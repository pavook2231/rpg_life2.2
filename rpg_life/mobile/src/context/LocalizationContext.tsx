import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStoredLanguage, LANGUAGE_STORAGE_KEY, type Language, translateStatic } from "../locales/index";

interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru");

  useEffect(() => {
    void loadLanguage();
  }, []);

  async function loadLanguage() {
    const storedLanguage = await getStoredLanguage();
    setLanguageState(storedLanguage);
  }

  async function setLanguage(lang: Language) {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error("Failed to save language preference:", error);
    }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    return translateStatic(language, key, params);
  }

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): LocalizationContextType {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalization must be used within LocalizationProvider");
  }
  return context;
}

export function useTranslation() {
  return useLocalization().t;
}
