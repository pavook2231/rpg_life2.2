import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { useTranslation } from "../context/LocalizationContext";
import { Card, useThemeColors } from "../ui";

export function HelpScreen() {
  const t = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const items = [
    t("screens.help.tipOffline"),
    t("screens.help.tipSync"),
    t("screens.help.tipNotifications"),
    t("screens.help.tipSecurity"),
  ];

  return (
    <Screen title={t("screens.help.title")} subtitle={t("screens.help.subtitle")}>
      {items.map((item, index) => (
        <Card key={item}>
          <View style={styles.row}>
            <Text style={styles.index}>{index + 1}</Text>
            <Text style={styles.text}>{item}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  index: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  text: {
    flex: 1,
    color: colors.textMuted,
    lineHeight: 21,
  },
  });
}
