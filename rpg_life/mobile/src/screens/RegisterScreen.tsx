import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SocialAuthSection } from "../components/SocialAuthSection";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { useThemeColors, useThemeMode } from "../ui";

type Props = {
  onBackToLogin: () => void;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function hasLetter(value: string) {
  return /[A-Za-zА-Яа-я]/.test(value);
}

function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

function isValidUsername(value: string) {
  return /^[a-z][a-z0-9_]{2,23}$/.test(normalizeUsernameInput(value));
}

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function RegisterScreen({ onBackToLogin }: Props) {
  const { signUp } = useAuth();
  const t = useTranslation();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedUsername = normalizeUsernameInput(username);

    if (!isValidEmail(trimmedEmail)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidEmail"),
        icon: "email-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (password.length < 8 || !hasLetter(password)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidPassword"),
        icon: "lock-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (trimmedName.length < 2 || /^\d/.test(trimmedName)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidName"),
        icon: "account-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (trimmedUsername && !isValidUsername(trimmedUsername)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidUsername"),
        icon: "at",
        tone: "warning",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp({
        email: trimmedEmail,
        password,
        name: trimmedName,
        username: trimmedUsername || undefined,
      });
    } catch (error) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      title={translateOrFallback(t, "screens.register.title", "Создай аккаунт")}
      subtitle={translateOrFallback(
        t,
        "screens.register.subtitle",
        "Начнем с аккаунта. Цель, стиль героя и первый план выберем уже внутри.",
      )}
      scrollable
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeTab} onPress={onBackToLogin} activeOpacity={0.85}>
            <Text style={styles.modeText}>{t("screens.register.login")}</Text>
          </TouchableOpacity>
          <View style={[styles.modeTab, styles.modeTabActive]}>
            <Text style={[styles.modeText, styles.modeTextActive]}>{t("screens.register.mode")}</Text>
          </View>
        </View>

        <SocialAuthSection
          title={translateOrFallback(t, "screens.register.quick.socialSectionTitle", "Быстрый вход")}
          hint={translateOrFallback(
            t,
            "screens.register.quick.socialSectionHint",
            "Google и VK создадут аккаунт автоматически, если входишь впервые.",
          )}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.register.basicData", "Создай аккаунт")}
          </Text>
          <Text style={styles.sectionHint}>
            {translateOrFallback(
              t,
              "screens.register.quick.accountSetupHint",
              "Сейчас нужны только имя, email и пароль. Остальное настроим по шагам после входа.",
            )}
          </Text>
          <TextInput
            placeholder={t("screens.register.namePlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            placeholder={t("screens.register.emailPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            placeholder={t("screens.register.passwordPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            placeholder={t("screens.register.usernamePlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Text style={styles.inlineHint}>
            {translateOrFallback(
              t,
              "screens.register.quick.usernameLaterHint",
              "Ник нужен для друзей и поиска. Можно добавить сейчас или позже в профиле.",
            )}
          </Text>
        </View>

        <View style={styles.cardMuted}>
          <Text style={styles.previewTitle}>
            {translateOrFallback(t, "screens.register.quick.nextTitle", "Что будет дальше")}
          </Text>
          <Text style={styles.previewText}>
            {translateOrFallback(
              t,
              "screens.register.quick.nextDescription",
              "После входа приложение проведет тебя по первому шагу: выбрать цель, взять первый квест и получить первую награду.",
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting ? styles.primaryButtonDisabled : null]}
          onPress={handleRegister}
          activeOpacity={0.85}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryText}>
            {isSubmitting
              ? t("common.loading")
              : translateOrFallback(t, "screens.register.register", "Продолжить")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onBackToLogin} activeOpacity={0.85}>
          <Text style={styles.link}>{t("screens.register.haveAccount")}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    container: {
      gap: 16,
    },
    modeRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 6,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    modeTabActive: {
      backgroundColor: colors.xp,
    },
    modeText: {
      color: colors.textDim,
      fontWeight: "700",
    },
    modeTextActive: {
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 18,
      gap: 14,
    },
    cardMuted: {
      backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.84)" : "rgba(10,16,29,0.74)",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 18,
      gap: 8,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    sectionHint: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    input: {
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
    },
    inlineHint: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 18,
    },
    previewTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    previewText: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryText: {
      color: "#451a03",
      fontWeight: "800",
      fontSize: 16,
    },
    linkButton: {
      backgroundColor: colors.cardMuted,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    link: {
      color: colors.xp,
      fontWeight: "700",
    },
  });
}
