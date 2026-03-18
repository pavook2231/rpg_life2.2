import { apiRequest, apiRootRequest, probeApiConnection } from "../api/client";
import { getCachedValue, saveCachedValue } from "../storage/offlineCacheStorage";
import { addPendingAction, getPendingActions, removePendingAction, type PendingAction } from "../storage/pendingActionStorage";

function isNetworkError(error: unknown) {
  return error instanceof Error && /network/i.test(error.message);
}

function createActionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchWithCache<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  try {
    const value = await loader();
    await saveCachedValue(cacheKey, value);
    return value;
  } catch (error) {
    const cached = await getCachedValue<T>(cacheKey);
    if (cached) {
      return cached.value;
    }
    throw error;
  }
}

type CacheOptions = {
  ttlMs?: number;
  forceRefresh?: boolean;
};

export async function fetchWithTtlCache<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttlMs = 0, forceRefresh = false } = options;
  const cached = await getCachedValue<T>(cacheKey);

  if (!forceRefresh && cached && ttlMs > 0) {
    const ageMs = Date.now() - new Date(cached.savedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= ttlMs) {
      return cached.value;
    }
  }

  try {
    const value = await loader();
    await saveCachedValue(cacheKey, value);
    return value;
  } catch (error) {
    if (cached) {
      return cached.value;
    }
    throw error;
  }
}

export async function enqueueOfflineAction(action: Omit<PendingAction, "id" | "createdAt">) {
  const pendingAction: PendingAction = {
    ...action,
    id: createActionId(),
    createdAt: new Date().toISOString(),
  } as PendingAction;
  await addPendingAction(pendingAction);
  return pendingAction;
}

export async function queueIfOffline<T>(
  request: () => Promise<T>,
  action: Omit<PendingAction, "id" | "createdAt">,
) {
  try {
    return await request();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    const queued = await enqueueOfflineAction(action);
    return {
      queued: true,
      offline: true,
      actionId: queued.id,
    } as T;
  }
}

async function executePendingAction(action: PendingAction) {
  if (action.type === "complete_quest") {
    return apiRequest(`/quests/${action.payload.questId}/complete`, { method: "POST" });
  }
  if (action.type === "claim_daily_bonus") {
    return apiRequest("/rewards/daily-bonus/claim", { method: "POST" });
  }
  if (action.type === "claim_weekly_reward") {
    return apiRequest("/rewards/weekly-goal/claim", { method: "POST" });
  }
  if (action.type === "claim_seasonal_reward") {
    return apiRequest("/rewards/seasonal-goal/claim", { method: "POST" });
  }
  return apiRootRequest("/chests/open", {
    method: "POST",
    body: JSON.stringify(action.payload),
  });
}

export async function syncPendingActions() {
  const actions = await getPendingActions();
  const results: Array<{ id: string; ok: boolean }> = [];

  for (const action of actions) {
    try {
      await executePendingAction(action);
      await removePendingAction(action.id);
      results.push({ id: action.id, ok: true });
    } catch (error) {
      if (isNetworkError(error)) {
        break;
      }
      await removePendingAction(action.id);
      results.push({ id: action.id, ok: false });
    }
  }

  return results;
}

export async function probeConnection() {
  try {
    await probeApiConnection();
    return true;
  } catch {
    return false;
  }
}
