import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import {
  equipInventoryItem,
  fetchInventoryItemDetail,
  openChest,
  sellInventoryItem,
  unequipInventoryItem,
} from "../features/items/itemService";
import {
  CharacterView,
} from "../components/CharacterView";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useFeedback } from "../context/FeedbackContext";
import { useGameInventoryEquipment, useGameProgress } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { buildItemStatEntries, pickEquipSlot } from "../lib/equipment";
import { mapEquipmentToLayers } from "../lib/characterEquipmentLayers";
import { buildItemComparison } from "../lib/itemComparison";
import { buildDerivedStats } from "../lib/gameRules";
import { getRarityLabel, getSlotLabel, normalizeItemText } from "../lib/gameUi";
import { getNextHealthDecayLabel } from "../lib/healthUi";
import {
  Button,
  ChestOpeningModal,
  Card,
  FullscreenItemDetails,
  GameIcon,
  ProfileHeroCard,
  Tooltip,
  getRaritySurface,
  radii,
  useThemeColors,
  useThemeMode,
} from "../ui";

const LEFT_SLOTS = ["head", "neck", "shoulders", "chest", "waist", "ring1", "trinket1"] as const;
const RIGHT_SLOTS = ["back", "main_hand", "off_hand", "wrist", "hands", "legs", "feet"] as const;

