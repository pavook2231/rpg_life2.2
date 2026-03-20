import { useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardPeriod, type LeaderboardResponse } from "../api/game";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useTranslation } from "../context/LocalizationContext";
import { useThemeColors } from "../ui/theme";

const metrics = ["level", "quests", "steps", "challenge_wins"] as const;
const periods = ["weekly", "season", "all_time"] as const;
const META_SEPARATOR = " | ";
const EMPTY_VALUE = "-";

function formatIdentityLabel(username?: string | null, friendId?: string | null) {
  const parts = [username ? `@${username}` : null, friendId ?? null].filter(Boolean);
  return parts.length ? parts.join(META_SEPARATOR) : null;
}

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function LeaderboardScreen() {
  const route = useRoute<any>();
  const [metric, setMetric] = useState<(typeof metrics)[number]>("level");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [payload, setPayload] = useState<LeaderboardResponse | null>(null);
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadSeed, setReloadSeed] = useState(0);
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const initialPeriod = route.params?.initialPeriod as LeaderboardPeriod | undefined;
    if (initialPeriod && periods.includes(initialPeriod)) {
      setPeriod(initialPeriod);
    }
  }, [route.params?.initialPeriod, route.params?.requestedAt]);

  useEffect(() => {
    setPayload(null);
    fetchLeaderboard(metric, "global", 1, 20, period)
      .then((nextPayload) => {
        setPayload(nextPayload);
        setItems(nextPayload.items);
        setError(null);
      })
      .catch((loadError) => {
        setItems([]);
        setPayload(null);
        setError(loadError instanceof Error ? loadError.message : t("screens.friends.errors.loadLeaderboard"));
      });
  }, [metric, period, reloadSeed, t]);

  function getMetricLabel(value: (typeof metrics)[number]) {
    const key = `screens.leaderboard.metrics.${value}`;
    const translated = t(key);
    return translated === key ? value : translated;
  }

  function getPeriodLabel(value: LeaderboardPeriod) {
    switch (value) {
      case "weekly":
        return translateOrFallback(t, "screens.friends.periods.weekly", "Неделя");
      case "season":
        return translateOrFallback(t, "screens.friends.periods.season", "Сезон");
      default:
        return translateOrFallback(t, "screens.friends.periods.all_time", "Все время");
    }
  }

  const periodEndsLabel = payload?.period_ends_at ? new Date(payload.period_ends_at).toLocaleDateString() : null;

  return (
    <Screen title={t("screens.leaderboard.title")} subtitle={t("screens.leaderboard.subtitle")}>
      <View style={styles.filters}>
        {metrics.map((entry) => (
          <Pressable
            key={entry}
            style={[styles.filter, metric === entry ? styles.filterActive : null]}
            onPress={() => setMetric(entry)}
          >
            <Text style={[styles.filterText, metric === entry ? styles.filterTextActive : null]}>{getMetricLabel(entry)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filters}>
        {periods.map((entry) => (
          <Pressable
            key={entry}
            style={[styles.filter, period === entry ? styles.filterActive : null]}
            onPress={() => setPeriod(entry)}
          >
            <Text style={[styles.filterText, period === entry ? styles.filterTextActive : null]}>{getPeriodLabel(entry)}</Text>
          </Pressable>
        ))}
      </View>
      {periodEndsLabel ? (
        <Text style={styles.hint}>
          {translateOrFallback(t, "screens.friends.periodEnds", `Окно заканчивается ${periodEndsLabel}`, { date: periodEndsLabel })}
        </Text>
      ) : null}
      {!!error ? (
        <StateBlock
          tone="warning"
          icon="alert-circle"
          title={t("screens.friends.errorTitle")}
          description={error}
          actionLabel={t("common.retry")}
          onAction={() => setReloadSeed((value) => value + 1)}
        />
      ) : null}
      {!error && payload === null ? (
        <StateBlock
          tone="info"
          icon="timer-sand"
          title={t("common.loading")}
        />
      ) : null}
      {!error && payload && items.length === 0 ? (
        <StateBlock
          icon="flag-checkered"
          title={t("screens.friends.empty.leaderboardTitle")}
          description={t("screens.friends.empty.leaderboardDescription")}
        />
      ) : null}
      {items.map((item) => (
        <Card key={item.user_id}>
          <Text style={styles.title}>
            #{item.rank} {item.name}
          </Text>
          {formatIdentityLabel(item.username, item.friend_id) ? (
            <Text style={styles.meta}>{formatIdentityLabel(item.username, item.friend_id)}</Text>
          ) : null}
          <Text style={styles.subTitle}>
            {t("screens.leaderboard.fields.class")}: {item.class_display_name ?? item.class_name ?? EMPTY_VALUE}
            {META_SEPARATOR}
            {t("screens.leaderboard.fields.level")}: {item.class_level ?? item.level}
          </Text>
          <Text style={styles.meta}>
            {t("screens.leaderboard.fields.goal")}:
            {item.goal_type ? ` ${item.goal_type}` : ` ${EMPTY_VALUE}`}
            {item.goal_progress_percent != null && typeof item.goal_progress_percent === "number"
              ? ` (${item.goal_progress_percent}%${item.goal_target_xp ? `, ${item.goal_cycle_xp}/${item.goal_target_xp} XP` : ""})`
              : ""}
          </Text>
          <Text style={styles.meta}>{t("screens.leaderboard.fields.score")}: {item.score}</Text>
          <Text style={styles.meta}>{t("screens.leaderboard.fields.quests")}: {item.quests_completed}</Text>
          <Text style={styles.meta}>{t("screens.leaderboard.fields.steps")}: {item.steps}</Text>
          <Text style={styles.meta}>{t("screens.leaderboard.fields.challengeWins")}: {item.challenge_wins}</Text>
        </Card>
      ))}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    filters: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    filter: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#334155",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    filterActive: {
      backgroundColor: "#22c55e",
      borderColor: "#22c55e",
    },
    filterText: {
      color: "#cbd5e1",
      fontSize: 12,
      fontWeight: "600",
    },
    filterTextActive: {
      color: "#052e16",
    },
    hint: {
      color: colors.textDim,
      fontSize: 13,
      marginTop: 12,
      marginBottom: 8,
    },
    title: {
      color: "#f8fafc",
      fontWeight: "700",
      fontSize: 18,
    },
    subTitle: {
      color: "#cbd5e1",
      fontSize: 13,
      marginTop: 4,
    },
    meta: {
      color: "#cbd5e1",
    },
  });
}
