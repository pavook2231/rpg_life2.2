import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";

import { getSocialAuthProviders, login, register, socialLogin, type SocialAuthProvider } from "../api/auth";
import { fetchProfile } from "../api/game";
import { unregisterStoredPushDevice } from "../api/notifications";
import { SOCIAL_AUTH_REDIRECT_SCHEME } from "../config/env";
import { markGoalSetupPending } from "../storage/beginnerOnboardingStorage";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../storage/tokenStorage";

type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  username?: string | null;
  friend_id?: string | null;
};

type RegisterInput = {
  email: string;
  password: string;
  name: string;
  username?: string;
  birthYear?: number;
  gender?: string;
  characterClass?: string;
  goalType?: string;
  goalTermMonths?: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  socialProviders: SocialAuthProvider[];
  authFlowNotice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<AuthUser>;
  signInWithProvider: (
    provider: SocialAuthProvider["id"],
    payload?: {
      id_token?: string;
      access_token?: string;
      authorization_code?: string;
      init_data?: string;
      bridge_ticket?: string;
    },
  ) => Promise<void>;
  reloadSocialProviders: () => Promise<void>;
  completeSocialRedirectUrl: (url: string) => Promise<boolean>;
  clearAuthFlowNotice: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getProviderFromRoute(route: string): SocialAuthProvider["id"] | null {
  switch (route) {
    case "auth/google":
      return "google";
    case "auth/telegram":
      return "telegram";
    case "auth/vk":
      return "vk";
    default:
      return null;
  }
}

function getProviderLabel(provider: SocialAuthProvider["id"]): string {
  switch (provider) {
    case "google":
      return "Google";
    case "telegram":
      return "Telegram";
    case "vk":
      return "VK ID";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socialProviders, setSocialProviders] = useState<SocialAuthProvider[]>([]);
  const [authFlowNotice, setAuthFlowNotice] = useState<string | null>(null);
  const lastHandledSocialUrlRef = useRef<string | null>(null);

  async function applyAuthPayload(authPayload: Awaited<ReturnType<typeof login>>) {
    await saveTokens(authPayload.tokens.access_token, authPayload.tokens.refresh_token);
    if (authPayload.needs_goal_setup) {
      await markGoalSetupPending(authPayload.user.id);
    }
    setAuthFlowNotice(null);
    setUser(authPayload.user);
  }

  async function completeSocialSignInFromUrl(url: string): Promise<boolean> {
    if (!url.toLowerCase().startsWith(`${SOCIAL_AUTH_REDIRECT_SCHEME.toLowerCase()}://`)) {
      return false;
    }

    const shouldDeduplicate = url.includes("ticket=") || url.includes("init_data=");
    if (shouldDeduplicate && lastHandledSocialUrlRef.current === url) {
      return true;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    const route = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "").toLowerCase();
    const provider = getProviderFromRoute(route);
    if (!provider) {
      return false;
    }

    if (shouldDeduplicate) {
      lastHandledSocialUrlRef.current = url;
    }

    const errorMessage = parsed.searchParams.get("error");
    if (errorMessage) {
      setAuthFlowNotice(`${getProviderLabel(provider)}: ${errorMessage}`);
      return true;
    }

    try {
      const authPayload =
        provider === "telegram"
          ? await socialLogin({ provider, init_data: parsed.searchParams.get("init_data") || undefined })
          : await socialLogin({ provider, bridge_ticket: parsed.searchParams.get("ticket") || undefined });
      await applyAuthPayload(authPayload);
    } catch (error) {
      if (error instanceof Error) {
        setAuthFlowNotice(error.message);
      } else if (provider === "telegram") {
        setAuthFlowNotice("Could not finish Telegram sign-in.");
      } else if (provider === "vk") {
        setAuthFlowNotice("Could not finish VK ID sign-in.");
      } else {
        setAuthFlowNotice("Could not finish Google sign-in.");
      }
    }

    return true;
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
          setAuthFlowNotice(null);
          setUser({
            id: profile.user.id,
            email: profile.user.email,
            name: profile.user.name,
            username: profile.user.username ?? null,
            friend_id: profile.user.friend_id ?? null,
          });
        }
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          return completeSocialSignInFromUrl(url);
        }
        return undefined;
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeSocialSignInFromUrl(url);
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
        await applyAuthPayload(payload);
      },
      signUp: async (input) => {
        const payload = await register({
          email: input.email,
          password: input.password,
          name: input.name,
          username: input.username,
          birth_year: input.birthYear,
          gender: input.gender,
          character_class: input.characterClass,
          goal_type: input.goalType,
          goal_term_months: input.goalTermMonths,
        });
        await applyAuthPayload(payload);
        return payload.user;
      },
      signInWithProvider: async (provider, providerPayload = {}) => {
        const authPayload = await socialLogin({ provider, ...providerPayload });
        await applyAuthPayload(authPayload);
      },
      reloadSocialProviders: async () => {
        const payload = await getSocialAuthProviders();
        setSocialProviders(payload.providers);
      },
      completeSocialRedirectUrl: completeSocialSignInFromUrl,
      clearAuthFlowNotice: () => {
        setAuthFlowNotice(null);
      },
      signOut: async () => {
        try {
          await unregisterStoredPushDevice();
        } catch {
          // Best-effort cleanup; auth state should still be cleared locally.
        }
        lastHandledSocialUrlRef.current = null;
        setAuthFlowNotice(null);
        await clearTokens();
        setUser(null);
      },
    }),
    [authFlowNotice, isLoading, socialProviders, user]
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
