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

export const ALLOW_CUSTOM_API_OVERRIDE = extra.allowCustomApiOverride ?? true;
export const REQUIRE_HTTPS = extra.requireHttps ?? false;
export const ENABLE_ACCOUNT_RECOVERY = extra.enableAccountRecovery ?? false;
export const GOOGLE_AUTH_CLIENT_ID = extra.googleAuthClientId ?? "";
export const SOCIAL_AUTH_REDIRECT_SCHEME = extra.socialAuthRedirectScheme ?? "rpglife";

function isPrivateHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "10.0.2.2" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function extractHost(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    return new URL(withProtocol).hostname || null;
  } catch {
    return null;
  }
}

function getExpoRuntimeHost() {
  return (
    extractHost(Constants.expoConfig?.hostUri) ||
    extractHost(Constants.platform?.hostUri) ||
    extractHost(Constants.expoGoConfig?.debuggerHost) ||
    extractHost(Constants.linkingUri) ||
    extractHost(Constants.experienceUrl)
  );
}

function getRuntimeDevApiBaseUrl() {
  const host = getExpoRuntimeHost();
  if (!host || !isPrivateHost(host)) {
    return null;
  }
  return `http://${host}:8000/api/v1`;
}

export const DEFAULT_API_BASE_URL = getRuntimeDevApiBaseUrl() ?? extra.apiBaseUrl ?? "https://six-moose-push.loca.lt/api/v1";

export function isDeprecatedLocalApiBaseUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const normalized = normalizeApiBaseUrl(value);
    const url = new URL(normalized);
    const defaultUrl = new URL(normalizeApiBaseUrl(DEFAULT_API_BASE_URL));
    return isPrivateHost(url.hostname) && !isPrivateHost(defaultUrl.hostname);
  } catch {
    return false;
  }
}

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
  const runtimeDevApiBaseUrl = getRuntimeDevApiBaseUrl();

  if (!ALLOW_CUSTOM_API_OVERRIDE) {
    return normalizeApiBaseUrl(runtimeDevApiBaseUrl || DEFAULT_API_BASE_URL);
  }
  const storedValue = await getStoredApiBaseUrl();
  if (runtimeDevApiBaseUrl) {
    return normalizeApiBaseUrl(runtimeDevApiBaseUrl);
  }
  if (isDeprecatedLocalApiBaseUrl(storedValue)) {
    return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  }
  return normalizeApiBaseUrl(storedValue || DEFAULT_API_BASE_URL);
}
