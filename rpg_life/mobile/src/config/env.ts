import Constants from "expo-constants";

import { getStoredApiBaseUrl } from "../storage/appConfigStorage";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  allowCustomApiOverride?: boolean;
  requireHttps?: boolean;
  enableAccountRecovery?: boolean;
  googleAuthClientId?: string;
  socialAuthRedirectScheme?: string;
};

export const DEFAULT_API_BASE_URL = extra.apiBaseUrl ?? "http://127.0.0.1:8000/api/v1";
export const ALLOW_CUSTOM_API_OVERRIDE = extra.allowCustomApiOverride ?? true;
export const REQUIRE_HTTPS = extra.requireHttps ?? false;
export const ENABLE_ACCOUNT_RECOVERY = extra.enableAccountRecovery ?? false;
export const GOOGLE_AUTH_CLIENT_ID = extra.googleAuthClientId ?? "";
export const SOCIAL_AUTH_REDIRECT_SCHEME = extra.socialAuthRedirectScheme ?? "rpglife";

export function normalizeApiBaseUrl(value: string) {
  let trimmed = value.trim().replace(/\/+$/, "");
  if (REQUIRE_HTTPS && trimmed.startsWith("http://")) {
    trimmed = `https://${trimmed.slice("http://".length)}`;
  }
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  if (trimmed.endsWith("/api/v1")) {
    return trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return `${trimmed}/v1`;
  }
  return `${trimmed}/api/v1`;
}

export async function getApiBaseUrl() {
  if (!ALLOW_CUSTOM_API_OVERRIDE) {
    return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  }
  const storedValue = await getStoredApiBaseUrl();
  return normalizeApiBaseUrl(storedValue || DEFAULT_API_BASE_URL);
}
