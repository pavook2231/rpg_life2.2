import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  searchUsers,
  sendFriendRequest,
} from "../../api/social";
import { useTranslation } from "../../context/LocalizationContext";
import type {
  FriendItem,
  FriendRequestItem,
  FriendsRouteParams,
  FriendsTabKey,
  UserSearchResult,
} from "./types";

const FRIENDS_PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 20;

type RefreshGameFn = (forceRefresh?: boolean) => Promise<void>;

type UseFriendsScreenStateArgs = {
  refreshGame: RefreshGameFn;
  routeParams?: FriendsRouteParams;
};

export function useFriendsScreenState({ refreshGame, routeParams }: UseFriendsScreenStateArgs) {
  const t = useTranslation();
  const friendsRequestRef = useRef(0);
  const requestsRequestRef = useRef(0);
  const searchRequestRef = useRef(0);

  const [activeTab, setActiveTab] = useState<FriendsTabKey>("friends");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sendingIds, setSendingIds] = useState<number[]>([]);
  const [respondingIds, setRespondingIds] = useState<number[]>([]);
  const [searchFocusKey, setSearchFocusKey] = useState(0);

  const incomingRequests = useMemo(
    () => requests.filter((request) => request.direction === "incoming"),
    [requests],
  );
  const outgoingRequests = useMemo(
    () => requests.filter((request) => request.direction === "outgoing"),
    [requests],
  );

  const loadFriends = useCallback(async () => {
    const requestId = ++friendsRequestRef.current;
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const payload = await fetchFriends(1, FRIENDS_PAGE_SIZE);
      if (requestId !== friendsRequestRef.current) {
        return;
      }
      setFriends(payload.items ?? []);
    } catch (error) {
      if (requestId !== friendsRequestRef.current) {
        return;
      }
      setFriendsError(error instanceof Error ? error.message : t("screens.friends.errors.loadFriends"));
    } finally {
      if (requestId === friendsRequestRef.current) {
        setFriendsLoading(false);
      }
    }
  }, [t]);

  const loadRequests = useCallback(async () => {
    const requestId = ++requestsRequestRef.current;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const payload = await fetchFriendRequests();
      if (requestId !== requestsRequestRef.current) {
        return;
      }
      setRequests(payload.items ?? []);
    } catch (error) {
      if (requestId !== requestsRequestRef.current) {
        return;
      }
      setRequestsError(error instanceof Error ? error.message : t("screens.friends.errors.loadFriends"));
    } finally {
      if (requestId === requestsRequestRef.current) {
        setRequestsLoading(false);
      }
    }
  }, [t]);

  const runSearch = useCallback(async (rawQuery: string, options?: { silent?: boolean }) => {
    const query = rawQuery.trim();
    if (!query) {
      searchRequestRef.current += 1;
      setSearchSubmitted(false);
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    if (query.length < 2) {
      setSearchSubmitted(true);
      setSearchResults([]);
      setSearchError(t("screens.friends.errors.searchMinLength"));
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    if (!options?.silent) {
      setSearchSubmitted(true);
      setSearchLoading(true);
    }
    setSearchError(null);

    try {
      const payload = await searchUsers(query, 1, SEARCH_PAGE_SIZE);
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setSearchResults(payload.items ?? []);
    } catch (error) {
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.search"));
    } finally {
      if (requestId === searchRequestRef.current && !options?.silent) {
        setSearchLoading(false);
      }
    }
  }, [t]);

  const reloadDiscover = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchSubmitted(false);
      setSearchError(null);
      return;
    }
    await runSearch(searchQuery, { silent: false });
  }, [runSearch, searchQuery]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadFriends(),
      loadRequests(),
      ...(searchSubmitted && searchQuery.trim() ? [runSearch(searchQuery, { silent: true })] : []),
    ]);
  }, [loadFriends, loadRequests, runSearch, searchQuery, searchSubmitted]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  useEffect(() => {
    if (!routeParams) {
      return;
    }

    if (routeParams.focusSearch) {
      setActiveTab("discover");
      setSearchFocusKey((value) => value + 1);
      return;
    }

    if (routeParams.initialTab) {
      setActiveTab(routeParams.initialTab);
    }
  }, [routeParams?.focusSearch, routeParams?.initialTab, routeParams?.requestedAt]);

  const openDiscoverTab = useCallback((focusInput = false) => {
    setActiveTab("discover");
    if (focusInput) {
      setSearchFocusKey((value) => value + 1);
    }
  }, []);

  const refreshScreen = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const handleSendRequest = useCallback(async (userId: number) => {
    if (sendingIds.includes(userId)) {
      return;
    }

    const previousResults = searchResults;
    setSendingIds((current) => [...current, userId]);
    setSearchResults((current) =>
      current.map((user) => (
        user.id === userId
          ? { ...user, status: "outgoing_pending", request_id: user.request_id ?? null }
          : user
      )),
    );
    setSearchError(null);

    try {
      const payload = await sendFriendRequest(userId);
      setSearchResults((current) =>
        current.map((user) => (
          user.id === userId
            ? { ...user, status: "outgoing_pending", request_id: payload.request.id }
            : user
        )),
      );
      await Promise.allSettled([loadRequests(), refreshGame(true)]);
    } catch (error) {
      setSearchResults(previousResults);
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setSendingIds((current) => current.filter((entry) => entry !== userId));
    }
  }, [loadRequests, refreshGame, searchResults, sendingIds, t]);

  const handleRespondToRequest = useCallback(async (
    requestId: number,
    action: "accept" | "decline",
    userId?: number,
  ) => {
    if (respondingIds.includes(requestId)) {
      return;
    }

    const previousRequests = requests;
    const previousSearchResults = searchResults;
    setRespondingIds((current) => [...current, requestId]);
    setRequests((current) => current.filter((request) => request.id !== requestId));
    if (userId != null) {
      setSearchResults((current) =>
        current.map((user) => {
          if (user.id !== userId) {
            return user;
          }
          return {
            ...user,
            status: action === "accept" ? "friend" : "none",
            request_id: null,
          };
        }),
      );
    }
    setSearchError(null);

    try {
      if (action === "accept") {
        await acceptFriendRequest(requestId);
        await Promise.allSettled([loadFriends(), loadRequests(), refreshGame(true)]);
      } else {
        await declineFriendRequest(requestId);
        await Promise.allSettled([loadRequests(), refreshGame(true)]);
      }

      if (searchSubmitted && searchQuery.trim()) {
        await runSearch(searchQuery, { silent: true });
      }
    } catch (error) {
      setRequests(previousRequests);
      setSearchResults(previousSearchResults);
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setRespondingIds((current) => current.filter((entry) => entry !== requestId));
    }
  }, [loadFriends, loadRequests, refreshGame, requests, respondingIds, runSearch, searchQuery, searchResults, searchSubmitted, t]);

  return {
    activeTab,
    setActiveTab,
    openDiscoverTab,
    friends,
    requests,
    incomingRequests,
    outgoingRequests,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchSubmitted,
    friendsLoading,
    requestsLoading,
    searchLoading,
    refreshing,
    friendsError,
    requestsError,
    searchError,
    sendingIds,
    respondingIds,
    searchFocusKey,
    pendingRequestCount: requests.length,
    loadFriends,
    loadRequests,
    reloadDiscover,
    refreshScreen,
    runSearch,
    handleSendRequest,
    handleRespondToRequest,
  };
}
