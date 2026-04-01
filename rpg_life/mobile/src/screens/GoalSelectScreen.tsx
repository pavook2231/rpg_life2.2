import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
      id: "lose",
      title: "Снижение веса",
      description: "Детерминированная программа снижения веса с анамнезом, базовой точкой и адаптивной ходьбой.",
      result_example: "Понятный маршрут от стартовой точки до регулярного прогресса.",
      icon: "run-fast",
      accent_color: "#2ecc71",
      recommended_term_months: 6,
      is_primary: true,
    },
    {
      id: "maintain",
      title: "Удержание веса",
      description: "Профиль можно сохранить, но полноценная программа удержания пока ещё не включена.",
      result_example: "Этот режим появится позже отдельным маршрутом.",
      icon: "scale-balance",
      accent_color: "#3498db",
      recommended_term_months: 6,
      is_primary: false,
    },
    {
      id: "gain",
      title: "Набор веса",
      description: "Профиль можно сохранить, но отдельная программа набора пока находится в подготовке.",
      result_example: "Для этого режима позже появится собственная логика.",
      icon: "arm-flex",
      accent_color: "#e67e22",
      recommended_term_months: 6,
      is_primary: false,
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
  const [goalType, setGoalType] = useState(profile?.user?.goal_type ?? fallbackGoals[0]?.id ?? "lose");
  const [goalTermMonths, setGoalTermMonths] = useState<number>(profile?.user?.goal_term_months ?? 6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const goalBenefits = useMemo(
    () => [
      {
        icon: "flag-checkered",
        title: translateOrFallback(t, "screens.goalSelect.benefits.planTitle", "Понятный план"),
        description: translateOrFallback(
          t,
          "screens.goalSelect.benefits.planDescription",
          "Приложение подберет первые задания и покажет, как двигаться к результату.",
        ),
      },
      {
        icon: "chart-line",
        title: translateOrFallback(t, "screens.goalSelect.benefits.progressTitle", "Видимый прогресс"),
        description: translateOrFallback(
          t,
          "screens.goalSelect.benefits.progressDescription",
          "Каждый день будет видно, как твои действия реально продвигают цель.",
        ),
      },
      {
        icon: "refresh",
        title: translateOrFallback(t, "screens.goalSelect.benefits.flexibleTitle", "Можно изменить позже"),
        description: translateOrFallback(
          t,
          "screens.goalSelect.benefits.flexibleDescription",
          "Сейчас важно просто выбрать направление. Потом цель можно поменять в профиле.",
        ),
      },
    ],
    [t],
  );

  useEffect(() => {
    setGoalType(profile?.user?.goal_type ?? fallbackGoals[0]?.id ?? "lose");
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
      <Card tone="accent">
        <Text style={styles.previewEyebrow}>
          {translateOrFallback(t, "screens.goalSelect.previewEyebrow", "Что даст этот выбор")}
        </Text>
        <Text style={styles.previewTitle}>{selectedGoal?.title ?? t("screens.profile.quick.goalsTitle")}</Text>
        <Text style={styles.previewDescription}>
          {selectedGoal?.description ??
            translateOrFallback(
              t,
              "screens.profile.quick.goalsSubtitle",
              "Выбери направление, и приложение соберет под него понятный план действий.",
            )}
        </Text>
        {selectedGoal?.result_example ? <Text style={styles.previewResult}>{selectedGoal.result_example}</Text> : null}
        <View style={styles.benefitsList}>
          {goalBenefits.map((benefit) => (
            <View key={benefit.title} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <GameIcon name={benefit.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {translateOrFallback(t, "screens.goalSelect.goalListTitle", "Выбери направление")}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {translateOrFallback(
            t,
            "screens.goalSelect.goalListSubtitle",
            "Выбери самый близкий для себя вариант. Этого достаточно, чтобы начать.",
          )}
        </Text>

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
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {translateOrFallback(t, "screens.goalSelect.termTitle", "Сколько времени дать этой цели")}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {translateOrFallback(
            t,
            "screens.goalSelect.termSubtitle",
            "Для старта выбери комфортный срок. Его тоже можно поменять позже.",
          )}
        </Text>
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
      <Text style={styles.bottomHint}>
        {translateOrFallback(t, "screens.goalSelect.bottomHint", "Позже цель можно поменять в профиле.")}
      </Text>
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
    previewEyebrow: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    previewTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    previewDescription: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    previewResult: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 18,
    },
    benefitsList: {
      gap: 10,
    },
    benefitRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    benefitIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    benefitCopy: {
      flex: 1,
      gap: 2,
    },
    benefitTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    benefitDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
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
    bottomHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      paddingHorizontal: 12,
      marginTop: -4,
    },
  });
}
