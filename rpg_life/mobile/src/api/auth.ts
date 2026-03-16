import { apiRequest, probeApiConnection } from "./client";

export type AuthPayload = {
  user: {
    id: number;
    email: string;
    name: string | null;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
};

export type SocialAuthProvider = {
  id: "google" | "telegram" | "yandex";
  label: string;
  kind: "oauth" | "telegram";
  enabled: boolean;
  configured: boolean;
  mobile_client_id?: string | null;
};

export type GoalTemplatePayload = {
  goals: Array<{
    id: string;
    title: string;
    description: string;
    result_example: string;
    icon: string;
    accent_color: string;
    recommended_term_months: number;
    is_primary: boolean;
  }>;
  terms: Array<{
    months: number;
    title: string;
    title_ru?: string;
    tempo: string;
  }>;
};

export function login(email: string, password: string) {
  return apiRequest<AuthPayload>("/auth/login", {
    authenticated: false,
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function register(payload: {
  email: string;
  password: string;
  name: string;
  birth_year: number;
  gender: string;
  character_class: string;
  goal_type: string;
  goal_term_months: number;
}) {
  return apiRequest<AuthPayload>("/auth/register", {
    authenticated: false,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ ok: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export function recoverAccount(email: string) {
  return apiRequest<{ ok: boolean; message: string }>("/auth/recover-account", {
    authenticated: false,
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function getSocialAuthProviders() {
  return apiRequest<{ providers: SocialAuthProvider[] }>("/auth/providers", {
    authenticated: false,
    method: "GET",
  });
}

export function fetchGoalTemplates() {
  return apiRequest<GoalTemplatePayload>("/goals/templates", {
    authenticated: false,
    method: "GET",
  });
}

export function socialLogin(payload: {
  provider: SocialAuthProvider["id"];
  id_token?: string;
  access_token?: string;
  authorization_code?: string;
  init_data?: string;
}) {
  return apiRequest<AuthPayload>("/auth/social", {
    authenticated: false,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export { probeApiConnection };
