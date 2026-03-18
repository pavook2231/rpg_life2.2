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
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { useGame } from "../context/GameContext";
import { Button, Card, ProfileHeroCard, QuestCard, radii, useThemeColors, useThemeMode } from "../ui";

type StatusTab = "active" | "completed";

function questKindLabel(quest: QuestItem, t: (key: string, params?: Record<string, string | number>) => string) {
  if (quest.is_universal) return t("screens.quests.quick.kind.support");
  if (quest.difficulty_level === "hard") return t("screens.quests.quick.kind.hard");
  if (quest.difficulty_level === "medium") return t("screens.quests.quick.kind.medium");
  return t("screens.quests.quick.kind.daily");
}

export function QuestsScreen() {
  const t = useTranslation();
  const { hero, applyQuestResult, todaySteps, stepSourceLabel } = useGame();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [status, setStatus] = useState<StatusTab>("active");
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [goal, setGoal] = useState<GoalStatePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [completingQuestId, setCompletingQuestId] = useState<number | null>(null);

  const loadQuests = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const payload = await fetchDailyQuests(1, 40, "daily", { forceRefresh });
      setQuests(payload.items ?? []);
      setGoal(payload.goal ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuests().catch(() => undefined);
  }, [loadQuests]);

  const filteredQuests = useMemo(
    () => quests.filter((quest) => (status === "active" ? !quest.is_completed : quest.is_completed)),
    [quests, status],
  );

  const healthState = hero?.health ?? null;
  const limits = goal?.daily_limits ?? null;
  const goalSummary = goal
    ? t("screens.quests.quick.goalSummary", {
        goal: goal.goal_title,
        progress: goal.goal_progress_percent,
        days: goal.goal_days_remaining,
      })
    : t("screens.quests.quick.goalSummaryEmpty");
  const limitsSummary = limits
    ? t("screens.quests.quick.limitsSummary", {
        system: limits.completed_system,
        total: limits.completed_total,
      })
    : t("screens.quests.quick.limitsSummaryEmpty");

  async function handleComplete(questId: number) {
    try {
      setCompletingQuestId(questId);
      setQuests((current) => current.map((quest) => (quest.id === questId ? { ...quest, is_completed: true } : quest)));
      const result = await completeQuest(questId);
      await Promise.all([applyQuestResult(result), loadQuests(true)]);
    } catch (error) {
      await loadQuests(true).catch(() => undefined);
      await pushToast({
        title: t("screens.quests.errors.failedToComplete"),
        description: error instanceof Error ? error.message : t("screens.quests.quick.tryAgain"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setCompletingQuestId(null);
    }
  }

  async function handleRefresh() {
    try {
      setIsRefreshingList(true);
      await regenerateTodayQuests();
      await loadQuests(true);
      await pushToast({
        title: t("screens.quests.quick.refreshList"),
        description: t("screens.quests.quick.loadingDescription"),
        icon: "refresh",
        tone: "success",
      });
    } catch (error) {
      await pushToast({
        title: t("screens.quests.quick.refreshFailed"),
        description: error instanceof Error ? error.message : t("screens.quests.quick.tryAgain"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsRefreshingList(false);
    }
  }

  async function handleCreateCustomQuest() {
    const title = customTitle.trim();
    const description = customDescription.trim();

    if (!title || !description) {
      await pushToast({
        title: t("screens.quests.quick.fillAllFields"),
        description: t("screens.quests.quick.fillAllFieldsDescription"),
        icon: "text-box-outline",
        tone: "warning",
      });
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
        await loadQuests(true);
      await pushToast({
        title: t("screens.quests.quick.createCustomQuest"),
        description: title,
        icon: "notebook-edit-outline",
        tone: "success",
      });
    } catch (error) {
      await pushToast({
        title: t("screens.quests.errors.failedToCreate"),
        description: error instanceof Error ? error.message : t("screens.quests.quick.tryAgain"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Screen title={t("screens.quests.title")} subtitle={t("screens.quests.quick.subtitle")}>
      <ProfileHeroCard
        name={hero?.name ?? t("screens.home.heroName")}
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
        subtitle={t("screens.quests.quick.commandCenter")}
      />

      <Card tone="accent">
        <Text style={styles.goalTitle}>{t("screens.quests.quick.dailyFocus")}</Text>
        <Text style={styles.goalSummary}>{goalSummary}</Text>
        <Text style={styles.goalLimits}>{limitsSummary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.stepsMeta}>
            {t("screens.quests.quick.todaySteps")}: {todaySteps ?? t("screens.quests.quick.notAvailable")}
            {stepSourceLabel && todaySteps != null ? ` (${stepSourceLabel})` : ""}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <Button
            label={isRefreshingList ? t("common.loading") : t("screens.quests.quick.refreshList")}
            icon="refresh"
            onPress={handleRefresh}
            style={styles.refreshButton}
            loading={isRefreshingList}
          />
          <Button
            label={t("screens.quests.quick.createQuest")}
            icon="plus"
            variant="secondary"
            onPress={() => setShowCreateModal(true)}
            style={styles.refreshButton}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.filterTitle}>{t("screens.quests.quick.show")}</Text>
        <View style={styles.statusRow}>
          <Pressable style={[styles.statusChip, status === "active" ? styles.statusChipActive : null]} onPress={() => setStatus("active")}>
            <Text style={[styles.statusText, status === "active" ? styles.statusTextActive : null]}>{t("screens.quests.active")}</Text>
          </Pressable>
          <Pressable style={[styles.statusChip, status === "completed" ? styles.statusChipActive : null]} onPress={() => setStatus("completed")}>
            <Text style={[styles.statusText, status === "completed" ? styles.statusTextActive : null]}>{t("screens.quests.completed")}</Text>
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
              : t("screens.quests.quick.goalImpact", { value: quest.goal_progress_percent ?? 0 });

          return (
            <QuestCard
              key={quest.id}
              title={quest.title}
              description={quest.description}
              rarity={quest.rarity}
              badgeLabel={t("screens.quests.quick.today")}
              trackingLabel={questKindLabel(quest, t)}
              rewardXp={quest.xp_reward}
              rewardGold={quest.crystal_reward}
              progressLabel={
                stepCheckFailed
                  ? `${progressLabel} | ${t("screens.quests.quick.needSteps")}: ${targetSteps}`
                  : progressLabel
              }
              completed={quest.is_completed}
              primaryAction={
                !quest.is_completed
                  ? {
                      label: t("screens.quests.quick.complete"),
                      onPress: () => handleComplete(quest.id),
                      variant: "success",
                      disabled: quest.can_complete === false || stepCheckFailed,
                      loading: completingQuestId === quest.id,
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
            {isLoading ? t("screens.quests.quick.loadingTitle") : t("screens.quests.quick.emptyTitle")}
          </Text>
          <Text style={styles.emptyText}>
            {isLoading ? t("screens.quests.quick.loadingDescription") : t("screens.quests.quick.emptyDescription")}
          </Text>
          {!isLoading ? <Button label={t("screens.quests.quick.refresh")} icon="refresh" onPress={handleRefresh} /> : null}
        </Card>
      )}

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("screens.quests.quick.createCustomQuest")}</Text>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              style={styles.input}
              placeholder={t("screens.quests.quick.questTitlePlaceholder")}
              placeholderTextColor={colors.textDim}
            />
            <TextInput
              value={customDescription}
              onChangeText={setCustomDescription}
              style={[styles.input, styles.multilineInput]}
              multiline
              numberOfLines={3}
              placeholder={t("screens.quests.quick.descriptionPlaceholder")}
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.modalActions}>
              <Button label={t("common.cancel")} variant="secondary" onPress={() => setShowCreateModal(false)} />
              <Button
                label={isCreating ? t("screens.quests.quick.creating") : t("screens.quests.create")}
                icon="plus"
                onPress={handleCreateCustomQuest}
                disabled={isCreating}
                loading={isCreating}
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
