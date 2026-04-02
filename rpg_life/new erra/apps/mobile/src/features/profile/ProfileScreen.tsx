import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { AppInput } from "../../components/ui/AppInput";
import { getRussianProfileFacts } from "../../lib/demo-api";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

export function ProfileScreen() {
  const { session, updateProfile } = useSession();
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  const [fullName, setFullName] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [noticeText, setNoticeText] = useState("");

  useEffect(() => {
    if (!session) {
      return;
    }

    setFullName(session.user.fullName);
    setCurrentWeightKg(String(session.currentWeightKg));
    setGoalWeightKg(String(session.questionnaire.goalWeightKg));
  }, [session]);

  if (!session) {
    return null;
  }

  const facts = getRussianProfileFacts(session);

  const handleSave = async () => {
    await updateProfile({
      fullName: fullName.trim(),
      currentWeightKg: Number(currentWeightKg),
      goalWeightKg: Number(goalWeightKg)
    });
    setNoticeText("Профиль обновлён. Следующие квесты будут опираться на новые данные.");
  };

  return (
    <ScreenShell
      title="Профиль"
      subtitle="Здесь хранятся твои исходные данные, по которым программа считает калории, воду и шаги."
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Основные данные</Text>
          <AppInput label="Имя" value={fullName} onChangeText={setFullName} placeholder="Имя" />
          <AppInput
            label="Текущий вес, кг"
            value={currentWeightKg}
            onChangeText={setCurrentWeightKg}
            keyboardType="numeric"
          />
          <AppInput
            label="Цель по весу, кг"
            value={goalWeightKg}
            onChangeText={setGoalWeightKg}
            keyboardType="numeric"
          />
          {noticeText ? <Text style={styles.noticeText}>{noticeText}</Text> : null}
          <AppButton title="Сохранить изменения" onPress={handleSave} />
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Анамнез</Text>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.factRow}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue}>{value}</Text>
            </View>
          ))}
          <Text style={styles.emailText}>Аккаунт: {session.user.email}</Text>
        </View>
      </AppCard>
    </ScreenShell>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  spacing: ReturnType<typeof useAppTheme>["spacing"]
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
    factRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    factLabel: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted
    },
    factValue: {
      maxWidth: "55%",
      fontSize: 15,
      lineHeight: 22,
      textAlign: "right",
      color: colors.text,
      fontWeight: "700"
    },
    emailText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted
    },
    noticeText: {
      color: colors.success,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600"
    }
  });
