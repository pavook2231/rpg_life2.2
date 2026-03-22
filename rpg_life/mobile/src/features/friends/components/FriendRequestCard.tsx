import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { radii, useThemeColors, useThemeMode } from "../../../ui/theme";
import { getClassIcon, normalizeDisplayText } from "../../../lib/gameUi";
import type { FriendRequestItem } from "../types";
import { formatIdentityLabel, formatPresenceLabel } from "../utils";

type Props = {
  request: FriendRequestItem;
  t: (key: string, params?: Record<string, string | number>) => string;
  loading?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
};

export function FriendRequestCard({ request, t, loading = false, onAccept, onDecline }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const isIncoming = request.direction === "incoming";
  const identityLabel = formatIdentityLabel(request.user.username, request.user.friend_id);

  return (
    <Card tone={isIncoming ? "accent" : "subtle"}>
      <View style={styles.topRow}>
        <View style={styles.identityWrap}>
          <Avatar icon={getClassIcon(request.user.class_name)} size={52} />
          <View style={styles.copyWrap}>
            <Text style={styles.nameText}>{normalizeDisplayText(request.user.name) || "Игрок"}</Text>
            {identityLabel ? <Text style={styles.metaText}>{identityLabel}</Text> : null}
            <Text style={styles.metaText}>{formatPresenceLabel(request.user.presence_status, t)}</Text>
          </View>
        </View>

        <View style={styles.directionBadge}>
          <Text style={styles.directionText}>{isIncoming ? "Входящая" : "Ожидает ответа"}</Text>
        </View>
      </View>

      {isIncoming ? (
        <View style={styles.actionRow}>
          <Button
            label="Принять"
            icon="check-circle-outline"
            onPress={onAccept ?? (() => undefined)}
            loading={loading}
            disabled={loading || !onAccept}
            style={styles.actionButton}
          />
          <Button
            label="Отклонить"
            icon="close-circle-outline"
            onPress={onDecline ?? (() => undefined)}
            disabled={loading || !onDecline}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>
      ) : (
        <View style={styles.pendingRow}>
          <Text style={styles.pendingText}>Заявка отправлена. Ждём подтверждение от друга.</Text>
        </View>
      )}
    </Card>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    identityWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    copyWrap: {
      flex: 1,
      gap: 4,
    },
    nameText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    metaText: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
    },
    directionBadge: {
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.34)" : "rgba(245,158,11,0.24)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.96)" : "rgba(11,18,32,0.72)",
    },
    directionText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minWidth: 140,
    },
    pendingRow: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pendingText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
  });
}
