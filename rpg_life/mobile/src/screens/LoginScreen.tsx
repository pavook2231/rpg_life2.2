import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { probeApiConnection } from "../api/auth";
import { Screen } from "../components/Screen";
import {
  GOOGLE_AUTH_ANDROID_CLIENT_ID,
  DEFAULT_API_BASE_URL,
  GOOGLE_AUTH_CLIENT_ID,
  GOOGLE_AUTH_IOS_CLIENT_ID,
  GOOGLE_AUTH_WEB_CLIENT_ID,
  isDeprecatedLocalApiBaseUrl,
  normalizeApiBaseUrl,
  SOCIAL_AUTH_REDIRECT_SCHEME,
} from "../config/env";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LocalizationContext";
import { clearApiBaseUrl, getStoredApiBaseUrl, saveApiBaseUrl } from "../storage/appConfigStorage";
import { useFeedback } from "../context/FeedbackContext";
import { useThemeColors, useThemeMode } from "../ui";

WebBrowser.maybeCompleteAuthSession();

type Props = {
  onShowRegister: () => void;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginScreen({ onShowRegister }: Props) {
  const { signIn, signInWithProvider, socialProviders, reloadSocialProviders, authFlowNotice, clearAuthFlowNotice, completeSocialRedirectUrl } = useAuth();
  const t = useTranslation();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [activeSocialProviderId, setActiveSocialProviderId] = useState<"google" | "telegram" | "vk" | null>(null);
  const [showApiTools, setShowApiTools] = useState(false);
  const providerList = Array.isArray(socialProviders) ? socialProviders : [];
  const googleProvider = providerList.find((entry) => entry.id === "google");
  const googleFallbackClientId = googleProvider?.mobile_client_id || GOOGLE_AUTH_CLIENT_ID;
  const googleAndroidClientId = GOOGLE_AUTH_ANDROID_CLIENT_ID || googleFallbackClientId;
  const googleIosClientId = GOOGLE_AUTH_IOS_CLIENT_ID || googleFallbackClientId;
  const googleWebClientId = GOOGLE_AUTH_WEB_CLIENT_ID || GOOGLE_AUTH_CLIENT_ID || googleFallbackClientId;
  const googleClientId =
    Platform.OS === "android"
      ? googleAndroidClientId
      : Platform.OS === "ios"
        ? googleIosClientId
        : googleWebClientId;
  const googleRedirectUri = AuthSession.makeRedirectUri({
    native: "com.rpglife.mobile:/oauthredirect",
  });
  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useIdTokenAuthRequest(
    {
      androidClientId: googleAndroidClientId || undefined,
      iosClientId: googleIosClientId || undefined,
      webClientId: googleWebClientId || undefined,
      redirectUri: googleRedirectUri,
      scopes: ["openid", "profile", "email"],
      selectAccount: true,
    },
  );

  useEffect(() => {
    getStoredApiBaseUrl()
      .then((storedValue) => {
        if (
          storedValue &&
          !isDeprecatedLocalApiBaseUrl(storedValue) &&
          normalizeApiBaseUrl(storedValue) === normalizeApiBaseUrl(DEFAULT_API_BASE_URL)
        ) {
          setApiBaseUrl(storedValue);
        } else {
          setApiBaseUrl(DEFAULT_API_BASE_URL);
        }
      })
      .catch(() => undefined);

    reloadSocialProviders().catch(() => undefined);
  }, [reloadSocialProviders]);

  useEffect(() => {
    if (!authFlowNotice) {
      return;
    }

    Alert.alert(t("screens.login.quick.socialLoginTitle"), authFlowNotice, [
      {
        text: t("screens.login.quick.ok"),
        onPress: clearAuthFlowNotice,
      },
    ]);
  }, [authFlowNotice, clearAuthFlowNotice, t]);

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    if (googleResponse.type !== "success") {
      if (googleResponse.type === "error") {
        void pushToast({
          title: t("screens.login.quick.googleTitle"),
          description: googleResponse.error?.message || t("errors.unknownError"),
          icon: "alert-circle",
          tone: "warning",
        });
      }
      return;
    }

    const idToken = googleResponse.params?.id_token || googleResponse.authentication?.idToken;
    if (!idToken) {
      void pushToast({
        title: t("screens.login.quick.googleTitle"),
        description: t("screens.login.quick.googleMissingIdToken"),
        icon: "alert-circle",
        tone: "warning",
      });
      setIsSocialLoading(false);
      return;
    }

    signInWithProvider("google", { id_token: idToken })
      .catch((error) => {
        void pushToast({
          title: t("screens.login.quick.socialLoginTitle"),
          description: error instanceof Error ? error.message : t("errors.unknownError"),
          icon: "alert-circle",
          tone: "warning",
        });
      })
      .finally(() => {
        setIsSocialLoading(false);
      });
  }, [googleResponse, signInWithProvider, t]);

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      await pushToast({
        title: t("screens.login.errors.loginFailed"),
        description: t("screens.login.quick.invalidEmail"),
        icon: "email-alert-outline",
        tone: "warning",
      });
      return;
    }
    if (password.length < 8) {
      await pushToast({
        title: t("screens.login.errors.loginFailed"),
        description: t("screens.login.quick.passwordTooShort"),
        icon: "lock-alert-outline",
        tone: "warning",
      });
      return;
    }

    try {
      setIsSigningIn(true);
      await signIn(trimmedEmail, password);
    } catch (error) {
      await pushToast({
        title: t("screens.login.errors.loginFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSaveApiUrl() {
    try {
      setIsSavingApi(true);
      const normalized = normalizeApiBaseUrl(apiBaseUrl);
      await saveApiBaseUrl(normalized);
      setApiBaseUrl(normalized);
      await pushToast(
        {
          title: t("screens.login.apiSaved"),
          description: t("screens.login.apiWillBeUsed", { url: normalized }),
          icon: "cloud-check-outline",
          tone: "success",
        },
        { haptic: "success" },
      );
    } catch (error) {
      await pushToast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsSavingApi(false);
    }
  }

  async function handleResetApiUrl() {
    await clearApiBaseUrl();
    setApiBaseUrl(DEFAULT_API_BASE_URL);
    await pushToast(
      {
        title: t("screens.login.apiReset"),
        description: t("screens.login.apiResetMessage"),
        icon: "restore",
        tone: "info",
      },
      { haptic: "success" },
    );
  }

  async function handleCheckApi() {
    try {
      setIsCheckingApi(true);
      const normalized = normalizeApiBaseUrl(apiBaseUrl);
      await saveApiBaseUrl(normalized);
      setApiBaseUrl(normalized);
      const result = await probeApiConnection();
      await pushToast(
        {
          title: t("screens.login.connectionWorks"),
          description: `${result.service} | ${t("screens.login.connectionStatus", { status: result.status })}`,
          icon: "cloud-check-outline",
          tone: "success",
        },
        { haptic: "success" },
      );
    } catch (error) {
      await pushToast({
        title: t("screens.login.connectionFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "cloud-alert-outline",
        tone: "warning",
      });
    } finally {
      setIsCheckingApi(false);
    }
  }

  async function openBrowserSocialFlow(providerId: "google" | "vk", loginUrl: string) {
    const authResult = await WebBrowser.openAuthSessionAsync(loginUrl, `${SOCIAL_AUTH_REDIRECT_SCHEME}://auth/${providerId}`);
    if (authResult.type === "success" && authResult.url) {
      await completeSocialRedirectUrl(authResult.url);
      return;
    }

    if (authResult.type !== "cancel" && authResult.type !== "dismiss") {
      throw new Error(providerId === "google" ? t("screens.login.quick.googleFailed") : t("errors.unknownError"));
    }
  }

  async function handleSocialLogin(providerId: "google" | "telegram" | "vk") {
    const provider = providerList.find((entry) => entry.id === providerId);

    try {
      setActiveSocialProviderId(providerId);
      if (providerId === "google") {
        if (provider?.browser_login_path) {
          setIsSocialLoading(true);
          await openBrowserSocialFlow(providerId, `${normalizeApiBaseUrl(apiBaseUrl)}${provider.browser_login_path}`);
          return;
        }

        if (!googleClientId) {
          await pushToast({
            title: t("screens.login.quick.googleTitle"),
            description: t("screens.login.quick.googleClientMissing"),
            icon: "alert-circle",
            tone: "warning",
          });
          return;
        }

        if (!googleRequest) {
          await pushToast({
            title: t("screens.login.quick.googleTitle"),
            description: t("screens.login.quick.googleNotReady"),
            icon: "alert-circle",
            tone: "warning",
          });
          return;
        }

        setIsSocialLoading(true);
        const result = await promptGoogleAuth().catch((error) => {
          setIsSocialLoading(false);
          setActiveSocialProviderId(null);
          throw error;
        });
        if (result.type !== "success") {
          setIsSocialLoading(false);
          setActiveSocialProviderId(null);
          if (result.type !== "dismiss" && result.type !== "cancel") {
            await pushToast({
              title: t("screens.login.quick.googleTitle"),
              description: t("screens.login.quick.googleFailed"),
              icon: "alert-circle",
              tone: "warning",
            });
          }
        }
        return;
      }

      if (providerId === "telegram") {
        const botUsername = provider?.mobile_client_id;
        if (botUsername) {
          const telegramLoginUrl = `${normalizeApiBaseUrl(apiBaseUrl)}/auth/telegram/login`;
          await Linking.openURL(telegramLoginUrl);
          await pushToast(
            {
              title: t("screens.login.quick.telegramTitle"),
              description: t("screens.login.quick.telegramOpened"),
              icon: "send-circle-outline",
              tone: "info",
            },
            { haptic: "success" },
          );
          return;
        }
      }

      if (providerId === "vk") {
        const vkLoginPath = provider?.browser_login_path || "/auth/vk/login";
        if (provider?.mobile_client_id || provider?.browser_login_path) {
          setIsSocialLoading(true);
          await openBrowserSocialFlow(providerId, `${normalizeApiBaseUrl(apiBaseUrl)}${vkLoginPath}`);
          return;
        }
      }

      setIsSocialLoading(true);
      await signInWithProvider(providerId);
    } catch (error) {
      await pushToast({
        title: t("screens.login.quick.socialLoginTitle"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      if (providerId !== "google") {
        setIsSocialLoading(false);
      }
      setActiveSocialProviderId(null);
    }
  }

  return (
    <Screen title={t("screens.login.title")} subtitle={t("screens.login.subtitle")}>
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
          <Text style={styles.cardTitle}>{t("screens.login.accountLogin")}</Text>
          <Text style={styles.hint}>{t("screens.login.quick.accountHint")}</Text>
          <TextInput
            placeholder={t("screens.login.emailPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            placeholder={t("screens.login.passwordPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={[styles.primaryButton, isSigningIn ? styles.buttonDisabled : null]} onPress={handleLogin} activeOpacity={0.85} disabled={isSigningIn}>
            <Text style={styles.primaryText}>{isSigningIn ? t("common.loading") : t("screens.login.login")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={onShowRegister} activeOpacity={0.85}>
            <Text style={styles.link}>{t("screens.login.noAccount")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("screens.login.quick.socialSectionTitle")}</Text>
          <Text style={styles.hint}>{t("screens.login.quick.socialSectionHint")}</Text>
          <View style={styles.socialColumn}>
            {providerList.map((provider) => {
              const isReady = provider.enabled && provider.configured;
              const isProviderActionable =
                provider.id !== "google" || Boolean(provider.browser_login_path || (googleClientId && googleRequest));
              const metaText = isReady
                ? provider.id === "telegram"
                  ? t("screens.login.quick.provider.telegramReady")
                  : t("screens.login.quick.provider.configured")
                : provider.id === "telegram"
                  ? t("screens.login.quick.provider.telegramPending")
                  : t("screens.login.quick.provider.pending");

              return (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.socialButton,
                    isReady ? styles.socialButtonReady : styles.socialButtonPending,
                  ]}
                  activeOpacity={0.85}
                  disabled={!isReady || !isProviderActionable || isSocialLoading}
                  onPress={() => handleSocialLogin(provider.id)}
                >
                  <View style={styles.socialButtonCopy}>
                    <Text style={styles.socialButtonTitle}>{t("screens.login.quick.continueWith", { provider: provider.label })}</Text>
                    <Text style={styles.socialButtonMeta}>{metaText}</Text>
                  </View>
                  <Text style={[styles.socialStatus, isReady ? styles.socialStatusReady : styles.socialStatusPending]}>
                    {activeSocialProviderId === provider.id && isSocialLoading
                      ? t("common.loading")
                      : isReady
                        ? t("screens.login.quick.ready")
                        : t("screens.login.quick.comingSoon")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.apiCard}>
          <View style={styles.apiHeaderRow}>
            <View style={styles.apiHeaderCopy}>
              <Text style={styles.apiLabel}>{t("screens.login.apiConnection")}</Text>
              <Text style={styles.apiValue}>{normalizeApiBaseUrl(apiBaseUrl)}</Text>
            </View>
            <TouchableOpacity style={styles.apiToggleButton} onPress={() => setShowApiTools((value) => !value)} activeOpacity={0.85}>
              <Text style={styles.apiToggleText}>{showApiTools ? t("screens.login.quick.hide") : t("screens.login.quick.configure")}</Text>
            </TouchableOpacity>
          </View>

          {showApiTools ? (
            <View style={styles.apiTools}>
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
          ) : null}
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
    apiCard: {
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.8)" : "rgba(10,14,24,0.72)",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 12,
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
      flexWrap: "wrap",
    },
    apiHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    apiHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    apiLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    apiValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    apiToggleButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.backgroundInset,
    },
    apiToggleText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    apiTools: {
      gap: 12,
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
    buttonDisabled: {
      opacity: 0.6,
    },
    primaryText: {
      color: "#052e16",
      fontWeight: "800",
      fontSize: 16,
    },
    secondaryButton: {
      flex: 1,
      minWidth: 110,
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
