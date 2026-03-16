import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { equipInventoryItem, fetchInventory, fetchInventoryItemDetail, openChest, sellInventoryItem, unequipInventoryItem, type InventoryItem } from "../api/game";
import { Screen } from "../components/Screen";
import { useGame } from "../context/GameContext";
import { useFeedback } from "../context/FeedbackContext";
import { useTranslation } from "../context/LocalizationContext";
import { buildItemStatEntries, buildItemStats, pickEquipSlot } from "../lib/equipment";
import { getRarityLabel, getSlotLabel, normalizeItemText } from "../lib/gameUi";
import { Button, Card, ChestOpeningModal, FullscreenItemDetails, ItemCard, radii, useThemeColors } from "../ui";

type SortMode = "rarity" | "name" | "slot" | "equipped";

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
  const { equipment, refreshGame } = useGame();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [openedChestReward, setOpenedChestReward] = useState<Awaited<ReturnType<typeof openChest>> | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("rarity");
  const [search, setSearch] = useState("");
  const isPhoneLayout = width < 420;

  async function loadInventory() {
    const payload = await fetchInventory(1, 80);
    setItems(payload.items);
  }

  useEffect(() => {
    loadInventory().catch(console.error);
  }, []);

  const equippedCount = useMemo(() => items.filter((item) => item.is_equipped).length, [items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => `${normalizeItemText(item.item.name)} ${normalizeItemText(item.item.description ?? "")}`.toLowerCase().includes(search.toLowerCase()));

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
      pushToast({
        title: t("inventory.openItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleEquip() {
    if (!selectedItem) return;
    try {
      const targetSlot = pickEquipSlot(selectedItem, equipment?.equipment ?? []);
      await equipInventoryItem(selectedItem.inventory_id, targetSlot, equipment?.class_info?.id);
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
    } catch (error) {
      pushToast({
        title: t("inventory.equipItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
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
      await Promise.all([loadInventory(), refreshGame()]);
    } catch (error) {
      pushToast({
        title: t("inventory.unequipItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
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
      await sellInventoryItem(selectedItem.inventory_id);
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
    } catch (error) {
      pushToast({
        title: t("inventory.sellItemFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  async function handleOpenChest() {
    if (!selectedItem) return;
    try {
      const result = await openChest({ inventory_id: selectedItem.inventory_id });
      setSelectedItem(null);
      await Promise.all([loadInventory(), refreshGame()]);
      setOpenedChestReward(result);
      pushToast({
        title: `Получен предмет: ${normalizeItemText(result.item.name)}`,
        description: "Сундук открыт и награда добавлена в инвентарь.",
        icon: result.item.icon ?? "treasure-chest",
        tone: "reward",
      });
    } catch (error) {
      pushToast({
        title: "Не удалось открыть сундук",
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
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
        <TextInput value={search} onChangeText={setSearch} placeholder={t("screens.inventory.searchPlaceholder")} placeholderTextColor={colors.textDim} style={[styles.searchInput, isPhoneLayout ? styles.searchInputCompact : null]} />
        <View style={styles.filterRow}>
          <Button label={t("screens.inventory.sort.rarity")} icon="diamond-stone" onPress={() => setSortMode("rarity")} variant={sortMode === "rarity" ? "primary" : "secondary"} style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]} />
          <Button label={t("screens.inventory.sort.name")} icon="sort-alphabetical-ascending" onPress={() => setSortMode("name")} variant={sortMode === "name" ? "primary" : "secondary"} style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]} />
          <Button label={t("screens.inventory.sort.slot")} icon="shape-outline" onPress={() => setSortMode("slot")} variant={sortMode === "slot" ? "primary" : "secondary"} style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]} />
          <Button label={t("screens.inventory.sort.equipped")} icon="shield-check" onPress={() => setSortMode("equipped")} variant={sortMode === "equipped" ? "primary" : "secondary"} style={[styles.filterButton, isPhoneLayout ? styles.filterButtonCompact : null]} />
        </View>
      </Card>

      <View style={styles.list}>
        {visibleItems.map((item, index) => (
          <ItemCard
            key={item.id}
            itemId={item.item.id ?? item.item_id}
            itemType={item.item.type}
            itemSlot={item.item.slot}
            itemSubclass={item.item.subclass}
            icon={item.item.icon || "📦"}
            name={normalizeItemText(item.item.name)}
            rarity={item.item.rarity}
            description={normalizeItemText(item.item.description)}
            stats={buildItemStats(item as any, t)}
            statEntries={buildItemStatEntries(item as any, t)}
            badge={`${getSlotLabel(item.item.slot, t)} • ${getRarityLabel(item.item.rarity, t)}`}
            equipped={item.is_equipped}
            compact
            onPress={() => openItem(item)}
            delay={index * 18}
          />
        ))}
      </View>

      <FullscreenItemDetails
        visible={Boolean(selectedItem)}
        title={normalizeItemText(selectedItem?.item?.name)}
        itemId={selectedItem?.item?.id ?? null}
        itemType={selectedItem?.item?.type ?? null}
        itemSlot={selectedItem?.item?.slot ?? null}
        itemSubclass={selectedItem?.item?.subclass ?? null}
        icon={selectedItem?.item?.icon ?? "📦"}
        rarity={selectedItem?.item?.rarity}
        subtitle={selectedItem ? getRarityLabel(selectedItem.item.rarity, t) : undefined}
        description={normalizeItemText(selectedItem?.item?.description)}
        metaRows={
          selectedItem
            ? [
                { label: t("inventory.slot"), value: getSlotLabel(pickEquipSlot(selectedItem, equipment?.equipment ?? []), t) },
                { label: t("inventory.rarity"), value: getRarityLabel(selectedItem.item.rarity, t) },
                { label: t("inventory.sellPrice"), value: `${selectedItem.sell_price} ${t("common.gold")}` },
              ]
            : []
        }
        stats={selectedItem ? buildItemStats(selectedItem, t) : []}
        actions={
          selectedItem
            ? [
                ...(selectedItem.item?.type === "chest"
                  ? [{ label: "Открыть сундук", icon: "treasure-chest", onPress: handleOpenChest as () => void, variant: "gold" as const }]
                  : [
                      selectedItem.is_equipped
                        ? { label: t("inventory.unequipItem"), icon: "shield-off-outline", onPress: confirmUnequip as () => void, variant: "secondary" as const }
                        : { label: t("inventory.equipItem"), icon: "shield-sword", onPress: handleEquip as () => void },
                    ]),
                { label: t("inventory.sellItem"), icon: "cash-remove", onPress: confirmSell as () => void, variant: "danger" as const },
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
