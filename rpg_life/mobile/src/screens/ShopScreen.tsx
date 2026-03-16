import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { buyShopItem, fetchShop, refreshShop, type ShopPayload } from "../api/game";
import { Screen } from "../components/Screen";
import { useFeedback } from "../context/FeedbackContext";
import { useGame } from "../context/GameContext";
import { useLocalization } from "../context/LocalizationContext";
import { type ItemStatEntry } from "../lib/equipment";
import {
  buildCatalogLookupTokens,
  findUnifiedItemByIcon,
  getUnifiedItemCatalog,
  type UnifiedCatalogItem,
} from "../lib/itemCatalog";
import { Button, Card, FullscreenItemDetails, GameIcon, ItemCard, useThemeColors, useThemeMode } from "../ui";

type CatalogFilter = "all" | "weapon" | "armor" | "accessory" | "chest";
type SortMode = "rarity" | "price" | "level" | "name";

type ShopVisualItem = UnifiedCatalogItem & {
  shopItemId: number;
  priceGold: number;
  requiredLevel: number;
};

const FILTERS: Array<{ key: CatalogFilter; ru: string; en: string }> = [
  { key: "all", ru: "Все", en: "All" },
  { key: "weapon", ru: "Оружие", en: "Weapons" },
  { key: "armor", ru: "Броня", en: "Armor" },
  { key: "accessory", ru: "Аксессуары", en: "Accessories" },
  { key: "chest", ru: "Сундуки", en: "Chests" },
];

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  immortal: 5,
};

const RARITY_TITLES: Record<string, { ru: string; en: string }> = {
  common: { ru: "Обычный", en: "Common" },
  uncommon: { ru: "Необычный", en: "Uncommon" },
  rare: { ru: "Редкий", en: "Rare" },
  epic: { ru: "Эпический", en: "Epic" },
  legendary: { ru: "Легендарный", en: "Legendary" },
  immortal: { ru: "Мифический", en: "Mythic" },
};

