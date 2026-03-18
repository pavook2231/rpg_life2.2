import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { fetchLeaderboard } from "../api/game";
import {
  fetchFriendRequests,
  fetchFriendsLeaderboard,
  fetchFriendsList,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FriendRequestItem,
  type FriendItem,
  type UserSearchResult,
} from "../api/social";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useTranslation } from "../context/LocalizationContext";
import { useThemeColors } from "../ui/theme";

const tabs = ["friends", "leaderboard", "global"] as const;
const metrics = ["level", "quests", "steps", "challenge_wins"] as const;
type LeaderboardMetric = (typeof metrics)[number];
type LeaderboardScope = "leaderboard" | "global";
const FRIENDS_PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 20;
const LEADERBOARD_PAGE_SIZE = 20;
const LEADERBOARD_SEPARATOR = " | ";
const EMPTY_VALUE = "-";

type LeaderboardItem = {
  user_id: number;
  rank: number;
  name: string;
  score: number;
  level: number;
  quests_completed: number;
  steps: number;
  challenge_wins: number;
  class_display_name?: string | null;
  class_name?: string | null;
  class_level?: number | null;
  goal_type?: string | null;
  goal_progress_percent?: number | null;
  goal_cycle_xp?: number | null;
  goal_target_xp?: number | null;
};

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function FriendsScreen() {
  const navigation = useNavigation<any>();
  const searchInputRef = useRef<TextInput | null>(null);
  const friendsRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const leaderboardRequestRef = useRef(0);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("friends");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);
  const [friendsRefreshing, setFriendsRefreshing] = useState(false);
  const [friendsPage, setFriendsPage] = useState(1);
  const [friendsHasMore, setFriendsHasMore] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [friendRequestsLoading, setFriendRequestsLoading] = useState(false);
  const [friendRequestsError, setFriendRequestsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchActiveQuery, setSearchActiveQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sendingRequestIds, setSendingRequestIds] = useState<number[]>([]);
  const [respondingRequestIds, setRespondingRequestIds] = useState<number[]>([]);
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>("level");
  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(false);
  const [leaderboardLoadingMore, setLeaderboardLoadingMore] = useState(false);
  const [globalLeaderboardItems, setGlobalLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [globalLeaderboardPage, setGlobalLeaderboardPage] = useState(1);
  const [globalLeaderboardHasMore, setGlobalLeaderboardHasMore] = useState(false);
  const [globalLeaderboardLoadingMore, setGlobalLeaderboardLoadingMore] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [leaderboardRefreshing, setLeaderboardRefreshing] = useState(false);

  useEffect(() => {
    if (activeTab === "friends") {
      void Promise.all([
        loadFriends({ page: 1, refresh: false, append: false }),
        loadFriendRequests(),
      ]);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "leaderboard" || activeTab === "global") {
      void loadLeaderboard({ page: 1, append: false, scope: activeTab });
    }
  }, [activeTab, leaderboardMetric]);

  async function loadFriends({ page, refresh, append }: { page: number; refresh: boolean; append: boolean }) {
    const requestId = ++friendsRequestRef.current;

    if (refresh) {
      setFriendsRefreshing(true);
    } else if (append) {
      setFriendsLoadingMore(true);
    } else {
      setFriendsLoading(true);
    }
    setFriendsError(null);
    try {
      const payload = await fetchFriendsList(page, FRIENDS_PAGE_SIZE);
      if (requestId !== friendsRequestRef.current) {
        return;
      }
      setFriends((prev) => (append ? [...prev, ...payload.items] : payload.items));
      setFriendsPage(payload.pagination.page);
      setFriendsHasMore(payload.pagination.page < payload.pagination.total_pages);
    } catch (error) {
      if (requestId !== friendsRequestRef.current) {
        return;
      }
      setFriendsError(error instanceof Error ? error.message : t("screens.friends.errors.loadFriends"));
    } finally {
      if (requestId !== friendsRequestRef.current) {
        return;
      }
      setFriendsLoading(false);
      setFriendsLoadingMore(false);
      setFriendsRefreshing(false);
    }
  }

  async function loadFriendRequests() {
    setFriendRequestsLoading(true);
    setFriendRequestsError(null);
    try {
      const payload = await fetchFriendRequests();
      setFriendRequests(payload.items ?? []);
    } catch (error) {
      setFriendRequestsError(error instanceof Error ? error.message : t("screens.friends.errors.loadFriends"));
    } finally {
      setFriendRequestsLoading(false);
    }
  }

  async function loadLeaderboard({ page, append, scope }: { page: number; append: boolean; scope: LeaderboardScope }) {
    const requestId = ++leaderboardRequestRef.current;

    if (append) {
      if (scope === "leaderboard") {
        setLeaderboardLoadingMore(true);
      } else {
        setGlobalLeaderboardLoadingMore(true);
      }
    } else {
      setLeaderboardLoading(true);
    }
    setLeaderboardError(null);
    try {
      if (scope === "leaderboard") {
        const payload = await fetchFriendsLeaderboard(leaderboardMetric, page, LEADERBOARD_PAGE_SIZE);
        if (requestId !== leaderboardRequestRef.current) {
          return;
        }
        setLeaderboardItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
        setLeaderboardPage(payload.pagination.page);
        setLeaderboardHasMore(payload.pagination.page < payload.pagination.total_pages);
      } else {
        const payload = await fetchLeaderboard(leaderboardMetric, "global", page, LEADERBOARD_PAGE_SIZE, {
          forceRefresh: !append,
        });
        if (requestId !== leaderboardRequestRef.current) {
          return;
        }
        setGlobalLeaderboardItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
        setGlobalLeaderboardPage(payload.pagination.page);
        setGlobalLeaderboardHasMore(payload.pagination.page < payload.pagination.total_pages);
      }
    } catch (error) {
      if (requestId !== leaderboardRequestRef.current) {
        return;
      }
      setLeaderboardError(error instanceof Error ? error.message : t("screens.friends.errors.loadLeaderboard"));
    } finally {
      if (requestId !== leaderboardRequestRef.current) {
        return;
      }
      setLeaderboardLoading(false);
      setLeaderboardLoadingMore(false);
      setGlobalLeaderboardLoadingMore(false);
    }
  }

  async function handleRefreshLeaderboard(scope: LeaderboardScope) {
    try {
      setLeaderboardRefreshing(true);
      await loadLeaderboard({ page: 1, append: false, scope });
    } finally {
      setLeaderboardRefreshing(false);
    }
  }

  async function performSearch(query: string, page: number, append: boolean) {
    const requestId = ++searchRequestRef.current;

    if (append) {
      setSearchLoadingMore(true);
    } else {
      setSearchLoading(true);
      setSearchAttempted(true);
    }
    setSearchError(null);
    try {
      const payload = await searchUsers(query, page, SEARCH_PAGE_SIZE);
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setSearchResults((prev) => (append ? [...prev, ...payload.items] : payload.items));
      setSearchActiveQuery(query);
      setSearchPage(payload.pagination.page);
      setSearchHasMore(payload.pagination.page < payload.pagination.total_pages);
    } catch (error) {
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.search"));
    } finally {
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setSearchLoading(false);
      setSearchLoadingMore(false);
    }
  }

  function resetSearchState() {
    searchRequestRef.current += 1;
    setSearchResults([]);
    setSearchAttempted(false);
    setSearchHasMore(false);
    setSearchPage(1);
    setSearchActiveQuery("");
    setSearchError(null);
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      resetSearchState();
      return;
    }
    if (query.length < 2) {
      setSearchError(t("screens.friends.errors.searchMinLength"));
      return;
    }

    await performSearch(query, 1, false);
  }

  async function handleLoadMoreSearch() {
    if (searchLoading || searchLoadingMore || !searchHasMore || !searchActiveQuery) {
      return;
    }
    await performSearch(searchActiveQuery, searchPage + 1, true);
  }

  async function handleLoadMoreFriends() {
    if (friendsLoading || friendsLoadingMore || !friendsHasMore) {
      return;
    }
    await loadFriends({ page: friendsPage + 1, refresh: false, append: true });
  }

  async function handleLoadMoreLeaderboard() {
    if (leaderboardLoading || leaderboardLoadingMore || !leaderboardHasMore) {
      return;
    }
    await loadLeaderboard({ page: leaderboardPage + 1, append: true, scope: "leaderboard" });
  }

  async function handleLoadMoreGlobalLeaderboard() {
    if (leaderboardLoading || globalLeaderboardLoadingMore || !globalLeaderboardHasMore) {
      return;
    }
    await loadLeaderboard({ page: globalLeaderboardPage + 1, append: true, scope: "global" });
  }

  async function handleSendRequest(userId: number) {
    if (sendingRequestIds.includes(userId)) {
      return;
    }

    setSendingRequestIds((prev) => [...prev, userId]);
    try {
      const payload = await sendFriendRequest(userId);
      setSearchResults((prev) => prev.map((user) => (
        user.id === userId
          ? { ...user, status: "outgoing_pending", request_id: payload.request.id }
          : user
      )));
      await loadFriendRequests();
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setSendingRequestIds((prev) => prev.filter((id) => id !== userId));
    }
  }

  async function handleRespondToFriendRequest(requestId: number, action: "accept" | "decline", userId?: number) {
    if (respondingRequestIds.includes(requestId)) {
      return;
    }

    setRespondingRequestIds((prev) => [...prev, requestId]);
    setSearchError(null);
    try {
      await respondToFriendRequest(requestId, action);
      setFriendRequests((prev) => prev.filter((request) => request.id !== requestId));
      setSearchResults((prev) => prev.flatMap((user) => {
        if (user.request_id !== requestId && user.id !== userId) {
          return [user];
        }
        if (action === "accept") {
          return [];
        }
        return [{ ...user, status: "none", request_id: undefined }];
      }));
      if (action === "accept") {
        await Promise.all([
          loadFriends({ page: 1, refresh: false, append: false }),
          loadLeaderboard({ page: 1, append: false, scope: "leaderboard" }),
        ]);
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setRespondingRequestIds((prev) => prev.filter((id) => id !== requestId));
    }
  }

  function getMetricLabel(value: LeaderboardMetric) {
    const key = `screens.leaderboard.metrics.${value}`;
    const translated = t(key);
    return translated === key ? value : translated;
  }

  function focusSearchInput() {
    searchInputRef.current?.focus();
  }

  const currentLeaderboardItems = activeTab === "leaderboard" ? leaderboardItems : globalLeaderboardItems;
  const incomingRequests = friendRequests.filter((request) => request.direction === "incoming");
  const outgoingRequests = friendRequests.filter((request) => request.direction === "outgoing");
  const pendingRequestCount = friendRequests.length;
  const topLeaderboardEntry = currentLeaderboardItems[0] ?? null;
  const topLeaderboardLabel = topLeaderboardEntry ? `#${topLeaderboardEntry.rank} ${topLeaderboardEntry.name}` : EMPTY_VALUE;
  const socialPulse = friends.length === 0
    ? {
        title: translateOrFallback(t, "screens.friends.quick.pulseNoFriendsTitle", "Добавь первых союзников"),
        description: translateOrFallback(
          t,
          "screens.friends.quick.pulseNoFriendsDescription",
          "С друзьями проще держать темп: можно сравнивать прогресс и следить за рейтингом.",
        ),
        actionLabel: t("screens.friends.empty.findFriendsAction"),
        onPress: focusSearchInput,
      }
    : pendingRequestCount > 0
      ? {
          title: translateOrFallback(t, "screens.friends.quick.pulsePendingTitle", "Есть новые контакты"),
          description: translateOrFallback(
            t,
            "screens.friends.quick.pulsePendingDescription",
            `У тебя уже ${pendingRequestCount} отправленных заявок. Пока ждёшь ответ, можно заглянуть в лидерборд.`,
            { count: pendingRequestCount },
          ),
          actionLabel: translateOrFallback(t, "screens.friends.quick.openLeaderboard", "Открыть рейтинг"),
          onPress: () => setActiveTab("leaderboard"),
        }
      : {
          title: translateOrFallback(t, "screens.friends.quick.pulseReadyTitle", "Ты уже в социальной игре"),
          description: translateOrFallback(
            t,
            "screens.friends.quick.pulseReadyDescription",
            `У тебя ${friends.length} друзей. Открой рейтинг и посмотри, кого можно догнать сегодня.`,
            { count: friends.length },
          ),
          actionLabel: translateOrFallback(t, "screens.friends.quick.openLeaderboard", "Открыть рейтинг"),
          onPress: () => setActiveTab("leaderboard"),
        };

  return (
    <Screen title={t("screens.friends.title")} subtitle={t("screens.friends.subtitle")} scrollable={false}>
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab ? styles.tabActive : null]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : null]}>
              {t(`screens.friends.tabs.${tab}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "friends" && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentBody}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={friendsRefreshing}
              onRefresh={() => Promise.all([
                loadFriends({ page: 1, refresh: true, append: false }),
                loadFriendRequests(),
              ])}
              tintColor={colors.primary}
            />
          }
        >
          <Card>
            <Text style={styles.sectionTitle}>{translateOrFallback(t, "screens.friends.quick.pulseTitle", "Социальная сводка")}</Text>
            <Text style={styles.pulseTitle}>{socialPulse.title}</Text>
            <Text style={styles.pulseDescription}>{socialPulse.description}</Text>
            <Pressable style={styles.pulseButton} onPress={socialPulse.onPress}>
              <Text style={styles.pulseButtonText}>{socialPulse.actionLabel}</Text>
            </Pressable>
          </Card>

          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryLabel}>{t("screens.friends.myFriends")}</Text>
              <Text style={styles.summaryValue}>{friends.length}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryLabel}>{t("screens.friends.searchResults")}</Text>
              <Text style={styles.summaryValue}>{searchResults.length}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryLabel}>{translateOrFallback(t, "screens.friends.pendingTotal", "Ожидают ответа")}</Text>
              <Text style={styles.summaryValue}>{pendingRequestCount}</Text>
            </View>
          </View>

          {!!friendRequestsError ? (
            <StateBlock
              tone="warning"
              icon="alert-circle"
              title={t("screens.friends.errorTitle")}
              description={friendRequestsError}
              actionLabel={t("common.retry")}
              onAction={loadFriendRequests}
            />
          ) : null}

          {friendRequestsLoading ? <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} /> : null}

          {incomingRequests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {translateOrFallback(t, "screens.friends.incomingRequests", "Входящие заявки")}
              </Text>
              {incomingRequests.map((request) => {
                const isResponding = respondingRequestIds.includes(request.id);
                return (
                  <Card key={request.id}>
                    <View style={styles.requestCard}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{request.user.name}</Text>
                        <Text style={styles.userEmail}>{request.user.email}</Text>
                      </View>
                      <View style={styles.requestActions}>
                        <Pressable
                          style={[styles.actionButton, isResponding ? styles.actionButtonDisabled : null]}
                          onPress={() => handleRespondToFriendRequest(request.id, "accept", request.user.id)}
                          disabled={isResponding}
                        >
                          <Text style={styles.actionButtonText}>
                            {isResponding
                              ? t("common.loading")
                              : translateOrFallback(t, "screens.friends.acceptRequest", "Принять")}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, isResponding ? styles.actionButtonDisabled : null]}
                          onPress={() => handleRespondToFriendRequest(request.id, "decline", request.user.id)}
                          disabled={isResponding}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {translateOrFallback(t, "screens.friends.declineRequest", "Отклонить")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : null}

          {outgoingRequests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {translateOrFallback(t, "screens.friends.outgoingRequests", "Отправленные заявки")}
              </Text>
              {outgoingRequests.map((request) => (
                <Card key={request.id}>
                  <View style={styles.userRow}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{request.user.name}</Text>
                      <Text style={styles.userEmail}>{request.user.email}</Text>
                    </View>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingText}>{t("screens.friends.requestPending")}</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          <View style={styles.searchContainer}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={t("screens.friends.searchPlaceholder")}
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                if (!value.trim()) {
                  resetSearchState();
                }
              }}
              onSubmitEditing={handleSearch}
            />
            <Pressable style={styles.searchButton} onPress={handleSearch} disabled={searchLoading}>
              <Text style={styles.searchButtonText}>{searchLoading ? t("common.loading") : t("common.search")}</Text>
            </Pressable>
          </View>

          {!!searchError ? (
            <StateBlock
              tone="warning"
              icon="alert-circle"
              title={t("screens.friends.errorTitle")}
              description={searchError}
              actionLabel={t("common.retry")}
              onAction={handleSearch}
            />
          ) : null}

          {searchResults.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("screens.friends.searchResults")}</Text>
              {searchResults.map((user) => {
                const isSending = sendingRequestIds.includes(user.id);
                return (
                  <Card key={user.id}>
                    <View style={styles.userRow}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
                      </View>
                      {user.status === "none" ? (
                        <Pressable
                          style={[styles.actionButton, isSending ? styles.actionButtonDisabled : null]}
                          onPress={() => handleSendRequest(user.id)}
                          disabled={isSending}
                        >
                          <Text style={styles.actionButtonText}>{isSending ? t("common.loading") : t("screens.friends.addFriend")}</Text>
                        </Pressable>
                      ) : null}
                      {user.status === "outgoing_pending" ? (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingText}>{t("screens.friends.requestPending")}</Text>
                        </View>
                      ) : null}
                      {user.status === "incoming_pending" ? (
                        <View style={styles.requestActions}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              user.request_id && respondingRequestIds.includes(user.request_id) ? styles.actionButtonDisabled : null,
                            ]}
                            onPress={() => user.request_id && handleRespondToFriendRequest(user.request_id, "accept", user.id)}
                            disabled={!user.request_id || respondingRequestIds.includes(user.request_id)}
                          >
                            <Text style={styles.actionButtonText}>
                              {translateOrFallback(t, "screens.friends.acceptRequest", "Принять")}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.secondaryButton,
                              user.request_id && respondingRequestIds.includes(user.request_id) ? styles.actionButtonDisabled : null,
                            ]}
                            onPress={() => user.request_id && handleRespondToFriendRequest(user.request_id, "decline", user.id)}
                            disabled={!user.request_id || respondingRequestIds.includes(user.request_id)}
                          >
                            <Text style={styles.secondaryButtonText}>
                              {translateOrFallback(t, "screens.friends.declineRequest", "Отклонить")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : null}

          {searchHasMore ? (
            <Pressable style={styles.loadMoreButton} onPress={handleLoadMoreSearch} disabled={searchLoadingMore}>
              <Text style={styles.loadMoreButtonText}>{searchLoadingMore ? t("common.loading") : t("common.loadMore")}</Text>
            </Pressable>
          ) : null}

          {searchAttempted && !searchLoading && searchResults.length === 0 ? (
            <StateBlock
              icon="account-search-outline"
              title={t("screens.friends.empty.searchTitle")}
              description={t("screens.friends.empty.searchDescription")}
              actionLabel={t("screens.friends.empty.findFriendsAction")}
              onAction={focusSearchInput}
            />
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("screens.friends.myFriends")}</Text>
            {!!friendsError ? (
              <StateBlock
                tone="warning"
                icon="alert-circle"
                title={t("screens.friends.errorTitle")}
                description={friendsError}
                actionLabel={t("common.retry")}
                onAction={() => loadFriends({ page: 1, refresh: false, append: false })}
              />
            ) : null}
            {friendsLoading ? <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} /> : null}
            {!friendsLoading && friends.length === 0 ? (
              <StateBlock
                icon="account-multiple-plus"
                title={t("screens.friends.empty.friendsTitle")}
                description={t("screens.friends.empty.friendsDescription")}
                actionLabel={t("screens.friends.empty.findFriendsAction")}
                onAction={focusSearchInput}
              />
            ) : null}
            {friends.map((friend) => (
              <Card key={friend.id}>
                <View style={styles.friendRow}>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendStats}>
                      {t("screens.friends.friendStats", {
                        level: friend.stats.level ?? 1,
                        quests: friend.stats.quests_completed ?? 0,
                        wins: friend.stats.challenge_wins ?? 0,
                      })}
                    </Text>
                    <Text style={styles.friendSince}>
                      {t("screens.friends.friendsSince")}: {new Date(friend.friends_since).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
            {friendsHasMore ? (
              <Pressable style={styles.loadMoreButton} onPress={handleLoadMoreFriends} disabled={friendsLoadingMore}>
                <Text style={styles.loadMoreButtonText}>{friendsLoadingMore ? t("common.loading") : t("common.loadMore")}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}

      {(activeTab === "leaderboard" || activeTab === "global") && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentBody}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={leaderboardRefreshing}
              onRefresh={() => handleRefreshLeaderboard(activeTab)}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryLabel}>{t("screens.leaderboard.fields.score")}</Text>
              <Text style={styles.summaryValue}>{getMetricLabel(leaderboardMetric)}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryLabel}>{t("navigation.leaderboard")}</Text>
              <Text style={styles.summaryValue}>{currentLeaderboardItems.length}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryLabel}>TOP 1</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {topLeaderboardLabel}
              </Text>
            </View>
          </View>

          {!!leaderboardError ? (
            <StateBlock
              tone="warning"
              icon="alert-circle"
              title={t("screens.friends.errorTitle")}
              description={leaderboardError}
              actionLabel={t("common.retry")}
              onAction={() => loadLeaderboard({ page: 1, append: false, scope: activeTab })}
            />
          ) : null}
          <View style={styles.filters}>
            {metrics.map((metric) => (
              <Pressable
                key={metric}
                style={[styles.filter, leaderboardMetric === metric ? styles.filterActive : null]}
                onPress={() => setLeaderboardMetric(metric)}
              >
                <Text style={[styles.filterText, leaderboardMetric === metric ? styles.filterTextActive : null]}>
                  {getMetricLabel(metric)}
                </Text>
              </Pressable>
            ))}
          </View>

          {leaderboardLoading ? <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} /> : null}
          {!leaderboardLoading && currentLeaderboardItems.length === 0 ? (
            <StateBlock
              icon="flag-checkered"
              title={t("screens.friends.empty.leaderboardTitle")}
              description={t("screens.friends.empty.leaderboardDescription")}
              actionLabel={t("common.createGoal")}
              onAction={() => navigation.navigate("GoalSelect")}
            />
          ) : null}

          {currentLeaderboardItems.map((item) => (
            <Card key={item.user_id}>
              <Text style={styles.title}>
                #{item.rank} {item.name}
              </Text>
              <Text style={styles.subTitle}>
                {t("screens.leaderboard.fields.class")}: {item.class_display_name ?? item.class_name ?? EMPTY_VALUE}
                {LEADERBOARD_SEPARATOR}
                {t("screens.leaderboard.fields.level")}: {item.class_level ?? item.level}
              </Text>
              <Text style={styles.meta}>
                {t("screens.leaderboard.fields.goal")}: {item.goal_type ?? EMPTY_VALUE}
                {item.goal_progress_percent != null
                  ? ` (${item.goal_progress_percent}%${item.goal_target_xp ? `, ${item.goal_cycle_xp}/${item.goal_target_xp} XP` : ""})`
                  : ""}
              </Text>
              <Text style={styles.meta}>{t("screens.leaderboard.fields.score")}: {item.score}</Text>
              <Text style={styles.meta}>{t("screens.leaderboard.fields.quests")}: {item.quests_completed}</Text>
              <Text style={styles.meta}>{t("screens.leaderboard.fields.steps")}: {item.steps}</Text>
              <Text style={styles.meta}>{t("screens.leaderboard.fields.challengeWins")}: {item.challenge_wins}</Text>
            </Card>
          ))}
          {activeTab === "leaderboard" && leaderboardHasMore ? (
            <Pressable style={styles.loadMoreButton} onPress={handleLoadMoreLeaderboard} disabled={leaderboardLoadingMore}>
              <Text style={styles.loadMoreButtonText}>{leaderboardLoadingMore ? t("common.loading") : t("common.loadMore")}</Text>
            </Pressable>
          ) : null}
          {activeTab === "global" && globalLeaderboardHasMore ? (
            <Pressable style={styles.loadMoreButton} onPress={handleLoadMoreGlobalLeaderboard} disabled={globalLeaderboardLoadingMore}>
              <Text style={styles.loadMoreButtonText}>{globalLeaderboardLoadingMore ? t("common.loading") : t("common.loadMore")}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    tabs: {
      flexDirection: "row",
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: colors.border,
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      color: colors.textDim,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: "bold",
    },
    content: {
      flex: 1,
    },
    contentBody: {
      paddingBottom: 28,
    },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    summaryChip: {
      flexGrow: 1,
      minWidth: 96,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textDim,
      fontWeight: "700",
    },
    summaryValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "800",
    },
    searchContainer: {
      flexDirection: "row",
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginRight: 8,
      backgroundColor: colors.backgroundRaised,
      color: colors.text,
    },
    searchButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      justifyContent: "center",
    },
    searchButtonText: {
      color: colors.text,
      fontWeight: "bold",
    },
    filters: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 16,
    },
    filter: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
    },
    filterActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    filterText: {
      color: colors.textDim,
    },
    filterTextActive: {
      color: colors.text,
      fontWeight: "bold",
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 8,
    },
    userRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    requestCard: {
      gap: 12,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
    },
    userEmail: {
      fontSize: 14,
      color: colors.textDim,
    },
    actionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    secondaryButton: {
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    actionButtonDisabled: {
      opacity: 0.72,
    },
    actionButtonText: {
      color: colors.text,
      fontSize: 14,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
    },
    requestActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    loadMoreButton: {
      alignSelf: "center",
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
    },
    loadMoreButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    pendingText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "700",
    },
    pendingBadge: {
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.backgroundRaised,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    friendRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    friendInfo: {
      flex: 1,
      gap: 4,
    },
    friendName: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
    },
    friendStats: {
      fontSize: 13,
      color: colors.textMuted,
    },
    friendSince: {
      fontSize: 14,
      color: colors.textDim,
    },
    title: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
    },
    pulseTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 6,
    },
    pulseDescription: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 12,
    },
    pulseButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    pulseButtonText: {
      color: colors.text,
      fontWeight: "700",
    },
    subTitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      marginBottom: 4,
    },
    meta: {
      fontSize: 14,
      color: colors.textDim,
    },
  });
}
