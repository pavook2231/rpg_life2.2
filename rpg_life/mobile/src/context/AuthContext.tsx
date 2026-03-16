import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";

import { getSocialAuthProviders, login, register, socialLogin, type SocialAuthProvider } from "../api/auth";
import { unregisterStoredPushDevice } from "../api/notifications";
import { fetchProfile } from "../api/game";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../storage/tokenStorage";

type AuthUser = {
  id: number;
  email: string;
  name: string | null;
};

type RegisterInput = {
  email: string;
  password: string;
  name: string;
  birthYear: number;
  gender: string;
  characterClass: string;
  goalType: string;
  goalTermMonths: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  socialProviders: SocialAuthProvider[];
  authFlowNotice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signInWithProvider: (
    provider: SocialAuthProvider["id"],
    payload?: {
      id_token?: string;
      access_token?: string;
      authorization_code?: string;
      init_data?: string;
    },
  ) => Promise<void>;
  reloadSocialProviders: () => Promise<void>;
  clearAuthFlowNotice: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socialProviders, setSocialProviders] = useState<SocialAuthProvider[]>([]);
  const [authFlowNotice, setAuthFlowNotice] = useState<string | null>(null);

  async function completeTelegramSignInFromUrl(url: string) {
    if (!url.toLowerCase().startsWith("rpglife://")) {
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }

    const route = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "").toLowerCase();
    if (route !== "auth/telegram") {
      return;
    }

    const initData = parsed.searchParams.get("init_data");
    const errorMessage = parsed.searchParams.get("error");

    if (errorMessage) {
      setAuthFlowNotice(`Telegram: ${errorMessage}`);
      return;
    }

    if (!initData) {
      setAuthFlowNotice("Telegram: не получили данные авторизации.");
      return;
    }

    try {
      const authPayload = await socialLogin({ provider: "telegram", init_data: initData });
      await saveTokens(authPayload.tokens.access_token, authPayload.tokens.refresh_token);
      setUser(authPayload.user);
      setAuthFlowNotice("Telegram вход выполнен.");
    } catch (error) {
      setAuthFlowNotice(error instanceof Error ? error.message : "Не удалось завершить Telegram вход.");
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const providerPayload = await getSocialAuthProviders().catch(() => ({ providers: [] as SocialAuthProvider[] }));
        setSocialProviders(providerPayload.providers);
        const accessToken = await getAccessToken();
        const refreshToken = await getRefreshToken();
        if (accessToken && refreshToken) {
          const profile = await fetchProfile();
          setUser({
            id: profile.user.id,
            email: profile.user.email,
            name: profile.user.name
          });
        }
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          return completeTelegramSignInFromUrl(url);
        }
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeTelegramSignInFromUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      socialProviders,
      authFlowNotice,
      signIn: async (email, password) => {
        const payload = await login(email, password);
        await saveTokens(payload.tokens.access_token, payload.tokens.refresh_token);
        setUser(payload.user);
      },
      signUp: async (input) => {
        const payload = await register({
          email: input.email,
          password: input.password,
          name: input.name,
          birth_year: input.birthYear,
          gender: input.gender,
          character_class: input.characterClass,
          goal_type: input.goalType,
          goal_term_months: input.goalTermMonths,
        });
        await saveTokens(payload.tokens.access_token, payload.tokens.refresh_token);
        setUser(payload.user);
      },
      signInWithProvider: async (provider, providerPayload = {}) => {
        const authPayload = await socialLogin({ provider, ...providerPayload });
        await saveTokens(authPayload.tokens.access_token, authPayload.tokens.refresh_token);
        setUser(authPayload.user);
      },
      reloadSocialProviders: async () => {
        const payload = await getSocialAuthProviders();
        setSocialProviders(payload.providers);
      },
      clearAuthFlowNotice: () => {
        setAuthFlowNotice(null);
      },
      signOut: async () => {
        try {
          await unregisterStoredPushDevice();
        } catch {
          // Best-effort cleanup; auth state should still be cleared locally.
        }
        await clearTokens();
        setUser(null);
      }
    }),
    [authFlowNotice, socialProviders, user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
