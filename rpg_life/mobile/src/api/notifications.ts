import { apiRequest } from "./client";

import { clearStoredPushToken, getStoredPushToken } from "../storage/pushTokenStorage";

type RegisterPushDevicePayload = {
  push_token: string;
  platform: "ios" | "android" | "unknown";
  device_name?: string;
  app_version?: string;
};

export function registerPushDevice(payload: RegisterPushDevicePayload) {
  return apiRequest<{
    ok: boolean;
    device: {
      id: number;
      platform: string;
      token_preview: string;
      is_active: boolean;
      last_seen_at: string;
    };
  }>("/notifications/devices/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function unregisterPushDevice(pushToken: string) {
  return apiRequest<{ ok: boolean; removed: boolean }>("/notifications/devices/unregister", {
    method: "POST",
    body: JSON.stringify({ push_token: pushToken }),
  });
}

export async function unregisterStoredPushDevice() {
  const pushToken = await getStoredPushToken();
  if (!pushToken) {
    return;
  }

  try {
    await unregisterPushDevice(pushToken);
  } finally {
    await clearStoredPushToken();
  }
}
