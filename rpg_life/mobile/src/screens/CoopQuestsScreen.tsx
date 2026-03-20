import { useNavigation, useScrollToTop } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  fetchChallengeInvitations,
  fetchCoopQuests,
  respondToChallengeInvitation,
  type ChallengeInvitation,
  type CoopQuest,
} from "../api/social";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useTranslation } from "../context/LocalizationContext";
import { useGame } from "../context/GameContext";
import { useThemeColors } from "../ui/theme";

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function CoopQuestsScreen() {
  const navigation = useNavigation<any>();
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { refreshGame } = useGame();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollToTopRef = useRef({
    scrollToTop: () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<ChallengeInvitation[]>([]);
  const [coopQuests, setCoopQuests] = useState<CoopQuest[]>([]);
  const [processingInvitationIds, setProcessingInvitationIds] = useState<number[]>([]);
  useScrollToTop(scrollToTopRef);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    try {
      const [invitationsPayload, activePayload, scheduledPayload] = await Promise.all([
        fetchChallengeInvitations("pending"),
        fetchCoopQuests(1, 50, "active"),
        fetchCoopQuests(1, 50, "scheduled"),
      ]);

      setPendingInvitations((invitationsPayload.invitations ?? []).filter((invitation) => invitation.challenge_type === "coop"));
      setCoopQuests([...(scheduledPayload.items ?? []), ...(activePayload.items ?? [])]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("screens.coopTasks.errors.load"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleInvitationAction(invitationId: number, action: "accept" | "decline") {
    if (processingInvitationIds.includes(invitationId)) {
      return;
    }

    setProcessingInvitationIds((prev) => [...prev, invitationId]);
    try {
      await respondToChallengeInvitation(invitationId, action);
      await Promise.all([loadData(), refreshGame()]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("screens.coopTasks.errors.update"));
    } finally {
      setProcessingInvitationIds((prev) => prev.filter((id) => id !== invitationId));
    }
  }

  function getObjectiveLabel(objectiveType: ChallengeInvitation["objective_type"] | CoopQuest["objective_type"]) {
    const labels: Record<string, string> = {
      steps: t("game.objectives.steps"),
      workouts: t("game.objectives.workouts"),
      quests_completed: t("game.objectives.questsCompleted"),
    };
    return labels[objectiveType] ?? objectiveType;
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      scheduled: t("screens.coopTasks.status.scheduled"),
      active: t("screens.coopTasks.status.active"),
      completed: t("screens.coopTasks.status.completed"),
      failed: t("screens.coopTasks.status.failed"),
    };
    return labels[status] ?? status;
  }

  function getProgressPercent(quest: CoopQuest) {
    return Math.min(100, Math.round((quest.progress / Math.max(quest.goal, 1)) * 100));
  }

  function getQuestWindowLabel(quest: CoopQuest) {
    const endsAt = new Date(quest.end_time).getTime();
    const diffMs = endsAt - Date.now();
    if (diffMs <= 0) {
      return translateOrFallback(t, "screens.coopTasks.timeEnded", "Окно завершено");
    }
    const totalHours = Math.ceil(diffMs / (60 * 60 * 1000));
    if (totalHours < 24) {
      return translateOrFallback(t, "screens.coopTasks.timeHours", `Осталось ${totalHours} ч`, { hours: totalHours });
    }
    const totalDays = Math.ceil(totalHours / 24);
    return translateOrFallback(t, "screens.coopTasks.timeDays", `Осталось ${totalDays} д`, { days: totalDays });
  }

  function scrollToPendingInvitations() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <Screen title={t("screens.coopTasks.title")} subtitle={t("screens.coopTasks.subtitle")} scrollable={false}>
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />
        }
      >
        {!!error ? (
          <StateBlock
            tone="warning"
            icon="alert-circle"
            title={t("screens.coopTasks.errorTitle")}
            description={error}
            actionLabel={t("common.retry")}
            onAction={() => loadData()}
          />
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("screens.coopTasks.pendingTitle")}</Text>
          {isLoading && !pendingInvitations.length && !coopQuests.length ? <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} /> : null}
          {!isLoading && pendingInvitations.length === 0 ? (
            <StateBlock
              icon="account-search-outline"
              title={t("screens.coopTasks.empty.pendingTitle")}
              description={t("screens.coopTasks.empty.pendingDescription")}
              actionLabel={t("common.findFriends")}
              onAction={() => navigation.navigate("Friends")}
            />
          ) : null}
          {pendingInvitations.map((invitation) => {
            const isProcessing = processingInvitationIds.includes(invitation.id);

            return (
              <Card key={invitation.id}>
                <Text style={styles.cardTitle}>{invitation.title}</Text>
                <Text style={styles.metaText}>
                  {getObjectiveLabel(invitation.objective_type)} - {invitation.goal}
                </Text>
                {!!invitation.description ? <Text style={styles.description}>{invitation.description}</Text> : null}
                <Text style={styles.rewardText}>
                  +{invitation.reward_xp} XP / +{invitation.reward_crystals} {t("common.crystals")}
                </Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleInvitationAction(invitation.id, "accept")}
                    disabled={isProcessing}
                  >
                    <Text style={styles.actionButtonText}>
                      {isProcessing ? t("common.loading") : t("screens.coopTasks.accept")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleInvitationAction(invitation.id, "decline")}
                    disabled={isProcessing}
                  >
                    <Text style={styles.actionButtonText}>{t("screens.coopTasks.decline")}</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("screens.coopTasks.activeTitle")}</Text>
          {!isLoading && coopQuests.length === 0 ? (
            <StateBlock
              icon="sword-cross"
              title={t("screens.coopTasks.empty.activeTitle")}
              description={pendingInvitations.length > 0 ? t("screens.coopTasks.empty.activeDescriptionPending") : t("screens.coopTasks.empty.activeDescription")}
              actionLabel={pendingInvitations.length > 0 ? t("common.acceptInvite") : t("common.findFriends")}
              onAction={pendingInvitations.length > 0 ? scrollToPendingInvitations : () => navigation.navigate("Friends")}
            />
          ) : null}
          {coopQuests.map((quest) => (
            <Card key={quest.id}>
              <View style={styles.questHeader}>
                <View style={styles.questHeaderCopy}>
                  <Text style={styles.cardTitle}>{quest.title}</Text>
                  <Text style={styles.metaText}>
                    {getObjectiveLabel(quest.objective_type)} - {getQuestWindowLabel(quest)}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{getStatusLabel(quest.status)}</Text>
                </View>
              </View>
              {!!quest.description ? <Text style={styles.description}>{quest.description}</Text> : null}
              <Text style={styles.metaText}>
                {t("screens.coopTasks.progress", {
                  current: quest.progress,
                  goal: quest.goal,
                })}
                {" • "}
                {getProgressPercent(quest)}%
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${getProgressPercent(quest)}%` }]} />
              </View>
              <Text style={styles.rewardText}>
                +{quest.reward.xp} XP / +{quest.reward.crystals} {t("common.crystals")}
              </Text>
              <View style={styles.participants}>
                {quest.participants.map((participant, index) => (
                  <View
                    key={`${quest.id}-${participant.user_id}`}
                    style={[styles.participantRow, participant.is_current_user ? styles.participantRowCurrent : null]}
                  >
                    <Text style={[styles.participantText, participant.is_current_user ? styles.participantTextCurrent : null]}>
                      #{index + 1} {participant.is_current_user ? t("screens.coopTasks.youLabel", { name: participant.name }) : participant.name}
                    </Text>
                    <Text style={[styles.participantValue, participant.is_current_user ? styles.participantTextCurrent : null]}>
                      {participant.contribution}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    content: {
      flex: 1,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 4,
    },
    questHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    questHeaderCopy: {
      flex: 1,
    },
    statusBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusBadgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    metaText: {
      fontSize: 14,
      color: colors.textDim,
      marginBottom: 4,
    },
    description: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
    },
    rewardText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: "600",
      marginBottom: 10,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.backgroundRaised,
      overflow: "hidden",
      marginBottom: 10,
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    participants: {
      gap: 4,
    },
    participantRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
    },
    participantRowCurrent: {
      borderColor: colors.primary,
    },
    participantText: {
      fontSize: 13,
      color: colors.textDim,
    },
    participantTextCurrent: {
      color: colors.text,
      fontWeight: "700",
    },
    participantValue: {
      fontSize: 13,
      color: colors.textDim,
      fontWeight: "700",
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      paddingVertical: 10,
    },
    acceptButton: {
      backgroundColor: colors.primary,
    },
    declineButton: {
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonText: {
      color: colors.text,
      fontWeight: "600",
    },
  });
}
