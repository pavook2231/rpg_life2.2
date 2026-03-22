import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { radii, useThemeColors, useThemeMode } from "../../../ui/theme";
import { getClassIcon, normalizeDisplayText } from "../../../lib/gameUi";
import type { UserSearchResult } from "../types";
import { formatIdentityLabel, formatLastActive, formatPresenceLabel } from "../utils";

type Props = {
  user: UserSearchResult;
  t: (key: string, params?: Record<string, string | number>) => string;
  sending?: boolean;
  responding?: boolean;
  onAdd: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
};

export function FriendSearchResultCard({
  user,
  t,
  sending = false,
  responding = false,
  onAdd,
  onAccept,
  onDecline,
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const identityLabel = formatIdentityLabel(user.username, user.friend_id);
  const lastActiveLabel = formatLastActive(user.last_active_at);
  const level = user.level ?? 1;

  return (
    <Card>
      <View style={styles.topRow}>
        <View style={styles.identityWrap}>
          <Avatar icon={getClassIcon(user.class_name)} size={54} />
          <View style={styles.copyWrap}>
            <Text style={styles.nameText}>{normalizeDisplayText(user.name) || "Игрок"}</Text>
            {identityLabel ? <Text style={styles.metaText}>{identityLabel}</Text> : null}
            <Text style={styles.metaText}>
              Ур. {level} • {formatPresenceLabel(user.presence_status, t)}
              {user.presence_status === "offline" && lastActiveLabel ? ` • был ${lastActiveLabel}` : ""}
            </Text>
          </View>
        </View>
      </View>

      {user.status === "none" ? (
        <Button
          label={sending ? "Отправляем..." : "Добавить в друзья"}
          icon="account-plus-outline"
          onPress={onAdd}
          loading={sending}
          disabled={sending}
        />
      ) : null}

      {user.status === "friend" ? (
        <View style={styles.stateBadge}>
          <Text style={styles.stateText}>Уже в друзьях</Text>
        </View>
      ) : null}

      {user.status === "outgoing_pending" ? (
        <View style={styles.stateBadge}>
          <Text style={styles.stateText}>Заявка уже отправлена</Text>
        </View>
      ) : null}

      {user.status === "incoming_pending" ? (
        <View style={styles.actionRow}>
          <Button
            label="Принять"
            icon="check-circle-outline"
            onPress={onAccept ?? (() => undefined)}
            loading={responding}
            disabled={responding || !onAccept}
            style={styles.actionButton}
          />
          <Button
            label="Отклонить"
            icon="close-circle-outline"
            onPress={onDecline ?? (() => undefined)}
            disabled={responding || !onDecline}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>
      ) : null}
    </Card>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    topRow: {
      flexDirection: "row",
      alignItems: "center",
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
    stateBadge: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.26)" : "rgba(245,158,11,0.18)",
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    stateText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
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
  });
}
