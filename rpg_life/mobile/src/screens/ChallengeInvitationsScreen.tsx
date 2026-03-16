import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { fetchChallengeInvitations, respondChallengeInvitation, type ChallengeInvitation } from "../api/social";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { GameIcon } from "../ui/GameIcon";
import { useThemeColors } from "../ui/theme";

export function ChallengeInvitationsScreen() {
  const [invitations, setInvitations] = useState<ChallengeInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useFeedback();
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const loadInvitations = async () => {
    try {
      const response = await fetchChallengeInvitations("pending");
      setInvitations(response.invitations);
    } catch {
      pushToast({
        title: t("errors.networkError"),
        description: t("errors.tryAgain"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleRespond = async (invitationId: number, action: "accept" | "decline") => {
    try {
      await respondChallengeInvitation(invitationId, action);
      pushToast({
        title: action === "accept" ? t("challenges.invitationAccepted") : t("challenges.invitationDeclined"),
        icon: action === "accept" ? "check-circle" : "close-circle",
        tone: action === "accept" ? "success" : "info",
      });
      setInvitations((prev) => prev.filter((invitation) => invitation.id !== invitationId));
    } catch {
      pushToast({
        title: t("errors.networkError"),
        description: t("errors.tryAgain"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  };

  const renderInvitation = ({ item }: { item: ChallengeInvitation }) => (
    <Card style={styles.invitationCard}>
      <View style={styles.invitationHeader}>
        <GameIcon name="account" size={24} color={colors.primary} />
        <Text style={styles.senderName}>{item.sender.name}</Text>
        <Text style={styles.invitationType}>
          {item.challenge_type === "pvp" ? t("challenges.pvp") : t("challenges.coop")}
        </Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          {t("challenges.objective")}: {t(`challenges.objectives.${item.objective_type}`)} ({item.goal})
        </Text>
        <Text style={styles.detailText}>
          {t("challenges.reward")}: {item.reward_xp} XP, {item.reward_crystals} {t("common.gold")}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={t("common.accept")}
          onPress={() => handleRespond(item.id, "accept")}
          style={styles.acceptButton}
          variant="success"
        />
        <Button
          label={t("common.decline")}
          onPress={() => handleRespond(item.id, "decline")}
          variant="secondary"
          style={styles.declineButton}
        />
      </View>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t("challenges.invitations")}</Text>
      {invitations.length === 0 ? (
        <View style={styles.empty}>
          <GameIcon name="email-off" size={48} color={colors.textDim} />
          <Text style={styles.emptyText}>{t("challenges.noInvitations")}</Text>
        </View>
      ) : (
        <FlatList
          data={invitations}
          renderItem={renderInvitation}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
  },
  loadingText: {
    color: colors.text,
  },
  list: {
    paddingBottom: 20,
  },
  invitationCard: {
    marginBottom: 12,
    padding: 16,
  },
  invitationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  senderName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  invitationType: {
    fontSize: 12,
    color: colors.primary,
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.textDim,
    marginBottom: 12,
  },
  details: {
    marginBottom: 16,
  },
  detailText: {
    color: colors.textDim,
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 16,
  },
  });
}
