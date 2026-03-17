import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { buyShopItem, fetchShop, refreshShop, type ShopPayload } from "../api/game";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useFeedback } from "../context/FeedbackContext";
import { useGame } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
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

const FILTERS: CatalogFilter[] = ["all", "weapon", "armor", "accessory", "chest"];
const SORT_MODES: SortMode[] = ["rarity", "price", "level", "name"];

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  immortal: 5,
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

function toStatEntries(item: UnifiedCatalogItem): ItemStatEntry[] {
  return item.statEntries;
}

export function ShopScreen() {
  const { language } = useLocalization();
  const t = useTranslation();
  const { pushToast } = useFeedback();
  const { hero, refreshGame } = useGame();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  const [shopPayload, setShopPayload] = useState<ShopPayload | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [isRefreshingShop, setIsRefreshingShop] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopVisualItem | null>(null);
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("level");
  const [search, setSearch] = useState("");
  const [shopError, setShopError] = useState<string | null>(null);

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
      if (sortMode === "name") return left.name.localeCompare(right.name, language === "en" ? "en" : "ru");
      if (sortMode === "price") return left.priceGold - right.priceGold;
      if (sortMode === "level") return left.requiredLevel - right.requiredLevel;

      const rarityDelta = (RARITY_ORDER[right.rarity] ?? 0) - (RARITY_ORDER[left.rarity] ?? 0);
      if (rarityDelta !== 0) return rarityDelta;
      return left.requiredLevel - right.requiredLevel;
    });

    return filtered;
  }, [filter, language, search, shopItems, sortMode]);

  const shopGold = hero?.crystals ?? shopPayload?.crystals ?? 0;
  const heroLevel = hero?.level ?? shopPayload?.character_level ?? 1;
  const gridColumns = width < 760 ? 1 : width < 1160 ? 2 : 3;
  const gridGap = 10;
  const gridWidth = Math.max(width - 32, 300);
  const cardWidth = Math.max((gridWidth - gridGap * (gridColumns - 1)) / gridColumns, 240);

  const getRarityLabel = useCallback((rarity: string) => {
    return t(`game.rarities.${rarity}`);
  }, [t]);

  const getFilterLabel = useCallback((value: CatalogFilter) => t(`screens.shop.quick.filters.${value}`), [t]);
  const getSortLabel = useCallback((value: SortMode) => t(`screens.shop.quick.sort.${value}`), [t]);

  const loadShop = useCallback(async () => {
    setIsLoadingShop(true);
    setShopError(null);
    try {
      const payload = await fetchShop();
      setShopPayload(payload);
    } catch (error) {
      setShopError(error instanceof Error ? error.message : t("shop.purchaseFailed"));
      throw error;
    } finally {
      setIsLoadingShop(false);
    }
  }, [t]);

  useEffect(() => {
    loadShop().catch((error) => {
      pushToast({
        title: t("screens.shop.quick.loadFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    });
  }, [loadShop, pushToast, t]);

  async function handleRefreshRotation() {
    setIsRefreshingShop(true);
    try {
      const payload = await refreshShop();
      setShopPayload(payload);
      await pushToast({
        title: t("screens.shop.quick.refreshedTitle"),
        description: t("screens.shop.quick.refreshedDescription"),
        icon: "refresh",
        tone: "success",
      }, { sound: "item" });
    } catch (error) {
      pushToast({
        title: t("screens.shop.quick.refreshFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
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
        title: t("screens.shop.quick.levelTooLow"),
        description: t("screens.shop.quick.requiredLevelValue", { level: item.requiredLevel }),
        icon: "shield-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (shopGold < item.priceGold) {
      pushToast({
        title: t("screens.shop.quick.notEnoughGold"),
        description: t("screens.shop.quick.notEnoughGoldDescription"),
        icon: "cash-remove",
        tone: "warning",
      });
      return;
    }

    try {
      const result = await buyShopItem(item.shopItemId);
      await Promise.all([refreshGame(), loadShop()]);

      if (result.kind === "chest") {
        await pushToast({
          title: t("screens.shop.quick.chestPurchased"),
          description: result.chest_item?.name ?? t("screens.shop.quick.openInInventory"),
          icon: result.chest_item?.icon ?? item.iconName,
          tone: "reward",
        }, { sound: "item" });
      } else {
        await pushToast({
          title: t("screens.shop.quick.itemPurchased"),
          description: item.name,
          icon: item.iconName,
          tone: "reward",
        }, { sound: "item" });
      }
    } catch (error) {
      pushToast({
        title: t("shop.purchaseFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    }
  }

  function resetFilters() {
    setFilter("all");
    setSortMode("level");
    setSearch("");
  }

  return (
    <Screen
      title={t("screens.shop.title")}
      subtitle={t("screens.shop.quick.subtitle")}
      showHeader={false}
      contentTopOffset={10}
    >
      <Card style={styles.headerCard}>
        <Text style={styles.eyebrow}>MARKET</Text>
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{t("screens.shop.title")}</Text>
            <Text style={styles.headerText}>
              {t("screens.shop.quick.itemsInRotation", { count: shopItems.length })}
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
            placeholder={t("screens.shop.quick.searchPlaceholder")}
            placeholderTextColor={colors.textDim}
            style={styles.searchInput}
          />
          <Button
            label={t("screens.shop.quick.refresh")}
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
              key={entry}
              onPress={() => setFilter(entry)}
              style={[styles.filterTab, filter === entry ? styles.filterTabActive : null]}
            >
              <Text style={[styles.filterTabText, filter === entry ? styles.filterTabTextActive : null]}>
                {getFilterLabel(entry)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sortRow}>
          {SORT_MODES.map((entry) => (
            <Button
              key={entry}
              label={getSortLabel(entry)}
              onPress={() => setSortMode(entry)}
              variant={sortMode === entry ? "gold" : "secondary"}
              style={styles.sortButton}
            />
          ))}
        </View>
      </Card>

      {shopError ? (
        <StateBlock
          tone="warning"
          icon="alert-circle"
          title={t("screens.shop.quick.loadFailed")}
          description={shopError}
          actionLabel={t("common.retry")}
          onAction={() => {
            void loadShop();
          }}
        />
      ) : null}

      {isLoadingShop && !shopItems.length ? (
        <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
      ) : null}

      {!isLoadingShop && visibleItems.length ? (
        <View style={styles.grid}>
          {visibleItems.map((item, index) => {
            const rarityLabel = getRarityLabel(item.rarity);
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
                  badge={t("screens.shop.quick.itemBadge", {
                    rarity: rarityLabel,
                    level: item.requiredLevel,
                    levelShort: t("common.levelShort"),
                  })}
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
        <StateBlock
          icon="package-variant-closed"
          title={t("screens.shop.quick.emptyTitle")}
          description={t("screens.shop.quick.emptyDescription")}
          actionLabel={t("screens.shop.quick.resetFilters")}
          onAction={resetFilters}
        />
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
        subtitle={selectedItem ? getRarityLabel(selectedItem.rarity) : undefined}
        description={selectedItem?.description}
        metaRows={
          selectedItem
            ? [
                {
                  label: t("screens.shop.quick.requiredLevel"),
                  value: String(selectedItem.requiredLevel),
                },
                {
                  label: t("common.price"),
                  value: t("screens.shop.quick.priceValue", { price: selectedItem.priceGold, gold: t("common.gold") }),
                },
              ]
            : []
        }
        statEntries={selectedItem ? toStatEntries(selectedItem) : []}
        actions={
          selectedItem && heroLevel >= selectedItem.requiredLevel
            ? [
                {
                  label: String(selectedItem.priceGold),
                  icon: "cash",
                  onPress: () => handleBuy(selectedItem),
                  variant: "gold" as const,
                },
              ]
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
      gap: 12,
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.88)" : "rgba(12,17,28,0.72)",
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
    },
    headerText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
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
  });
}
