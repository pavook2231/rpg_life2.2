import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { probeApiConnection } from "../api/auth";
import { Screen } from "../components/Screen";
import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from "../config/env";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LocalizationContext";
import { clearApiBaseUrl, getStoredApiBaseUrl, saveApiBaseUrl } from "../storage/appConfigStorage";
import { useThemeColors, useThemeMode } from "../ui";

type Props = {
  onShowRegister: () => void;
};

export function LoginScreen({ onShowRegister }: Props) {
  const { signIn, signInWithProvider, socialProviders, reloadSocialProviders, authFlowNotice, clearAuthFlowNotice } = useAuth();
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);

  useEffect(() => {
    getStoredApiBaseUrl()
      .then((storedValue) => {
        if (storedValue) {
          setApiBaseUrl(storedValue);
        }
      })
      .catch(console.error);

    reloadSocialProviders().catch(console.error);
  }, []);

  useEffect(() => {
    if (!authFlowNotice) {
      return;
    }

    Alert.alert("Соцвход", authFlowNotice, [
      {
        text: "OK",
        onPress: clearAuthFlowNotice,
      },
    ]);
  }, [authFlowNotice, clearAuthFlowNotice]);

  async function handleLogin() {
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      Alert.alert(t("login.loginError"), error instanceof Error ? error.message : t("errors.unknownError"));
    }
  }

  async function handleSaveApiUrl() {
    try {
      setIsSavingApi(true);
      const normalized = normalizeApiBaseUrl(apiBaseUrl);
      await saveApiBaseUrl(normalized);
      setApiBaseUrl(normalized);
      Alert.alert(t("login.apiSaved"), t("login.apiWillBeUsed", { url: normalized }));
    } catch (error) {
      Alert.alert(t("common.error"), error instanceof Error ? error.message : t("errors.unknownError"));
    } finally {
      setIsSavingApi(false);
    }
  }

  async function handleResetApiUrl() {
    await clearApiBaseUrl();
    setApiBaseUrl(DEFAULT_API_BASE_URL);
    Alert.alert(t("login.apiReset"), t("login.apiResetMessage"));
  }

  async function handleCheckApi() {
    try {
      setIsCheckingApi(true);
      const normalized = normalizeApiBaseUrl(apiBaseUrl);
      await saveApiBaseUrl(normalized);
      setApiBaseUrl(normalized);
      const result = await probeApiConnection();
      Alert.alert(t("login.connectionWorks"), `${result.service}\n${t("login.connectionStatus", { status: result.status })}`);
    } catch (error) {
      Alert.alert(t("login.connectionFailed"), error instanceof Error ? error.message : t("errors.unknownError"));
    } finally {
      setIsCheckingApi(false);
    }
  }

  async function handleSocialLogin(providerId: "google" | "telegram" | "yandex") {
    const provider = socialProviders.find((entry) => entry.id === providerId);

    try {
      if (providerId === "telegram") {
        const botUsername = provider?.mobile_client_id;
        if (botUsername) {
          await Linking.openURL(`https://t.me/${botUsername}?start=rpglife_login`);
          Alert.alert(
            "Telegram",
            "Открыли бота Telegram. Приложение уже умеет принять возврат по ссылке вида rpglife://auth/telegram?init_data=..., а backend bridge для этого готов по пути /api/v1/auth/telegram/bridge.",
          );
          return;
        }
      }

      setIsSocialLoading(true);
      await signInWithProvider(providerId);
    } catch (error) {
      Alert.alert("Соцвход", error instanceof Error ? error.message : t("errors.unknownError"));
    } finally {
      setIsSocialLoading(false);
    }
  }

  return (
    <Screen title={t("screens.login.title")} subtitle={t("screens.login.subtitle")} scrollable={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.modeRow}>
          <View style={[styles.modeTab, styles.modeTabActive]}>
            <Text style={[styles.modeText, styles.modeTextActive]}>{t("screens.login.mode")}</Text>
          </View>
          <TouchableOpacity style={styles.modeTab} onPress={onShowRegister} activeOpacity={0.85}>
            <Text style={styles.modeText}>{t("screens.login.register")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("screens.login.apiConnection")}</Text>
          <Text style={styles.hint}>{t("screens.login.apiHint")}</Text>
          <TextInput
            placeholder={t("screens.login.apiPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveApiUrl} activeOpacity={0.85} disabled={isSavingApi}>
              <Text style={styles.secondaryText}>{isSavingApi ? t("screens.login.saving") : t("screens.login.save")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleCheckApi} activeOpacity={0.85} disabled={isCheckingApi}>
              <Text style={styles.secondaryText}>{isCheckingApi ? t("screens.login.checking") : t("screens.login.check")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton} onPress={handleResetApiUrl} activeOpacity={0.85}>
              <Text style={styles.ghostText}>{t("screens.login.reset")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("screens.login.accountLogin")}</Text>
          <TextInput placeholder={t("screens.login.emailPlaceholder")} placeholderTextColor={colors.textDim} style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput placeholder={t("screens.login.passwordPlaceholder")} placeholderTextColor={colors.textDim} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} activeOpacity={0.85}>
            <Text style={styles.primaryText}>{t("screens.login.login")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={onShowRegister} activeOpacity={0.85}>
            <Text style={styles.link}>{t("screens.login.noAccount")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Социальный вход</Text>
          <Text style={styles.hint}>
            Подготовлено для Google, Telegram и Yandex. Для Telegram приложение уже умеет поймать возврат по deep link формата `rpglife://auth/telegram?init_data=...`.
          </Text>
          <View style={styles.socialColumn}>
            {socialProviders.map((provider) => {
              const isReady = provider.enabled && provider.configured;
              const metaText = isReady
                ? provider.id === "telegram"
                  ? "Бот подключен. Следующий шаг - автоматический возврат из Telegram в приложение."
                  : "Провайдер сконфигурирован"
                : provider.id === "telegram"
                  ? "Нужно добавить bot token и username"
                  : "Нужно добавить client id / bot settings";
              return (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.socialButton,
                    isReady ? styles.socialButtonReady : styles.socialButtonPending,
                  ]}
                  activeOpacity={0.85}
                  disabled={!isReady || isSocialLoading}
                  onPress={() => handleSocialLogin(provider.id)}
                >
                  <View style={styles.socialButtonCopy}>
                    <Text style={styles.socialButtonTitle}>Продолжить через {provider.label}</Text>
                    <Text style={styles.socialButtonMeta}>{metaText}</Text>
                  </View>
                  <Text style={[styles.socialStatus, isReady ? styles.socialStatusReady : styles.socialStatusPending]}>
                    {isReady ? "Готово" : "Скоро"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  container: {
    flex: 1,
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
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: 10,
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
  primaryButton: {
    backgroundColor: colors.success,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#052e16",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.xp,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryText: {
    color: "#dbeafe",
    fontWeight: "700",
  },
  ghostButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
  },
  link: {
    color: colors.xp,
    fontWeight: "700",
  },
  socialColumn: {
    gap: 10,
  },
  socialButton: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  socialButtonReady: {
    backgroundColor: themeMode === "light" ? "#e4f6e9" : "#173326",
    borderColor: colors.success,
  },
  socialButtonPending: {
    backgroundColor: colors.cardMuted,
    borderColor: colors.border,
  },
  socialButtonCopy: {
    flex: 1,
    gap: 3,
  },
  socialButtonTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  socialButtonMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  socialStatus: {
    fontWeight: "800",
    fontSize: 12,
  },
  socialStatusReady: {
    color: "#86efac",
  },
  socialStatusPending: {
    color: colors.textDim,
  },
  });
}
