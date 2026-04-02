import type { WeightLossQuestionnaire } from "@new-erra/shared";

import { API_BASE_URL } from "./api-config";
import type { AppPreferences, AppSession, RegisterFormPayload } from "./demo-api";

type ApiEnvelope<T> = {
  message?: string;
  data: T;
};

type AuthResponseData = {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  accessToken: string;
};

type ProfileResponse = {
  id: string;
  email: string;
  fullName: string;
  currentWeight: number;
  goalWeight: number;
  streakDays: number;
  totalXp: number;
  language: "ru" | "en";
  theme: "system" | "light" | "dark";
  profile: {
    age: number;
    gender: "male" | "female" | "other";
    heightCm: number;
    weightKg: number;
    activityLevel: "low" | "light" | "moderate" | "high";
    eatingPattern: "balanced" | "emotional" | "late_snacking" | "irregular";
    sleepQuality: "poor" | "average" | "good";
    goalWeightKg: number;
  } | null;
};

type QuestPayload = {
  questDay: number;
  quests: AppSession["quests"];
};

type SettingsPayload = {
  language: "ru" | "en";
  theme: "system" | "light" | "dark";
};

let accessToken: string | null = null;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("API не настроен. Добавь EXPO_PUBLIC_API_BASE_URL для живого режима.");
  }
  return API_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const baseUrl = assertApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => ({ data: {} }))) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(payload.message || "Сервер временно недоступен.");
  }

  return payload;
}

function toQuestionnaire(profile: NonNullable<ProfileResponse["profile"]>): WeightLossQuestionnaire {
  return {
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    eatingPattern: profile.eatingPattern,
    sleepQuality: profile.sleepQuality,
    goalWeightKg: profile.goalWeightKg
  };
}

function toSession(
  profile: ProfileResponse,
  questPayload: QuestPayload,
  settings: SettingsPayload
): AppSession {
  if (!profile.profile) {
    throw new Error("Профиль пользователя пока не заполнен.");
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName
    },
    questionnaire: toQuestionnaire(profile.profile),
    quests: questPayload.quests,
    programDay: questPayload.questDay,
    streakDays: profile.streakDays,
    totalXp: profile.totalXp,
    currentWeightKg: profile.currentWeight,
    preferences: {
      language: settings.language,
      theme: settings.theme
    }
  };
}

async function loadLiveSession(): Promise<AppSession> {
  const profileResponse = await request<ProfileResponse>("/profile");
  const questsResponse = await request<QuestPayload>("/quests/daily");
  const settingsResponse = await request<SettingsPayload>("/settings");

  return toSession(profileResponse.data, questsResponse.data, settingsResponse.data);
}

export async function registerLiveSession(payload: RegisterFormPayload) {
  const response = await request<AuthResponseData>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  accessToken = response.data.accessToken;
  return loadLiveSession();
}

export async function loginLiveSession(email: string, password: string) {
  const response = await request<AuthResponseData>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  accessToken = response.data.accessToken;
  return loadLiveSession();
}

export async function logoutLiveSession() {
  if (accessToken) {
    await request("/auth/logout", {
      method: "POST"
    }).catch(() => undefined);
  }

  accessToken = null;
  return true;
}

export async function getLiveCurrentSession() {
  if (!accessToken) {
    return null;
  }

  return loadLiveSession();
}

export async function completeLiveQuest(questId: string) {
  await request("/quests/complete", {
    method: "POST",
    body: JSON.stringify({ questId })
  });

  return loadLiveSession();
}

export async function updateLiveProfile(
  patch: Partial<Pick<AppSession, "currentWeightKg">> & { fullName?: string; goalWeightKg?: number }
) {
  await request("/profile", {
    method: "PATCH",
    body: JSON.stringify({
      fullName: patch.fullName,
      currentWeight: patch.currentWeightKg,
      goalWeight: patch.goalWeightKg
    })
  });

  return loadLiveSession();
}

export async function updateLivePreferences(preferences: Partial<AppPreferences>) {
  const response = await request<SettingsPayload>("/settings", {
    method: "PUT",
    body: JSON.stringify({
      language: preferences.language ?? "ru",
      theme: preferences.theme ?? "system"
    })
  });

  return response.data;
}

export async function changeLivePassword(currentPassword: string, nextPassword: string) {
  await request("/auth/password/change", {
    method: "POST",
    body: JSON.stringify({
      currentPassword,
      newPassword: nextPassword
    })
  });
  return true;
}

export async function requestLivePasswordReset(email: string) {
  const response = await request("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ email })
  });

  return {
    ok: true,
    message: response.message || "Инструкция подготовлена."
  };
}
