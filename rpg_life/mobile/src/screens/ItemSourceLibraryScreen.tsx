import React, { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Screen } from "../components/Screen";
import { ITEM_SOURCE_SECTIONS } from "../lib/itemSourceCatalog";
import { Card, radii, useThemeColors, useThemeMode } from "../ui";

export function ItemSourceLibraryScreen() {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const previewSize = isCompact ? 68 : 82;
  const totalAssets = useMemo(
    () => ITEM_SOURCE_SECTIONS.reduce((sum, section) => sum + section.items.length, 0),
    [],
  );

  return (
    <Screen
      title="Арсенал предметов"
      subtitle="Все игровые исходники иконок теперь загружены в приложение и доступны как единая mobile-библиотека."
    >
      <Card tone="accent">
        <Text style={styles.summaryTitle}>Библиотека ассетов</Text>
        <Text style={styles.summaryText}>
          {`Разделов: ${ITEM_SOURCE_SECTIONS.length} • Исходников: ${totalAssets}`}
        </Text>
      </Card>

      {ITEM_SOURCE_SECTIONS.map((section) => (
        <Card key={section.key} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionDescription}>{section.description}</Text>
            </View>
            <View style={[styles.sectionBadge, { borderColor: `${section.accent}66`, backgroundColor: `${section.accent}18` }]}>
              <Text style={[styles.sectionBadgeText, { color: section.accent }]}>{section.items.length}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetRow}>
            {section.items.map((item) => (
              <View key={item.key} style={[styles.assetCard, { width: previewSize + 28 }]}>
                <View style={[styles.assetFrame, { width: previewSize, height: previewSize, borderColor: `${section.accent}55` }]}>
                  <Image source={item.source} style={{ width: previewSize - 18, height: previewSize - 18, resizeMode: "contain" }} />
                </View>
                <Text style={styles.assetLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Card>
      ))}
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  summaryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  summaryText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  sectionCard: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  sectionDescription: {
    color: colors.textMuted,
    lineHeight: 19,
  },
  sectionBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  sectionBadgeText: {
    fontWeight: "900",
    fontSize: 15,
  },
  assetRow: {
    gap: 10,
    paddingRight: 4,
  },
  assetCard: {
    gap: 8,
  },
  assetFrame: {
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.94)" : "rgba(7, 12, 24, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  assetLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  });
}
