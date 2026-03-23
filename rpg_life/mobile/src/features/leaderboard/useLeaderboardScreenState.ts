import { useFocusEffect } from "@react-navigation/native";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadLeaderboardMe, loadLeaderboardPage, type LeaderboardResponse, type LeaderboardScope } from "./leaderboardService";
import { sanitizeLeaderboardMeResponse, sanitizeLeaderboardResponse } from "./normalize";
import type { LeaderboardEntry, LeaderboardRouteParams } from "./types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function mergeEntries(current: LeaderboardEntry[], incoming: LeaderboardEntry[]) {
  const seen = new Set<number>();
  return [...current, ...incoming].filter((entry) => {
    if (seen.has(entry.user_id)) {
      return false;
    }
    seen.add(entry.user_id);
    return true;
  });
}

type UseLeaderboardScreenStateParams = {
  routeParams?: LeaderboardRouteParams;
  loadErrorMessage: string;
};

export function useLeaderboardScreenState({
  routeParams,
  loadErrorMessage,
}: UseLeaderboardScreenStateParams) {
  const [scope, setScopeState] = useState<LeaderboardScope>(routeParams?.initialScope ?? "global");
  const [payload, setPayload] = useState<LeaderboardResponse | null>(null);
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [meEntry, setMeEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const hasFocusedOnceRef = useRef(false);

  const applyScope = useCallback((nextScope: LeaderboardScope) => {
    startTransition(() => {
      setScopeState(nextScope);
    });
  }, []);

  const loadInitial = useCallback(async (forceRefresh = false, refreshOnly = false) => {
    const requestVersion = ++requestVersionRef.current;

    if (refreshOnly) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    if (!refreshOnly) {
      setError(null);
    }

    try {
      const [listResult, meResult] = await Promise.allSettled([
        loadLeaderboardPage(scope, 1, { forceRefresh }),
        loadLeaderboardMe(scope, { forceRefresh }),
      ]);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (listResult.status === "rejected") {
        throw listResult.reason;
      }

      const sanitizedList = sanitizeLeaderboardResponse(listResult.value);
      setPayload(sanitizedList);
      setItems(sanitizedList.items ?? []);
      setError(null);

      if (meResult.status === "fulfilled") {
        setMeEntry(sanitizeLeaderboardMeResponse(meResult.value)?.item ?? null);
      } else {
        setMeEntry(null);
      }
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (!refreshOnly) {
        setPayload(null);
        setItems([]);
        setMeEntry(null);
      }
      setError(getErrorMessage(error, loadErrorMessage));
    } finally {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadErrorMessage, scope]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || !payload) {
      return;
    }
    if (payload.pagination.page >= payload.pagination.total_pages) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPayload = sanitizeLeaderboardResponse(await loadLeaderboardPage(scope, payload.pagination.page + 1));
      setItems((current) => mergeEntries(current, nextPayload.items ?? []));
      setPayload((current) => {
        if (!current) {
          return nextPayload;
        }
        return {
          ...nextPayload,
          items: mergeEntries(current.items ?? [], nextPayload.items ?? []),
        };
      });
    } catch (error) {
      setError((current) => current ?? getErrorMessage(error, loadErrorMessage));
    } finally {
      setLoadingMore(false);
    }
  }, [loadErrorMessage, loading, loadingMore, payload, refreshing, scope]);

  const refreshScreen = useCallback(async () => {
    await loadInitial(true, true);
  }, [loadInitial]);

  useEffect(() => {
    if (routeParams?.initialScope) {
      applyScope(routeParams.initialScope);
    }
  }, [applyScope, routeParams?.initialScope, routeParams?.requestedAt]);

  useEffect(() => {
    void loadInitial(false, false);
  }, [loadInitial, scope]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      void loadInitial(true, true);
    }, [loadInitial]),
  );

  const hasMore = useMemo(() => {
    if (!payload) {
      return false;
    }
    return payload.pagination.page < payload.pagination.total_pages;
  }, [payload]);

  return {
    scope,
    setScope: applyScope,
    payload,
    items,
    meEntry,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMore,
    refreshScreen,
    reload: () => void loadInitial(true, false),
  };
}
