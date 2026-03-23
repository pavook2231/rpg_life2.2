import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "../components/Screen";
import { ScreenRenderBoundary } from "../components/ScreenRenderBoundary";
import { StateBlock } from "../components/StateBlock";
import { useGameProgress } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { FriendCard } from "../features/friends/components/FriendCard";
import { FriendRequestCard } from "../features/friends/components/FriendRequestCard";
import { FriendSearchResultCard } from "../features/friends/components/FriendSearchResultCard";
import { FriendsSummaryCard } from "../features/friends/components/FriendsSummaryCard";
import { FriendsTabBar } from "../features/friends/components/FriendsTabBar";
import type { FriendsRouteParams } from "../features/friends/types";
import { useFriendsScreenState } from "../features/friends/useFriendsScreenState";
import { formatIdentityLabel, translateOrFallback } from "../features/friends/utils";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { radii, useThemeColors } from "../ui/theme";

function FriendsScreenContent() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile, refreshGame } = useGameProgress();
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const searchInputRef = useRef<TextInput | null>(null);
  const handledFocusKeyRef = useRef<number | null>(null);
  const routeParams = route.params as FriendsRouteParams | undefined;
  const {
    activeTab,
    setActiveTab,
    openDiscoverTab,
    friends,
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
    pendingRequestCount,
    loadFriends,
    loadRequests,
    reloadDiscover,
    refreshScreen,
    runSearch,
    handleSendRequest,
    handleRespondToRequest,
  } = useFriendsScreenState({
    refreshGame,
    routeParams,
  });

  const identityLabel = formatIdentityLabel(profile?.user?.username, profile?.user?.friend_id);
  const showTopPlayers = !searchQuery.trim();

  useEffect(() => {
    if (activeTab !== "discover") {
      return;
    }
    if (searchFocusKey <= 0) {
      return;
    }
    if (handledFocusKeyRef.current === searchFocusKey) {
      return;
    }
    handledFocusKeyRef.current = searchFocusKey;

    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, searchFocusKey]);

  async function handleShareIdentity() {
    if (!identityLabel) {
      return;
    }

    try {
      await Share.share({
        message: translateOrFallback(
          t,
          "screens.friends.shareIdentityMessage",
          `Мой код в RPG Life: ${identityLabel}. Добавь меня через поиск по username.`,
          { identity: identityLabel },
        ),
      });
    } catch {
      // Native share is best-effort.
    }
  }

  function openPlayerProfile(userId: number, userName?: string | null) {
    navigation.navigate("PlayerProfile", {
      userId,
      userName,
    });
  }

  return (
    <Screen
      title={t("screens.friends.title")}
      subtitle={translateOrFallback(t, "screens.friends.subtitle", "Друзья, заявки и поиск игроков в едином social-разделе.")}
      scrollable={false}
    >
      <ScreenRenderBoundary
        resetKeys={[
          activeTab,
          friends.length,
          incomingRequests.length,
          outgoingRequests.length,
          discoverSuggestions.length,
          searchResults.length,
          searchQuery,
        ]}
        fallback={({ error, reset }) => (
          <StateBlock
            tone="warning"
            icon="alert-circle"
            title={translateOrFallback(t, "screens.friends.errorTitle", "Не удалось открыть раздел")}
            description={error.message || translateOrFallback(t, "screens.friends.errors.loadFriends", "Произошла ошибка при рендере списка друзей.")}
            actionLabel={translateOrFallback(t, "common.retry", "Повторить")}
            onAction={() => {
              reset();
              void refreshScreen();
            }}
          />
        )}
      >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentBody}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshScreen()} tintColor={colors.primary} />}
      >
        <FriendsSummaryCard
          t={t}
          friendsCount={friends.length}
          incomingCount={incomingRequests.length}
          outgoingCount={outgoingRequests.length}
          identityLabel={identityLabel}
          onFindFriends={() => openDiscoverTab(false)}
          onShareIdentity={identityLabel ? handleShareIdentity : undefined}
        />

        <FriendsTabBar
          activeTab={activeTab}
          pendingRequestCount={pendingRequestCount}
          onChange={(tab) => {
            if (tab === "discover") {
              openDiscoverTab(false);
              return;
            }
            setActiveTab(tab);
          }}
        />

        {activeTab === "friends" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{translateOrFallback(t, "screens.friends.myFriends", "Мои друзья")}</Text>
              <Button
                label={translateOrFallback(t, "screens.friends.findFriendsTitle", "Найти друзей")}
                icon="account-plus-outline"
                onPress={() => openDiscoverTab(false)}
                variant="secondary"
                style={styles.headerButton}
              />
            </View>

            {!!friendsError ? (
              <StateBlock
                tone="warning"
                icon="alert-circle"
                title={t("screens.friends.errorTitle")}
                description={friendsError}
                actionLabel={t("common.retry")}
                onAction={() => void loadFriends()}
              />
            ) : null}

            {friendsLoading ? (
              <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
            ) : null}

            {!friendsLoading && friends.length === 0 ? (
              <StateBlock
                icon="account-multiple-plus"
                title={translateOrFallback(t, "screens.friends.empty.friendsTitle", "Пока друзей нет")}
                description={translateOrFallback(
                  t,
                  "screens.friends.empty.friendsDescription",
                  "Добавь союзников по username или из топа игроков, чтобы видеть их уровень, рейтинг и статус активности.",
                )}
                actionLabel={translateOrFallback(t, "screens.friends.findFriendsTitle", "Найти друзей")}
                onAction={() => openDiscoverTab(false)}
              />
            ) : null}

            {friends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                t={t}
                onInspect={() => openPlayerProfile(friend.id, friend.name)}
              />
            ))}
          </View>
        ) : null}

        {activeTab === "requests" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Заявки в друзья</Text>

            {!!requestsError ? (
              <StateBlock
                tone="warning"
                icon="alert-circle"
                title={t("screens.friends.errorTitle")}
                description={requestsError}
                actionLabel={t("common.retry")}
                onAction={() => void loadRequests()}
              />
            ) : null}

            {requestsLoading ? (
              <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
            ) : null}

            {!requestsLoading && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
              <StateBlock
                icon="email-outline"
                title="Заявок пока нет"
                description="Когда кто-то отправит запрос в друзья, он появится здесь. Исходящие заявки тоже хранятся в этом разделе."
              />
            ) : null}

            {incomingRequests.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Входящие</Text>
                {incomingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    t={t}
                    loading={respondingIds.includes(request.id)}
                    onAccept={() => void handleRespondToRequest(request.id, "accept", request.user.id)}
                    onDecline={() => void handleRespondToRequest(request.id, "decline", request.user.id)}
                    onInspect={() => openPlayerProfile(request.user.id, request.user.name)}
                  />
                ))}
              </View>
            ) : null}

            {outgoingRequests.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Исходящие</Text>
                {outgoingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    t={t}
                    onInspect={() => openPlayerProfile(request.user.id, request.user.name)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === "discover" ? (
          <View style={styles.section}>
            <Card tone="subtle">
              <Text style={styles.sectionTitle}>{translateOrFallback(t, "screens.friends.findFriendsTitle", "Найти друзей")}</Text>
              <Text style={styles.searchHint}>
                Без запроса мы показываем топ-10 игроков приложения по рейтингу. Если ввести username, ниже появятся точные результаты поиска.
              </Text>
              <View style={styles.searchRow}>
                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={translateOrFallback(t, "screens.friends.searchPlaceholder", "Поиск по username")}
                  placeholderTextColor={colors.textDim}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => void runSearch(searchQuery)}
                />
                <Button
                  label={t("common.search")}
                  icon="magnify"
                  onPress={() => void runSearch(searchQuery)}
                  style={styles.searchButton}
                />
              </View>
              {searchQuery.trim() ? (
                <Button
                  label="Очистить поиск"
                  icon="close-circle-outline"
                  onPress={() => {
                    setSearchQuery("");
                    void runSearch("");
                  }}
                  variant="secondary"
                />
              ) : null}
            </Card>

            {showTopPlayers ? (
              <>
                {!!(socialGraphError ?? discoverError) ? (
                  <StateBlock
                    tone="warning"
                    icon="alert-circle"
                    title={t("screens.friends.errorTitle")}
                    description={socialGraphError ?? discoverError ?? undefined}
                    actionLabel={t("common.retry")}
                    onAction={() => void reloadDiscover()}
                  />
                ) : null}

                {discoverLoading || ((socialGraphLoading || !discoverActionsReady) && !(socialGraphError ?? discoverError)) ? (
                  <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
                ) : null}

                {!discoverLoading && !socialGraphLoading && !socialGraphError && !discoverError && discoverSuggestions.length === 0 ? (
                  <StateBlock
                    icon="trophy-outline"
                    title="Топ игроков пока пуст"
                    description="Когда сервер вернёт рейтинг, здесь появятся лучшие игроки приложения, которых можно добавить в друзья."
                  />
                ) : null}

                {!discoverLoading && !socialGraphLoading && discoverActionsReady && discoverSuggestions.length > 0 ? (
                  <View style={styles.block}>
                    <Text style={styles.blockTitle}>Топ-10 по рейтингу</Text>
                    {discoverSuggestions.map((user) => {
                      const isSending = sendingIds.includes(user.id);
                      const isResponding = user.request_id != null && respondingIds.includes(user.request_id);
                      return (
                        <FriendSearchResultCard
                          key={`discover-${user.id}`}
                          user={user}
                          t={t}
                          sending={isSending}
                          responding={isResponding}
                          onAdd={() => void handleSendRequest(user.id)}
                          onAccept={user.request_id ? () => void handleRespondToRequest(user.request_id!, "accept", user.id) : undefined}
                          onDecline={user.request_id ? () => void handleRespondToRequest(user.request_id!, "decline", user.id) : undefined}
                          onInspect={() => openPlayerProfile(user.id, user.name)}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : null}

            {!showTopPlayers ? (
              <>
                {!!searchError ? (
                  <StateBlock
                    tone="warning"
                    icon="alert-circle"
                    title={t("screens.friends.errorTitle")}
                    description={searchError}
                    actionLabel={t("common.retry")}
                    onAction={() => void reloadDiscover()}
                  />
                ) : null}

                {searchLoading ? (
                  <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
                ) : null}

                {!searchLoading && searchSubmitted && searchResults.length === 0 ? (
                  <StateBlock
                    icon="account-search-outline"
                    title={translateOrFallback(t, "screens.friends.empty.searchTitle", "Никого не нашли")}
                    description={translateOrFallback(
                      t,
                      "screens.friends.empty.searchDescription",
                      "Попробуй другой username. Если пользователь удалён или недоступен, сервер вернёт пустой результат или ошибку.",
                    )}
                  />
                ) : null}

                {searchResults.map((user) => {
                  const isSending = sendingIds.includes(user.id);
                  const isResponding = user.request_id != null && respondingIds.includes(user.request_id);
                  return (
                    <FriendSearchResultCard
                      key={`search-${user.id}`}
                      user={user}
                      t={t}
                      sending={isSending}
                      responding={isResponding}
                      onAdd={() => void handleSendRequest(user.id)}
                      onAccept={user.request_id ? () => void handleRespondToRequest(user.request_id!, "accept", user.id) : undefined}
                      onDecline={user.request_id ? () => void handleRespondToRequest(user.request_id!, "decline", user.id) : undefined}
                      onInspect={() => openPlayerProfile(user.id, user.name)}
                    />
                  );
                })}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      </ScreenRenderBoundary>
    </Screen>
  );
}

export function FriendsScreen() {
  return (
    <ScreenRenderBoundary
      fallback={({ error, reset }) => (
        <Screen title="Друзья" subtitle="Ошибка рендера раздела друзей." scrollable={false}>
          <StateBlock
            tone="warning"
            icon="alert-circle"
            title="Не удалось открыть раздел друзей"
            description={error.message || "Произошла ошибка рендера. Попробуй повторить."}
            actionLabel="Повторить"
            onAction={reset}
          />
        </Screen>
      )}
    >
      <FriendsScreenContent />
    </ScreenRenderBoundary>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
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
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "900",
    },
    headerButton: {
      minWidth: 160,
    },
    block: {
      gap: 10,
    },
    blockTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    searchHint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      minHeight: 52,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      color: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    searchButton: {
      minWidth: 120,
    },
  });
}
