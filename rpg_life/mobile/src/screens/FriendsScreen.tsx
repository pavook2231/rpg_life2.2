import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { fetchLeaderboard } from "../api/game";
import {
  fetchFriendsLeaderboard,
  fetchFriendsList,
  searchUsers,
  sendFriendRequest,
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
const FRIENDS_PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 20;
const LEADERBOARD_PAGE_SIZE = 20;

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

export function FriendsScreen() {
  const navigation = useNavigation<any>();
  const searchInputRef = useRef<TextInput | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("friends");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);
  const [friendsRefreshing, setFriendsRefreshing] = useState(false);
  const [friendsPage, setFriendsPage] = useState(1);
  const [friendsHasMore, setFriendsHasMore] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
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

  useEffect(() => {
    if (activeTab === "friends") {
      void loadFriends({ page: 1, refresh: false, append: false });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "leaderboard" || activeTab === "global") {
      void loadLeaderboard({ page: 1, append: false });
    }
  }, [activeTab, leaderboardMetric]);

  async function loadFriends({ page, refresh, append }: { page: number; refresh: boolean; append: boolean }) {
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
      setFriends((prev) => (append ? [...prev, ...payload.items] : payload.items));
      setFriendsPage(payload.pagination.page);
      setFriendsHasMore(payload.pagination.page < payload.pagination.total_pages);
    } catch (error) {
      setFriendsError(error instanceof Error ? error.message : t("screens.friends.errors.loadFriends"));
    } finally {
      setFriendsLoading(false);
      setFriendsLoadingMore(false);
      setFriendsRefreshing(false);
    }
  }

  async function loadLeaderboard({ page, append }: { page: number; append: boolean }) {
    if (append) {
      if (activeTab === "leaderboard") {
        setLeaderboardLoadingMore(true);
      } else {
        setGlobalLeaderboardLoadingMore(true);
      }
    } else {
      setLeaderboardLoading(true);
    }
    setLeaderboardError(null);
    try {
      if (activeTab === "leaderboard") {
        const payload = await fetchFriendsLeaderboard(leaderboardMetric, page, LEADERBOARD_PAGE_SIZE);
        setLeaderboardItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
        setLeaderboardPage(payload.pagination.page);
        setLeaderboardHasMore(payload.pagination.page < payload.pagination.total_pages);
      } else {
        const payload = await fetchLeaderboard(leaderboardMetric, "global", page, LEADERBOARD_PAGE_SIZE);
        setGlobalLeaderboardItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
        setGlobalLeaderboardPage(payload.pagination.page);
        setGlobalLeaderboardHasMore(payload.pagination.page < payload.pagination.total_pages);
      }
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : t("screens.friends.errors.loadLeaderboard"));
    } finally {
      setLeaderboardLoading(false);
      setLeaderboardLoadingMore(false);
      setGlobalLeaderboardLoadingMore(false);
    }
  }

  async function performSearch(query: string, page: number, append: boolean) {
    if (append) {
      setSearchLoadingMore(true);
    } else {
      setSearchLoading(true);
      setSearchAttempted(true);
    }
    setSearchError(null);
    try {
      const payload = await searchUsers(query, page, SEARCH_PAGE_SIZE);
      setSearchResults((prev) => (append ? [...prev, ...payload.items] : payload.items));
      setSearchActiveQuery(query);
      setSearchPage(payload.pagination.page);
      setSearchHasMore(payload.pagination.page < payload.pagination.total_pages);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.search"));
    } finally {
      setSearchLoading(false);
      setSearchLoadingMore(false);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchAttempted(false);
      setSearchHasMore(false);
      setSearchPage(1);
      setSearchActiveQuery("");
      setSearchError(null);
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
    await loadLeaderboard({ page: leaderboardPage + 1, append: true });
  }

  async function handleLoadMoreGlobalLeaderboard() {
    if (leaderboardLoading || globalLeaderboardLoadingMore || !globalLeaderboardHasMore) {
      return;
    }
    await loadLeaderboard({ page: globalLeaderboardPage + 1, append: true });
  }

  async function handleSendRequest(userId: number) {
    if (sendingRequestIds.includes(userId)) {
      return;
    }

    setSendingRequestIds((prev) => [...prev, userId]);
    try {
      await sendFriendRequest(userId);
      setSearchResults((prev) => prev.map((user) => (user.id === userId ? { ...user, status: "pending" } : user)));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setSendingRequestIds((prev) => prev.filter((id) => id !== userId));
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
          refreshControl={
            <RefreshControl
              refreshing={friendsRefreshing}
              onRefresh={() => loadFriends({ page: 1, refresh: true, append: false })}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.searchContainer}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={t("screens.friends.searchPlaceholder")}
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                if (!value.trim()) {
                  setSearchResults([]);
                  setSearchAttempted(false);
                  setSearchHasMore(false);
                  setSearchPage(1);
                  setSearchActiveQuery("");
                  setSearchError(null);
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
                        <Pressable style={styles.actionButton} onPress={() => handleSendRequest(user.id)} disabled={isSending}>
                          <Text style={styles.actionButtonText}>{isSending ? t("common.loading") : t("screens.friends.addFriend")}</Text>
                        </Pressable>
                      ) : null}
                      {user.status === "pending" ? <Text style={styles.pendingText}>{t("screens.friends.requestPending")}</Text> : null}
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
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendSince}>
                    {t("screens.friends.friendsSince")}: {new Date(friend.friends_since).toLocaleDateString()}
                  </Text>
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
        <ScrollView style={styles.content}>
          {!!leaderboardError ? (
            <StateBlock
              tone="warning"
              icon="alert-circle"
              title={t("screens.friends.errorTitle")}
              description={leaderboardError}
              actionLabel={t("common.retry")}
              onAction={() => loadLeaderboard({ page: 1, append: false })}
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
                {t("screens.leaderboard.fields.class")}: {item.class_display_name ?? item.class_name ?? "-"}
                {"  •  "}
                {t("screens.leaderboard.fields.level")}: {item.class_level ?? item.level}
              </Text>
              <Text style={styles.meta}>
                {t("screens.leaderboard.fields.goal")}: {item.goal_type ?? "-"}
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
    actionButtonText: {
      color: colors.text,
      fontSize: 14,
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
      fontSize: 14,
      color: colors.textDim,
      fontStyle: "italic",
    },
    friendRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    friendName: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
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
