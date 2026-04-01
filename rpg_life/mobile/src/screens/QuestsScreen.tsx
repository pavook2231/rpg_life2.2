import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  completeQuest,
  fetchDailyQuests,
  submitProgramAnamnesis,
  submitProgramBaseline,
  submitProgramWeeklyReview,
  syncTodaySteps,
  type GoalStatePayload,
  type QuestItem,
} from "../api/game";
import { Screen } from "../components/Screen";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { useGameProgress } from "../context/GameContext";
import { Button, Card, ProfileHeroCard, QuestCard, radii, useThemeColors, useThemeMode } from "../ui";

type StatusTab = "active" | "completed";

const DIRECT_CODES = new Set(["walking_daily_target", "recovery_restart", "plateau_review"]);
const SEX_OPTIONS = ["male", "female", "other"] as const;
const GOAL_OPTIONS = ["lose", "maintain", "gain"] as const;
const ACTIVITY_OPTIONS = ["sedentary", "light", "moderate", "high", "very_high"] as const;
const SEX_LABELS: Record<(typeof SEX_OPTIONS)[number], string> = { male: "Мужской", female: "Женский", other: "Другой" };
const GOAL_LABELS: Record<(typeof GOAL_OPTIONS)[number], string> = {
  lose: "Снижение веса",
  maintain: "Удержание веса",
  gain: "Набор веса",
};
const ACTIVITY_LABELS: Record<(typeof ACTIVITY_OPTIONS)[number], string> = {
  sedentary: "Сидячий",
  light: "Лёгкий",
  moderate: "Умеренный",
  high: "Высокий",
  very_high: "Очень высокий",
};

const DEVICE_TIMEZONE = resolveDeviceTimezoneName();

function localDayStartedAt(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
}

function resolveDeviceTimezoneName() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC";
  } catch {
    return "UTC";
  }
}

function parsePositive(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
}

function phaseLabel(goal: GoalStatePayload | null) {
  if (goal?.program_phase === "anamnesis_required") return "Обязательный анамнез";
  if (goal?.program_phase === "baseline_required") return "Базовая точка";
  if (goal?.program_phase === "walking_active") return "Ходьба активна";
  if (goal?.program_phase === "unsupported_goal") return "Режим в подготовке";
  return "Программа";
}

function modeLabel(goal: GoalStatePayload | null) {
  if (goal?.program_mode === "recovery") return "Восстановление";
  if (goal?.program_mode === "plateau_hold") return "Плато";
  if (goal?.program_mode === "normal") return "Нормальный режим";
  return "Маршрут";
}

function questPhaseLabel(phaseCode?: string | null) {
  if (phaseCode === "anamnesis_required") return "Старт";
  if (phaseCode === "baseline_required") return "Базовая точка";
  if (phaseCode === "walking_active") return "Ходьба";
  return "Программа";
}

function motivationBandLabel(goal: GoalStatePayload | null) {
  if (goal?.motivation?.band === "low") return "Щадящий режим";
  if (goal?.motivation?.band === "medium") return "Ровный темп";
  if (goal?.motivation?.band === "high") return "Устойчивый ритм";
  return null;
}

