import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createChallenge, fetchChallenges } from "../api/game";
import { createCoopQuest, fetchCoopQuests, fetchFriends, type FriendItem } from "../api/social";
import { Card } from "../components/Card";
import { GameButton } from "../components/GameButton";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { Screen } from "../components/Screen";
import { useFeedback } from "../context/FeedbackContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { getObjectiveLabel } from "../lib/gameUi";
import { palette, radii } from "../theme/gameTheme";

export function MultiplayerQuestsScreen() {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [coopQuests, setCoopQuests] = useState<any[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const t = useTranslation();
  const { language } = useLocalization();
  const [title, setTitle] = useState(() => t("screens.multiplayer.form.defaultTitle"));
  const [description, setDescription] = useState(() => t("screens.multiplayer.form.defaultDescription"));
  const [goal, setGoal] = useState("5");
  const [isLoading, setIsLoading] = useState(true);
  const { pushToast, playSound } = useFeedback();

  const selectedFriends = useMemo(() => friends.filter((friend) => selectedFriendIds.includes(friend.id)), [friends, selectedFriendIds]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [friendsPayload, challengesPayload, coopPayload] = await Promise.all([
        fetchFriends(),
        fetchChallenges(1, 20),
        fetchCoopQuests(),
      ]);
      setFriends(friendsPayload.items ?? []);
      setChallenges(challengesPayload.items ?? []);
      setCoopQuests(coopPayload.items ?? []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  function toggleFriend(friendId: number) {
    setSelectedFriendIds((current) => (current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId]));
  }

  function translateStatus(value?: string | null) {
    const key = `screens.multiplayer.status.${value ?? "unknown"}`;
    const translated = t(key);
    return translated === key ? value ?? "-" : translated;
  }

  async function handleCreateCoop() {
    try {
      const result = await createCoopQuest({
        title: title.trim(),
        description: description.trim(),
        objective_type: "quests_completed",
        goal: Number(goal) || 1,
        duration_hours: 24,
        reward_xp: 180,
        reward_crystals: 60,
        participant_ids: selectedFriendIds,
      });
      const coopReward = result.coop_quest.reward;
      await playSound("select");
      pushToast({
        title: t("screens.multiplayer.feedback.coopCreated"),
        description: selectedFriends.length
          ? `${t("screens.multiplayer.feedback.invitedFriends", {
              friends: selectedFriends.map((friend) => friend.name).join(", "),
            })} • +${coopReward.xp} XP / +${coopReward.crystals} ${language === "en" ? "gold" : "золота"}`
          : `${t("screens.multiplayer.feedback.singleRaidCreated")} • +${coopReward.xp} XP / +${coopReward.crystals} ${language === "en" ? "gold" : "золота"}`,
        icon: "account-multiple",
        tone: "reward",
      });
      await loadData();
    } catch (error) {
      Alert.alert(
        t("screens.multiplayer.errors.createCoop"),
        error instanceof Error ? error.message : t("errors.unknownError"),
      );
    }
  }

  async function handleCreateDuel(friendId: number) {
    try {
      await createChallenge({
        title: t("screens.multiplayer.feedback.duelTitle"),
        description: t("screens.multiplayer.feedback.duelDescription"),
        challenge_type: "duel",
        objective_type: "quests_completed",
        target_value: 5,
        duration_days: 1,
        opponent_id: friendId,
        reward_xp: 140,
        reward_crystals: 30,
        reward_chest: false,
      });
      await playSound("select");
      pushToast({
        title: t("screens.multiplayer.feedback.invitationSent"),
        description: t("screens.multiplayer.feedback.invitationDescription"),
        icon: "sword-cross",
        tone: "info",
      });
      await loadData();
    } catch (error) {
      Alert.alert(
        t("screens.multiplayer.errors.createDuel"),
        error instanceof Error ? error.message : t("errors.unknownError"),
      );
    }
  }

  return (
    <Screen title={t("screens.multiplayer.title")} subtitle={t("screens.multiplayer.subtitle")}>
      {isLoading ? <LoadingOverlay /> : null}

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.multiplayer.sections.createCoop")}</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder={t("screens.multiplayer.form.titlePlaceholder")} placeholderTextColor={palette.textDim} style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder={t("screens.multiplayer.form.descriptionPlaceholder")} placeholderTextColor={palette.textDim} style={[styles.input, styles.textarea]} multiline />
        <TextInput value={goal} onChangeText={setGoal} placeholder={t("screens.multiplayer.form.goalPlaceholder")} placeholderTextColor={palette.textDim} style={styles.input} keyboardType="numeric" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendRow}>
          {friends.map((friend) => {
            const selected = selectedFriendIds.includes(friend.id);
            return (
              <Text key={friend.id} style={[styles.friendChip, selected ? styles.friendChipActive : null]} onPress={() => toggleFriend(friend.id)}>
                {friend.name}
              </Text>
            );
          })}
        </ScrollView>
        <Text style={styles.helperText}>
          {language === "en"
            ? "Co-op rewards grow with each invited friend."
            : "Награда кооператива растет с каждым приглашенным другом."}
        </Text>
        <GameButton label={t("screens.multiplayer.actions.launchCoop")} onPress={handleCreateCoop} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.multiplayer.sections.friends")}</Text>
        {friends.length ? (
          friends.map((friend) => (
            <View key={friend.id} style={styles.friendCard}>
              <View style={styles.friendCopy}>
                <Text style={styles.friendName}>{friend.name}</Text>
                <Text style={styles.friendMeta}>
                  {t("screens.multiplayer.friendStats", {
                    level: friend.stats.level ?? 1,
                    quests: friend.stats.quests_completed ?? 0,
                    wins: friend.stats.challenge_wins ?? 0,
                  })}
                </Text>
              </View>
              <GameButton label={t("screens.multiplayer.actions.duel")} onPress={() => handleCreateDuel(friend.id)} variant="secondary" style={styles.duelButton} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t("screens.multiplayer.emptyFriends")}</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.multiplayer.sections.activePvp")}</Text>
        {challenges.length ? (
          challenges.map((challenge) => (
            <View key={challenge.id} style={styles.challengeCard}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <Text style={styles.challengeMeta}>
                {t("screens.multiplayer.challengeMeta", {
                  activity: getObjectiveLabel(challenge.activity_type, t),
                  goal: challenge.goal,
                  status: translateStatus(challenge.status),
                })}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t("screens.multiplayer.emptyPvp")}</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.multiplayer.sections.coopQuests")}</Text>
        {coopQuests.length ? (
          coopQuests.map((quest) => (
            <View key={quest.id} style={styles.challengeCard}>
              <Text style={styles.challengeTitle}>{quest.title}</Text>
              <Text style={styles.challengeMeta}>
                {t("screens.multiplayer.coopMeta", {
                  activity: getObjectiveLabel(quest.objective_type, t),
                  progress: quest.progress,
                  goal: quest.goal,
                  status: translateStatus(quest.status),
                })}
              </Text>
              <Text style={styles.challengeMeta}>
                {t("common.participants")}: {quest.participants.map((participant: any) => participant.name).join(", ")}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t("screens.multiplayer.emptyCoop")}</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  input: {
    backgroundColor: palette.bgCardAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  friendRow: {
    gap: 8,
  },
  friendChip: {
    color: palette.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.bgCardAlt,
    overflow: "hidden",
  },
  friendChipActive: {
    color: palette.text,
    backgroundColor: palette.primaryDeep,
    borderColor: palette.primary,
  },
  helperText: {
    color: palette.textMuted,
    lineHeight: 18,
  },
  friendCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: palette.bgCardAlt,
    borderRadius: radii.md,
    padding: 12,
  },
  friendCopy: {
    flex: 1,
  },
  friendName: {
    color: palette.text,
    fontWeight: "700",
  },
  friendMeta: {
    color: palette.textMuted,
    lineHeight: 18,
  },
  duelButton: {
    minWidth: 96,
  },
  challengeCard: {
    backgroundColor: palette.bgCardAlt,
    borderRadius: radii.md,
    padding: 12,
    gap: 4,
  },
  challengeTitle: {
    color: palette.text,
    fontWeight: "800",
  },
  challengeMeta: {
    color: palette.textMuted,
  },
  emptyText: {
    color: palette.textMuted,
    lineHeight: 20,
  },
});
