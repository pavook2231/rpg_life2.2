import React from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { useLocalization } from "../context/LocalizationContext";
import { type Language } from "../locales";
import { colors, radii } from "../ui";

interface LanguageSwitcherProps {
  style?: StyleProp<ViewStyle>;
}

export function LanguageSwitcher({ style }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLocalization();

  const languages: { code: Language; labelKey: string }[] = [
    { code: "ru", labelKey: "settings.languageSwitcher.ru" },
    { code: "en", labelKey: "settings.languageSwitcher.en" },
  ];

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{t("settings.language")}</Text>
      <View style={styles.buttonGroup}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.button,
              language === lang.code && styles.buttonActive,
            ]}
            onPress={() => setLanguage(lang.code)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.buttonText,
                language === lang.code && styles.buttonTextActive,
              ]}
            >
              {t(lang.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.backgroundInset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  button: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMuted,
  },
  buttonTextActive: {
    color: colors.text,
  },
});
