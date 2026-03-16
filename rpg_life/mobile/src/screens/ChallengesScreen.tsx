import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { fetchChallenges } from "../api/game";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { useTranslation } from "../context/LocalizationContext";
import { getObjectiveLabel } from "../lib/gameUi";
import { useThemeColors } from "../ui";

export function ChallengesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    fetchChallenges().then((payload) => setItems(payload.items)).catch(console.error);
  }, []);

  function translateStatus(value?: string | null) {
    const key = `screens.challenges.status.${value ?? "unknown"}`;
    const translated = t(key);
    return translated === key ? value ?? "-" : translated;
  }

  return (
    <Screen title={t("screens.challenges.title")} subtitle={t("screens.challenges.subtitle")}>
      {items.length ? (
        items.map((item) => (
          <Card key={item.id}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{t("screens.challenges.fields.activity")}: {getObjectiveLabel(item.activity_type, t)}</Text>
            <Text style={styles.meta}>{t("screens.challenges.fields.goal")}: {item.goal}</Text>
            <Text style={styles.meta}>{t("screens.challenges.fields.status")}: {translateStatus(item.status)}</Text>
            <Text style={styles.meta}>
              {t("screens.challenges.fields.reward")}: {item.reward.xp} XP / {item.reward.crystals} {t("common.gold")}
            </Text>
            <Text style={styles.meta}>{t("screens.challenges.fields.opponent")}: {item.opponent?.name ?? t("screens.challenges.openSlot")}</Text>
          </Card>
        ))
      ) : (
        <Text style={styles.meta}>{t("screens.challenges.empty")}</Text>
      )}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 18,
  },
  meta: {
    color: colors.textMuted,
  },
  });
}
