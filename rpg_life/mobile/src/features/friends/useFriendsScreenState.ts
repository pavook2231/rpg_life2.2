import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchLeaderboard, type LeaderboardEntry } from "../../api/game";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  searchUsers,
  sendFriendRequest,
} from "../../api/social";
import { useTranslation } from "../../context/LocalizationContext";
import { sanitizeLeaderboardEntries } from "../leaderboard/normalize";
import { sanitizeFriendItems, sanitizeFriendRequestItems, sanitizeSocialUserPreview, sanitizeUserSearchResults } from "./normalize";
import type {
  FriendItem,
  FriendRequestItem,
  FriendsRouteParams,
  FriendsTabKey,
  UserSearchResult,
} from "./types";

const DISCOVER_VISIBLE_LIMIT = 10;
const DISCOVER_PAGE_SIZE = 25;
const FRIENDS_PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 20;

type RefreshGameFn = (forceRefresh?: boolean) => Promise<void>;

type UseFriendsScreenStateArgs = {
  refreshGame: RefreshGameFn;
  routeParams?: FriendsRouteParams;
};

type SocialGraphSnapshot = {
  friends: FriendItem[];
  requests: FriendRequestItem[];
};

function toDiscoverUser(entry: LeaderboardEntry): UserSearchResult {
  return {
    id: entry.user_id,
    name: entry.name,
    username: entry.username,
    friend_id: entry.friend_id,
    class_name: entry.class_name,
    class_display_name: entry.class_display_name,
    level: entry.class_level ?? entry.level,
    current_xp: entry.current_xp,
    power_rating: entry.power_rating ?? entry.score,
    goal_type: entry.goal_type,
    goal_title: entry.goal_title,
    goal_progress_percent: entry.goal_progress_percent,
    goal_cycle_xp: entry.goal_cycle_xp,
    goal_target_xp: entry.goal_target_xp,
    presence_status: entry.presence_status ?? "offline",
    last_active_at: entry.last_active_at,
    status: "none",
    request_id: null,
    rank: entry.rank,
    rating_rank: entry.rank,
    score: entry.score,
    is_current_user: entry.is_current_user,
  };
}

function attachRelationshipState(
  users: UserSearchResult[],
  friends: FriendItem[],
  requests: FriendRequestItem[],
) {
  const friendIds = new Set(friends.map((friend) => friend.id));
  const outgoingByUserId = new Map<number, number>();
  const incomingByUserId = new Map<number, number>();

  for (const request of requests) {
    if (request.direction === "outgoing") {
      outgoingByUserId.set(request.user.id, request.id);
    } else {
      incomingByUserId.set(request.user.id, request.id);
    }
  }

  return users
    .filter((user) => (
      !user.is_current_user &&
      !friendIds.has(user.id) &&
      !incomingByUserId.has(user.id) &&
      !outgoingByUserId.has(user.id)
    ))
    .map((user) => {
      return {
        ...user,
        status: "none" as const,
        request_id: null,
      };
    })
    .slice(0, DISCOVER_VISIBLE_LIMIT);
}

function buildDiscoverExcludedUserIds(friends: FriendItem[], requests: FriendRequestItem[]) {
  const excludedIds = new Set<number>();

  for (const friend of friends) {
    excludedIds.add(friend.id);
  }

  for (const request of requests) {
    excludedIds.add(request.user.id);
  }

  return excludedIds;
}

