import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { fetchGoalTemplates, type GoalTemplatePayload } from "../api/auth";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { GameIcon, useThemeColors, useThemeMode } from "../ui";

type Props = {
  onBackToLogin: () => void;
};

type GoalCard = GoalTemplatePayload["goals"][number];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function hasLetter(value: string) {
  return /[A-Za-zА-Яа-я]/.test(value);
}

function getFallbackGoals(t: (key: string, params?: Record<string, string | number>) => string): GoalCard[] {
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

const GOAL_TERMS = [3, 6, 9] as const;

export function RegisterScreen({ onBackToLogin }: Props) {
  const { signUp } = useAuth();
  const t = useTranslation();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const fallbackGoals = useMemo(() => getFallbackGoals(t), [t]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("2000");
  const [characterClass, setCharacterClass] = useState<"warrior" | "archer" | "mage">("warrior");
  const [gender, setGender] = useState<"male" | "female" | "nonbinary">("male");
  const [goalType, setGoalType] = useState<string>("personal_development");
  const [goalTermMonths, setGoalTermMonths] = useState<number>(6);
  const [goals, setGoals] = useState<GoalCard[]>(fallbackGoals);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const classes = [
    { id: "warrior" as const, icon: "sword-cross", color: "#7f1d1d" },
    { id: "archer" as const, icon: "bow-arrow", color: "#14532d" },
    { id: "mage" as const, icon: "auto-fix", color: "#4c1d95" },
  ];

  const genders = [{ id: "male" as const }, { id: "female" as const }, { id: "nonbinary" as const }];

  useEffect(() => {
    setGoals((current) => (current.length ? current : fallbackGoals));
  }, [fallbackGoals]);

  useEffect(() => {
    let mounted = true;
    fetchGoalTemplates()
      .then((payload) => {
        if (!mounted || !payload.goals?.length) {
          return;
        }
        const primaryGoals = payload.goals.filter((goal) => goal.is_primary);
        setGoals(primaryGoals.length ? primaryGoals : payload.goals);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === goalType) ?? goals[0] ?? fallbackGoals[0],
    [fallbackGoals, goalType, goals],
  );

  useEffect(() => {
    if (!selectedGoal) {
      return;
    }
    if (!goals.some((goal) => goal.id === goalType)) {
      setGoalType(selectedGoal.id);
    }
  }, [goalType, goals, selectedGoal]);

  async function handleRegister() {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const numericBirthYear = Number(birthYear);
    const currentYear = new Date().getFullYear();

    if (!isValidEmail(trimmedEmail)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidEmail"),
        icon: "email-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (password.length < 8 || !hasLetter(password)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidPassword"),
        icon: "lock-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (trimmedName.length < 2 || /^\d/.test(trimmedName)) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidName"),
        icon: "account-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (!Number.isInteger(numericBirthYear) || numericBirthYear < 1950 || numericBirthYear > currentYear - 10) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: t("screens.register.quick.invalidBirthYear", { year: currentYear - 10 }),
        icon: "calendar-alert",
        tone: "warning",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp({
        email: trimmedEmail,
        password,
        name: trimmedName,
        birthYear: numericBirthYear,
        gender,
        characterClass,
        goalType,
        goalTermMonths,
      });
    } catch (error) {
      await pushToast({
        title: t("screens.register.errors.registrationFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen title={t("screens.register.title")} subtitle={t("screens.register.subtitle")} scrollable>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeTab} onPress={onBackToLogin} activeOpacity={0.85}>
            <Text style={styles.modeText}>{t("screens.register.login")}</Text>
          </TouchableOpacity>
          <View style={[styles.modeTab, styles.modeTabActive]}>
            <Text style={[styles.modeText, styles.modeTextActive]}>{t("screens.register.mode")}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("screens.register.basicData")}</Text>
          <TextInput
            placeholder={t("screens.register.emailPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            placeholder={t("screens.register.passwordPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            placeholder={t("screens.register.namePlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            placeholder={t("screens.register.birthYear")}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("screens.register.quick.goalSectionTitle")}</Text>
          {goals.map((goal) => {
            const isActive = goalType === goal.id;
            return (
              <Pressable
                key={goal.id}
                style={[
                  styles.goalCard,
                  {
                    borderColor: isActive ? goal.accent_color : "#1f2937",
                    backgroundColor: isActive ? `${goal.accent_color}22` : colors.backgroundInset,
                  },
                ]}
                onPress={() => setGoalType(goal.id)}
              >
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIconWrap, { borderColor: `${goal.accent_color}99` }]}>
                    <GameIcon name={goal.icon} size={20} color={goal.accent_color} />
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalDescription}>{goal.description}</Text>
                    <Text style={styles.goalResult}>{t("screens.register.quick.resultExample", { result: goal.result_example })}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}

          <Text style={[styles.sectionTitle, styles.subSectionTitle]}>{t("screens.register.quick.goalTermTitle")}</Text>
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
                    {t("screens.register.quick.goalTermMonths", { months })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedGoal ? (
            <Text style={styles.goalHint}>
              {t("screens.register.quick.goalTermHint", { months: selectedGoal.recommended_term_months })}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("screens.register.characterClass")}</Text>
          <View style={styles.classList}>
            {classes.map((entry) => {
              const isActive = characterClass === entry.id;
              return (
                <Pressable
                  key={entry.id}
                  style={[
                    styles.classCard,
                    {
                      backgroundColor: isActive ? entry.color : "#0f172a",
                      borderColor: isActive ? colors.text : colors.border,
                    },
                  ]}
                  onPress={() => setCharacterClass(entry.id)}
                >
                  <View style={styles.classIcon}>
                    <GameIcon name={entry.icon} size={28} color="#f8fafc" />
                  </View>
                  <Text style={styles.classTitle}>{t(`screens.register.class.${entry.id}`)}</Text>
                  <Text style={styles.classBonus}>{t(`screens.register.class.${entry.id}Bonus`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("screens.register.gender")}</Text>
          <View style={styles.genderRow}>
            {genders.map((entry) => {
              const isActive = gender === entry.id;
              return (
                <Pressable
                  key={entry.id}
                  style={[styles.genderChip, isActive ? styles.genderChipActive : null]}
                  onPress={() => setGender(entry.id)}
                >
                  <Text style={[styles.genderText, isActive ? styles.genderTextActive : null]}>
                    {t(`screens.register.genderOption.${entry.id}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting ? styles.primaryButtonDisabled : null]}
          onPress={handleRegister}
          activeOpacity={0.85}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryText}>{isSubmitting ? t("common.loading") : t("screens.register.register")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onBackToLogin} activeOpacity={0.85}>
          <Text style={styles.link}>{t("screens.register.haveAccount")}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    container: {
      gap: 16,
    },
    modeRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 6,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    modeTabActive: {
      backgroundColor: colors.xp,
    },
    modeText: {
      color: colors.textDim,
      fontWeight: "700",
    },
    modeTextActive: {
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 18,
      gap: 14,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    subSectionTitle: {
      marginTop: 6,
    },
    input: {
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
    },
    goalCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
    },
    goalHeader: {
      flexDirection: "row",
      gap: 10,
    },
    goalIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      backgroundColor: colors.backgroundInset,
    },
    goalCopy: {
      flex: 1,
      gap: 2,
    },
    goalTitle: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 15,
    },
    goalDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    goalResult: {
      color: "#93c5fd",
      fontSize: 11,
      lineHeight: 15,
    },
    termRow: {
      flexDirection: "row",
      gap: 8,
    },
    termChip: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      paddingVertical: 10,
      alignItems: "center",
    },
    termChipActive: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "#f2dfbf" : "#3f2a08",
    },
    termText: {
      color: colors.textMuted,
      fontWeight: "700",
    },
    termTextActive: {
      color: themeMode === "light" ? "#7a4b12" : "#fde68a",
    },
    goalHint: {
      color: colors.textDim,
      fontSize: 12,
    },
    classList: {
      gap: 12,
    },
    classCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      gap: 6,
    },
    classIcon: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    classTitle: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 18,
    },
    classBonus: {
      color: colors.textMuted,
      lineHeight: 18,
    },
    genderRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    genderChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
    },
    genderChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    genderText: {
      color: colors.textMuted,
      fontWeight: "700",
    },
    genderTextActive: {
      color: "#451a03",
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryText: {
      color: "#451a03",
      fontWeight: "800",
      fontSize: 16,
    },
    linkButton: {
      backgroundColor: colors.cardMuted,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    link: {
      color: colors.xp,
      fontWeight: "700",
    },
  });
}
