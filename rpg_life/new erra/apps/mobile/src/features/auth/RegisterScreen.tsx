import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  activityLevelLabels,
  eatingPatternLabels,
  genderLabels,
  sleepQualityLabels,
  type ActivityLevel,
  type EatingPattern,
  type Gender,
  type SleepQuality
} from "@new-erra/shared";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { ChoiceGroup } from "../../components/ui/ChoiceGroup";
import { AppInput } from "../../components/ui/AppInput";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

type Props = {
  onSwitchToLogin: () => void;
};

const genderOptions: { value: Gender; label: string }[] = [
  { value: "female", label: genderLabels.female },
  { value: "male", label: genderLabels.male },
  { value: "other", label: genderLabels.other }
];

const activityOptions: { value: ActivityLevel; label: string }[] = [
  { value: "low", label: activityLevelLabels.low },
  { value: "light", label: activityLevelLabels.light },
  { value: "moderate", label: activityLevelLabels.moderate },
  { value: "high", label: activityLevelLabels.high }
];

const eatingOptions: { value: EatingPattern; label: string }[] = [
  { value: "balanced", label: eatingPatternLabels.balanced },
  { value: "emotional", label: eatingPatternLabels.emotional },
  { value: "late_snacking", label: eatingPatternLabels.late_snacking },
  { value: "irregular", label: eatingPatternLabels.irregular }
];

const sleepOptions: { value: SleepQuality; label: string }[] = [
  { value: "poor", label: sleepQualityLabels.poor },
  { value: "average", label: sleepQualityLabels.average },
  { value: "good", label: sleepQualityLabels.good }
];

export function RegisterScreen({ onSwitchToLogin }: Props) {
  const { signUp } = useSession();
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("29");
  const [heightCm, setHeightCm] = useState("168");
  const [weightKg, setWeightKg] = useState("83");
  const [goalWeightKg, setGoalWeightKg] = useState("68");
  const [gender, setGender] = useState<Gender>("female");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [eatingPattern, setEatingPattern] = useState<EatingPattern>("balanced");
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>("average");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorText("");

      await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        questionnaire: {
          age: Number(age),
          gender,
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          activityLevel,
          eatingPattern,
          sleepQuality,
          goalWeightKg: Number(goalWeightKg)
        }
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Не удалось завершить регистрацию.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Новая эра похудения"
      subtitle="Сначала собираем анамнез и стартовые привычки, а затем превращаем цель в понятный ежедневный маршрут."
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Аккаунт</Text>
          <Text style={styles.cardText}>
            Регистрация занимает пару минут, зато потом задания будут подстроены под твои реальные данные.
          </Text>
          <AppInput
            label="Как к тебе обращаться"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Например, Анна"
          />
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="name@example.com"
          />
          <AppInput
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Минимум 8 символов"
          />
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Анамнез</Text>
          <View style={styles.grid}>
            <AppInput label="Возраст" value={age} onChangeText={setAge} keyboardType="numeric" />
            <AppInput
              label="Рост, см"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
            />
            <AppInput
              label="Текущий вес, кг"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
            />
            <AppInput
              label="Желаемый вес, кг"
              value={goalWeightKg}
              onChangeText={setGoalWeightKg}
              keyboardType="numeric"
            />
          </View>
          <ChoiceGroup
            label="Пол"
            value={gender}
            options={genderOptions}
            onChange={(nextValue) => setGender(nextValue as Gender)}
          />
          <ChoiceGroup
            label="Текущая активность"
            value={activityLevel}
            options={activityOptions}
            onChange={(nextValue) => setActivityLevel(nextValue as ActivityLevel)}
          />
          <ChoiceGroup
            label="Пищевые привычки"
            value={eatingPattern}
            options={eatingOptions}
            onChange={(nextValue) => setEatingPattern(nextValue as EatingPattern)}
          />
          <ChoiceGroup
            label="Качество сна"
            value={sleepQuality}
            options={sleepOptions}
            onChange={(nextValue) => setSleepQuality(nextValue as SleepQuality)}
          />
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Что будет дальше</Text>
          <Text style={styles.cardText}>
            После регистрации приложение выдаст ежедневные задания на воду, шаги и контроль калорий. Сложность растёт постепенно, а прогресс фиксируется в XP, серии дней и весе.
          </Text>
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          <AppButton
            title={isSubmitting ? "Создаём профиль..." : "Начать программу"}
            onPress={handleSubmit}
            disabled={isSubmitting}
          />
          <AppButton title="У меня уже есть аккаунт" onPress={onSwitchToLogin} variant="ghost" />
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
    grid: {
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
    errorText: {
      color: "#b24831",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600"
    }
  });
