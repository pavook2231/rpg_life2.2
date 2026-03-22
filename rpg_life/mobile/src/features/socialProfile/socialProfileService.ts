import { apiRequest } from "../../api/client";
import { fetchWithTtlCache } from "../../lib/offline";

import type { SocialProfilePayload } from "./types";

const SOCIAL_PROFILE_TTL_MS = 60_000;

export function fetchSocialProfile(userId: number, options: { forceRefresh?: boolean } = {}) {
  return fetchWithTtlCache(
    `social-profile:${userId}`,
    () => apiRequest<SocialProfilePayload>(`/users/${userId}/profile`),
    {
      ttlMs: SOCIAL_PROFILE_TTL_MS,
      forceRefresh: options.forceRefresh,
    },
  );
}
