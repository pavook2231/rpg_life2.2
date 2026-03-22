import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useLayoutEffect, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { CharacterView } from "../components/CharacterView";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useTranslation } from "../context/LocalizationContext";
import type { SocialProfileRouteParams } from "../features/socialProfile/types";
import { useSocialProfileState } from "../features/socialProfile/useSocialProfileState";
import { buildItemStatEntries } from "../lib/equipment";
import { buildDerivedStats } from "../lib/gameRules";
import {
  getClassIcon,
  getClassLabel,
  getRarityLabel,
  getSlotLabel,
  normalizeDisplayText,
  normalizeItemText,
} from "../lib/gameUi";
import { mapEquipmentToLayers } from "../lib/characterEquipmentLayers";
import { Avatar, Card, GameIcon, XPBar, radii, useThemeColors, useThemeMode } from "../ui";
import { formatIdentityLabel, formatPresenceLabel, translateOrFallback } from "../features/friends/utils";

function formatValue(value?: number | null) {
  return Math.max(0, Math.trunc(Number(value || 0))).toLocaleString();
}

function getStatLabel(
  key: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const labels: Record<string, string> = {
    rating: translateOrFallback(t, "screens.profile.rating", "Рейтинг"),
    level: translateOrFallback(t, "screens.leaderboard.fields.level", "Уровень"),
    goal: translateOrFallback(t, "screens.goalSelect.title", "Цель"),
    equipped: translateOrFallback(t, "screens.character.equipment.title", "Экипировка"),
    strength: translateOrFallback(t, "screens.character.stats.strength", "Сила"),
    agility: translateOrFallback(t, "screens.character.stats.agility", "Ловкость"),
    intellect: translateOrFallback(t, "screens.character.stats.intellect", "Интеллект"),
    stamina: translateOrFallback(t, "screens.character.stats.stamina", "Выносливость"),
    armor: translateOrFallback(t, "screens.character.stats.armor", "Броня"),
    crit: translateOrFallback(t, "screens.character.stats.crit", "Крит"),
    luck: translateOrFallback(t, "screens.character.stats.luck", "Удача"),
  };
  return labels[key] ?? key;
}