function formatDateLocal(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function QuestsScreen() {
  const navigation = useNavigation<any>();
  const t = useTranslation();
  const { hero, applyQuestResult, refreshGame, todaySteps, stepSourceLabel } = useGameProgress();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  const [status, setStatus] = useState<StatusTab>("active");
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [goal, setGoal] = useState<GoalStatePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<null | "anamnesis" | "baseline" | "review" | "steps">(null);
  const [completingQuestId, setCompletingQuestId] = useState<number | null>(null);

  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number]>("male");
  const [goalType, setGoalType] = useState<(typeof GOAL_OPTIONS)[number]>("lose");
  const [activityLevel, setActivityLevel] = useState<(typeof ACTIVITY_OPTIONS)[number]>("light");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [timezoneName, setTimezoneName] = useState(DEVICE_TIMEZONE);
  const [waistCm, setWaistCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [kilosToLose, setKilosToLose] = useState("");
  const [reviewWeightKg, setReviewWeightKg] = useState("");
  const [motivationRating, setMotivationRating] = useState("");
  const [difficultyRating, setDifficultyRating] = useState("");
  const [manualSteps, setManualSteps] = useState("");

  const loadProgram = useCallback(async (forceRefresh = false) => {
    setBusy(true);
    try {
      const payload = await fetchDailyQuests(1, 40, "daily", { forceRefresh });
      setQuests(payload.items ?? []);
      setGoal(payload.goal ?? null);
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshProgram = useCallback(
    async (forceRefresh = false) => {
      await Promise.all([loadProgram(forceRefresh), refreshGame(forceRefresh)]);
    },
    [loadProgram, refreshGame],
  );

  useEffect(() => {
    refreshProgram().catch(() => undefined);
  }, [refreshProgram]);

  useEffect(() => {
    const health = goal?.health_profile;
    if (!health) return;
    setSex((health.sex as (typeof SEX_OPTIONS)[number] | null) ?? "male");
    setGoalType((health.goal_type as (typeof GOAL_OPTIONS)[number] | null) ?? "lose");
    setActivityLevel((health.daily_activity_level as (typeof ACTIVITY_OPTIONS)[number] | null) ?? "light");
    setHeightCm(health.height_cm != null ? String(health.height_cm) : "");
    setWeightKg(health.weight_kg != null ? String(health.weight_kg) : "");
    setReviewWeightKg(health.weight_kg != null ? String(health.weight_kg) : "");
    setTargetWeightKg(health.target_weight_kg != null ? String(health.target_weight_kg) : "");
    setKilosToLose(health.kilos_to_lose != null ? String(health.kilos_to_lose) : "");
    setTimezoneName(goal?.timezone_name ?? DEVICE_TIMEZONE);
  }, [goal?.health_profile, goal?.timezone_name]);

  const activeQuests = useMemo(() => quests.filter((quest) => !quest.is_completed), [quests]);
  const visibleQuests = useMemo(
    () => (status === "active" ? activeQuests : quests.filter((quest) => quest.is_completed)),
    [activeQuests, quests, status],
  );

  const needsAnamnesis = goal?.program_phase === "anamnesis_required";
  const needsBaseline = goal?.program_phase === "baseline_required";
  const needsReview = activeQuests.some((quest) => quest.quest_code === "weekly_review");
  const needsMeasurementsRefresh = activeQuests.some((quest) => quest.quest_code === "plateau_measurements_refresh");
  const unsupportedGoal = Boolean(goal?.unsupported_goal);
  const reviewPreview = goal?.weekly_review_preview ?? null;
  const motivationLabel = motivationBandLabel(goal);

  async function handleComplete(questId: number) {
    try {
      setCompletingQuestId(questId);
      const result = await completeQuest(questId);
      await Promise.all([applyQuestResult(result), refreshProgram(true)]);
    } catch (error) {
      await pushToast({
        title: "Не удалось завершить шаг",
        description: error instanceof Error ? error.message : "Попробуй ещё раз.",
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setCompletingQuestId(null);
    }
  }

  async function handleSubmitAnamnesis() {
    const height = parsePositive(heightCm);
    const weight = parsePositive(weightKg);
    if (!height || !weight || Number.isNaN(height) || Number.isNaN(weight)) {
      await pushToast({ title: "Проверь рост и вес", description: "Нужны положительные значения.", icon: "alert-circle", tone: "warning" });
      return;
    }
    try {
      setSaving("anamnesis");
      await submitProgramAnamnesis({
        sex,
        height_cm: Math.round(height),
        weight_kg: weight,
        goal_type: goalType,
        daily_activity_level: activityLevel,
        timezone_name: timezoneName.trim() || DEVICE_TIMEZONE,
      });
      await refreshProgram(true);
    } catch (error) {
      await pushToast({ title: "Не удалось сохранить анамнез", description: error instanceof Error ? error.message : "Попробуй ещё раз.", icon: "alert-circle", tone: "warning" });
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmitBaseline() {
    const waist = parsePositive(waistCm);
    const hips = parsePositive(hipsCm);
    const chest = parsePositive(chestCm);
    const target = parsePositive(targetWeightKg);
    const kilos = parsePositive(kilosToLose);
    if ([waist, hips, chest, target, kilos].some((value) => Number.isNaN(value))) {
      await pushToast({ title: "Проверь базовую точку", description: "Замеры и цель должны быть больше нуля.", icon: "alert-circle", tone: "warning" });
      return;
    }
    const measurements: Record<string, number> = {};
    if (waist) measurements.waistCm = waist;
    if (hips) measurements.hipsCm = hips;
    if (chest) measurements.chestCm = chest;
    try {
      setSaving("baseline");
      await submitProgramBaseline({
        measurements: Object.keys(measurements).length ? measurements : undefined,
        target_weight_kg: target,
        kilos_to_lose: kilos,
      });
      await refreshProgram(true);
    } catch (error) {
      await pushToast({ title: "Не удалось сохранить базовую точку", description: error instanceof Error ? error.message : "Попробуй ещё раз.", icon: "alert-circle", tone: "warning" });
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmitReview() {
    const currentWeight = parsePositive(reviewWeightKg);
    const motivation = motivationRating.trim() ? Number(motivationRating) : undefined;
    const difficulty = difficultyRating.trim() ? Number(difficultyRating) : undefined;
    if (Number.isNaN(currentWeight) || (motivation != null && (motivation < 1 || motivation > 5)) || (difficulty != null && (difficulty < 1 || difficulty > 5))) {
      await pushToast({ title: "Проверь обзор недели", description: "Вес должен быть положительным, а оценки от 1 до 5.", icon: "alert-circle", tone: "warning" });
      return;
    }
    try {
      setSaving("review");
      await submitProgramWeeklyReview({
        current_weight_kg: currentWeight,
        motivation_self_rating: motivation,
        difficulty_self_rating: difficulty,
      });
      await refreshProgram(true);
    } catch (error) {
      await pushToast({ title: "Не удалось сохранить обзор недели", description: error instanceof Error ? error.message : "Попробуй ещё раз.", icon: "alert-circle", tone: "warning" });
    } finally {
      setSaving(null);
    }
  }

  async function handleManualSteps() {
    const steps = Math.round(Number(manualSteps.trim()));
    if (!Number.isFinite(steps) || steps <= 0) {
      await pushToast({ title: "Проверь шаги", description: "Нужно число больше нуля.", icon: "alert-circle", tone: "warning" });
      return;
    }
    try {
      setSaving("steps");
      await syncTodaySteps(steps, localDayStartedAt(new Date()), "manual");
      await refreshProgram(true);
    } catch (error) {
      await pushToast({ title: "Не удалось сохранить шаги", description: error instanceof Error ? error.message : "Попробуй ещё раз.", icon: "alert-circle", tone: "warning" });
    } finally {
      setSaving(null);
    }
  }

  const summaryTarget = reviewPreview?.target_daily_steps ?? goal?.walking_plan?.current_daily_target_steps ?? 0;
  const summaryWeek = reviewPreview?.week_number ?? goal?.walking_plan?.current_program_week ?? 0;
  const reviewPeriodLabel = reviewPreview ? `${formatDateLocal(reviewPreview.week_start_date_local)} - ${formatDateLocal(reviewPreview.week_end_date_local)}` : null;

  return (
    <Screen title={t("screens.quests.title")} subtitle={t("screens.quests.subtitle")}>
      <ProfileHeroCard
        name={hero?.name ?? "Герой"}
        heroClass={hero?.class}
        level={hero?.level ?? 1}
        currentXp={hero?.current_xp ?? 0}
        nextLevelXp={hero?.next_level_xp ?? 120}
        gold={hero?.crystals ?? 0}
        streak={hero?.streak ?? 0}
        healthCurrent={hero?.health?.current_health ?? null}
        healthMax={hero?.health?.max_health ?? null}
        isWounded={hero?.health?.is_wounded ?? false}
        penaltyQuestsRemaining={hero?.health?.penalty_quests_remaining ?? 0}
        rewardPenaltyPercent={hero?.health?.reward_penalty_percent ?? 0}
        subtitle="XP мотивирует, но реальный прогресс идёт по обязательным шагам программы."
      />

      <Card tone="accent">
        <Text style={styles.title}>{goal?.goal_title ?? "Снижение веса"}</Text>
        <Text style={styles.description}>{goal?.goal_description ?? "Обязательные шаги старта, базовой точки, ходьбы и недельного обзора."}</Text>
        <View style={styles.row}>
          <Text style={styles.chip}>{phaseLabel(goal)}</Text>
          <Text style={styles.chip}>{modeLabel(goal)}</Text>
          {motivationLabel ? <Text style={styles.chip}>{motivationLabel}</Text> : null}
        </View>
        <Text style={styles.meta}>Сегодня: {todaySteps ?? 0} шагов{stepSourceLabel ? ` (${stepSourceLabel})` : ""}</Text>
        <Text style={styles.meta}>Текущая цель по шагам: {summaryTarget || "—"} {summaryWeek > 0 ? `• неделя ${summaryWeek}` : ""}</Text>
        {reviewPeriodLabel ? <Text style={styles.meta}>Текущий интервал: {reviewPeriodLabel}</Text> : null}
        {goal?.walking_plan?.last_adjustment_reason ? <Text style={styles.helperText}>{goal.walking_plan.last_adjustment_reason}</Text> : null}
        <Text style={styles.helperText}>Сначала анамнез, затем базовая точка, потом ежедневная ходьба и недельный обзор. Случайных квестов здесь нет.</Text>
        <Button label={busy ? "Обновляем..." : "Обновить программу"} icon="refresh" onPress={() => refreshProgram(true)} loading={busy} />
      </Card>

      {unsupportedGoal ? (
        <Card tone="subtle">
          <Text style={styles.sectionTitle}>Этот режим пока не поддерживается</Text>
          <Text style={styles.description}>Профиль цели сохранён, но полноценная программа сейчас доступна только для снижения веса.</Text>
          <Button label="Сменить цель" icon="flag-checkered" onPress={() => navigation.navigate("GoalSelect")} />
        </Card>
      ) : null}

      {needsAnamnesis ? (
        <Card>
          <Text style={styles.sectionTitle}>1. Анамнез</Text>
          <Text style={styles.description}>Заполни базовые данные, чтобы программа открыла следующий обязательный этап.</Text>
          <View style={styles.choiceRow}>
            {SEX_OPTIONS.map((value) => (
              <Pressable key={value} style={[styles.choice, sex === value && styles.choiceActive]} onPress={() => setSex(value)}>
                <Text style={styles.choiceText}>{SEX_LABELS[value]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={heightCm} onChangeText={setHeightCm} style={styles.input} keyboardType="numeric" placeholder="Рост, см" placeholderTextColor={colors.textDim} />
          <TextInput value={weightKg} onChangeText={setWeightKg} style={styles.input} keyboardType="numeric" placeholder="Вес, кг" placeholderTextColor={colors.textDim} />
          <View style={styles.choiceRow}>
            {GOAL_OPTIONS.map((value) => (
              <Pressable key={value} style={[styles.choice, goalType === value && styles.choiceActive]} onPress={() => setGoalType(value)}>
                <Text style={styles.choiceText}>{GOAL_LABELS[value]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.choiceRow}>
            {ACTIVITY_OPTIONS.map((value) => (
              <Pressable key={value} style={[styles.choice, activityLevel === value && styles.choiceActive]} onPress={() => setActivityLevel(value)}>
                <Text style={styles.choiceText}>{ACTIVITY_LABELS[value]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={timezoneName} onChangeText={setTimezoneName} style={styles.input} placeholder="Часовой пояс, например Europe/Moscow" placeholderTextColor={colors.textDim} autoCapitalize="none" />
          <Button label={saving === "anamnesis" ? "Сохраняем..." : "Сохранить анамнез"} icon="clipboard-check-outline" onPress={handleSubmitAnamnesis} loading={saving === "anamnesis"} />
        </Card>
      ) : null}

      {(needsBaseline || needsMeasurementsRefresh) && !unsupportedGoal ? (
        <Card>
          <Text style={styles.sectionTitle}>{needsMeasurementsRefresh ? "Повтори замеры" : "2. Базовая точка"}</Text>
          <Text style={styles.description}>
            {needsMeasurementsRefresh
              ? "Обнови замеры, чтобы проверить прогресс в период плато."
              : "Сохрани стартовые замеры и цель по весу. После этого откроется план ходьбы."}
          </Text>
          <TextInput value={waistCm} onChangeText={setWaistCm} style={styles.input} keyboardType="numeric" placeholder="Талия, см" placeholderTextColor={colors.textDim} />
          <TextInput value={hipsCm} onChangeText={setHipsCm} style={styles.input} keyboardType="numeric" placeholder="Бёдра, см" placeholderTextColor={colors.textDim} />
          <TextInput value={chestCm} onChangeText={setChestCm} style={styles.input} keyboardType="numeric" placeholder="Грудь, см" placeholderTextColor={colors.textDim} />
          <TextInput value={targetWeightKg} onChangeText={setTargetWeightKg} style={styles.input} keyboardType="numeric" placeholder="Целевой вес, кг" placeholderTextColor={colors.textDim} />
          <TextInput value={kilosToLose} onChangeText={setKilosToLose} style={styles.input} keyboardType="numeric" placeholder="Или сколько кг убрать" placeholderTextColor={colors.textDim} />
          <Button label={saving === "baseline" ? "Сохраняем..." : "Сохранить базовую точку"} icon="ruler" onPress={handleSubmitBaseline} loading={saving === "baseline"} />
        </Card>
      ) : null}

      {needsReview ? (
        <Card>
          <Text style={styles.sectionTitle}>3. Недельный обзор</Text>
          <Text style={styles.description}>Подведи итоги недели, чтобы программа скорректировала следующий шаг без случайных изменений.</Text>
          {reviewPreview ? (
            <>
              <Text style={styles.helperText}>Период обзора: {reviewPeriodLabel}</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Неделя</Text>
                  <Text style={styles.statValue}>{reviewPreview.week_number}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Цель в день</Text>
                  <Text style={styles.statValue}>{reviewPreview.target_daily_steps}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Дней по плану</Text>
                  <Text style={styles.statValue}>{reviewPreview.achieved_days}/7</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Среднее в день</Text>
                  <Text style={styles.statValue}>{reviewPreview.average_steps}</Text>
                </View>
              </View>
            </>
          ) : null}
          <TextInput value={reviewWeightKg} onChangeText={setReviewWeightKg} style={styles.input} keyboardType="numeric" placeholder="Текущий вес, кг" placeholderTextColor={colors.textDim} />
          <TextInput value={motivationRating} onChangeText={setMotivationRating} style={styles.input} keyboardType="numeric" placeholder="Мотивация 1..5" placeholderTextColor={colors.textDim} />
          <TextInput value={difficultyRating} onChangeText={setDifficultyRating} style={styles.input} keyboardType="numeric" placeholder="Сложность 1..5" placeholderTextColor={colors.textDim} />
          <Button label={saving === "review" ? "Сохраняем..." : "Сохранить обзор недели"} icon="calendar-check" onPress={handleSubmitReview} loading={saving === "review"} />
        </Card>
      ) : null}

      {!unsupportedGoal && goal?.program_phase === "walking_active" ? (
        <Card tone="subtle">
          <Text style={styles.sectionTitle}>Ручной ввод шагов</Text>
          <Text style={styles.description}>Если синхронизация шагов сейчас недоступна, этого достаточно для работы программы и проверки цели за день.</Text>
          <TextInput value={manualSteps} onChangeText={setManualSteps} style={styles.input} keyboardType="numeric" placeholder="Шаги за сегодня" placeholderTextColor={colors.textDim} />
          <Button label={saving === "steps" ? "Сохраняем..." : "Сохранить шаги вручную"} icon="walk" onPress={handleManualSteps} loading={saving === "steps"} />
        </Card>
      ) : null}

      <Card>
        <View style={styles.row}>
          <Pressable style={[styles.tab, status === "active" && styles.tabActive]} onPress={() => setStatus("active")}><Text style={styles.tabText}>Активные</Text></Pressable>
          <Pressable style={[styles.tab, status === "completed" && styles.tabActive]} onPress={() => setStatus("completed")}><Text style={styles.tabText}>История</Text></Pressable>
        </View>
      </Card>

      {visibleQuests.length ? visibleQuests.map((quest, index) => (
        <QuestCard
          key={quest.id}
          title={quest.title}
          description={quest.description}
          rarity={quest.rarity}
          badgeLabel={quest.is_completed ? "Готово" : quest.is_required ? "Обязательный" : "Поддержка"}
          trackingLabel={questPhaseLabel(quest.phase_code)}
          rewardXp={quest.xp_reward}
          rewardGold={quest.crystal_reward}
          progressLabel={quest.objective_type === "steps" && quest.target_value != null ? `${quest.progress_value ?? 0}/${quest.target_value} шагов` : quest.reason_text ?? undefined}
          completed={quest.is_completed}
          primaryAction={!quest.is_completed && DIRECT_CODES.has(quest.quest_code ?? "") ? {
            label: quest.can_complete ? "Завершить" : "Ждём шаги",
            onPress: () => handleComplete(quest.id),
            variant: "success",
            disabled: !quest.can_complete,
            loading: completingQuestId === quest.id,
          } : undefined}
          delay={index * 16}
        />
      )) : (
        <Card tone="subtle">
          <Text style={styles.sectionTitle}>{busy ? "Загружаем программу..." : "Пока нет активных шагов"}</Text>
          <Text style={styles.description}>Здесь будут только детерминированные шаги, которые реально двигают программу снижения веса.</Text>
        </Card>
      )}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    title: { color: colors.text, fontSize: 20, fontWeight: "900" },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    description: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    helperText: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
    meta: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: {
      minWidth: "47%",
      flexGrow: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    statLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
    statValue: { color: colors.text, fontSize: 16, fontWeight: "900" },
    chip: {
      color: themeMode === "light" ? "#0f172a" : "#dbeafe",
      backgroundColor: themeMode === "light" ? "#dbeafe" : "#11243a",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.sm,
      fontSize: 11,
      fontWeight: "800",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 14,
    },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundInset, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8 },
    choiceActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
    choiceText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    tab: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 12, alignItems: "center", backgroundColor: colors.backgroundInset },
    tabActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
    tabText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  });
}
