import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useGameProgress } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { LeaderboardFilterBar } from "../features/leaderboard/components/LeaderboardFilterBar";
import { LeaderboardPodium } from "../features/leaderboard/components/LeaderboardPodium";
import { LeaderboardRowCard } from "../features/leaderboard/components/LeaderboardRowCard";
import { LeaderboardSummaryCard } from "../features/leaderboard/components/LeaderboardSummaryCard";
import type { LeaderboardRouteParams } from "../features/leaderboard/types";
import { useLeaderboardScreenState } from "../features/leaderboard/useLeaderboardScreenState";
import { getScopeLabel, translateOrFallback } from "../features/leaderboard/utils";
import { Button } from "../ui";
import { useThemeColors } from "../ui/theme";

export function LeaderboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile } = useGameProgress();
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const routeParams = route.params as LeaderboardRouteParams | undefined;
  const {
    scope,
    setScope,
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
    reload,
  } = useLeaderboardScreenState({
    routeParams,
    loadErrorMessage: translateOrFallback(t, "screens.friends.errors.loadLeaderboard", "Не удалось загрузить лидерборд."),
  });

  const currentUserId = profile?.user?.id ?? null;
  const topPlayers = items.slice(0, 3);
  const rankedPlayers = items.slice(3);
  const visibleUserIds = useMemo(() => new Set(items.map((entry) => entry.user_id)), [items]);
  const isCurrentUserVisible = meEntry ? visibleUserIds.has(meEntry.user_id) : false;
  const emptyTitle = translateOrFallback(t, "screens.friends.empty.leaderboardTitle", "Рейтинг пока пуст");
  const emptyDescription = translateOrFallback(
    t,
    "screens.friends.empty.leaderboardDescription",
    "Когда у игроков появится прогресс, сервер начнёт возвращать актуальный рейтинг без локальных вычислений.",
  );

  function openPlayerProfile(userId: number, userName?: string | null) {
    navigation.navigate("PlayerProfile", {
      userId,
      userName,
    });
  }

  return (
    <Screen
      title={translateOrFallback(t, "screens.leaderboard.title", "Лидерборд")}
      subtitle={translateOrFallback(
        t,
        "screens.leaderboard.subtitle",
        "Глобальный и дружеский рейтинг на основе одного backend-источника прогресса.",
      )}
      scrollable={false}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshScreen()} tintColor={colors.primary} />}
      >
        <LeaderboardSummaryCard
          scope={scope}
          totalPlayers={payload?.pagination.total_items ?? 0}
          meEntry={meEntry}
          showCurrentUserPanel={Boolean(meEntry && !isCurrentUserVisible)}
          t={t}
        />

        <LeaderboardFilterBar scope={scope} onChange={setScope} t={t} />

        {!!error ? (
          <StateBlock
            tone="warning"
            icon="alert-circle"
            title={translateOrFallback(t, "screens.friends.errorTitle", "Не удалось загрузить раздел")}
            description={error}
            actionLabel={translateOrFallback(t, "common.retry", "Повторить")}
            onAction={reload}
          />
        ) : null}

        {!error && loading ? (
          <StateBlock tone="info" icon="timer-sand" title={translateOrFallback(t, "common.loading", "Загрузка")} />
        ) : null}

        {!error && !loading && payload && items.length === 0 ? (
          <StateBlock
            icon="trophy-outline"
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={translateOrFallback(t, "common.createGoal", "Выбрать цель")}
            onAction={() => navigation.navigate("GoalSelect")}
          />
        ) : null}

        {!error && !loading && items.length > 0 ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{translateOrFallback(t, "screens.leaderboard.topThree", "Топ-3")}</Text>
              <LeaderboardPodium items={topPlayers} t={t} onSelect={(entry) => openPlayerProfile(entry.user_id, entry.name)} />
            </View>

            {rankedPlayers.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {translateOrFallback(t, "screens.leaderboard.rankings", `${getScopeLabel(scope, t)} рейтинг`)}
                </Text>
                {rankedPlayers.map((entry) => (
                  <LeaderboardRowCard
                    key={entry.user_id}
                    entry={entry}
                    t={t}
                    isCurrentUser={Boolean(entry.is_current_user || entry.user_id === currentUserId)}
                    onPress={() => openPlayerProfile(entry.user_id, entry.name)}
                  />
                ))}
              </View>
            ) : null}

            {hasMore ? (
              <Button
                label={translateOrFallback(t, "common.loadMore", "Загрузить еще")}
                onPress={() => void loadMore()}
                loading={loadingMore}
                variant="secondary"
                style={styles.loadMoreButton}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
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
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    loadMoreButton: {
      alignSelf: "stretch",
    },
  });
}
