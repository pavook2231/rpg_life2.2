import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  completeQuest,
  createCustomQuest,
  fetchDailyQuests,
  regenerateTodayQuests,
  type GoalStatePayload,
  type QuestItem,
} from "../api/game";
import { Screen } from "../components/Screen";
import { useLocalization } from "../context/LocalizationContext";
import { useGame } from "../context/GameContext";
import { getTodaySteps, watchTodaySteps } from "../lib/pedometer";
import { Button, Card, ProfileHeroCard, QuestCard, radii, useThemeColors, useThemeMode } from "../ui";

type StatusTab = "active" | "completed";

function questKindLabel(quest: QuestItem, isEn: boolean) {
  if (quest.is_universal) return isEn ? "Support" : "Поддержка";
  if (quest.difficulty_level === "hard") return isEn ? "Hard" : "Сложное";
  if (quest.difficulty_level === "medium") return isEn ? "Medium" : "Среднее";
  return isEn ? "Daily" : "Ежедневное";
}

export function QuestsScreen() {
  const { language } = useLocalization();
  const isEn = language === "en";
  const { hero, applyQuestResult } = useGame();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [status, setStatus] = useState<StatusTab>("active");
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [goal, setGoal] = useState<GoalStatePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadQuests = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await fetchDailyQuests(1, 40, "daily");
      setQuests(payload.items ?? []);
      setGoal(payload.goal ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuests().catch(() => undefined);
  }, [loadQuests]);

  useEffect(() => {
    let cancelled = false;
    let stopWatch: (() => void) | null = null;

    async function startStepTracking() {
      const initial = await getTodaySteps();
      if (!cancelled) {
        setTodaySteps(initial);
      }
      stopWatch = await watchTodaySteps((steps) => {
        if (!cancelled) {
          setTodaySteps(steps);
        }
      });
    }

    startStepTracking().catch(() => undefined);
    return () => {
      cancelled = true;
      stopWatch?.();
    };
  }, []);

  const filteredQuests = useMemo(
    () => quests.filter((quest) => (status === "active" ? !quest.is_completed : quest.is_completed)),
    [quests, status],
  );

  const healthState = hero?.health ?? null;
  const limits = goal?.daily_limits ?? null;
  const goalSummary = goal
    ? `${goal.goal_title} • ${goal.goal_progress_percent}% • ${isEn ? "left" : "осталось"} ${goal.goal_days_remaining} ${isEn ? "d" : "дн."}`
    : isEn
      ? "Select your life goal in profile to generate daily quests."
      : "Выбери жизненную цель в профиле, чтобы получать ежедневные задания.";
  const limitsSummary = limits
    ? isEn
      ? `Today: ${limits.completed_system}/10 system • ${limits.completed_total}/20 total`
      : `Сегодня: ${limits.completed_system}/10 системных • ${limits.completed_total}/20 всего`
    : isEn
      ? "System gives 10 goal-focused quests per day."
      : "Система выдает 10 целевых заданий в день.";

  async function handleComplete(questId: number) {
    try {
      const result = await completeQuest(questId);
      await applyQuestResult(result);
      await loadQuests();
    } catch (error) {
      Alert.alert(
        isEn ? "Failed to complete quest" : "Не удалось завершить задание",
        error instanceof Error ? error.message : isEn ? "Try again." : "Попробуй еще раз.",
      );
    }
  }

  async function handleRefresh() {
    try {
      await regenerateTodayQuests();
      await loadQuests();
    } catch (error) {
      Alert.alert(
        isEn ? "Failed to refresh" : "Не удалось обновить список",
        error instanceof Error ? error.message : isEn ? "Try again." : "Попробуй еще раз.",
      );
    }
  }

  async function handleCreateCustomQuest() {
    const title = customTitle.trim();
    const description = customDescription.trim();
    if (!title || !description) {
      Alert.alert(
        isEn ? "Fill all fields" : "Заполни поля",
        isEn ? "Enter title and description." : "Нужны название и описание.",
      );
      return;
    }
    try {
      setIsCreating(true);
      await createCustomQuest({
        title,
        description,
        xp_reward: 40,
        icon: "notebook-edit-outline",
      });
      setShowCreateModal(false);
      setCustomTitle("");
      setCustomDescription("");
      await loadQuests();
    } catch (error) {
      Alert.alert(
        isEn ? "Failed to create quest" : "Не удалось создать задание",
        error instanceof Error ? error.message : isEn ? "Try again." : "Попробуй еще раз.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Screen title={isEn ? "Quests" : "Задания"} subtitle={isEn ? "10 daily steps to your goal" : "10 ежедневных шагов к твоей цели"}>
      <ProfileHeroCard
        name={hero?.name ?? (isEn ? "Hero" : "Герой")}
        heroClass={hero?.class}
        level={hero?.level ?? 1}
        currentXp={hero?.current_xp ?? 0}
        nextLevelXp={hero?.next_level_xp ?? 120}
        gold={hero?.crystals ?? 0}
        streak={hero?.streak ?? 0}
        healthCurrent={healthState?.current_health ?? null}
        healthMax={healthState?.max_health ?? null}
        isWounded={healthState?.is_wounded ?? false}
        penaltyQuestsRemaining={healthState?.penalty_quests_remaining ?? 0}
        rewardPenaltyPercent={healthState?.reward_penalty_percent ?? 0}
        subtitle={isEn ? "Daily command center" : "Центр управления заданиями"}
      />

      <Card tone="accent">
        <Text style={styles.goalTitle}>{isEn ? "Daily focus" : "Фокус дня"}</Text>
        <Text style={styles.goalSummary}>{goalSummary}</Text>
        <Text style={styles.goalLimits}>{limitsSummary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.stepsMeta}>
            {isEn ? "Today steps" : "Шагов сегодня"}: {todaySteps ?? (isEn ? "not available" : "нет данных")}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <Button
            label={isEn ? "Refresh list" : "Обновить список"}
            icon="refresh"
            onPress={handleRefresh}
            style={styles.refreshButton}
          />
          <Button
            label={isEn ? "Create quest" : "Создать квест"}
            icon="plus"
            variant="secondary"
            onPress={() => setShowCreateModal(true)}
            style={styles.refreshButton}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.filterTitle}>{isEn ? "Show" : "Показывать"}</Text>
        <View style={styles.statusRow}>
          <Pressable style={[styles.statusChip, status === "active" ? styles.statusChipActive : null]} onPress={() => setStatus("active")}>
            <Text style={[styles.statusText, status === "active" ? styles.statusTextActive : null]}>{isEn ? "Active" : "Активные"}</Text>
          </Pressable>
          <Pressable style={[styles.statusChip, status === "completed" ? styles.statusChipActive : null]} onPress={() => setStatus("completed")}>
            <Text style={[styles.statusText, status === "completed" ? styles.statusTextActive : null]}>{isEn ? "Completed" : "Выполненные"}</Text>
          </Pressable>
        </View>
      </Card>

      {filteredQuests.length ? (
        filteredQuests.map((quest, index) => {
          const isStepQuest = quest.objective_type === "steps";
          const targetSteps = isStepQuest ? Number(quest.target_value ?? 0) : 0;
          const stepCheckFailed = isStepQuest && todaySteps != null && todaySteps < targetSteps;
          const progressLabel =
            quest.objective_label && quest.target_value != null
              ? `${quest.objective_label}: ${quest.target_value}`
              : `${isEn ? "Goal impact" : "Вклад в цель"}: +${quest.goal_progress_percent ?? 0}%`;

          return (
            <QuestCard
              key={quest.id}
              title={quest.title}
              description={quest.description}
              rarity={quest.rarity}
              badgeLabel={isEn ? "Today" : "Сегодня"}
              trackingLabel={questKindLabel(quest, isEn)}
              rewardXp={quest.xp_reward}
              rewardGold={quest.crystal_reward}
              progressLabel={stepCheckFailed ? `${progressLabel} • ${isEn ? "need steps" : "нужно шагов"}: ${targetSteps}` : progressLabel}
              completed={quest.is_completed}
              primaryAction={
                !quest.is_completed
                  ? {
                      label: isEn ? "Complete" : "Выполнить",
                      onPress: () => handleComplete(quest.id),
                      variant: "success",
                      disabled: quest.can_complete === false || stepCheckFailed,
                    }
                  : undefined
              }
              delay={index * 18}
            />
          );
        })
      ) : (
        <Card tone="subtle">
          <Text style={styles.emptyTitle}>
            {isLoading
              ? isEn
                ? "Loading quests..."
                : "Загружаем задания..."
              : isEn
                ? "No quests for today"
                : "На сегодня список пуст"}
          </Text>
          <Text style={styles.emptyText}>
            {isLoading
              ? isEn
                ? "Preparing quests for your goal."
                : "Подбираем задания по твоей цели."
              : isEn
                ? "Refresh the screen or create your own quest."
                : "Обнови экран или создай свое задание."}
          </Text>
          {!isLoading ? <Button label={isEn ? "Refresh" : "Обновить"} icon="refresh" onPress={handleRefresh} /> : null}
        </Card>
      )}

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{isEn ? "Create custom quest" : "Создать пользовательский квест"}</Text>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              style={styles.input}
              placeholder={isEn ? "Quest title" : "Название квеста"}
              placeholderTextColor={colors.textDim}
            />
            <TextInput
              value={customDescription}
              onChangeText={setCustomDescription}
              style={[styles.input, styles.multilineInput]}
              multiline
              numberOfLines={3}
              placeholder={isEn ? "Description" : "Описание"}
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.modalActions}>
              <Button
                label={isEn ? "Cancel" : "Отмена"}
                variant="secondary"
                onPress={() => setShowCreateModal(false)}
              />
              <Button
                label={isCreating ? (isEn ? "Creating..." : "Создаем...") : (isEn ? "Create" : "Создать")}
                icon="plus"
                onPress={handleCreateCustomQuest}
                disabled={isCreating}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  goalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  goalSummary: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  goalLimits: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepsMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  refreshButton: {
    flex: 1,
  },
  filterTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusChip: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundInset,
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: themeMode === "light" ? "#f2dfbf" : "#112036",
  },
  statusText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
  },
  statusTextActive: {
    color: themeMode === "light" ? "#7a4b12" : "#bfdbfe",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.textMuted,
    lineHeight: 19,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: themeMode === "light" ? "rgba(31,41,55,0.32)" : "rgba(2,6,16,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.backgroundInset,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  });
}
