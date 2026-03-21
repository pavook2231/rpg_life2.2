import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchGoalTemplates, selectGoal, type GoalTemplatePayload } from "../api/game";
import { Screen } from "../components/Screen";
import { useFeedback } from "../context/FeedbackContext";
import { useGameProgress } from "../context/GameContext";
import { useTranslation } from "../context/LocalizationContext";
import { clearGoalSetupPending } from "../storage/beginnerOnboardingStorage";
import { Button, Card, GameIcon, radii, useThemeColors, useThemeMode } from "../ui";

const GOAL_TERMS = [3, 6, 9] as const;

function getFallbackGoals(t: (key: string, params?: Record<string, string | number>) => string): GoalTemplatePayload["goals"] {
  return [
    {
      id: "weight_health",
      title: t("goals.fallback.weight_health.title"),
      description: t("goals.fallback.weight_health.description"),
      result_example: t("goals.fallback.weight_health.result"),
      icon: "run-fast",
      accent_color: "#2ecc71",
      recommended_term_months: 6,
      is_primary: true,
    },
    {
      id: "new_profession",
      title: t("goals.fallback.new_profession.title"),
      description: t("goals.fallback.new_profession.description"),
      result_example: t("goals.fallback.new_profession.result"),
      icon: "briefcase-variant-outline",
      accent_color: "#8b5cf6",
      recommended_term_months: 9,
      is_primary: true,
    },
    {
      id: "financial_growth",
      title: t("goals.fallback.financial_growth.title"),
      description: t("goals.fallback.financial_growth.description"),
      result_example: t("goals.fallback.financial_growth.result"),
      icon: "cash-multiple",
      accent_color: "#f1c40f",
      recommended_term_months: 6,
      is_primary: true,
    },
    {
      id: "discipline_productivity",
      title: t("goals.fallback.discipline_productivity.title"),
      description: t("goals.fallback.discipline_productivity.description"),
      result_example: t("goals.fallback.discipline_productivity.result"),
      icon: "timer-check-outline",
      accent_color: "#3498db",
      recommended_term_months: 3,
      is_primary: true,
    },
    {
      id: "personal_development",
      title: t("goals.fallback.personal_development.title"),
      description: t("goals.fallback.personal_development.description"),
      result_example: t("goals.fallback.personal_development.result"),
      icon: "brain",
      accent_color: "#f39c12",
      recommended_term_months: 6,
      is_primary: true,
    },
  ];
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

export function GoalSelectScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const t = useTranslation();
  const { profile, refreshGame } = useGameProgress();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const fallbackGoals = useMemo(() => getFallbackGoals(t), [t]);
  const [goals, setGoals] = useState<GoalTemplatePayload["goals"]>(fallbackGoals);
  const [goalType, setGoalType] = useState(profile?.user?.goal_type ?? fallbackGoals[0]?.id ?? "personal_development");
  const [goalTermMonths, setGoalTermMonths] = useState<number>(profile?.user?.goal_term_months ?? 6);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setGoalType(profile?.user?.goal_type ?? fallbackGoals[0]?.id ?? "personal_development");
    setGoalTermMonths(profile?.user?.goal_term_months ?? 6);
  }, [fallbackGoals, profile?.user?.goal_term_months, profile?.user?.goal_type]);

  useEffect(() => {
    let active = true;

    fetchGoalTemplates()
      .then((payload) => {
        if (!active) {
          return;
        }

        const nextGoals = payload.goals?.length ? payload.goals : fallbackGoals;
        setGoals(nextGoals);
        if (!nextGoals.some((goal) => goal.id === goalType)) {
          setGoalType(nextGoals[0]?.id ?? goalType);
        }
      })
      .catch(() => {
        if (active) {
          setGoals(fallbackGoals);
        }
      });

    return () => {
      active = false;
    };
  }, [fallbackGoals, goalType]);

  const selectedGoal = goals.find((goal) => goal.id === goalType) ?? goals[0] ?? fallbackGoals[0];

  async function handleApplyGoal() {
    if (!selectedGoal) {
      return;
    }

    try {
      setIsSubmitting(true);
      await selectGoal({
        goal_type: selectedGoal.id,
        goal_term_months: goalTermMonths,
        start_new_cycle: true,
      });
      if (profile?.user?.id) {
        await clearGoalSetupPending(profile.user.id);
      }
      await refreshGame();
      await pushToast(
        {
          title: t("screens.profile.quick.goalUpdatedTitle"),
          description: t("screens.profile.quick.goalUpdatedDescription"),
          icon: "flag-checkered",
          tone: "success",
        },
        { haptic: "success" },
      );
      navigation.goBack();
    } catch (error) {
      await pushToast({
        title: t("screens.profile.quick.goalUpdateFailed"),
        description: error instanceof Error ? error.message : t("common.error"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      title={translateOrFallback(t, "screens.home.quick.goalCtaTitle", "Выбери цель")}
      subtitle={translateOrFallback(
        t,
        "screens.home.quick.goalCtaDescription",
        "С этого начинается понятный план: по цели приложение соберет первые задания и покажет прогресс.",
      )}
    >
      <Card>
        <Text style={styles.sectionTitle}>{t("screens.profile.quick.goalsTitle")}</Text>
        <Text style={styles.sectionSubtitle}>{selectedGoal?.description ?? t("screens.profile.quick.goalsSubtitle")}</Text>

        <View style={styles.goalList}>
          {goals.map((goal) => {
            const active = goal.id === goalType;
            return (
              <Pressable
                key={goal.id}
                style={[
                  styles.goalCard,
                  active ? styles.goalCardActive : null,
                  {
                    borderColor: active ? goal.accent_color : colors.border,
                    backgroundColor: active ? `${goal.accent_color}18` : colors.backgroundInset,
                  },
                ]}
                onPress={() => setGoalType(goal.id)}
              >
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIconWrap, { borderColor: `${goal.accent_color}99` }]}>
                    <GameIcon name={goal.icon} size={18} color={goal.accent_color} />
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalDescription}>{goal.description}</Text>
                    <Text style={styles.goalResult}>{goal.result_example}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.profile.quick.goalTermMonths", { months: goalTermMonths })}</Text>
        <View style={styles.termRow}>
          {GOAL_TERMS.map((months) => {
            const active = goalTermMonths === months;
            return (
              <Pressable
                key={months}
                style={[styles.termChip, active ? styles.termChipActive : null]}
                onPress={() => setGoalTermMonths(months)}
              >
                <Text style={[styles.termText, active ? styles.termTextActive : null]}>
                  {t("screens.profile.quick.goalTermMonths", { months })}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedGoal ? (
          <Text style={styles.termHint}>
            {t("screens.register.quick.goalTermHint", { months: selectedGoal.recommended_term_months })}
          </Text>
        ) : null}
      </Card>

      <Button
        label={isSubmitting ? t("common.loading") : t("screens.profile.quick.applyGoalCycle")}
        icon="flag-checkered"
        onPress={handleApplyGoal}
        disabled={isSubmitting || !selectedGoal}
        loading={isSubmitting}
      />
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    sectionSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    goalList: {
      gap: 10,
    },
    goalCard: {
      borderRadius: radii.md,
      borderWidth: 1,
      padding: 12,
    },
    goalCardActive: {
      shadowOpacity: themeMode === "light" ? 0.12 : 0,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    goalHeader: {
      flexDirection: "row",
      gap: 10,
    },
    goalIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    goalCopy: {
      flex: 1,
      gap: 3,
    },
    goalTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    goalDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    goalResult: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
    },
    termRow: {
      flexDirection: "row",
      gap: 8,
    },
    termChip: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      alignItems: "center",
      paddingVertical: 10,
    },
    termChipActive: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "#f2dfbf" : "#112036",
    },
    termText: {
      color: colors.textMuted,
      fontWeight: "700",
    },
    termTextActive: {
      color: themeMode === "light" ? "#7a4b12" : "#bfdbfe",
    },
    termHint: {
      color: colors.textDim,
      fontSize: 12,
    },
  });
}
