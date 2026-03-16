import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { claimSeasonalGoalReward, fetchEvents, fetchRewardsSummary, type RewardsSummaryPayload } from "../api/game";
import { Card } from "../components/Card";
import { GameButton } from "../components/GameButton";
import { Screen } from "../components/Screen";
import { useFeedback } from "../context/FeedbackContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { useThemeColors, useThemeMode } from "../ui";

export function EventsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [seasonalGoal, setSeasonalGoal] = useState<RewardsSummaryPayload["seasonal_goal"] | null>(null);
  const t = useTranslation();
  const { language } = useLocalization();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const { pushToast, playSound } = useFeedback();

  useEffect(() => {
    Promise.all([fetchEvents(), fetchRewardsSummary()])
      .then(([eventsPayload, rewardsPayload]) => {
        setItems(eventsPayload.items);
        setSeasonalGoal(rewardsPayload.seasonal_goal ?? null);
      })
      .catch(console.error);
  }, []);

  async function handleClaimSeasonalReward() {
    const result = await claimSeasonalGoalReward();
    if ((result as { queued?: boolean })?.queued) {
      pushToast({
        title: t("offline.queuedActionTitle"),
        description:
          language === "en"
            ? "Seasonal reward was queued and will be claimed automatically once you are back online."
            : "Сезонная награда поставлена в очередь и будет получена автоматически после восстановления сети.",
        icon: "calendar-star",
        tone: "info",
      });
      return;
    }

    const reward = result as {
      reward_xp?: number;
      reward_crystals?: number;
      tier_title?: string;
    };

    await playSound("level");
    pushToast({
      title:
        reward.tier_title && language === "en"
          ? `${reward.tier_title} claimed`
          : reward.tier_title
            ? `Получена награда: ${reward.tier_title}`
            : language === "en"
              ? "Seasonal reward claimed"
              : "Сезонная награда получена",
      description:
        language === "en"
          ? `+${reward.reward_xp ?? 0} XP and +${reward.reward_crystals ?? 0} gold`
          : `+${reward.reward_xp ?? 0} XP и +${reward.reward_crystals ?? 0} золота`,
      icon: "gift-open-outline",
      tone: "reward",
    });

    const rewardsPayload = await fetchRewardsSummary();
    setSeasonalGoal(rewardsPayload.seasonal_goal ?? null);
  }

  function translateValue(group: "status" | "types", value?: string | null) {
    const key = `screens.events.${group}.${value ?? "unknown"}`;
    const translated = t(key);
    return translated === key ? value ?? "-" : translated;
  }

  return (
    <Screen title={t("screens.events.title")} subtitle={t("screens.events.subtitle")}>
      {seasonalGoal ? (
        <Card>
          <Text style={styles.title}>{seasonalGoal.event_title}</Text>
          <Text style={styles.meta}>{seasonalGoal.focus_label}</Text>
          <Text style={styles.description}>{seasonalGoal.state_message}</Text>
          <View style={styles.tierList}>
            {(seasonalGoal.tiers ?? []).map((tier) => (
              <View key={tier.index} style={styles.tierRow}>
                <Text style={styles.tierTitle}>{tier.title}</Text>
                <Text style={styles.meta}>
                  {tier.progress}/{tier.target} • +{tier.reward.xp} XP / +{tier.reward.crystals}
                  {tier.reward.chest_name ? ` / ${language === "en" ? "chest" : "сундук"}` : ""}
                </Text>
              </View>
            ))}
          </View>
          {seasonalGoal.claimable ? (
            <GameButton
              label={
                seasonalGoal.next_tier_title
                  ? language === "en"
                    ? `Claim ${seasonalGoal.next_tier_title}`
                    : `Забрать: ${seasonalGoal.next_tier_title}`
                  : language === "en"
                    ? "Claim seasonal reward"
                    : "Забрать сезонную награду"
              }
              onPress={handleClaimSeasonalReward}
            />
          ) : null}
        </Card>
      ) : null}
      {items.length ? (
        items.map((item) => (
          <Card key={item.id}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{t("screens.events.fields.type")}: {translateValue("types", item.event_type)}</Text>
            <Text style={styles.meta}>{t("screens.events.fields.status")}: {translateValue("status", item.status)}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </Card>
        ))
      ) : (
        <Text style={styles.description}>{t("screens.events.empty")}</Text>
      )}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 18
  },
  meta: {
    color: colors.textMuted
  },
  description: {
    color: colors.textMuted
  },
  tierList: {
    gap: 8,
  },
  tierRow: {
    backgroundColor: themeMode === "light" ? colors.backgroundInset : "#132036",
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  tierTitle: {
    color: colors.text,
    fontWeight: "700",
  }
  });
}
