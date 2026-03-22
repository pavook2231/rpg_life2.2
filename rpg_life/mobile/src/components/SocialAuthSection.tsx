import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { type SocialAuthProvider } from "../api/auth";
import {
  getApiBaseUrl,
  GOOGLE_AUTH_ANDROID_CLIENT_ID,
  GOOGLE_AUTH_CLIENT_ID,
  GOOGLE_AUTH_IOS_CLIENT_ID,
  GOOGLE_AUTH_WEB_CLIENT_ID,
  SOCIAL_AUTH_REDIRECT_SCHEME,
} from "../config/env";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { useThemeColors, useThemeMode } from "../ui";

WebBrowser.maybeCompleteAuthSession();

type Props = {
  title: string;
  hint: string;
};

export function SocialAuthSection({ title, hint }: Props) {
  const {
    authFlowNotice,
    clearAuthFlowNotice,
    completeSocialRedirectUrl,
    reloadSocialProviders,
    signInWithProvider,
    socialProviders,
  } = useAuth();
  const t = useTranslation();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [activeSocialProviderId, setActiveSocialProviderId] = useState<SocialAuthProvider["id"] | null>(null);
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
  const googleRedirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: SOCIAL_AUTH_REDIRECT_SCHEME,
        path: "oauthredirect",
      }),
    []
  );
  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useIdTokenAuthRequest({
    androidClientId: googleAndroidClientId || undefined,
    iosClientId: googleIosClientId || undefined,
    webClientId: googleWebClientId || undefined,
    redirectUri: googleRedirectUri,
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
  });

  useEffect(() => {
    reloadSocialProviders().catch(() => undefined);
  }, [reloadSocialProviders]);

  useEffect(() => {
    if (!authFlowNotice) {
      return;
    }

    Alert.alert(title, authFlowNotice, [
      {
        text: t("screens.login.quick.ok"),
        onPress: clearAuthFlowNotice,
      },
    ]);
  }, [authFlowNotice, clearAuthFlowNotice, t, title]);

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
      setIsSocialLoading(false);
      setActiveSocialProviderId(null);
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
      setActiveSocialProviderId(null);
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
        setActiveSocialProviderId(null);
      });
  }, [googleResponse, pushToast, signInWithProvider, t]);

  async function openBrowserSocialFlow(providerId: "google" | "vk", loginUrl: string) {
    const authResult = await WebBrowser.openAuthSessionAsync(loginUrl, `${SOCIAL_AUTH_REDIRECT_SCHEME}://auth/${providerId}`);
    if (authResult.type === "success" && authResult.url) {
      const wasHandled = await completeSocialRedirectUrl(authResult.url);
      if (!wasHandled) {
        throw new Error(
          providerId === "google"
            ? t("screens.login.quick.googleFailed")
            : t("screens.login.quick.socialLoginTitle"),
        );
      }
      return;
    }

    if (authResult.type !== "cancel" && authResult.type !== "dismiss") {
      throw new Error(providerId === "google" ? t("screens.login.quick.googleFailed") : t("errors.unknownError"));
    }
  }

  async function handleSocialLogin(providerId: SocialAuthProvider["id"]) {
    const provider = providerList.find((entry) => entry.id === providerId);

    try {
      clearAuthFlowNotice();
      setActiveSocialProviderId(providerId);
      const resolvedApiBaseUrl = await getApiBaseUrl();

      if (providerId === "google") {
        if (provider?.browser_login_path) {
          setIsSocialLoading(true);
          await openBrowserSocialFlow(providerId, `${resolvedApiBaseUrl}${provider.browser_login_path}`);
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
        if (provider?.mobile_client_id) {
          await Linking.openURL(`${resolvedApiBaseUrl}/auth/telegram/login`);
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
          await openBrowserSocialFlow(providerId, `${resolvedApiBaseUrl}${vkLoginPath}`);
          return;
        }
        throw new Error("VK ID sign-in is not configured on the server yet.");
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
        setActiveSocialProviderId(null);
      }
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
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
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
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
      fontSize: 18,
      fontWeight: "800",
    },
    hint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    socialColumn: {
      gap: 10,
    },
    socialButton: {
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    socialButtonReady: {
      backgroundColor: colors.backgroundInset,
      borderColor: colors.borderSoft,
    },
    socialButtonPending: {
      backgroundColor: themeMode === "light" ? "#f8fafc" : "#0f172a",
      borderColor: colors.border,
    },
    socialButtonCopy: {
      flex: 1,
      gap: 4,
    },
    socialButtonTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    socialButtonMeta: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 16,
    },
    socialStatus: {
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    socialStatusReady: {
      color: colors.success,
    },
    socialStatusPending: {
      color: colors.textDim,
    },
  });
}
