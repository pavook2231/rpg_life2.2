import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { type LeaderboardEntry } from "../api/game";
import {
  fetchFriendRequests,
  fetchFriends,
  fetchFriendsLeaderboard,
  fetchGlobalLeaderboard,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FriendItem,
  type FriendRequestItem,
  type UserSearchResult,
} from "../api/social";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useGameProgress } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { Button, GameIcon } from "../ui";
import { radii, useThemeColors } from "../ui/theme";

const FRIENDS_PAGE_SIZE = 40;
const RANKING_PAGE_SIZE = 50;
const DISCOVER_PAGE_SIZE = 20;
const META_SEPARATOR = " | ";
const EMPTY_VALUE = "-";

type FriendsRouteParams = {
  focusSearch?: boolean;
  requestedAt?: number;
};

type ScreenMode = "friends" | "discover";

type DiscoverSourceUser = {
  id: number;
  name: string;
  username?: string | null;
  friend_id?: string | null;
  rank?: number | null;
  level?: number | null;
  score?: number | null;
  quests_completed?: number | null;
  steps?: number | null;
  challenge_wins?: number | null;
};

type DiscoverUserCard = DiscoverSourceUser & {
  status: "none" | "friend" | "outgoing_pending" | "incoming_pending";
  requestId?: number;
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

function formatIdentityLabel(username?: string | null, friendId?: string | null) {
  const parts = [username ? `@${username}` : null, friendId ?? null].filter(Boolean);
  return parts.length ? parts.join(META_SEPARATOR) : null;
}

function buildFriendRankMap(entries: LeaderboardEntry[], currentUserId?: number | null) {
  return entries.reduce<Record<number, number>>((acc, entry) => {
    if (entry.user_id !== currentUserId) {
      acc[entry.user_id] = entry.rank;
    }
    return acc;
  }, {});
}

function mapTopPlayers(entries: LeaderboardEntry[], currentUserId?: number | null) {
  const seen = new Set<number>();
  return entries.flatMap<DiscoverSourceUser>((entry) => {
    if (entry.user_id === currentUserId || seen.has(entry.user_id)) {
      return [];
    }
    seen.add(entry.user_id);
    return [{
      id: entry.user_id,
      name: entry.name,
      username: entry.username,
      friend_id: entry.friend_id,
      rank: entry.rank,
      level: entry.class_level ?? entry.level,
      score: entry.score,
      quests_completed: entry.quests_completed,
      steps: entry.steps,
      challenge_wins: entry.challenge_wins,
    }];
  });
}

function mapSearchResults(entries: UserSearchResult[]) {
  return entries.map<DiscoverSourceUser>((entry) => ({
    id: entry.id,
    name: entry.name,
    username: entry.username,
    friend_id: entry.friend_id,
  }));
}

function rankLabel(rank?: number | null) {
  return rank != null ? `#${rank}` : EMPTY_VALUE;
}

export function FriendsStableScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile, refreshGame } = useGameProgress();
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const searchInputRef = useRef<TextInput | null>(null);

  const [mode, setMode] = useState<ScreenMode>("friends");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [friendRanks, setFriendRanks] = useState<Record<number, number>>({});
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverSourceUsers, setDiscoverSourceUsers] = useState<DiscoverSourceUser[]>([]);
  const [discoverTitle, setDiscoverTitle] = useState("");
  const [discoverDescription, setDiscoverDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingIds, setSendingIds] = useState<number[]>([]);
  const [respondingIds, setRespondingIds] = useState<number[]>([]);
  const [shouldFocusSearch, setShouldFocusSearch] = useState(false);

  const currentUserId = profile?.user?.id ?? null;
  const currentUserIdentity = formatIdentityLabel(profile?.user?.username, profile?.user?.friend_id);

  const incomingRequests = useMemo(() => requests.filter((item) => item.direction === "incoming"), [requests]);
  const outgoingRequests = useMemo(() => requests.filter((item) => item.direction === "outgoing"), [requests]);
  const friendIdSet = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const incomingRequestMap = useMemo(() => {
    const map = new Map<number, number>();
    incomingRequests.forEach((request) => map.set(request.user.id, request.id));
    return map;
  }, [incomingRequests]);
  const outgoingRequestMap = useMemo(() => {
    const map = new Map<number, number>();
    outgoingRequests.forEach((request) => map.set(request.user.id, request.id));
    return map;
  }, [outgoingRequests]);

  const sortedFriends = useMemo(() => {
    return [...friends].sort((left, right) => {
      const leftRank = friendRanks[left.id] ?? Number.MAX_SAFE_INTEGER;
      const rightRank = friendRanks[right.id] ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.name.localeCompare(right.name, "ru");
    });
  }, [friendRanks, friends]);

  const discoverUsers = useMemo<DiscoverUserCard[]>(() => {
    return discoverSourceUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => !friendIdSet.has(user.id))
      .map((user) => {
        if (incomingRequestMap.has(user.id)) {
          return { ...user, status: "incoming_pending", requestId: incomingRequestMap.get(user.id) };
        }
        if (outgoingRequestMap.has(user.id)) {
          return { ...user, status: "outgoing_pending", requestId: outgoingRequestMap.get(user.id) };
        }
        return { ...user, status: "none" };
      });
  }, [currentUserId, discoverSourceUsers, friendIdSet, incomingRequestMap, outgoingRequestMap]);

  const topFriendsPreview = useMemo(() => sortedFriends.slice(0, 3), [sortedFriends]);

  const loadFriendsView = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const [friendsPayload, requestsPayload, leaderboardPayload] = await Promise.all([
        fetchFriends(1, FRIENDS_PAGE_SIZE),
        fetchFriendRequests(),
        fetchFriendsLeaderboard("level", 1, RANKING_PAGE_SIZE, "weekly").catch(() => null),
      ]);

      setFriends(friendsPayload.items ?? []);
      setRequests(requestsPayload.items ?? []);
      setFriendRanks(buildFriendRankMap(leaderboardPayload?.items ?? [], currentUserId));
    } catch (error) {
      setFriendsError(error instanceof Error ? error.message : t("screens.friends.errors.loadFriends"));
    } finally {
      setFriendsLoading(false);
    }
  }, [currentUserId, t]);

  const loadTopPlayers = useCallback(async () => {
    setDiscoverLoading(true);
    setDiscoverError(null);
    setSearchAttempted(false);
    try {
      const payload = await fetchGlobalLeaderboard("level", 1, DISCOVER_PAGE_SIZE, "all_time");
      setDiscoverSourceUsers(mapTopPlayers(payload.items ?? [], currentUserId));
      setDiscoverTitle("Игроки с самым высоким рейтингом");
      setDiscoverDescription("Здесь собраны сильные игроки сообщества. Можно найти человека по нику или сразу отправить заявку.");
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : t("screens.friends.errors.loadLeaderboard"));
      setDiscoverSourceUsers([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, [currentUserId, t]);

  const runSearch = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) {
      await loadTopPlayers();
      return;
    }
    if (query.length < 2) {
      setDiscoverError(t("screens.friends.errors.searchMinLength"));
      setDiscoverSourceUsers([]);
      setSearchAttempted(true);
      return;
    }

    setDiscoverLoading(true);
    setDiscoverError(null);
    setSearchAttempted(true);
    try {
      const payload = await searchUsers(query, 1, DISCOVER_PAGE_SIZE);
      setDiscoverSourceUsers(mapSearchResults(payload.items ?? []));
      setDiscoverTitle(`Результаты поиска: ${query}`);
      setDiscoverDescription("Поиск работает по нику. Если человек есть в RPG Life, он появится ниже.");
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : t("screens.friends.errors.search"));
      setDiscoverSourceUsers([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, [loadTopPlayers, t]);

  function openDiscover(shouldFocus = false) {
    setMode("discover");
    setShouldFocusSearch(shouldFocus);
  }

  function openFriendsList() {
    setMode("friends");
    setShouldFocusSearch(false);
  }

  useEffect(() => {
    const params = route.params as FriendsRouteParams | undefined;
    if (!params?.focusSearch) {
      return;
    }
    openDiscover(true);
  }, [route.params?.focusSearch, route.params?.requestedAt]);

  useEffect(() => {
    if (mode !== "discover" || searchQuery.trim() || discoverSourceUsers.length > 0 || discoverLoading) {
      return;
    }
    void loadTopPlayers();
  }, [discoverLoading, discoverSourceUsers.length, loadTopPlayers, mode, searchQuery]);

  useEffect(() => {
    if (!shouldFocusSearch || mode !== "discover") {
      return;
    }
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
      setShouldFocusSearch(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [mode, shouldFocusSearch]);

  useFocusEffect(
    useCallback(() => {
      void loadFriendsView();
      if (mode === "discover") {
        if (searchQuery.trim()) {
          void runSearch(searchQuery);
        } else {
          void loadTopPlayers();
        }
      }
    }, [loadFriendsView, loadTopPlayers, mode, runSearch, searchQuery]),
  );

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadFriendsView();
      if (mode === "discover") {
        if (searchQuery.trim()) {
          await runSearch(searchQuery);
        } else {
          await loadTopPlayers();
        }
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSendRequest(userId: number) {
    if (sendingIds.includes(userId)) {
      return;
    }
    setSendingIds((prev) => [...prev, userId]);
    try {
      await sendFriendRequest(userId);
      await Promise.all([loadFriendsView(), refreshGame(true)]);
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setSendingIds((prev) => prev.filter((id) => id !== userId));
    }
  }

  async function handleRespond(requestId: number, action: "accept" | "decline") {
    if (respondingIds.includes(requestId)) {
      return;
    }
    setRespondingIds((prev) => [...prev, requestId]);
    try {
      await respondToFriendRequest(requestId, action);
      await Promise.all([loadFriendsView(), refreshGame(true)]);
      if (mode === "discover") {
        if (searchQuery.trim()) {
          await runSearch(searchQuery);
        } else {
          await loadTopPlayers();
        }
      }
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : t("screens.friends.errors.sendRequest"));
    } finally {
      setRespondingIds((prev) => prev.filter((id) => id !== requestId));
    }
  }

  async function handleShareIdentity() {
    if (!currentUserIdentity) {
      return;
    }
    try {
      await Share.share({
        message: `Мой код в RPG Life: ${currentUserIdentity}. Найди меня по нику в разделе друзей.`,
      });
    } catch {
      // Ignore share cancellation.
    }
  }

  return (
    <Screen
      title={t("screens.friends.title")}
      subtitle={translateOrFallback(t, "screens.friends.subtitle", "Друзья, поиск и мягкий рейтинг без перегруза.")}
      scrollable={false}
    >
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeChip, mode === "friends" ? styles.modeChipActive : null]}
          onPress={openFriendsList}
        >
          <Text style={[styles.modeChipText, mode === "friends" ? styles.modeChipTextActive : null]}>
            Мои друзья
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, mode === "discover" ? styles.modeChipActive : null]}
          onPress={() => openDiscover(mode !== "discover")}
        >
          <Text style={[styles.modeChipText, mode === "discover" ? styles.modeChipTextActive : null]}>
            Найти друзей
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentBody}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />}
      >
        {mode === "friends" ? (
          <>
            <Card tone="subtle">
              <Text style={styles.sectionTitle}>Мои друзья</Text>
              <Text style={styles.sectionDescription}>
                Здесь хранится твой круг поддержки. Добавь людей, с которыми хочешь держать темп вместе.
              </Text>
              <Button
                label="Найти друзей"
                icon="account-search-outline"
                onPress={() => openDiscover(true)}
                variant="secondary"
              />
            </Card>

            {!!friendsError ? (
              <StateBlock
                tone="warning"
                icon="alert-circle"
                title={t("screens.friends.errorTitle")}
                description={friendsError}
                actionLabel={t("common.retry")}
                onAction={() => void loadFriendsView()}
              />
            ) : null}

            {friendsLoading ? (
              <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
            ) : null}

            {!friendsLoading && sortedFriends.length === 0 ? (
              <Card tone="accent">
                <Text style={styles.emptyTitle}>Пока друзей нет</Text>
                <Text style={styles.sectionDescription}>
                  Нажми на кнопку ниже, и мы откроем поиск. Сразу покажем игроков с самым высоким рейтингом и строку поиска по нику.
                </Text>
                <Button
                  label="Найти друзей"
                  icon="account-plus-outline"
                  onPress={() => openDiscover(true)}
                />
              </Card>
            ) : null}

            {incomingRequests.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Входящие заявки</Text>
                {incomingRequests.map((request) => {
                  const isResponding = respondingIds.includes(request.id);
                  return (
                    <Card key={request.id} tone="accent">
                      <View style={styles.cardHeader}>
                        <View style={styles.cardCopy}>
                          <Text style={styles.cardTitle}>{request.user.name}</Text>
                          {formatIdentityLabel(request.user.username, request.user.friend_id) ? (
                            <Text style={styles.cardMeta}>{formatIdentityLabel(request.user.username, request.user.friend_id)}</Text>
                          ) : null}
                        </View>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>Новая заявка</Text>
                        </View>
                      </View>
                      <View style={styles.actionRow}>
                        <Button
                          label="Принять"
                          icon="check-circle-outline"
                          onPress={() => void handleRespond(request.id, "accept")}
                          disabled={isResponding}
                          loading={isResponding}
                          style={styles.actionButton}
                        />
                        <Button
                          label="Отклонить"
                          icon="close-circle-outline"
                          onPress={() => void handleRespond(request.id, "decline")}
                          disabled={isResponding}
                          variant="secondary"
                          style={styles.actionButton}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : null}

            {sortedFriends.length > 0 ? (
              <View style={styles.section}>
                {topFriendsPreview.length > 0 ? (
                  <Card tone="subtle">
                    <Text style={styles.sectionTitle}>Рейтинг среди друзей</Text>
                    <Text style={styles.sectionDescription}>
                      Легкий ориентир по текущему темпу. Полный рейтинг открывается на отдельном экране.
                    </Text>
                    {topFriendsPreview.map((friend) => (
                      <View key={`preview-${friend.id}`} style={styles.previewRow}>
                        <Text style={styles.previewRank}>{rankLabel(friendRanks[friend.id])}</Text>
                        <View style={styles.previewCopy}>
                          <Text style={styles.previewName}>{friend.name}</Text>
                          <Text style={styles.previewMeta}>Уровень {friend.stats.level ?? 1}</Text>
                        </View>
                      </View>
                    ))}
                    <Button
                      label="Открыть рейтинг"
                      icon="trophy-outline"
                      onPress={() => navigation.navigate("Leaderboard", { requestedAt: Date.now() })}
                      variant="secondary"
                    />
                  </Card>
                ) : null}

                {sortedFriends.map((friend) => (
                  <Card key={friend.id}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{friend.name}</Text>
                        {formatIdentityLabel(friend.username, friend.friend_id) ? (
                          <Text style={styles.cardMeta}>{formatIdentityLabel(friend.username, friend.friend_id)}</Text>
                        ) : null}
                      </View>
                      {friendRanks[friend.id] ? (
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankBadgeText}>{rankLabel(friendRanks[friend.id])}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statChip}>
                        <GameIcon name="shield-account" size={15} color={colors.primary} />
                        <Text style={styles.statChipText}>Уровень {friend.stats.level ?? 1}</Text>
                      </View>
                      <View style={styles.statChip}>
                        <GameIcon name="notebook-outline" size={15} color={colors.primary} />
                        <Text style={styles.statChipText}>Квесты {friend.stats.quests_completed ?? 0}</Text>
                      </View>
                      <View style={styles.statChip}>
                        <GameIcon name="trophy-outline" size={15} color={colors.primary} />
                        <Text style={styles.statChipText}>Победы {friend.stats.challenge_wins ?? 0}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}

            {outgoingRequests.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Отправленные заявки</Text>
                {outgoingRequests.map((request) => (
                  <Card key={request.id} tone="subtle">
                    <Text style={styles.cardTitle}>{request.user.name}</Text>
                    {formatIdentityLabel(request.user.username, request.user.friend_id) ? (
                      <Text style={styles.cardMeta}>{formatIdentityLabel(request.user.username, request.user.friend_id)}</Text>
                    ) : null}
                    <Text style={styles.pendingText}>Заявка отправлена. Ждем ответ.</Text>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Card tone="accent">
              <Text style={styles.sectionTitle}>Поиск друзей</Text>
              <Text style={styles.sectionDescription}>
                Ищи по нику. Ниже уже показаны игроки с самым высоким рейтингом, чтобы можно было быстро найти людей в приложении.
              </Text>
              {currentUserIdentity ? (
                <View style={styles.identityRow}>
                  <View style={styles.identityCopy}>
                    <Text style={styles.identityLabel}>Твой ник и код</Text>
                    <Text style={styles.identityValue}>{currentUserIdentity}</Text>
                  </View>
                  <Button
                    label="Поделиться"
                    icon="share-variant-outline"
                    onPress={() => void handleShareIdentity()}
                    variant="secondary"
                  />
                </View>
              ) : null}
              <View style={styles.searchRow}>
                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Поиск по нику"
                  placeholderTextColor={colors.textDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => void runSearch(searchQuery)}
                />
                <Button
                  label="Найти"
                  icon="magnify"
                  onPress={() => void runSearch(searchQuery)}
                  style={styles.searchButton}
                />
              </View>
              {searchQuery.trim() ? (
                <Button
                  label="Показать лучших игроков"
                  icon="refresh"
                  onPress={() => {
                    setSearchQuery("");
                    void loadTopPlayers();
                  }}
                  variant="secondary"
                />
              ) : null}
            </Card>

            {!!discoverError ? (
              <StateBlock
                tone="warning"
                icon="alert-circle"
                title={t("screens.friends.errorTitle")}
                description={discoverError}
                actionLabel={t("common.retry")}
                onAction={() => void (searchQuery.trim() ? runSearch(searchQuery) : loadTopPlayers())}
              />
            ) : null}

            {discoverLoading ? (
              <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
            ) : null}

            {!discoverLoading ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{discoverTitle || "Найти друзей"}</Text>
                {discoverDescription ? <Text style={styles.sectionDescription}>{discoverDescription}</Text> : null}
                {discoverUsers.length === 0 ? (
                  <StateBlock
                    icon="account-search-outline"
                    title={searchAttempted ? "Никого не нашли" : "Пока нет подходящих игроков"}
                    description={
                      searchAttempted
                        ? "Попробуй другой ник. Поиск работает по имени пользователя."
                        : "Открой поиск позже или попробуй ввести ник вручную."
                    }
                  />
                ) : null}
                {discoverUsers.map((user) => {
                  const isSending = sendingIds.includes(user.id);
                  const isResponding = user.requestId != null && respondingIds.includes(user.requestId);
                  return (
                    <Card key={user.id}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardCopy}>
                          <Text style={styles.cardTitle}>{user.name}</Text>
                          {formatIdentityLabel(user.username, user.friend_id) ? (
                            <Text style={styles.cardMeta}>{formatIdentityLabel(user.username, user.friend_id)}</Text>
                          ) : null}
                        </View>
                        {user.rank != null ? (
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankBadgeText}>{rankLabel(user.rank)}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.statsRow}>
                        {user.level != null ? (
                          <View style={styles.statChip}>
                            <GameIcon name="shield-account" size={15} color={colors.primary} />
                            <Text style={styles.statChipText}>Уровень {user.level}</Text>
                          </View>
                        ) : null}
                        {user.score != null ? (
                          <View style={styles.statChip}>
                            <GameIcon name="trophy-outline" size={15} color={colors.primary} />
                            <Text style={styles.statChipText}>Рейтинг {user.score}</Text>
                          </View>
                        ) : null}
                        {user.quests_completed != null ? (
                          <View style={styles.statChip}>
                            <GameIcon name="notebook-outline" size={15} color={colors.primary} />
                            <Text style={styles.statChipText}>Квесты {user.quests_completed}</Text>
                          </View>
                        ) : null}
                      </View>

                      {user.status === "none" ? (
                        <Button
                          label={isSending ? "Отправляем..." : "Добавить в друзья"}
                          icon="account-plus-outline"
                          onPress={() => void handleSendRequest(user.id)}
                          disabled={isSending}
                          loading={isSending}
                        />
                      ) : null}

                      {user.status === "outgoing_pending" ? (
                        <View style={styles.pendingBadge}>
                          <GameIcon name="clock-outline" size={16} color={colors.primary} />
                          <Text style={styles.pendingText}>Заявка уже отправлена</Text>
                        </View>
                      ) : null}

                      {user.status === "incoming_pending" ? (
                        <View style={styles.actionRow}>
                          <Button
                            label="Принять"
                            icon="check-circle-outline"
                            onPress={() => user.requestId && handleRespond(user.requestId, "accept")}
                            disabled={!user.requestId || isResponding}
                            loading={isResponding}
                            style={styles.actionButton}
                          />
                          <Button
                            label="Отклонить"
                            icon="close-circle-outline"
                            onPress={() => user.requestId && handleRespond(user.requestId, "decline")}
                            disabled={!user.requestId || isResponding}
                            variant="secondary"
                            style={styles.actionButton}
                          />
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    modeRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },
    modeChip: {
      flex: 1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    modeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.card,
    },
    modeChipText: {
      color: colors.textDim,
      fontSize: 14,
      fontWeight: "700",
    },
    modeChipTextActive: {
      color: colors.primary,
    },
    content: {
      flex: 1,
    },
    contentBody: {
      paddingBottom: 28,
      gap: 14,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    sectionDescription: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    cardCopy: {
      flex: 1,
      gap: 4,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
    cardMeta: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
    },
    rankBadge: {
      minWidth: 52,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    rankBadgeText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.cardMuted,
    },
    statusBadgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    statChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    actionButton: {
      flex: 1,
      minWidth: 140,
    },
    pendingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pendingText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    searchRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    searchInput: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      color: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
    },
    searchButton: {
      minWidth: 120,
    },
    identityRow: {
      gap: 10,
    },
    identityCopy: {
      gap: 4,
    },
    identityLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    identityValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4,
    },
    previewRank: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "800",
      minWidth: 42,
    },
    previewCopy: {
      gap: 2,
      flex: 1,
    },
    previewName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    previewMeta: {
      color: colors.textDim,
      fontSize: 12,
    },
  });
}
