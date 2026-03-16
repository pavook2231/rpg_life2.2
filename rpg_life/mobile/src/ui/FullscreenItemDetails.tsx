import React, { useMemo } from "react";
import { Modal as NativeModal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTranslation } from "../context/LocalizationContext";
import type { ItemStatEntry } from "../lib/equipment";
import { GameIcon } from "./GameIcon";
import { Button } from "./Button";
import { getRaritySurface, radii, shadows, useThemeColors, useThemeMode } from "./theme";

type Action = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost" | "gold";
  icon?: string;
  disabled?: boolean;
};

type MetaRow = {
  label: string;
  value: string;
};

type ComparisonRow = {
  label: string;
  currentValue: string | number;
  nextValue: string | number;
  delta: number;
};

type Props = {
  visible: boolean;
  title: string;
  icon: string;
  itemId?: number | null;
  itemType?: string | null;
  itemSlot?: string | null;
  itemSubclass?: string | null;
  rarity?: string | null;
  subtitle?: string;
  description?: string;
  metaRows?: MetaRow[];
  stats?: string[];
  statEntries?: ItemStatEntry[];
  comparisonTitle?: string;
  comparisonIntro?: string;
  comparisonRows?: ComparisonRow[];
  actions?: Action[];
  onClose: () => void;
};