type StatHint = {
  key: string;
  icon: string;
  label: string;
  value: string | number;
  description: string;
};

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function CharacterScreen() {
  const t = useTranslation();
  const { language } = useLocalization();
  const { width } = useWindowDimensions();
  const { hero } = useGameProgress();
  const { equipment, inventory, refreshGame, isDataConsistent, dataConsistencyError } = useGameInventoryEquipment();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedStat, setSelectedStat] = useState<StatHint | null>(null);
  const [openedChestReward, setOpenedChestReward] = useState<Awaited<ReturnType<typeof openChest>> | null>(null);

  const isCompact = width < 430;
  const slotSize = isCompact ? 58 : 66;
  const characterSize = isCompact ? 360 : 430;
  const bagColumns = width >= 480 ? 6 : 5;
  const bagGap = 8;
  const bagCellWidth = Math.max((width - 56 - bagGap * (bagColumns - 1)) / bagColumns, 56);
  const heroLevel = hero?.level ?? equipment?.class_info?.level ?? 1;

  const bagItems = useMemo(
    () => equipment?.bag_items ?? inventory.filter((entry) => !entry.is_equipped),
    [equipment?.bag_items, inventory],
  );
  const equippedCount = equipment?.equipment?.length ?? 0;
  const layeredEquipment = useMemo(() => mapEquipmentToLayers(equipment?.equipment ?? []), [equipment?.equipment]);
  const equipmentMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const entry of equipment?.equipment ?? []) {
      map.set(entry.slot, entry);
    }
    return map;
  }, [equipment?.equipment]);
  const selectedComparison = useMemo(
    () => (selectedItem?.is_equipped ? null : buildItemComparison(selectedItem, equipment?.equipment ?? [], t)),
    [equipment?.equipment, selectedItem, t],
  );
  const derivedStats = useMemo(
    () => buildDerivedStats(equipment?.class_info, equipment?.equipment_totals, equipment?.reward_effects),
    [equipment],
  );

  const healthState = hero?.health ?? null;
  const maxHealth = Math.max(1, Math.round(healthState?.max_health ?? derivedStats.health));
  const currentHealth = Math.max(0, Math.min(maxHealth, Math.round(healthState?.current_health ?? maxHealth)));
  const healthPercent = Math.max(0, Math.min(100, Math.round((currentHealth * 100) / maxHealth)));
  const healthAccentColor = colors.hp;
  const healthCardTone: "subtle" | "accent" | "danger" =
    healthState?.is_wounded || healthPercent <= 35 ? "danger" : healthPercent <= 70 ? "accent" : "subtle";
  const healthStatusLabel =
    healthState?.is_wounded ? "Ранен" : healthPercent <= 35 ? "Критично" : healthPercent <= 70 ? "Ослаблен" : "В строю";
  const woundedPenaltyPercent = Math.max(0, Math.round(healthState?.reward_penalty_percent ?? 0));
  const nextDecayLabel = getNextHealthDecayLabel(healthState?.last_health_decay_at, language);

  function getItemRequiredLevel(entry: { item?: { required_level?: number | null } | null } | null | undefined) {
    return Math.max(1, entry?.item?.required_level ?? 1);
  }

  function isItemLevelLocked(entry: { item?: { required_level?: number | null; type?: string | null } | null } | null | undefined) {
    if (!entry?.item || entry.item.type === "chest") {
      return false;
    }
    return getItemRequiredLevel(entry) > heroLevel;
  }

  const statHints: StatHint[] = useMemo(
    () => [
      {
        key: "damage",
        icon: "sword-cross",
        label: "Урон",
        value: equipment?.equipment_totals ? `${equipment.equipment_totals.damage_min}-${equipment.equipment_totals.damage_max}` : "0-0",
        description: "Итоговый урон экипированного оружия.",
      },
      {
        key: "health",
        icon: "heart-plus",
        label: "HP",
        value: `${currentHealth}/${maxHealth}`,
        description: healthState?.is_wounded
          ? `Герой ранен и получает штраф к наградам. Осталось восстановить ${healthState.penalty_quests_remaining} квестов.`
          : `Текущий запас здоровья героя: ${currentHealth} из ${maxHealth}.`,
      },
      {
        key: "armor",
        icon: "armor",
        label: t("screens.character.stats.armor"),
        value: derivedStats.armor,
        description: `Броня снижает урон от пропущенных дней на ${derivedStats.armorReductionPercent}%.`,
      },
      {
        key: "strength",
        icon: "strength",
        label: t("screens.character.stats.strength"),
        value: derivedStats.strength,
        description: "Сила показывает общую физическую мощь героя и усиливает ощущение прогресса от экипировки.",
      },
      {
        key: "agility",
        icon: "agility",
        label: t("screens.character.stats.agility"),
        value: derivedStats.agility,
        description: `Ловкость повышает золото за задания. Текущий бонус: +${derivedStats.goldBonusPercent}%.`,
      },
      {
        key: "intellect",
        icon: "intellect",
        label: t("screens.character.stats.intellect"),
        value: derivedStats.intellect,
        description: `Интеллект повышает опыт за задания. Текущий бонус: +${derivedStats.xpBonusPercent}%.`,
      },
      {
        key: "stamina",
        icon: "stamina",
        label: t("screens.character.stats.stamina"),
        value: derivedStats.stamina,
        description: `Выносливость увеличивает максимум здоровья. Текущий максимум: ${maxHealth} HP.`,
      },
      {
        key: "crit",
        icon: "crit",
        label: t("screens.character.stats.crit"),
        value: `${derivedStats.critRewardChancePercent}%`,
        description: `Крит дает шанс удвоить XP и золото. Текущий шанс: ${derivedStats.critRewardChancePercent}%.`,
      },
      {
        key: "luck",
        icon: "luck",
        label: t("screens.character.stats.luck"),
        value: `${derivedStats.lootChancePercent}%`,
        description: `Удача усиливает шанс редких предметов и сундуков. Текущий бонус: +${derivedStats.lootChancePercent}%.`,
      },
    ].map((hint) =>
      hint.key === "strength"
        ? {
            ...hint,
            description: `Сила увеличивает дневной лимит системных квестов. Каждые 10 силы дают ещё 1 квест. Сейчас бонус: +${Math.floor(derivedStats.strength / 10)}.`,
          }
        : hint,
    ),
    [currentHealth, derivedStats, equipment?.equipment_totals, healthState?.is_wounded, healthState?.penalty_quests_remaining, maxHealth, t],
  );
  const selectedItemRequiredLevel = getItemRequiredLevel(selectedItem);
  const selectedItemLocked = isItemLevelLocked(selectedItem);
  const firstEquippableBagItem = useMemo(
    () => bagItems.find((item) => !isItemLevelLocked(item) && item.item?.type !== "chest") ?? null,
    [bagItems, heroLevel],
  );
  const firstEquippableStatEntries = useMemo(
    () => (firstEquippableBagItem ? buildItemStatEntries(firstEquippableBagItem, t).slice(0, 3) : []),
    [firstEquippableBagItem, t],
  );
  const showFirstEquipGuide = equippedCount === 0 && bagItems.length > 0;
  const showEmptyBagGuide = equippedCount === 0 && bagItems.length === 0;

  async function openItemByInventoryId(inventoryId: number) {
    try {
      const detail = await fetchInventoryItemDetail(inventoryId);
      setSelectedItem(detail);
    } catch (error) {
      await pushToast({
        title: "Не удалось открыть предмет",
        description: error instanceof Error ? error.message : t("screens.character.errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleEquip() {
    if (!selectedItem) return;
    const requiredLevel = getItemRequiredLevel(selectedItem);
    if (isItemLevelLocked(selectedItem)) {
      await pushToast({
        title: t("screens.character.levelLocked"),
        description: t("screens.character.unlockAtLevel", { level: requiredLevel }),
        icon: "lock",
        tone: "warning",
      });
      return;
    }
    try {
      const targetSlot = pickEquipSlot(selectedItem, equipment?.equipment ?? []);
      await equipInventoryItem(selectedItem.inventory_id, targetSlot, equipment?.class_info?.id);
      setSelectedItem(null);
      await refreshGame();
    } catch (error) {
      pushToast({
        title: t("screens.character.errors.failedToEquip"),
        description: error instanceof Error ? error.message : t("screens.character.errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleUnequip() {
    if (!selectedItem) return;
    try {
      await unequipInventoryItem(selectedItem.inventory_id);
      setSelectedItem(null);
      await refreshGame();
    } catch (error) {
      pushToast({
        title: t("inventory.unequipItemFailed"),
        description: error instanceof Error ? error.message : t("screens.character.errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleSell() {
    if (!selectedItem) return;
    try {
      await sellInventoryItem(selectedItem.inventory_id);
      setSelectedItem(null);
      await refreshGame();
    } catch (error) {
      pushToast({
        title: t("screens.character.errors.failedToSell"),
        description: error instanceof Error ? error.message : t("screens.character.errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleOpenChest() {
    if (!selectedItem) return;
    try {
      const reward = await openChest({ inventory_id: selectedItem.inventory_id });
      setSelectedItem(null);
      await refreshGame();
      setOpenedChestReward(reward);
      pushToast({
        title: `Получен предмет: ${normalizeItemText(reward.item.name)}`,
        description: "Сундук открыт, предмет добавлен в сумку.",
        icon: reward.item.icon ?? "treasure-chest",
        tone: "reward",
      }, { sound: "item" });
    } catch (error) {
      pushToast({
        title: "Не удалось открыть сундук",
        description: error instanceof Error ? error.message : t("screens.character.errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  function renderSlot(slot: string) {
    const entry = equipmentMap.get(slot);
    const surface = entry ? getRaritySurface(entry.item.rarity, themeMode) : null;

    return (
      <Pressable
        key={slot}
        onPress={entry ? () => openItemByInventoryId(entry.inventory_id) : undefined}
        style={[
          styles.slotCell,
          {
            width: slotSize,
            height: slotSize,
            backgroundColor: entry ? surface?.background : themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(8,14,24,0.8)",
            borderColor: entry ? surface?.border : themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
          },
        ]}
      >
        {entry ? (
          <GameIcon
            itemId={entry.item.id ?? null}
            itemType={entry.item.type}
            itemSlot={entry.item.slot}
            itemSubclass={entry.item.subclass}
            rarity={entry.item.rarity}
            name={entry.item.icon}
            size={34}
            color={surface?.accent ?? colors.text}
          />
        ) : (
          <GameIcon name="plus" size={18} color={colors.textDim} />
        )}
        <Text style={styles.slotLabel} numberOfLines={1}>
          {getSlotLabel(slot, t)}
        </Text>
      </Pressable>
    );
  }

  return (
    <Screen
      title={t("screens.character.title")}
      subtitle={t("screens.character.subtitle")}
      showHeader={false}
      contentTopOffset={10}
    >
      <Card style={styles.introCard} animated={false}>
        <View style={styles.introHeader}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>CHARACTER</Text>
            <Text style={styles.screenTitle}>{t("screens.character.title")}</Text>
            <Text style={styles.screenSubtitle}>{t("screens.character.subtitle")}</Text>
          </View>
          <View style={styles.introMeta}>
            <View style={styles.introChip}>
              <Text style={styles.introChipLabel}>Экипировано</Text>
              <Text style={styles.introChipValue}>{equippedCount}</Text>
            </View>
            <View style={styles.introChip}>
              <Text style={styles.introChipLabel}>Сумка</Text>
              <Text style={styles.introChipValue}>{bagItems.length}</Text>
            </View>
          </View>
        </View>
      </Card>

      {!isDataConsistent && dataConsistencyError ? (
        <StateBlock
          tone="warning"
          icon="alert-circle"
          title={translateOrFallback(t, "screens.character.dataConsistencyError", "Экипировка и характеристики не синхронизированы")}
          description={dataConsistencyError}
          actionLabel={t("common.retry")}
          onAction={() => void refreshGame(true)}
        />
      ) : null}

      <ProfileHeroCard
        name={hero?.name ?? equipment?.class_info?.display_name ?? "Герой"}
        heroClass={hero?.class ?? equipment?.class_info?.class_name}
        level={hero?.level ?? equipment?.class_info?.level ?? 1}
        currentXp={hero?.current_xp ?? equipment?.class_info?.current_xp ?? 0}
        nextLevelXp={hero?.next_level_xp ?? 120}
        gold={hero?.crystals ?? equipment?.class_info?.crystals ?? 0}
        streak={hero?.streak ?? 0}
        healthCurrent={currentHealth}
        healthMax={maxHealth}
        isWounded={healthState?.is_wounded ?? false}
        penaltyQuestsRemaining={healthState?.penalty_quests_remaining ?? 0}
        rewardPenaltyPercent={healthState?.reward_penalty_percent ?? 0}
      />

      <Card tone={healthCardTone}>
        <View style={styles.healthHeaderRow}>
          <View style={styles.healthHeaderCopy}>
            <Text style={styles.sectionTitle}>Состояние героя</Text>
            <Text style={styles.healthDescription}>
              {healthState?.is_wounded
                ? `Герой ослаблен после пропущенных дней. Награды снижены на ${woundedPenaltyPercent}% до восстановления.`
                : `Если пропускать дни, персонаж теряет HP. Броня уменьшает потери на ${derivedStats.armorReductionPercent}%. ${nextDecayLabel}`}
            </Text>
          </View>

          <View
            style={[
              styles.healthStateBadge,
              {
                borderColor: `${healthAccentColor}55`,
                backgroundColor: `${healthAccentColor}22`,
              },
            ]}
          >
            <GameIcon name={healthState?.is_wounded ? "alert-circle" : "heart-plus"} size={16} color={healthAccentColor} />
            <Text style={[styles.healthStateText, { color: healthAccentColor }]}>{healthStatusLabel}</Text>
          </View>
        </View>

        <View style={styles.healthInfoRow}>
          <View style={styles.healthInfoChip}>
            <GameIcon name="shield" size={16} color={colors.primary} />
            <View style={styles.healthInfoCopy}>
              <Text style={styles.healthInfoLabel}>Броня</Text>
              <Text style={styles.healthInfoValue}>{derivedStats.armor}</Text>
            </View>
          </View>
          <View style={styles.healthInfoChip}>
            <GameIcon name="shield-half-full" size={16} color={colors.primary} />
            <View style={styles.healthInfoCopy}>
              <Text style={styles.healthInfoLabel}>Защита</Text>
              <Text style={styles.healthInfoValue}>{derivedStats.armorReductionPercent}%</Text>
            </View>
          </View>
          <View style={styles.healthInfoChip}>
            <GameIcon
              name={healthState?.is_wounded ? "alert-circle" : "check-circle-outline"}
              size={16}
              color={healthState?.is_wounded ? healthAccentColor : colors.success}
            />
            <View style={styles.healthInfoCopy}>
              <Text style={styles.healthInfoLabel}>{healthState?.is_wounded ? "Восстановление" : "Штраф"}</Text>
              <Text style={styles.healthInfoValue}>
                {healthState?.is_wounded ? `${healthState.penalty_quests_remaining} квеста` : "Нет"}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <Card style={styles.stageCard}>
        <View style={styles.stageRow}>
          <View style={styles.slotColumn}>{LEFT_SLOTS.map((slot) => renderSlot(slot))}</View>

          <View style={styles.characterWrap}>
            <View style={styles.characterHalo} />
            <CharacterView equipment={layeredEquipment} characterClass={hero?.class ?? equipment?.class_info?.class_name} size={characterSize} />
          </View>

          <View style={styles.slotColumn}>{RIGHT_SLOTS.map((slot) => renderSlot(slot))}</View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Мини-характеристики</Text>
        <Text style={styles.sectionHint}>
          {translateOrFallback(
            t,
            "screens.character.statHint",
            "Нажми на характеристику, чтобы посмотреть, как она влияет на награды и прогресс.",
          )}
        </Text>
        <View style={styles.statsRow}>
          {statHints.map((chip) => (
            <Pressable key={chip.key} onPress={() => setSelectedStat(chip)} style={styles.statChip}>
              <View style={styles.statIconWrap}>
                <GameIcon name={chip.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Text style={styles.statValue}>{chip.value}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      {showFirstEquipGuide ? (
        <Card tone="accent">
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.character.firstEquipTitle", "Что надеть сейчас")}
          </Text>
          <Text style={styles.sectionHint}>
            {firstEquippableBagItem
              ? translateOrFallback(
                  t,
                  "screens.character.firstEquipDescription",
                  "У тебя уже есть доступный предмет. Открой его и надень, чтобы бонусы начали реально работать.",
                )
              : translateOrFallback(
                  t,
                  "screens.character.firstEquipLockedDescription",
                  "В сумке уже есть предметы, но они пока выше твоего уровня. Сначала закрой еще несколько заданий.",
                )}
          </Text>

          {firstEquippableBagItem ? (
            <View style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <View style={styles.recommendationIconWrap}>
                  <GameIcon
                    itemId={firstEquippableBagItem.item.id ?? firstEquippableBagItem.item_id}
                    itemType={firstEquippableBagItem.item.type}
                    itemSlot={firstEquippableBagItem.item.slot}
                    itemSubclass={firstEquippableBagItem.item.subclass}
                    rarity={firstEquippableBagItem.item.rarity}
                    name={firstEquippableBagItem.item.icon}
                    size={28}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.recommendationCopy}>
                  <Text style={styles.recommendationTitle}>{normalizeItemText(firstEquippableBagItem.item.name)}</Text>
                  <Text style={styles.recommendationMeta}>
                    {getSlotLabel(firstEquippableBagItem.item.slot, t)} | {t("screens.character.levelBadge", { level: getItemRequiredLevel(firstEquippableBagItem) })}
                  </Text>
                </View>
              </View>
              {firstEquippableStatEntries.length ? (
                <View style={styles.recommendationStats}>
                  {firstEquippableStatEntries.map((entry) => (
                    <View key={`${entry.label}-${entry.value}`} style={styles.recommendationStatChip}>
                      <Text style={styles.recommendationStatLabel}>{entry.label}</Text>
                      <Text style={styles.recommendationStatValue}>{entry.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Button
                label={translateOrFallback(t, "screens.character.firstEquipAction", "Открыть предмет")}
                icon="shield-account"
                onPress={() => openItemByInventoryId(firstEquippableBagItem.id)}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {showEmptyBagGuide ? (
        <Card tone="subtle">
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.character.emptyBagTitle", "Экипировка появится после первой награды")}
          </Text>
          <Text style={styles.sectionHint}>
            {translateOrFallback(
              t,
              "screens.character.emptyBagDescription",
              "Пока сумка пустая. Сначала закрой задания или зайди в магазин, а затем вернись сюда, чтобы надеть первый предмет.",
            )}
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.bagHeader}>
          <Text style={styles.sectionTitle}>{t("screens.character.sections.bag")}</Text>
          <Text style={styles.bagCount}>{bagItems.length}</Text>
        </View>
        <View style={styles.bagGrid}>
          {bagItems.map((item, index) => {
            const surface = getRaritySurface(item.item.rarity, themeMode);
            const requiredLevel = getItemRequiredLevel(item);
            const isLocked = isItemLevelLocked(item);
            return (
              <Pressable
                key={`${item.id}-${index}`}
                onPress={() => openItemByInventoryId(item.id)}
                style={[
                  styles.bagCell,
                  {
                    width: bagCellWidth,
                    borderColor: isLocked ? colors.borderSoft : surface.border,
                    backgroundColor: isLocked
                      ? themeMode === "light"
                        ? "rgba(226,232,240,0.92)"
                        : "rgba(30,41,59,0.82)"
                      : surface.background,
                  },
                ]}
              >
                <View style={styles.bagLevelBadge}>
                  <Text style={styles.bagLevelBadgeText}>{t("screens.character.levelBadge", { level: requiredLevel })}</Text>
                </View>
                <View
                  style={[
                    styles.bagInner,
                    {
                      borderColor: isLocked ? colors.borderSoft : surface.trim,
                      backgroundColor: isLocked
                        ? themeMode === "light"
                          ? "rgba(255,255,255,0.72)"
                          : "rgba(15,23,42,0.72)"
                        : surface.panel,
                    },
                  ]}
                >
                  <GameIcon
                    itemId={item.item.id ?? item.item_id}
                    itemType={item.item.type}
                    itemSlot={item.item.slot}
                    itemSubclass={item.item.subclass}
                    rarity={item.item.rarity}
                    name={item.item.icon}
                    size={42}
                    color={isLocked ? colors.textDim : surface.accent}
                  />
                  {isLocked ? (
                    <View style={styles.bagLockOverlay}>
                      <GameIcon name="lock" size={18} color={colors.text} />
                    </View>
                  ) : null}
                </View>
                {isLocked ? (
                  <Text style={styles.bagLockedLabel} numberOfLines={1}>
                    {t("screens.character.unlockAtLevelCompact", { level: requiredLevel })}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <FullscreenItemDetails
        visible={Boolean(selectedItem)}
        title={normalizeItemText(selectedItem?.item?.name)}
        icon={selectedItem?.item?.icon ?? "package-variant"}
        itemId={selectedItem?.item?.id ?? null}
        itemType={selectedItem?.item?.type ?? null}
        itemSlot={selectedItem?.item?.slot ?? null}
        itemSubclass={selectedItem?.item?.subclass ?? null}
        rarity={selectedItem?.item?.rarity}
        subtitle={selectedItem ? getRarityLabel(selectedItem.item.rarity, t) : undefined}
        description={normalizeItemText(selectedItem?.item?.description)}
        metaRows={
          selectedItem
            ? [
                { label: t("screens.character.requiredLevel"), value: t("screens.character.levelBadge", { level: selectedItemRequiredLevel }) },
                ...(selectedItemLocked
                  ? [{ label: t("screens.character.levelLocked"), value: t("screens.character.unlockAtLevel", { level: selectedItemRequiredLevel }) }]
                  : []),
                { label: t("screens.character.sellPrice"), value: `${selectedItem.sell_price} ${t("common.gold")}` },
              ]
            : []
        }
        statEntries={selectedItem ? buildItemStatEntries(selectedItem, t) : []}
        comparisonTitle={selectedComparison?.comparisonTitle}
        comparisonIntro={selectedComparison?.comparisonIntro}
        comparisonRows={selectedComparison?.comparisonRows}
        actions={
          selectedItem
            ? [
                ...(selectedItem.item?.type === "chest"
                  ? [{ label: "Открыть сундук", icon: "treasure-chest", onPress: handleOpenChest as () => void, variant: "gold" as const }]
                  : selectedItem.is_equipped
                    ? [{ label: t("inventory.unequipItem"), icon: "shield-off-outline", onPress: handleUnequip as () => void, variant: "secondary" as const }]
                    : selectedItemLocked
                      ? [{
                          label: t("screens.character.unlockAtLevelAction", { level: selectedItemRequiredLevel }),
                          icon: "lock",
                          onPress: () => undefined,
                          variant: "secondary" as const,
                          disabled: true,
                        }]
                      : [{ label: t("screens.character.equip"), icon: "shield-sword", onPress: handleEquip as () => void }]),
                { label: t("screens.character.sell"), icon: "cash-remove", onPress: handleSell as () => void, variant: "danger" as const },
              ]
            : []
        }
        onClose={() => setSelectedItem(null)}
      />

      <Tooltip
        visible={Boolean(selectedStat)}
        title={selectedStat?.label ?? ""}
        description={selectedStat?.description ?? ""}
        onClose={() => setSelectedStat(null)}
      />

      <ChestOpeningModal
        visible={Boolean(openedChestReward)}
        reward={openedChestReward}
        onClose={() => setOpenedChestReward(null)}
      />
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  introCard: {
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.86)" : "rgba(11,17,31,0.66)",
  },
  introHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  introCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  introMeta: {
    width: 112,
    gap: 8,
  },
  introChip: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.24)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.92)" : "rgba(8,13,23,0.72)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  introChipLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  introChipValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  healthHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  healthHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  healthDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  healthStateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  healthStateText: {
    fontSize: 12,
    fontWeight: "900",
  },
  healthInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  healthInfoChip: {
    minWidth: 108,
    flexGrow: 1,
    flexBasis: "30%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.9)" : "rgba(8,13,23,0.66)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  healthInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  healthInfoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  healthInfoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  stageCard: {
    backgroundColor: themeMode === "light" ? "rgba(255, 250, 240, 0.92)" : "rgba(10, 14, 24, 0.84)",
    padding: 10,
  },
  stageRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  slotColumn: {
    gap: 8,
    alignItems: "center",
  },
  slotCell: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 3,
    overflow: "hidden",
  },
  slotLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  characterWrap: {
    flex: 1,
    minHeight: 430,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(6, 10, 18, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  characterHalo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statChip: {
    minWidth: 126,
    flexGrow: 1,
    flexBasis: "24%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(8,13,23,0.78)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  bagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recommendationCard: {
    gap: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(9,14,24,0.8)",
    padding: 12,
  },
  recommendationHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  recommendationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.24)" : "rgba(245,158,11,0.24)",
  },
  recommendationCopy: {
    flex: 1,
    gap: 2,
  },
  recommendationTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  recommendationMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  recommendationStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recommendationStatChip: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.9)" : "rgba(8,13,23,0.66)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  recommendationStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  recommendationStatValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  bagCount: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  bagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bagCell: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    gap: 6,
    position: "relative",
  },
  bagLevelBadge: {
    alignSelf: "flex-end",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.96)" : "rgba(15,23,42,0.92)",
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.28)" : "rgba(245,158,11,0.18)",
  },
  bagLevelBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
  },
  bagInner: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    minHeight: 56,
    position: "relative",
    overflow: "hidden",
  },
  bagLockOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(255,248,235,0.62)" : "rgba(2,6,23,0.52)",
  },
  bagLockedLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  });
}