export function SocialProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const t = useTranslation();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const routeParams = route.params as SocialProfileRouteParams | undefined;
  const userId = routeParams?.userId ?? null;
  const { profile, loading, refreshing, error, refreshScreen, reload } = useSocialProfileState({
    userId,
    loadErrorMessage: translateOrFallback(t, "screens.profile.errors.loadProfile", "Не удалось загрузить профиль игрока."),
  });

  const summaryName = normalizeDisplayText(profile?.user.name ?? routeParams?.userName) || "Игрок";
  const identityLabel = profile ? formatIdentityLabel(profile.user.username, profile.user.friend_id) : null;
  const presenceLabel = profile ? formatPresenceLabel(profile.user.presence_status, t) : null;
  const goalTitle = profile?.goal.goal_title ?? profile?.user.goal_title ?? null;
  const goalProgressPercent = Math.max(
    0,
    Math.min(
      100,
      Number(profile?.goal.goal_progress_percent ?? profile?.user.goal_progress_percent ?? profile?.character?.goal_progress_percent ?? 0),
    ),
  );
  const goalCurrentXp = Math.max(
    0,
    Number(profile?.goal.goal_cycle_xp ?? profile?.user.goal_cycle_xp ?? profile?.character?.goal_cycle_xp ?? 0),
  );
  const goalTargetXp = Math.max(
    0,
    Number(profile?.goal.goal_target_xp ?? profile?.user.goal_target_xp ?? profile?.character?.goal_target_xp ?? 0),
  );
  const character = profile?.character ?? null;
  const equipmentOverview = profile?.equipment_overview ?? null;
  const equipmentEntries = equipmentOverview?.equipment ?? [];
  const layeredEquipment = useMemo(() => mapEquipmentToLayers(equipmentEntries), [equipmentEntries]);
  const derivedStats = useMemo(
    () => buildDerivedStats(equipmentOverview?.class_info, equipmentOverview?.equipment_totals, equipmentOverview?.reward_effects),
    [equipmentOverview?.class_info, equipmentOverview?.equipment_totals, equipmentOverview?.reward_effects],
  );
  const characterSize = width < 420 ? 300 : 360;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: summaryName,
    });
  }, [navigation, summaryName]);

  return (
    <Screen
      title={summaryName}
      subtitle={translateOrFallback(
        t,
        "screens.profile.subtitle",
        "Осмотр профиля игрока, его цели, рейтинга и текущей экипировки.",
      )}
      scrollable={false}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshScreen()} tintColor={colors.primary} />}
      >
        {!userId ? (
          <StateBlock
            tone="warning"
            icon="alert-circle"
            title={translateOrFallback(t, "screens.friends.errorTitle", "Не удалось открыть профиль")}
            description="У профиля нет корректного идентификатора игрока."
          />
        ) : null}

        {loading ? (
          <StateBlock tone="info" icon="timer-sand" title={translateOrFallback(t, "common.loading", "Загрузка")} />
        ) : null}

        {!loading && error ? (
          <StateBlock
            tone="warning"
            icon="alert-circle"
            title={translateOrFallback(t, "screens.friends.errorTitle", "Не удалось загрузить профиль")}
            description={error}
            actionLabel={translateOrFallback(t, "common.retry", "Повторить")}
            onAction={() => void reload()}
          />
        ) : null}

        {!loading && !error && profile ? (
          <>
            <Card tone="accent" style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroIdentity}>
                  <Avatar icon={getClassIcon(profile.user.class_name ?? character?.class)} size={72} />
                  <View style={styles.heroCopy}>
                    <Text style={styles.heroName}>{summaryName}</Text>
                    {identityLabel ? <Text style={styles.heroMeta}>{identityLabel}</Text> : null}
                    <Text style={styles.heroMeta}>
                      {getClassLabel(profile.user.class_name ?? character?.class, t)}{" "}
                      {character ? `• ${translateOrFallback(t, "screens.leaderboard.fields.level", "Уровень")} ${character.level}` : ""}
                    </Text>
                  </View>
                </View>

                {presenceLabel ? (
                  <View
                    style={[
                      styles.presenceBadge,
                      profile.user.presence_status === "online" ? styles.presenceBadgeOnline : styles.presenceBadgeOffline,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presenceText,
                        profile.user.presence_status === "online" ? styles.presenceTextOnline : styles.presenceTextOffline,
                      ]}
                    >
                      {presenceLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricChip}>
                  <Text style={styles.metricLabel}>{getStatLabel("rating", t)}</Text>
                  <Text style={styles.metricValue}>{formatValue(profile.user.power_rating)}</Text>
                </View>
                <View style={styles.metricChip}>
                  <Text style={styles.metricLabel}>{getStatLabel("level", t)}</Text>
                  <Text style={styles.metricValue}>{character?.level ?? profile.user.level ?? 1}</Text>
                </View>
                <View style={styles.metricChip}>
                  <Text style={styles.metricLabel}>{getStatLabel("goal", t)}</Text>
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {goalTitle || "Не выбрана"}
                  </Text>
                </View>
                <View style={styles.metricChip}>
                  <Text style={styles.metricLabel}>{getStatLabel("equipped", t)}</Text>
                  <Text style={styles.metricValue}>{equipmentEntries.length}</Text>
                </View>
              </View>

              {goalTitle ? (
                <View style={styles.progressBlock}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>{goalTitle}</Text>
                    <Text style={styles.progressMeta}>
                      {goalTargetXp > 0 ? `${formatValue(goalCurrentXp)} / ${formatValue(goalTargetXp)} XP` : `${goalProgressPercent}%`}
                    </Text>
                  </View>
                  <XPBar
                    current={goalTargetXp > 0 ? goalCurrentXp : goalProgressPercent}
                    total={goalTargetXp > 0 ? Math.max(goalTargetXp, 1) : 100}
                    color={colors.gold}
                    compact
                  />
                </View>
              ) : null}
            </Card>

            {profile.has_character && character && equipmentOverview ? (
              <>
                <Card style={styles.characterCard}>
                  <Text style={styles.sectionTitle}>{translateOrFallback(t, "navigation.character", "Персонаж")}</Text>

                  <View style={styles.characterLayout}>
                    <View style={styles.characterPreviewWrap}>
                      <CharacterView equipment={layeredEquipment} characterClass={character.class} size={characterSize} />
                    </View>

                    <View style={styles.characterSummary}>
                      <View style={styles.progressBlock}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressTitle}>{translateOrFallback(t, "screens.profile.heroProgress", "Прогресс героя")}</Text>
                          <Text style={styles.progressMeta}>
                            {formatValue(character.current_xp)} / {formatValue(character.next_level_xp)} XP
                          </Text>
                        </View>
                        <XPBar current={character.current_xp} total={Math.max(character.next_level_xp, 1)} color={colors.primary} compact />
                      </View>

                      <View style={styles.summaryGrid}>
                        {[
                          ["strength", derivedStats.strength],
                          ["agility", derivedStats.agility],
                          ["intellect", derivedStats.intellect],
                          ["stamina", derivedStats.stamina],
                          ["armor", derivedStats.armor],
                          ["crit", `${derivedStats.critRewardChancePercent}%`],
                          ["luck", `${derivedStats.lootChancePercent}%`],
                        ].map(([key, value]) => {
                          const statKey = String(key);
                          return (
                            <View key={statKey} style={styles.summaryChip}>
                              <Text style={styles.summaryChipLabel}>{getStatLabel(statKey, t)}</Text>
                              <Text style={styles.summaryChipValue}>{String(value)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </Card>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{translateOrFallback(t, "screens.character.equipment.title", "Экипировка")}</Text>
                  {equipmentEntries.length > 0 ? (
                    equipmentEntries.map((entry) => {
                      const statEntries = buildItemStatEntries(entry, t).slice(0, 4);
                      return (
                        <Card key={`${entry.slot}-${entry.inventory_id}`} tone="subtle">
                          <View style={styles.itemTopRow}>
                            <View style={styles.itemIdentity}>
                              <View style={styles.itemIconWrap}>
                                <GameIcon
                                  itemId={entry.item.id ?? null}
                                  itemType={entry.item.type}
                                  itemSlot={entry.item.slot}
                                  itemSubclass={entry.item.subclass}
                                  rarity={entry.item.rarity}
                                  name={entry.item.icon}
                                  size={34}
                                  color={colors.text}
                                />
                              </View>
                              <View style={styles.itemCopy}>
                                <Text style={styles.itemName}>{normalizeItemText(entry.item.name)}</Text>
                                <Text style={styles.itemMeta}>
                                  {getSlotLabel(entry.slot, t)} • {getRarityLabel(entry.item.rarity, t)}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {statEntries.length ? (
                            <View style={styles.itemStatsRow}>
                              {statEntries.map((stat) => (
                                <View key={`${entry.inventory_id}-${stat.key}`} style={styles.itemStatChip}>
                                  <Text style={styles.itemStatLabel}>{stat.label}</Text>
                                  <Text style={styles.itemStatValue}>{stat.displayValue}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.itemMeta}>Без дополнительных бонусов</Text>
                          )}
                        </Card>
                      );
                    })
                  ) : (
                    <StateBlock
                      icon="shield-outline"
                      title="Пока ничего не экипировано"
                      description="У этого игрока нет надетых предметов или сервер ещё не вернул экипировку."
                    />
                  )}
                </View>
              </>
            ) : (
              <StateBlock
                icon="account-question-outline"
                title="Персонаж пока недоступен"
                description="У игрока ещё нет активного персонажа или прогресс не загружен."
              />
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    content: {
      flex: 1,
    },
    contentBody: {
      paddingBottom: 28,
      gap: 14,
    },
    heroCard: {
      gap: 14,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    heroIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    heroCopy: {
      flex: 1,
      gap: 4,
    },
    heroName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
    },
    heroMeta: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    presenceBadge: {
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
    },
    presenceBadgeOnline: {
      borderColor: themeMode === "light" ? "rgba(22,163,74,0.28)" : "rgba(34,197,94,0.24)",
      backgroundColor: themeMode === "light" ? "rgba(220,252,231,0.96)" : "rgba(20,83,45,0.4)",
    },
    presenceBadgeOffline: {
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
    },
    presenceText: {
      fontSize: 12,
      fontWeight: "800",
    },
    presenceTextOnline: {
      color: themeMode === "light" ? "#166534" : "#86efac",
    },
    presenceTextOffline: {
      color: colors.textDim,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    metricChip: {
      flexGrow: 1,
      minWidth: 110,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    metricLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    metricValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    progressBlock: {
      gap: 8,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    progressTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      flex: 1,
    },
    progressMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    characterCard: {
      gap: 14,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    characterLayout: {
      gap: 14,
    },
    characterPreviewWrap: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingVertical: 12,
    },
    characterSummary: {
      gap: 12,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    summaryChip: {
      flexGrow: 1,
      minWidth: 96,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    summaryChipLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    summaryChipValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    itemTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    itemIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    itemIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    itemCopy: {
      flex: 1,
      gap: 4,
    },
    itemName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    itemStatsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    itemStatChip: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
      minWidth: 84,
    },
    itemStatLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
    },
    itemStatValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
  });
}