export function FullscreenItemDetails({
  visible,
  title,
  icon,
  itemId,
  itemType,
  itemSlot,
  itemSubclass,
  rarity,
  subtitle,
  description,
  metaRows = [],
  stats = [],
  statEntries = [],
  comparisonTitle,
  comparisonIntro,
  comparisonRows = [],
  actions = [],
  onClose,
}: Props) {
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const surface = getRaritySurface(rarity, themeMode);
  const entries = statEntries.length
    ? statEntries
    : stats.map((stat, index) => ({
        key: `${stat}-${index}`,
        label: stat,
        displayValue: "",
        value: 0,
        icon: "plus-circle-outline",
      }));

  return (
    <NativeModal visible={visible} animationType="none" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Animated.View
              entering={FadeInDown.duration(260)}
              style={[
                styles.heroCard,
                {
                  backgroundColor: surface.background,
                  borderColor: surface.border,
                  shadowColor: surface.border,
                },
              ]}
            >
              <View style={[styles.heroInset, { borderColor: `${surface.accent}55`, backgroundColor: surface.panel }]} />
              <View style={[styles.heroGlow, { backgroundColor: surface.glow }]} />
              <View style={styles.heroTopBar}>
                <View style={[styles.rarityBadge, { backgroundColor: `${surface.accent}18`, borderColor: `${surface.accent}33` }]}>
                  <GameIcon name="star-four-points" size={14} color={surface.accent} />
                  <Text style={[styles.rarityLabel, { color: surface.accent }]}>{subtitle ?? t("common.item")}</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <GameIcon name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              <View style={styles.heroBody}>
                <View style={[styles.iconFrame, { borderColor: surface.border, backgroundColor: `${surface.accent}12` }]}>
                  <View style={[styles.iconGlow, { backgroundColor: `${surface.border}1f` }]} />
                  <GameIcon itemId={itemId} itemType={itemType} itemSlot={itemSlot} itemSubclass={itemSubclass} rarity={rarity} name={icon} size={92} color={surface.accent} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={[styles.title, { color: surface.accent }]}>{title}</Text>
                  {description ? <Text style={styles.description}>{description}</Text> : null}
                  {metaRows.length ? (
                    <View style={styles.metaList}>
                      {metaRows.map((row) => (
                        <View key={`${row.label}-${row.value}`} style={[styles.metaRow, { borderColor: `${surface.accent}22` }]}>
                          <Text style={styles.metaLabel}>{row.label}</Text>
                          <Text style={[styles.metaValue, { color: surface.accent }]}>{row.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("common.itemStatsTitle")}</Text>
              {entries.length ? (
                <View style={styles.statsGrid}>
                  {entries.map((entry) => (
                    <View key={entry.key} style={styles.statChip}>
                      <View style={styles.statIconWrap}>
                        <GameIcon name={entry.icon} size={16} color={colors.primary} />
                      </View>
                      <View style={styles.statCopy}>
                        <Text style={styles.statLabel}>{entry.label}</Text>
                        <Text style={styles.statValue}>{entry.displayValue || entry.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.sectionText}>{t("common.noItemBonuses")}</Text>
              )}
            </View>

            {comparisonTitle ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{comparisonTitle}</Text>
                {comparisonIntro ? <Text style={styles.sectionText}>{comparisonIntro}</Text> : null}
                {comparisonRows.length ? (
                  <>
                    <View style={styles.compareHeader}>
                      <Text style={styles.compareHeaderLabel}>{t("common.comparisonColumns.stat")}</Text>
                      <Text style={styles.compareHeaderValue}>{t("common.comparisonColumns.current")}</Text>
                      <Text style={styles.compareHeaderValue}>{t("common.comparisonColumns.next")}</Text>
                      <Text style={styles.compareHeaderValue}>{t("common.comparisonColumns.delta")}</Text>
                    </View>
                    {comparisonRows.map((row) => (
                      <View key={row.label} style={styles.compareRow}>
                        <Text style={styles.compareLabel}>{row.label}</Text>
                        <Text style={styles.compareCurrent}>{row.currentValue}</Text>
                        <Text style={styles.compareNext}>{row.nextValue}</Text>
                        <View
                          style={[
                            styles.deltaPill,
                            row.delta > 0 ? styles.deltaPositiveBg : row.delta < 0 ? styles.deltaNegativeBg : styles.deltaNeutralBg,
                          ]}
                        >
                          <Text
                            style={[
                              styles.compareDelta,
                              row.delta > 0 ? styles.deltaPositive : row.delta < 0 ? styles.deltaNegative : styles.deltaNeutral,
                            ]}
                          >
                            {row.delta > 0 ? `+${row.delta}` : row.delta}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.sectionText}>{t("common.comparisonUnavailable")}</Text>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                onPress={action.onPress}
                variant={action.variant}
                icon={action.icon}
                disabled={action.disabled}
                style={styles.footerButton}
              />
            ))}
          </View>
        </Animated.View>
      </SafeAreaView>
    </NativeModal>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 16,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.xl,
    borderWidth: 2,
    padding: 18,
    gap: 16,
    ...shadows.card,
  },
  heroInset: {
    position: "absolute",
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  heroGlow: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.15,
  },
  heroTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rarityLabel: {
    fontWeight: "800",
    fontSize: 12,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: themeMode === "light" ? "rgba(241,245,249,0.92)" : "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroBody: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  iconFrame: {
    width: 132,
    height: 132,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconGlow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
  },
  description: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  metaList: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: themeMode === "light" ? "rgba(248,250,252,0.9)" : "rgba(11, 18, 32, 0.34)",
  },
  metaLabel: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  metaValue: {
    fontWeight: "900",
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  statsGrid: {
    gap: 10,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.backgroundInset,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
  },
  statCopy: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statLabel: {
    color: colors.text,
    fontWeight: "700",
  },
  statValue: {
    color: colors.primary,
    fontWeight: "900",
  },
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  compareHeaderLabel: {
    flex: 1.2,
    color: colors.textDim,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  compareHeaderValue: {
    flex: 0.8,
    color: colors.textDim,
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
    textTransform: "uppercase",
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.backgroundInset,
  },
  compareLabel: {
    flex: 1.2,
    color: colors.text,
    fontWeight: "700",
  },
  compareCurrent: {
    flex: 0.8,
    color: colors.textMuted,
    fontWeight: "700",
    textAlign: "center",
  },
  compareNext: {
    flex: 0.8,
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
  },
  deltaPill: {
    flex: 0.8,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  compareDelta: {
    textAlign: "center",
    fontWeight: "900",
  },
  deltaPositiveBg: {
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  deltaNegativeBg: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  deltaNeutralBg: {
    backgroundColor: "rgba(148,163,184,0.14)",
  },
  deltaPositive: {
    color: colors.success,
  },
  deltaNegative: {
    color: colors.danger,
  },
  deltaNeutral: {
    color: colors.textDim,
  },
  footer: {
    position: "absolute",
    right: 16,
    bottom: 16,
    left: 16,
    flexDirection: "row",
    gap: 10,
  },
  footerButton: {
    flex: 1,
  },
  });
}