function normalizeToken(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^\.?\//, "")
    .replace(/\.(png|webp|jpg|jpeg)$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toItemCardType(category: string) {
  if (category === "weapon") return "weapon";
  if (category === "armor") return "armor";
  if (category === "accessory") return "accessory";
  if (category === "chest") return "chest";
  return "misc";
}

function getRarityLabel(rarity: string, language: "ru" | "en") {
  const label = RARITY_TITLES[rarity];
  if (!label) return rarity;
  return language === "en" ? label.en : label.ru;
}

function toStatEntries(item: UnifiedCatalogItem): ItemStatEntry[] {
  return item.statEntries;
}

export function ShopScreen() {
  const { language } = useLocalization();
  const { pushToast, playSound } = useFeedback();
  const { hero, refreshGame } = useGame();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const isEn = language === "en";
  const activeLanguage: "ru" | "en" = isEn ? "en" : "ru";

  const [shopPayload, setShopPayload] = useState<ShopPayload | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [isRefreshingShop, setIsRefreshingShop] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopVisualItem | null>(null);
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("level");
  const [search, setSearch] = useState("");

  const catalog = useMemo(() => getUnifiedItemCatalog(), []);
  const catalogByToken = useMemo(() => {
    const map = new Map<string, UnifiedCatalogItem>();
    for (const item of catalog) {
      for (const token of buildCatalogLookupTokens(item)) {
        map.set(token, item);
      }
    }
    return map;
  }, [catalog]);

  const shopItems = useMemo(() => {
    const result: ShopVisualItem[] = [];

    for (const serverItem of shopPayload?.items ?? []) {
      const directMatch = findUnifiedItemByIcon(serverItem.icon);
      const tokenMatch = catalogByToken.get(normalizeToken(serverItem.icon));
      const catalogItem = directMatch ?? tokenMatch;
      if (!catalogItem) continue;

      result.push({
        ...catalogItem,
        shopItemId: serverItem.id,
        priceGold: serverItem.price_crystals ?? catalogItem.priceGold,
        requiredLevel: serverItem.required_level ?? catalogItem.requiredLevel,
      });
    }

    return result;
  }, [catalogByToken, shopPayload?.items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = shopItems.filter((item) => {
      const filterMatch = filter === "all" || item.category === filter;
      if (!filterMatch) return false;
      if (!query) return true;
      return `${item.name} ${item.description} ${item.iconName}`.toLowerCase().includes(query);
    });

    filtered.sort((left, right) => {
      if (sortMode === "name") return left.name.localeCompare(right.name, "ru");
      if (sortMode === "price") return left.priceGold - right.priceGold;
      if (sortMode === "level") return left.requiredLevel - right.requiredLevel;

      const rarityDelta = (RARITY_ORDER[right.rarity] ?? 0) - (RARITY_ORDER[left.rarity] ?? 0);
      if (rarityDelta !== 0) return rarityDelta;
      return left.requiredLevel - right.requiredLevel;
    });

    return filtered;
  }, [filter, search, shopItems, sortMode]);

  const shopGold = hero?.crystals ?? shopPayload?.crystals ?? 0;
  const heroLevel = hero?.level ?? shopPayload?.character_level ?? 1;
  const gridColumns = width < 760 ? 1 : width < 1160 ? 2 : 3;
  const gridGap = 10;
  const gridWidth = Math.max(width - 32, 300);
  const cardWidth = Math.max((gridWidth - gridGap * (gridColumns - 1)) / gridColumns, 240);

  const loadShop = useCallback(async () => {
    setIsLoadingShop(true);
    try {
      const payload = await fetchShop();
      setShopPayload(payload);
    } finally {
      setIsLoadingShop(false);
    }
  }, []);

  useEffect(() => {
    loadShop().catch((error) => {
      pushToast({
        title: isEn ? "Failed to load shop" : "Не удалось загрузить магазин",
        description: error instanceof Error ? error.message : isEn ? "Unknown error" : "Неизвестная ошибка",
        icon: "alert-circle",
        tone: "warning",
      });
    });
  }, [isEn, loadShop, pushToast]);

  async function handleRefreshRotation() {
    setIsRefreshingShop(true);
    try {
      const payload = await refreshShop();
      setShopPayload(payload);
      await playSound("item");
      pushToast({
        title: isEn ? "Shop refreshed" : "Ассортимент обновлен",
        description: isEn ? "New rotation is now available." : "Новая ротация уже доступна.",
        icon: "refresh",
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: isEn ? "Refresh failed" : "Не удалось обновить",
        description: error instanceof Error ? error.message : isEn ? "Unknown error" : "Неизвестная ошибка",
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsRefreshingShop(false);
    }
  }

  async function handleBuy(item: ShopVisualItem) {
    if (heroLevel < item.requiredLevel) {
      pushToast({
        title: isEn ? "Level too low" : "Недостаточный уровень",
        description: isEn
          ? `Required level: ${item.requiredLevel}`
          : `Требуется уровень: ${item.requiredLevel}`,
        icon: "shield-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (shopGold < item.priceGold) {
      pushToast({
        title: isEn ? "Not enough gold" : "Недостаточно золота",
        description: isEn ? "Earn more from quests and return." : "Получи больше золота в заданиях и возвращайся.",
        icon: "cash-remove",
        tone: "warning",
      });
      return;
    }

    try {
      const result = await buyShopItem(item.shopItemId);
      await playSound("item");
      await Promise.all([refreshGame(), loadShop()]);

      if (result.kind === "chest") {
        pushToast({
          title: isEn ? "Chest purchased" : "Сундук куплен",
          description: result.chest_item?.name ?? (isEn ? "Open it in inventory." : "Открой его в инвентаре."),
          icon: result.chest_item?.icon ?? item.iconName,
          tone: "reward",
        });
      } else {
        pushToast({
          title: isEn ? "Item purchased" : "Предмет куплен",
          description: item.name,
          icon: item.iconName,
          tone: "reward",
        });
      }
    } catch (error) {
      pushToast({
        title: isEn ? "Purchase failed" : "Покупка не удалась",
        description: error instanceof Error ? error.message : isEn ? "Unknown error" : "Неизвестная ошибка",
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  return (
    <Screen
      title={isEn ? "Shop" : "Магазин"}
      subtitle={isEn ? "Compact server shop with unified items" : "Компактный серверный магазин с единой системой предметов"}
      showHeader={false}
    >
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{isEn ? "Compact item market" : "Компактный рынок предметов"}</Text>
            <Text style={styles.headerText}>
              {isEn
                ? `${shopItems.length} items available in current rotation`
                : `${shopItems.length} предметов в текущей ротации`}
            </Text>
          </View>

          <View style={styles.walletChip}>
            <GameIcon name="cash" size={18} color={colors.gold} />
            <Text style={styles.walletValue}>{shopGold}</Text>
          </View>
        </View>

        <View style={styles.toolbarRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isEn ? "Search item..." : "Поиск предмета..."}
            placeholderTextColor={colors.textDim}
            style={styles.searchInput}
          />
          <Button
            label={isEn ? "Refresh" : "Обновить"}
            icon="refresh"
            onPress={handleRefreshRotation}
            variant="secondary"
            disabled={isRefreshingShop || isLoadingShop}
            style={styles.refreshButton}
          />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((entry) => (
            <Pressable
              key={entry.key}
              onPress={() => setFilter(entry.key)}
              style={[styles.filterTab, filter === entry.key ? styles.filterTabActive : null]}
            >
              <Text style={[styles.filterTabText, filter === entry.key ? styles.filterTabTextActive : null]}>
                {isEn ? entry.en : entry.ru}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sortRow}>
          <Button
            label={isEn ? "Rarity" : "Редкость"}
            onPress={() => setSortMode("rarity")}
            variant={sortMode === "rarity" ? "gold" : "secondary"}
            style={styles.sortButton}
          />
          <Button
            label={isEn ? "Price" : "Цена"}
            onPress={() => setSortMode("price")}
            variant={sortMode === "price" ? "gold" : "secondary"}
            style={styles.sortButton}
          />
          <Button
            label={isEn ? "Level" : "Уровень"}
            onPress={() => setSortMode("level")}
            variant={sortMode === "level" ? "gold" : "secondary"}
            style={styles.sortButton}
          />
          <Button
            label={isEn ? "Name" : "Имя"}
            onPress={() => setSortMode("name")}
            variant={sortMode === "name" ? "gold" : "secondary"}
            style={styles.sortButton}
          />
        </View>
      </Card>

      {visibleItems.length ? (
        <View style={styles.grid}>
          {visibleItems.map((item, index) => {
            const rarityLabel = getRarityLabel(item.rarity, activeLanguage);
            const lockedByLevel = heroLevel < item.requiredLevel;

            return (
              <View key={`${item.shopItemId}-${item.key}`} style={[styles.gridCell, { width: cardWidth }]}>
                <ItemCard
                  itemId={item.id}
                  itemType={toItemCardType(item.category)}
                  itemSlot={item.slot}
                  itemSubclass={item.subclass}
                  icon={item.iconName}
                  name={item.name}
                  rarity={item.rarity}
                  description={item.description}
                  statEntries={toStatEntries(item)}
                  badge={`${rarityLabel} • ${isEn ? "Lv" : "Ур"}.${item.requiredLevel}`}
                  actionLabel={String(item.priceGold)}
                  onAction={() => handleBuy(item)}
                  onPress={() => setSelectedItem(item)}
                  compact
                  shopStyle
                  locked={lockedByLevel}
                  delay={index * 10}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>{isEn ? "No items found" : "Ничего не найдено"}</Text>
          <Text style={styles.emptyText}>
            {isEn ? "Try another category or search query." : "Попробуй другую категорию или запрос."}
          </Text>
        </Card>
      )}

      <FullscreenItemDetails
        visible={Boolean(selectedItem)}
        title={selectedItem?.name ?? ""}
        icon={selectedItem?.iconName ?? "package-variant"}
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem ? toItemCardType(selectedItem.category) : null}
        itemSlot={selectedItem?.slot ?? null}
        itemSubclass={selectedItem?.subclass ?? null}
        rarity={selectedItem?.rarity}
        subtitle={selectedItem ? getRarityLabel(selectedItem.rarity, activeLanguage) : undefined}
        description={selectedItem?.description}
        metaRows={
          selectedItem
            ? [
                {
                  label: isEn ? "Required level" : "Требуемый уровень",
                  value: String(selectedItem.requiredLevel),
                },
                {
                  label: isEn ? "Price" : "Цена",
                  value: `${selectedItem.priceGold} ${isEn ? "gold" : "золота"}`,
                },
              ]
            : []
        }
        statEntries={selectedItem ? toStatEntries(selectedItem) : []}
        actions={
          selectedItem
            ? heroLevel >= selectedItem.requiredLevel
              ? [
                  {
                    label: String(selectedItem.priceGold),
                    icon: "cash",
                    onPress: () => handleBuy(selectedItem),
                    variant: "gold" as const,
                  },
                ]
              : []
            : []
        }
        onClose={() => setSelectedItem(null)}
      />
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  headerCard: {
    gap: 10,
    backgroundColor: themeMode === "light" ? "rgba(255, 250, 240, 0.92)" : "rgba(12, 17, 28, 0.86)",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  headerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.38)" : "rgba(245,158,11,0.28)",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  toolbarRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(9,14,24,0.8)",
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  refreshButton: {
    minWidth: 128,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterTab: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
    backgroundColor: themeMode === "light" ? "rgba(239,231,215,0.9)" : "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterTabActive: {
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.4)" : "rgba(245,158,11,0.3)",
    backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.18)" : "rgba(245,158,11,0.16)",
  },
  filterTabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterTabTextActive: {
    color: colors.text,
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sortButton: {
    minWidth: 98,
    flexGrow: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridCell: {
    minWidth: 240,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  });
}
