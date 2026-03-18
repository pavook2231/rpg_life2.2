import React, { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { probeConnection, syncPendingActions } from "../lib/offline";
import { getPendingActions } from "../storage/pendingActionStorage";
import { useAuth } from "./AuthContext";
import { useFeedback } from "./FeedbackContext";
import { useTranslation } from "./LocalizationContext";

type OfflineContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActionsCount: number;
  refreshOfflineState: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pushToast } = useFeedback();
  const t = useTranslation();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);

  const refreshOfflineState = useCallback(async () => {
    const [online, pendingActions] = await Promise.all([probeConnection(), getPendingActions()]);
    setPendingActionsCount(pendingActions.length);

    const cameBackOnline = !isOnline && online;
    setIsOnline(online);

    if (cameBackOnline && pendingActions.length > 0) {
      setIsSyncing(true);
      const results = await syncPendingActions();
      const remainingActions = await getPendingActions();
      setPendingActionsCount(remainingActions.length);
      setIsSyncing(false);
      const syncedCount = results.filter((item) => item.ok).length;
      const failedCount = results.filter((item) => !item.ok).length;

      if (syncedCount > 0) {
        void pushToast({
          title: t("offline.syncCompleteTitle"),
          description:
            remainingActions.length > 0 || failedCount > 0
              ? `${t("offline.syncCompleteDescription", { count: syncedCount })} ${t("screens.settings.pendingActions", { count: remainingActions.length })}`
              : t("offline.syncCompleteDescription", { count: syncedCount }),
          icon: "sync",
          tone: remainingActions.length > 0 || failedCount > 0 ? "info" : "success",
        });
      }
    }
  }, [isOnline, pushToast, t]);

  useEffect(() => {
    if (!user) {
      setIsOnline(true);
      setPendingActionsCount(0);
      return;
    }

    void refreshOfflineState();
    const interval = setInterval(() => {
      void refreshOfflineState();
    }, 15000);

    return () => clearInterval(interval);
  }, [refreshOfflineState, user]);

  const value = useMemo(
    () => ({
      isOnline,
      isSyncing,
      pendingActionsCount,
      refreshOfflineState,
    }),
    [isOnline, isSyncing, pendingActionsCount, refreshOfflineState],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used inside OfflineProvider");
  }
  return context;
}