export function useFriendsScreenState({ refreshGame, routeParams }: UseFriendsScreenStateArgs) {
  const t = useTranslation();
  const discoverRequestRef = useRef(0);
  const socialGraphRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const friendsRef = useRef<FriendItem[]>([]);
  const requestsRef = useRef<FriendRequestItem[]>([]);
  const searchQueryRef = useRef("");
  const searchSubmittedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<FriendsTabKey>("friends");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [socialGraphReady, setSocialGraphReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
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
  const discoverSuggestions = useMemo(
    () => attachRelationshipState(discoverUsers, friends, requests),
    [discoverUsers, friends, requests],
  );
  const socialGraphLoading = friendsLoading || requestsLoading;
  const socialGraphError = friendsError ?? requestsError;
  const discoverActionsReady = socialGraphReady && !socialGraphLoading;

  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    searchSubmittedRef.current = searchSubmitted;
  }, [searchSubmitted]);

  const loadSocialGraph = useCallback(async (): Promise<SocialGraphSnapshot | null> => {
    const requestId = ++socialGraphRequestRef.current;
    setFriendsLoading(true);
    setRequestsLoading(true);
    setSocialGraphReady(false);
    setFriendsError(null);
    setRequestsError(null);

    try {
      const [friendsResult, requestsResult] = await Promise.allSettled([
        fetchFriends(1, FRIENDS_PAGE_SIZE),
        fetchFriendRequests(),
      ]);

      if (requestId !== socialGraphRequestRef.current) {
        return null;
      }

      if (friendsResult.status !== "fulfilled" || requestsResult.status !== "fulfilled") {
        if (friendsResult.status !== "fulfilled") {
          setFriendsError(friendsResult.reason instanceof Error ? friendsResult.reason.message : t("screens.friends.errors.loadFriends"));
        }
        if (requestsResult.status !== "fulfilled") {
          setRequestsError(requestsResult.reason instanceof Error ? requestsResult.reason.message : t("screens.friends.errors.loadFriends"));
        }
        return null;
      }

      const nextSnapshot = {
        friends: sanitizeFriendItems(friendsResult.value.items),
        requests: sanitizeFriendRequestItems(requestsResult.value.items),
      };

      setFriends(nextSnapshot.friends);
      setRequests(nextSnapshot.requests);
      setFriendsError(null);
      setRequestsError(null);
      setSocialGraphReady(true);
      return nextSnapshot;
    } finally {
      if (requestId === socialGraphRequestRef.current) {
        setFriendsLoading(false);
        setRequestsLoading(false);
      }
    }
  }, [t]);

  const loadFriends = useCallback(async () => {
    await loadSocialGraph();
  }, [loadSocialGraph]);

  const loadRequests = useCallback(async () => {
    await loadSocialGraph();
  }, [loadSocialGraph]);

  const loadDiscoverUsers = useCallback(async (options?: {
    forceRefresh?: boolean;
    socialGraph?: SocialGraphSnapshot | null;
  }) => {
    const requestId = ++discoverRequestRef.current;
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const socialGraph = options?.socialGraph ?? {
        friends: friendsRef.current,
        requests: requestsRef.current,
      };
      const excludedUserIds = buildDiscoverExcludedUserIds(socialGraph.friends, socialGraph.requests);
      const collectedUsers: UserSearchResult[] = [];
      const seenUserIds = new Set<number>();
      let page = 1;
      let totalPages = 1;

      while (collectedUsers.length < DISCOVER_VISIBLE_LIMIT && page <= totalPages) {
        const payload = await fetchLeaderboard("power", "global", page, DISCOVER_PAGE_SIZE, "all_time", {
          forceRefresh: options?.forceRefresh,
        });
        const leaderboardEntries = sanitizeLeaderboardEntries(payload.items);
        totalPages = Math.max(payload.pagination?.total_pages ?? 1, 1);

        for (const entry of leaderboardEntries) {
          const user = toDiscoverUser(entry);
          if (seenUserIds.has(user.id)) {
            continue;
          }

          seenUserIds.add(user.id);
          if (user.is_current_user || excludedUserIds.has(user.id)) {
            continue;
          }

          collectedUsers.push(user);
          if (collectedUsers.length >= DISCOVER_VISIBLE_LIMIT) {
            break;
          }
        }

        if (leaderboardEntries.length === 0) {
          break;
        }

        page += 1;
      }

      if (requestId !== discoverRequestRef.current) {
        return;
      }

      setDiscoverUsers(collectedUsers);
    } catch (error) {
      if (requestId !== discoverRequestRef.current) {
        return;
      }
      setDiscoverUsers([]);
      setDiscoverError(error instanceof Error ? error.message : t("screens.friends.errors.loadLeaderboard"));
    } finally {
      if (requestId === discoverRequestRef.current) {
        setDiscoverLoading(false);
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
      setSearchResults(sanitizeUserSearchResults(payload.items));
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
    const currentQuery = searchQueryRef.current.trim();
    if (currentQuery) {
      await runSearch(currentQuery, { silent: false });
      return;
    }
    const socialGraph = await loadSocialGraph();
    if (!socialGraph) {
      return;
    }
    await loadDiscoverUsers({ forceRefresh: true, socialGraph });
  }, [loadDiscoverUsers, loadSocialGraph, runSearch]);

  const refreshAll = useCallback(async () => {
    const socialGraph = await loadSocialGraph();
    const currentQuery = searchQueryRef.current.trim();
    const shouldRefreshSearch = searchSubmittedRef.current && currentQuery;

    await Promise.all([
      ...(socialGraph ? [loadDiscoverUsers({ forceRefresh: true, socialGraph })] : []),
      ...(shouldRefreshSearch ? [runSearch(currentQuery, { silent: true })] : []),
    ]);
  }, [loadDiscoverUsers, loadSocialGraph, runSearch]);

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
    const previousDiscoverUsers = discoverUsers;
    setSendingIds((current) => [...current, userId]);
    setDiscoverUsers((current) => current.filter((user) => user.id !== userId));
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
      setRequests((current) => {
        const receiver = sanitizeSocialUserPreview(payload.request.receiver);
        if (!receiver) {
          return current;
        }
        if (current.some((request) => request.id === payload.request.id)) {
          return current;
        }
        return [
          {
            id: payload.request.id,
            status: "pending",
            direction: "outgoing",
            created_at: payload.request.created_at,
            responded_at: null,
            user: receiver,
          },
          ...current,
        ];
      });
      const socialGraph = await loadSocialGraph();
      await Promise.allSettled([refreshGame(true)]);
      if (!searchQuery.trim() && socialGraph) {
        await loadDiscoverUsers({ forceRefresh: true, socialGraph });
      }
    } catch (error) {
      setDiscoverUsers(previousDiscoverUsers);
      setSearchResults(previousResults);
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setSendingIds((current) => current.filter((entry) => entry !== userId));
    }
  }, [discoverUsers, loadDiscoverUsers, loadSocialGraph, refreshGame, searchQuery, searchResults, sendingIds, t]);

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
    const previousDiscoverUsers = discoverUsers;
    setRespondingIds((current) => [...current, requestId]);
    setRequests((current) => current.filter((request) => request.id !== requestId));
    if (userId != null) {
      setDiscoverUsers((current) => current.filter((user) => user.id !== userId));
    }
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
        const socialGraph = await loadSocialGraph();
        await Promise.allSettled([refreshGame(true)]);
        if (!searchQuery.trim() && socialGraph) {
          await loadDiscoverUsers({ forceRefresh: true, socialGraph });
        }
      } else {
        await declineFriendRequest(requestId);
        const socialGraph = await loadSocialGraph();
        await Promise.allSettled([refreshGame(true)]);
        if (!searchQuery.trim() && socialGraph) {
          await loadDiscoverUsers({ forceRefresh: true, socialGraph });
        }
      }

      if (searchSubmitted && searchQuery.trim()) {
        await runSearch(searchQuery, { silent: true });
      }
    } catch (error) {
      setDiscoverUsers(previousDiscoverUsers);
      setRequests(previousRequests);
      setSearchResults(previousSearchResults);
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setRespondingIds((current) => current.filter((entry) => entry !== requestId));
    }
  }, [discoverUsers, loadDiscoverUsers, loadSocialGraph, refreshGame, requests, respondingIds, runSearch, searchQuery, searchResults, searchSubmitted, t]);

  return {
    activeTab,
    setActiveTab,
    openDiscoverTab,
    friends,
    requests,
    incomingRequests,
    outgoingRequests,
    discoverSuggestions,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchSubmitted,
    friendsLoading,
    requestsLoading,
    socialGraphLoading,
    socialGraphError,
    discoverActionsReady,
    discoverLoading,
    searchLoading,
    refreshing,
    friendsError,
    requestsError,
    discoverError,
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
