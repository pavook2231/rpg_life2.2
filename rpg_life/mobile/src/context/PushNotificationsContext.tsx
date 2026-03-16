import Constants from "expo-constants";
import React, { ReactNode, useEffect } from "react";
import { Platform } from "react-native";

import { registerPushDevice, unregisterStoredPushDevice } from "../api/notifications";
import { savePushToken } from "../storage/pushTokenStorage";
import { useAppPreferences } from "./AppPreferencesContext";
import { useAuth } from "./AuthContext";
import { useFeedback } from "./FeedbackContext";

type NotificationTone = "info" | "success" | "reward" | "warning";
type NotificationsModule = typeof import("expo-notifications");

type NotificationData = {
  event_type?: string;
};

const isExpoGo = Constants.appOwnership === "expo";

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (isExpoGo) {
    return null;
  }

  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

function getProjectId() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    eas?: { projectId?: string };
    expoProjectId?: string;
  };
  return Constants.easConfig?.projectId ?? extra.eas?.projectId ?? extra.expoProjectId;
}

async function getExpoPushToken(notifications: NotificationsModule) {
  if (Platform.OS === "android") {
    await notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }

  const existingPermissions = await notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted") {
    const requestedPermissions = await notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = getProjectId();
  const tokenResponse = projectId
    ? await notifications.getExpoPushTokenAsync({ projectId })
    : await notifications.getExpoPushTokenAsync();

  return tokenResponse.data;
}

function resolveToastIcon(eventType?: string) {
  switch (eventType) {
    case "boss_victory":
      return "crown";
    case "friend_invitation":
      return "account-multiple";
    case "challenge_completed":
      return "sword-cross";
    case "daily_quests_available":
      return "scroll-text";
    default:
      return "sparkles";
  }
}

function resolveToastTone(eventType?: string): NotificationTone {
  switch (eventType) {
    case "boss_victory":
      return "reward";
    case "challenge_completed":
      return "success";
    case "friend_invitation":
      return "info";
    case "daily_quests_available":
      return "info";
    default:
      return "info";
  }
}

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { pushToast } = useFeedback();
  const { notificationsEnabled } = useAppPreferences();

  useEffect(() => {
    let cancelled = false;
    let removeSubscription: (() => void) | null = null;

    async function setupNotificationsListener() {
      const notifications = await loadNotificationsModule();
      if (!notifications || cancelled) {
        return;
      }

      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      const subscription = notifications.addNotificationReceivedListener((notification) => {
        const content = notification.request.content;
        const title = content.title ?? "RPG Life";
        const description = typeof content.body === "string" ? content.body : undefined;
        const data = (content.data as NotificationData | undefined) ?? undefined;

        pushToast({
          title,
          description,
          icon: resolveToastIcon(data?.event_type),
          tone: resolveToastTone(data?.event_type),
        });
      });
      removeSubscription = () => subscription.remove();
    }

    void setupNotificationsListener();

    return () => {
      cancelled = true;
      removeSubscription?.();
    };
  }, [pushToast]);

  useEffect(() => {
    if (!notificationsEnabled) {
      unregisterStoredPushDevice().catch(() => undefined);
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (isLoading || !user || !notificationsEnabled || isExpoGo) {
      return;
    }

    let cancelled = false;

    async function syncPushRegistration() {
      try {
        const notifications = await loadNotificationsModule();
        if (!notifications || cancelled) {
          return;
        }

        const pushToken = await getExpoPushToken(notifications);
        if (!pushToken || cancelled) {
          return;
        }

        await registerPushDevice({
          push_token: pushToken,
          platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
          app_version: Constants.expoConfig?.version,
        });

        if (!cancelled) {
          await savePushToken(pushToken);
        }
      } catch {
        // Keep notification registration best-effort to avoid blocking auth flows.
      }
    }

    void syncPushRegistration();

    return () => {
      cancelled = true;
    };
  }, [isLoading, notificationsEnabled, user]);

  return <>{children}</>;
}
