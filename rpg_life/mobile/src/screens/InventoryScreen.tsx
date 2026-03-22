import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import {
  equipInventoryItem,
  fetchInventory,
  fetchInventoryItemDetail,
  openChest,
  sellInventoryItem,
  unequipInventoryItem,
} from "../features/items/itemService";
import type { InventoryItem } from "../features/items/types";
import { Screen } from "../components/Screen";
import { useGameProgress } from "../context/GameContext";
import { useGameInventoryEquipment } from "../context/GameContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { buildItemStatEntries, buildItemStats, pickEquipSlot } from "../lib/equipment";
import { buildItemComparison } from "../lib/itemComparison";
import { getRarityLabel, getSlotLabel, normalizeItemText } from "../lib/gameUi";
import { Button, Card, ChestOpeningModal, FullscreenItemDetails, ItemCard, LoadingAnimation, radii, useThemeColors } from "../ui";

type SortMode = "rarity" | "name" | "slot" | "equipped";
type ItemAction = "equip" | "unequip" | "sell" | "chest" | null;

const rarityWeight: Record<string, number> = {
  immortal: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

export function InventoryScreen() {
  const t = useTranslation();
  const { hero } = useGameProgress();
  const { equipment, refreshGame } = useGameInventoryEquipment();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [openedChestReward, setOpenedChestReward] = useState<Awaited<ReturnType<typeof openChest>> | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("rarity");
  const [search, setSearch] = useState("");
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [activeItemAction, setActiveItemAction] = useState<ItemAction>(null);
  const isPhoneLayout = width < 420;
  const heroLevel = hero?.level ?? equipment?.class_info?.level ?? 1;
  const selectedComparison = useMemo(
    () => (selectedItem?.is_equipped ? null : buildItemComparison(selectedItem, equipment?.equipment ?? [], t)),
    [equipment?.equipment, selectedItem, t],
  );

  function getItemRequiredLevel(item: { item?: { required_level?: number | null; type?: string | null } | null } | null | undefined) {
    return Math.max(1, item?.item?.required_level ?? 1);
  }

  function isItemLevelLocked(item: { item?: { required_level?: number | null; type?: string | null } | null } | null | undefined) {
    if (!item?.item || item.item.type === "chest") {
      return false;
    }
    return getItemRequiredLevel(item) > heroLevel;
  }

  const loadInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    try {
      const payload = await fetchInventory(1, 80);
      setItems(payload.items);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInventory().catch(() => undefined);
    }, [loadInventory]),
  );

  const equippedCount = useMemo(() => items.filter((item) => item.is_equipped).length, [items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) =>
      `${normalizeItemText(item.item.name)} ${normalizeItemText(item.item.description ?? "")}`.toLowerCase().includes(search.toLowerCase()),
    );

    filtered.sort((a, b) => {
      if (sortMode === "name") return normalizeItemText(a.item.name).localeCompare(normalizeItemText(b.item.name), "ru");
      if (sortMode === "slot") return getSlotLabel(a.item.slot, t).localeCompare(getSlotLabel(b.item.slot, t));
      if (sortMode === "equipped") return Number(b.is_equipped) - Number(a.is_equipped);
      return (rarityWeight[b.item.rarity] ?? 0) - (rarityWeight[a.item.rarity] ?? 0);
    });

    return filtered;
  }, [items, search, sortMode, t]);

  async function openItem(item: InventoryItem) {
    try {
      const detail = await fetchInventoryItemDetail(item.id);
      setSelectedItem(detail);
    } catch (error) {
      void pushToast({
        title: t("inventory.openItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleEquip() {
    if (!selectedItem) return;
    const requiredLevel = getItemRequiredLevel(selectedItem);
    if (isItemLevelLocked(selectedItem)) {
      void pushToast({
        title: t("screens.character.levelLocked"),
        description: t("screens.character.unlockAtLevel", { level: requiredLevel }),
        icon: "lock",
        tone: "warning",
      });
      return;
    }
    try {
      setActiveItemAction("equip");
      const targetSlot = pickEquipSlot(selectedItem, equipment?.equipment ?? []);
      await equipInventoryItem(selectedItem.inventory_id, targetSlot, equipment?.class_info?.id);
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
    } catch (error) {
      void pushToast({
        title: t("inventory.equipItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setActiveItemAction(null);
    }
  }

  async function handleUnequip() {
    if (!selectedItem) return;
    try {
      setActiveItemAction("unequip");
      await unequipInventoryItem(selectedItem.inventory_id);
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
    } catch (error) {
      void pushToast({
        title: t("inventory.unequipItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setActiveItemAction(null);
    }
  }

  function confirmUnequip() {
    if (!selectedItem) return;
    Alert.alert(
      t("inventory.confirmUnequip"),
      t("screens.inventory.confirmUnequipMessageNamed", { itemName: selectedItem.item.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("inventory.unequipItem"), onPress: handleUnequip },
      ],
    );
  }

  async function handleSell() {
    if (!selectedItem) return;
    try {
      setActiveItemAction("sell");
      await sellInventoryItem(selectedItem.inventory_id);
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
    } catch (error) {
      void pushToast({
        title: t("inventory.sellItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setActiveItemAction(null);
    }
  }

  async function handleOpenChest() {
    if (!selectedItem) return;
    try {
      setActiveItemAction("chest");
      const result = await openChest({ inventory_id: selectedItem.inventory_id });
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
      setOpenedChestReward(result);
      await pushToast(
        {
          title: t("game.reward.itemObtainedTitle", { title: normalizeItemText(result.item.name) }),
          description: t("game.reward.itemAdded"),
          icon: result.item.icon ?? "treasure-chest",
          tone: "reward",
        },
        { sound: "item" },
      );
    } catch (error) {
      void pushToast({
        title: t("screens.shop.purchaseChestFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setActiveItemAction(null);
    }
  }

  function confirmSell() {
    if (!selectedItem) return;
    Alert.alert(
      t("inventory.confirmSell"),
      t("screens.inventory.confirmSellMessageNamed", { itemName: selectedItem.item.name, price: selectedItem.sell_price }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("inventory.sellItem"), style: "destructive", onPress: handleSell },
      ],
    );
  }

  return (
    <Screen title={t("screens.inventory.title")} subtitle={t("screens.inventory.subtitle")}>
      <Card tone="accent">
        <Text style={styles.sectionTitle}>{t("screens.inventory.bagTitle")}</Text>
        <View style={[styles.summaryRow, isPhoneLayout ? styles.summaryRowCompact : null]}>
          <Text style={styles.summaryMeta}>{t("screens.inventory.summaryItems", { count: items.length })}</Text>
          <Text style={styles.summaryMeta}>{t("screens.inventory.summaryEquipped", { count: equippedCount })}</Text>
        </View>
      </Card>

      <Card>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("screens.inventory.searchPlaceholder")}
          placeholderTextColor={colors.textDim}
          style={[styles.searchInput, isPhoneLayout ? styles.searchInputCompact : null]}
        />
        <View style={styles.filterRow}>
          <Button
            label={t("screens.inventory.sort.rarity")}
            icon="diamond-stone"
            onPress={() => setSortMode("rarity")}
            variant={sortMode === "rarity" ? "primary" : "secondary"}
            style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]}
          />
          <Button
            label={t("screens.inventory.sort.name")}
            icon="sort-alphabetical-ascending"
            onPress={() => setSortMode("name")}
            variant={sortMode === "name" ? "primary" : "secondary"}
            style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]}
          />
          <Button
            label={t("screens.inventory.sort.slot")}
            icon="shape-outline"
            onPress={() => setSortMode("slot")}
            variant={sortMode === "slot" ? "primary" : "secondary"}
            style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]}
          />
          <Button
            label={t("screens.inventory.sort.equipped")}
            icon="shield-check"
            onPress={() => setSortMode("equipped")}
            variant={sortMode === "equipped" ? "primary" : "secondary"}
            style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]}
          />
        </View>
      </Card>

      {isLoadingInventory ? (
        <Card tone="subtle">
          <LoadingAnimation label={t("common.loading")} />
        </Card>
      ) : (
        <View style={styles.list}>
          {visibleItems.map((item, index) => (
            <ItemCard
              key={item.id}
              itemId={item.item.id ?? item.item_id}
              itemType={item.item.type}
              itemSlot={item.item.slot}
              itemSubclass={item.item.subclass}
              icon={item.item.icon || "package-variant-closed"}
              name={normalizeItemText(item.item.name)}
              rarity={item.item.rarity}
              description={normalizeItemText(item.item.description)}
              stats={buildItemStats(item as any, t)}
              statEntries={buildItemStatEntries(item as any, t)}
              badge={`${getSlotLabel(item.item.slot, t)} | ${getRarityLabel(item.item.rarity, t)}`}
              equipped={item.is_equipped}
              locked={isItemLevelLocked(item)}
              compact
              onPress={() => openItem(item)}
              delay={index * 18}
            />
          ))}
        </View>
      )}

      <FullscreenItemDetails
        visible={Boolean(selectedItem)}
        title={normalizeItemText(selectedItem?.item?.name)}
        itemId={selectedItem?.item?.id ?? null}
        itemType={selectedItem?.item?.type ?? null}
        itemSlot={selectedItem?.item?.slot ?? null}
        itemSubclass={selectedItem?.item?.subclass ?? null}
        icon={selectedItem?.item?.icon ?? "package-variant-closed"}
        rarity={selectedItem?.item?.rarity}
        subtitle={selectedItem ? getRarityLabel(selectedItem.item.rarity, t) : undefined}
        description={normalizeItemText(selectedItem?.item?.description)}
        metaRows={
          selectedItem
            ? [
                { label: t("inventory.slot"), value: getSlotLabel(pickEquipSlot(selectedItem, equipment?.equipment ?? []), t) },
                { label: t("inventory.rarity"), value: getRarityLabel(selectedItem.item.rarity, t) },
                { label: t("screens.character.requiredLevel"), value: t("screens.character.levelBadge", { level: getItemRequiredLevel(selectedItem) }) },
                { label: t("inventory.sellPrice"), value: `${selectedItem.sell_price} ${t("common.gold")}` },
              ]
            : []
        }
        stats={selectedItem ? buildItemStats(selectedItem, t) : []}
        comparisonTitle={selectedComparison?.comparisonTitle}
        comparisonIntro={selectedComparison?.comparisonIntro}
        comparisonRows={selectedComparison?.comparisonRows}
        actions={
          selectedItem
            ? [
                ...(selectedItem.item?.type === "chest"
                  ? [
                      {
                        label: t("screens.shop.openChest"),
                        icon: "treasure-chest",
                        onPress: handleOpenChest as () => void,
                        variant: "gold" as const,
                        loading: activeItemAction === "chest",
                      },
                    ]
                  : [
                      selectedItem.is_equipped
                        ? {
                            label: t("inventory.unequipItem"),
                            icon: "shield-off-outline",
                            onPress: confirmUnequip as () => void,
                            variant: "secondary" as const,
                            loading: activeItemAction === "unequip",
                          }
                        : {
                            label: isItemLevelLocked(selectedItem)
                              ? t("screens.character.unlockAtLevelAction", { level: getItemRequiredLevel(selectedItem) })
                              : t("inventory.equipItem"),
                            icon: isItemLevelLocked(selectedItem) ? "lock" : "shield-sword",
                            onPress: isItemLevelLocked(selectedItem) ? (() => undefined) : (handleEquip as () => void),
                            loading: !isItemLevelLocked(selectedItem) && activeItemAction === "equip",
                            variant: isItemLevelLocked(selectedItem) ? ("secondary" as const) : undefined,
                            disabled: isItemLevelLocked(selectedItem),
                          },
                    ]),
                {
                  label: t("inventory.sellItem"),
                  icon: "cash-remove",
                  onPress: confirmSell as () => void,
                  variant: "danger" as const,
                  loading: activeItemAction === "sell",
                },
              ]
            : []
        }
        onClose={() => setSelectedItem(null)}
      />

      <ChestOpeningModal
        visible={Boolean(openedChestReward)}
        reward={openedChestReward}
        onClose={() => setOpenedChestReward(null)}
      />
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    summaryRowCompact: {
      flexWrap: "wrap",
    },
    summaryMeta: {
      color: colors.textMuted,
      fontWeight: "700",
    },
    searchInput: {
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
    },
    searchInputCompact: {
      paddingVertical: 10,
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    filterButton: {
      minWidth: 120,
    },
    filterButtonCompact: {
      minWidth: 0,
      width: "48%",
    },
    list: {
      gap: 8,
    },
  });
}
