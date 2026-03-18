import { getApiBaseUrl } from "../config/env";
import { translateStored } from "../locales";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../storage/tokenStorage";

type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T;
  message: string;
};

type RequestOptions = RequestInit & {
  authenticated?: boolean;
};

type HealthPayload = {
  service: string;
  status: string;
};

const REQUEST_TIMEOUT_MS = 15_000;
let refreshPromise: Promise<boolean> | null = null;

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const apiBaseUrl = await getApiBaseUrl();
      const response = await fetchWithTimeout(`${apiBaseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        return false;
      }

      const payload = (await response.json()) as ApiEnvelope<{
        tokens: {
          access_token: string;
          refresh_token: string;
        };
      }>;

      await saveTokens(payload.data.tokens.access_token, payload.data.tokens.refresh_token);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function requestWithBase<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, headers, ...rest } = options;
  const accessToken = authenticated ? await getAccessToken() : null;
  let response: Response;

  try {
    response = await fetchWithTimeout(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(await translateStored("errors.api.networkUnavailable", { url: baseUrl }));
    }
    throw new Error(await translateStored("errors.api.networkUnavailable", { url: baseUrl }));
  }

  if (response.status === 401 && authenticated && baseUrl.endsWith("/api/v1")) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return requestWithBase(baseUrl, path, options);
    }
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(await translateStored("errors.api.invalidServerResponse", { status: response.status }));
  }

  if (!response.ok || (payload.status && payload.status !== "success")) {
    throw new Error(payload.message || (await translateStored("errors.api.requestFailed")));
  }

  return (payload.data ?? payload) as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl();
  return requestWithBase(apiBaseUrl, path, options);
}

export async function apiRootRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl();
  const serverBaseUrl = apiBaseUrl.replace(/\/api\/v1$/, "");
  return requestWithBase(serverBaseUrl, path, options);
}

export function probeApiConnection() {
  return apiRequest<HealthPayload>("", { authenticated: false, method: "GET" });
}
