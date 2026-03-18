import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchLeaderboard } from "../api/game";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { useTranslation } from "../context/LocalizationContext";

const metrics = ["level", "quests", "steps", "challenge_wins"] as const;
const META_SEPARATOR = " | ";
const EMPTY_VALUE = "-";

export function LeaderboardScreen() {
  const [metric, setMetric] = useState<(typeof metrics)[number]>("level");
  const [items, setItems] = useState<any[]>([]);
  const t = useTranslation();

  useEffect(() => {
    fetchLeaderboard(metric).then((payload) => setItems(payload.items)).catch(() => undefined);
  }, [metric]);

  function getMetricLabel(value: (typeof metrics)[number]) {
    const key = `screens.leaderboard.metrics.${value}`;
    const translated = t(key);
    return translated === key ? value : translated;
  }

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
      {items.map((item) => (
        <Card key={item.user_id}>
          <Text style={styles.title}>
            #{item.rank} {item.name}
          </Text>
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

const styles = StyleSheet.create({
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
