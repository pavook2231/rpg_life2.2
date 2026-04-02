import { StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppCard } from "../../components/ui/AppCard";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { getSummary } from "../../lib/demo-api";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

export function ProgressScreen() {
  const { session } = useSession();
  const { colors, spacing, radius } = useAppTheme();
  const styles = createStyles(colors, spacing, radius);

  if (!session) {
    return null;
  }

  const summary = getSummary(session);
  const totalToLose = Math.max(1, session.questionnaire.weightKg - session.questionnaire.goalWeightKg);
  const lostAlready = Math.max(0, session.questionnaire.weightKg - session.currentWeightKg);
  const progressPercent = Math.min(100, Math.round((lostAlready / totalToLose) * 100));

  return (
    <ScreenShell
      title="Прогресс и статистика"
      subtitle="Здесь видно, как маленькие ежедневные действия складываются в большую цель."
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Движение к цели</Text>
          <ProgressBar progress={progressPercent} />
          <Text style={styles.cardText}>
            Старт: {session.questionnaire.weightKg} кг · Сейчас: {summary.currentWeightKg} кг · Цель: {summary.goalWeightKg} кг
          </Text>
        </View>
      </AppCard>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary.kilosLeft}</Text>
          <Text style={styles.metricLabel}>Кг до цели</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary.streakDays}</Text>
          <Text style={styles.metricLabel}>Серия дней</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary.totalXp}</Text>
          <Text style={styles.metricLabel}>Накоплено XP</Text>
        </View>
      </View>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Текущие ориентиры</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Дневной лимит калорий</Text>
            <Text style={styles.infoValue}>{summary.dailyCalorieTarget.toLocaleString("ru-RU")} ккал</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Норма воды</Text>
            <Text style={styles.infoValue}>{summary.dailyWaterTargetLiters} л</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Норма шагов</Text>
            <Text style={styles.infoValue}>{summary.dailyStepTarget.toLocaleString("ru-RU")}</Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Почему это работает</Text>
          <Text style={styles.cardText}>
            Программа не давит случайными заданиями. Она каждый день напоминает о трёх основах похудения: дефицит калорий, движение и водный режим. Именно это создаёт реальный, а не декоративный прогресс.
          </Text>
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
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    infoLabel: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted
    },
    infoValue: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text
    }
  });
