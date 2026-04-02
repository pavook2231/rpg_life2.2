import { StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

export function QuestsScreen() {
  const { session, completeQuest } = useSession();
  const { colors, spacing, radius } = useAppTheme();
  const styles = createStyles(colors, spacing, radius);

  if (!session) {
    return null;
  }

  return (
    <ScreenShell
      title="Квесты"
      subtitle="Здесь только полезные задания для похудения: без случайного шума, только действия, которые реально влияют на результат."
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>День программы №{session.programDay}</Text>
          <Text style={styles.cardText}>
            Когда закрываешь все задания дня, система открывает следующий день и наращивает серию.
          </Text>
        </View>
      </AppCard>

      {session.quests.map((quest) => (
        <AppCard key={quest.id}>
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <View style={styles.titleBlock}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.questDescription}>{quest.description}</Text>
              </View>
              <Text style={styles.xpTag}>+{quest.xpReward} XP</Text>
            </View>

            <Text style={styles.reasonText}>{quest.reasonText}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>
                Цель: {quest.targetValue.toLocaleString("ru-RU")} {quest.unit}
              </Text>
              <Text style={styles.metaLabel}>Сложность: {quest.difficultyLevel}/5</Text>
            </View>

            <AppButton
              title={quest.status === "completed" ? "Выполнено" : "Отметить выполнение"}
              onPress={() => completeQuest(quest.id)}
              disabled={quest.status === "completed"}
            />
          </View>
        </AppCard>
      ))}
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
      alignItems: "flex-start",
      gap: spacing.md
    },
    titleBlock: {
      flex: 1,
      gap: spacing.xs
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
    questTitle: {
      fontSize: 21,
      lineHeight: 27,
      fontWeight: "800",
      color: colors.text
    },
    questDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted
    },
    xpTag: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
      color: colors.text,
      fontSize: 12,
      fontWeight: "800"
    },
    reasonText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    metaLabel: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700"
    }
  });
