import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useNavigation } from "@react-navigation/native";

import Constants from "expo-constants";

import { Screen } from "../components/Screen";
import { useTranslation } from "../context/LocalizationContext";
import { ITEM_SOURCE_SECTIONS } from "../lib/itemSourceCatalog";
import { Button, Card, useThemeColors, useThemeMode } from "../ui";

export function AboutScreen() {
  const t = useTranslation();
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const previewItems = ITEM_SOURCE_SECTIONS.flatMap((section) => section.items).slice(0, 6);

  return (
    <Screen title={t("screens.about.title")} subtitle={t("screens.about.subtitle")}>
      <Card>
        <Text style={styles.title}>{t("screens.about.appName")}</Text>
        <Text style={styles.text}>{t("screens.about.description")}</Text>
        <Text style={styles.meta}>{t("screens.about.version")}: {Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </Card>
      <Card>
        <Text style={styles.title}>{t("screens.about.whatsInside")}</Text>
        <Text style={styles.text}>{t("screens.about.features")}</Text>
      </Card>
      <Card tone="accent">
        <Text style={styles.title}>Арсенал предметов</Text>
        <Text style={styles.text}>
          В приложении теперь доступна полная mobile-библиотека всех item source-ассетов из проекта: оружие, броня, аксессуары, сундуки, misc и armory.
        </Text>
        <View style={styles.previewRow}>
          {previewItems.map((item) => (
            <View key={item.key} style={styles.previewChip}>
              <Text style={styles.previewText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        <Button label="Открыть арсенал" icon="treasure-chest" onPress={() => navigation.navigate("ItemSourceLibrary")} />
      </Card>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  text: {
    color: colors.textMuted,
    lineHeight: 21,
  },
  meta: {
    color: colors.primary,
    fontWeight: "700",
  },
  previewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewChip: {
    backgroundColor: colors.backgroundInset,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  });
}
