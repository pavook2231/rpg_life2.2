import Constants from "expo-constants";

import { clearApiBaseUrl, getStoredApiBaseUrl, saveApiBaseUrl } from "../storage/appConfigStorage";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  allowCustomApiOverride?: boolean;
  requireHttps?: boolean;
  enableAccountRecovery?: boolean;
  googleAuthClientId?: string;
  googleAuthAndroidClientId?: string;
  googleAuthIosClientId?: string;
  googleAuthWebClientId?: string;
  socialAuthRedirectScheme?: string;
};

const IS_DEV_BUILD = typeof __DEV__ !== "undefined" ? __DEV__ : false;
const API_PATH_SUFFIX = "/api/v1";

export const ALLOW_CUSTOM_API_OVERRIDE = extra.allowCustomApiOverride ?? IS_DEV_BUILD;
export const REQUIRE_HTTPS = extra.requireHttps ?? !IS_DEV_BUILD;
export const ENABLE_ACCOUNT_RECOVERY = extra.enableAccountRecovery ?? false;
export const GOOGLE_AUTH_CLIENT_ID = extra.googleAuthClientId ?? "";
export const GOOGLE_AUTH_ANDROID_CLIENT_ID = extra.googleAuthAndroidClientId ?? "";
export const GOOGLE_AUTH_IOS_CLIENT_ID = extra.googleAuthIosClientId ?? "";
export const GOOGLE_AUTH_WEB_CLIENT_ID = extra.googleAuthWebClientId ?? GOOGLE_AUTH_CLIENT_ID;
export const SOCIAL_AUTH_REDIRECT_SCHEME = extra.socialAuthRedirectScheme ?? "rpglife";
const PUBLIC_BETA_API_BASE_URL = "https://rpglife.online/api/v1";

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

const configuredApiBaseUrl = typeof extra.apiBaseUrl === "string" && extra.apiBaseUrl.trim() ? extra.apiBaseUrl : null;

function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function correctCommonApiTypos(value: string) {
  const trimmed = trimTrailingSlashes(value);
  const dottedApiSuffixMatch = trimmed.match(/^([a-z0-9.-]+)\.api\.v1$/i);
  if (dottedApiSuffixMatch) {
    return `${dottedApiSuffixMatch[1]}${API_PATH_SUFFIX}`;
  }
  return trimmed;
}

function normalizeApiBaseUrlOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let normalizedValue = correctCommonApiTypos(value);
  if (!normalizedValue) {
    return null;
  }

  if (!/^[a-z]+:\/\//i.test(normalizedValue)) {
    const host = extractHost(normalizedValue);
    const protocol = host && isPrivateHost(host) ? "http://" : "https://";
    normalizedValue = `${protocol}${normalizedValue.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(normalizedValue);
  } catch {
    return null;
  }

  if (!url.hostname || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return null;
  }

  if (url.hostname.toLowerCase().endsWith(".api.v1") && (!url.pathname || url.pathname === "/")) {
    url.hostname = url.hostname.slice(0, -".api.v1".length);
    url.pathname = API_PATH_SUFFIX;
  }

  if (REQUIRE_HTTPS && !isPrivateHost(url.hostname) && url.protocol === "http:") {
    url.protocol = "https:";
  }

  url.search = "";
  url.hash = "";

  const pathname = trimTrailingSlashes(url.pathname || "");
  if (!pathname || pathname === "/") {
    url.pathname = API_PATH_SUFFIX;
  } else if (pathname === "/api") {
    url.pathname = API_PATH_SUFFIX;
  } else if (pathname !== API_PATH_SUFFIX) {
    url.pathname = `${pathname}${API_PATH_SUFFIX}`;
  }

  return url.toString().replace(/\/$/, "");
}

export const DEFAULT_API_BASE_URL =
  normalizeApiBaseUrlOrNull(getRuntimeDevApiBaseUrl() ?? configuredApiBaseUrl ?? PUBLIC_BETA_API_BASE_URL) ??
  PUBLIC_BETA_API_BASE_URL;

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
  return normalizeApiBaseUrlOrNull(value) ?? DEFAULT_API_BASE_URL;
}

export function tryNormalizeApiBaseUrl(value: string) {
  return normalizeApiBaseUrlOrNull(value);
}

export async function getApiBaseUrl() {
  const runtimeDevApiBaseUrl = getRuntimeDevApiBaseUrl();

  if (runtimeDevApiBaseUrl) {
    return normalizeApiBaseUrl(runtimeDevApiBaseUrl);
  }

  if (!ALLOW_CUSTOM_API_OVERRIDE) {
    const storedValue = await getStoredApiBaseUrl();
    if (storedValue) {
      await clearApiBaseUrl();
    }
    return DEFAULT_API_BASE_URL;
  }

  const storedValue = await getStoredApiBaseUrl();
  if (isDeprecatedLocalApiBaseUrl(storedValue)) {
    await clearApiBaseUrl();
    return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  }

  const normalizedStoredValue = normalizeApiBaseUrlOrNull(storedValue);
  if (!storedValue || !normalizedStoredValue) {
    if (storedValue) {
      await clearApiBaseUrl();
    }
    return DEFAULT_API_BASE_URL;
  }

  if (normalizedStoredValue !== trimTrailingSlashes(storedValue)) {
    await saveApiBaseUrl(normalizedStoredValue);
  }

  return normalizedStoredValue;
}
