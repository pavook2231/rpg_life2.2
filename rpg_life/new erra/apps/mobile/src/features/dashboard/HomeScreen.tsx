import { StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppCard } from "../../components/ui/AppCard";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { getSummary } from "../../lib/demo-api";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

export function HomeScreen() {
  const { session } = useSession();
  const { colors, spacing, radius } = useAppTheme();
  const styles = createStyles(colors, spacing, radius);

  if (!session) {
    return null;
  }

  const summary = getSummary(session);
  const completedQuests = session.quests.filter((quest) => quest.status === "completed").length;
  const progressBase = Math.max(1, session.questionnaire.weightKg - session.questionnaire.goalWeightKg);
  const progressDone = Math.max(0, session.questionnaire.weightKg - session.currentWeightKg);
  const progressPercent = Math.min(100, Math.round((progressDone / progressBase) * 100));

  return (
    <ScreenShell
      title={`Привет, ${session.user.fullName}`}
      subtitle={`Сегодня у тебя день программы №${session.programDay}. Всё строится вокруг одной цели: снизить вес безопасно и устойчиво.`}
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Как это работает</Text>
          <Text style={styles.cardText}>
            Каждый день ты получаешь полезные квесты, которые действительно двигают к снижению веса: вода, шаги и контроль калорий. Ты не просто закрываешь задачи, а формируешь систему привычек.
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Прогресс к цели</Text>
            <Text style={styles.badge}>{summary.kilosLeft} кг осталось</Text>
          </View>
          <ProgressBar progress={progressPercent} />
          <Text style={styles.cardText}>
            Сейчас: {summary.currentWeightKg} кг · Цель: {summary.goalWeightKg} кг
          </Text>
        </View>
      </AppCard>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{completedQuests}/3</Text>
          <Text style={styles.metricLabel}>Квестов сегодня</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary.streakDays}</Text>
          <Text style={styles.metricLabel}>Серия дней</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary.totalXp}</Text>
          <Text style={styles.metricLabel}>XP всего</Text>
        </View>
      </View>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Фокус на сегодня</Text>
          <View style={styles.focusRow}>
            <Text style={styles.focusLabel}>Вода</Text>
            <Text style={styles.focusValue}>{summary.dailyWaterTargetLiters} л</Text>
          </View>
          <View style={styles.focusRow}>
            <Text style={styles.focusLabel}>Шаги</Text>
            <Text style={styles.focusValue}>{summary.dailyStepTarget.toLocaleString("ru-RU")}</Text>
          </View>
          <View style={styles.focusRow}>
            <Text style={styles.focusLabel}>Калории</Text>
            <Text style={styles.focusValue}>{summary.dailyCalorieTarget.toLocaleString("ru-RU")} ккал</Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Сегодняшние задания</Text>
          {session.quests.map((quest) => (
            <View key={quest.id} style={styles.questRow}>
              <View style={styles.questText}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.questReason}>{quest.reasonText}</Text>
              </View>
              <Text style={[styles.questStatus, quest.status === "completed" && styles.questStatusDone]}>
                {quest.status === "completed" ? "Готово" : "В работе"}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>
    </ScreenShell>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  spacing: ReturnType<typeof useAppTheme>["spacing"],
  radius: ReturnType<typeof useAppTheme>["radius"]
) =>
  StyleSheet.create({
    section: {
      gap: spacing.md
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.md
    },
    cardTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",
      color: colors.text
    },
    cardText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted
    },
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
      color: colors.text,
      fontWeight: "700"
    },
    metricsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md
    },
    metricCard: {
      flex: 1,
      minWidth: 96,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs
    },
    metricValue: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "800",
      color: colors.text
    },
    metricLabel: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted
    },
    focusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    focusLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textMuted
    },
    focusValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text
    },
    questRow: {
      gap: spacing.xs,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    questText: {
      gap: spacing.xs
    },
    questTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "700",
      color: colors.text
    },
    questReason: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted
    },
    questStatus: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      fontSize: 12,
      fontWeight: "700"
    },
    questStatusDone: {
      backgroundColor: colors.success,
      color: "#f6fff7"
    }
  });
