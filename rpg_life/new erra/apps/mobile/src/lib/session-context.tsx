import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { isDemoMode } from "./api-config";
import {
  changeDemoPassword,
  completeDemoQuest,
  getCurrentSession,
  type AppSession,
  loginDemoSession,
  logoutDemoSession,
  requestDemoPasswordReset,
  registerDemoSession,
  type RegisterFormPayload,
  updateDemoPreferences,
  updateDemoProfile
} from "./demo-api";
import {
  changeLivePassword,
  completeLiveQuest,
  getLiveCurrentSession,
  loginLiveSession,
  logoutLiveSession,
  requestLivePasswordReset,
  registerLiveSession,
  updateLivePreferences,
  updateLiveProfile
} from "./live-api";

type SessionContextValue = {
  session: AppSession | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterFormPayload) => Promise<void>;
  signOut: () => Promise<void>;
  completeQuest: (questId: string) => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<AppSession, "currentWeightKg">> & {
      fullName?: string;
      goalWeightKg?: number;
    }
  ) => Promise<void>;
  updatePreferences: (patch: Partial<AppSession["preferences"]>) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string>;
  mode: "demo" | "live";
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AppSession | null>(null);

  useEffect(() => {
    const loader = isDemoMode ? getCurrentSession : getLiveCurrentSession;

    loader()
      .then((nextSession) => {
        setSession(nextSession);
      })
      .catch(() => {
        setSession(null);
      });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      mode: isDemoMode ? "demo" : "live",
      signIn: async (email, password) => {
        const nextSession = isDemoMode
          ? await loginDemoSession(email, password)
          : await loginLiveSession(email, password);
        setSession(nextSession);
      },
      signUp: async (payload) => {
        const nextSession = isDemoMode
          ? await registerDemoSession(payload)
          : await registerLiveSession(payload);
        setSession(nextSession);
      },
      signOut: async () => {
        if (isDemoMode) {
          await logoutDemoSession();
        } else {
          await logoutLiveSession();
        }
        setSession(null);
      },
      completeQuest: async (questId) => {
        const nextSession = isDemoMode
          ? await completeDemoQuest(questId)
          : await completeLiveQuest(questId);
        setSession(nextSession);
      },
      updateProfile: async (patch) => {
        const nextSession = isDemoMode
          ? await updateDemoProfile(patch)
          : await updateLiveProfile(patch);
        setSession(nextSession);
      },
      updatePreferences: async (patch) => {
        if (isDemoMode) {
          await updateDemoPreferences(patch);
          const nextSession = await getCurrentSession();
          setSession(nextSession);
          return;
        }

        await updateLivePreferences(patch);
        const nextSession = await getLiveCurrentSession();
        setSession(nextSession);
      },
      changePassword: async (currentPassword, nextPassword) => {
        if (isDemoMode) {
          await changeDemoPassword(currentPassword, nextPassword);
          return;
        }

        await changeLivePassword(currentPassword, nextPassword);
      },
      requestPasswordReset: async (email) => {
        const result = isDemoMode
          ? await requestDemoPasswordReset(email)
          : await requestLivePasswordReset(email);
        return result.message;
      }
    }),
    [session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession должен использоваться внутри SessionProvider");
  }
  return context;
}
