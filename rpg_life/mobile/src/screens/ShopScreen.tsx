import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { buyShopItem, fetchShop } from "../features/items/itemService";
import type {
  ShopItemPayload,
  ShopPayload,
  ShopQuestContractPayload,
  ShopServicePayload,
  ShopWeaponEnchantPayload,
  ShopXpScrollPayload,
} from "../features/items/types";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { useFeedback } from "../context/FeedbackContext";
import { useGameInventoryEquipment, useGameProgress } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { buildItemComparison } from "../lib/itemComparison";
import { buildItemStatEntries, type ItemStatEntry } from "../lib/equipment";
import { Button, Card, FullscreenItemDetails, GameIcon, ItemCard, useThemeColors, useThemeMode } from "../ui";

type CatalogFilter = "all" | "weapon" | "armor" | "accessory" | "chest";
type SortMode = "rarity" | "price" | "level" | "name";
type ShopCatalogTab = "equipment" | "xp_scrolls" | "contracts" | "enchants" | "services";

type ShopVisualItem = ShopItemPayload & {
  shopItemId: number;
  priceGold: number;
  requiredLevel: number;
  category: "weapon" | "armor" | "accessory" | "chest" | "misc";
  iconName: string;
};

const FILTERS: CatalogFilter[] = ["all", "weapon", "armor", "accessory", "chest"];
const SORT_MODES: SortMode[] = ["rarity", "price", "level", "name"];
const SHOP_CATALOGS: ShopCatalogTab[] = ["equipment", "xp_scrolls", "contracts", "enchants", "services"];

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  immortal: 5,
};

function toItemCardType(category: string) {
  if (category === "weapon") return "weapon";
  if (category === "armor") return "armor";
  if (category === "accessory") return "accessory";
  if (category === "chest") return "chest";
  return "misc";
}

function toStatEntries(item: ShopVisualItem, t: ReturnType<typeof useTranslation>): ItemStatEntry[] {
  return buildItemStatEntries(item, t);
}

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

function buildShopVisualItem(serverItem: ShopItemPayload): ShopVisualItem {
  const normalizedType =
    serverItem.type === "chest"
      ? "chest"
      : serverItem.type === "weapon"
        ? "weapon"
        : serverItem.type === "armor"
          ? "armor"
          : serverItem.type === "accessory"
            ? "accessory"
            : "misc";
  return {
    ...serverItem,
    shopItemId: serverItem.id,
    priceGold: serverItem.price_crystals ?? 0,
    requiredLevel: serverItem.required_level ?? 1,
    category: normalizedType,
    iconName: serverItem.icon || "package-variant-closed",
  };
}

export function ShopScreen() {
  const navigation = useNavigation<any>();
  const { language } = useLocalization();
  const t = useTranslation();
  const { pushToast } = useFeedback();
  const { hero } = useGameProgress();
  const { equipment, inventory, refreshGame } = useGameInventoryEquipment();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  const [shopPayload, setShopPayload] = useState<ShopPayload | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopVisualItem | null>(null);
  const [purchasingItemId, setPurchasingItemId] = useState<number | null>(null);
  const [activeCatalog, setActiveCatalog] = useState<ShopCatalogTab>("equipment");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("level");
  const [search, setSearch] = useState("");
  const [shopError, setShopError] = useState<string | null>(null);
  const [recentPurchase, setRecentPurchase] = useState<{
    name: string;
    requiredLevel: number;
    statEntries: ItemStatEntry[];
    isChest: boolean;
  } | null>(null);

  const shopItems = useMemo(() => {
    return (shopPayload?.items ?? []).map((serverItem) => buildShopVisualItem(serverItem));
  }, [shopPayload?.items]);
  const shopServices = useMemo(() => shopPayload?.services ?? [], [shopPayload?.services]);
  const shopXpScrolls = useMemo(() => shopPayload?.xp_scrolls ?? [], [shopPayload?.xp_scrolls]);
  const shopContracts = useMemo(() => shopPayload?.quest_contracts ?? [], [shopPayload?.quest_contracts]);
  const shopEnchants = useMemo(() => shopPayload?.weapon_enchants ?? [], [shopPayload?.weapon_enchants]);
  const sortedShopServices = useMemo(
    () => [...shopServices].sort((left, right) => Number(right.available) - Number(left.available) || left.price_crystals - right.price_crystals),
    [shopServices],
  );
  const sortedShopXpScrolls = useMemo(
    () => [...shopXpScrolls].sort((left, right) => Number(right.available) - Number(left.available) || left.price_crystals - right.price_crystals),
    [shopXpScrolls],
  );
  const sortedShopContracts = useMemo(
    () => [...shopContracts].sort((left, right) => Number(right.available) - Number(left.available) || left.price_crystals - right.price_crystals),
    [shopContracts],
  );
  const sortedShopEnchants = useMemo(
    () => [...shopEnchants].sort((left, right) => Number(right.available) - Number(left.available) || left.price_crystals - right.price_crystals),
    [shopEnchants],
  );
  const activeContract = shopPayload?.active_contract ?? null;

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
  const activeCatalogCount = useMemo(() => {
    if (activeCatalog === "equipment") return visibleItems.length;
    if (activeCatalog === "services") return shopServices.length;
    if (activeCatalog === "xp_scrolls") return shopXpScrolls.length;
    if (activeCatalog === "contracts") return shopContracts.length;
    return shopEnchants.length;
  }, [activeCatalog, shopContracts.length, shopEnchants.length, shopServices.length, shopXpScrolls.length, visibleItems.length]);

  const shopGold = hero?.crystals ?? shopPayload?.crystals ?? 0;
  const heroLevel = hero?.level ?? shopPayload?.character_level ?? 1;
  const showFirstPurchaseGuide =
    (heroLevel <= 1 || (hero?.current_xp ?? 0) <= 0) &&
    (equipment?.equipment?.length ?? 0) === 0 &&
    inventory.length === 0;
  const firstPurchaseGuideItems = [
    {
      icon: "shield-check-outline",
      title: translateOrFallback(t, "screens.shop.quick.firstGuideStatsTitle", "Смотри на характеристики"),
      description: translateOrFallback(
        t,
        "screens.shop.quick.firstGuideStatsDescription",
        "Первый предмет лучше выбирать не по редкости, а по полезным бонусам: броня, сила, ловкость или выносливость.",
      ),
    },
    {
      icon: "lock-open-check-outline",
      title: translateOrFallback(t, "screens.shop.quick.firstGuideLevelTitle", "Проверь уровень"),
      description: translateOrFallback(
        t,
        "screens.shop.quick.firstGuideLevelDescription",
        "Если на предмете стоит нужный уровень, его пока не получится надеть. Для первого шага лучше брать то, что доступно уже сейчас.",
      ),
    },
    {
      icon: "shield-account",
      title: translateOrFallback(t, "screens.shop.quick.firstGuideEquipTitle", "После покупки надень предмет"),
      description: translateOrFallback(
        t,
        "screens.shop.quick.firstGuideEquipDescription",
        "Покупка сама по себе ничего не усиливает. Бонусы начинают работать только после экипировки на экране персонажа.",
      ),
    },
  ];
  const selectedComparison = useMemo(
    () => buildItemComparison(selectedItem, equipment?.equipment ?? [], t),
    [equipment?.equipment, selectedItem, t],
  );
  const gridColumns = width < 760 ? 1 : width < 1160 ? 2 : 3;
  const gridGap = 10;
  const gridWidth = Math.max(width - 32, 300);
  const cardWidth = Math.max((gridWidth - gridGap * (gridColumns - 1)) / gridColumns, 240);

  const getRarityLabel = useCallback((rarity: string) => {
    return t(`game.rarities.${rarity}`);
  }, [t]);

  const getFilterLabel = useCallback((value: CatalogFilter) => t(`screens.shop.quick.filters.${value}`), [t]);
  const getSortLabel = useCallback((value: SortMode) => t(`screens.shop.quick.sort.${value}`), [t]);
  const getCatalogLabel = useCallback((value: ShopCatalogTab) => {
    const fallbackMap: Record<ShopCatalogTab, string> = {
      equipment: "Снаряжение",
      xp_scrolls: "Свитки XP",
      contracts: "Контракты",
      enchants: "Чары",
      services: "Услуги",
    };
    return translateOrFallback(t, `screens.shop.quick.catalogs.${value}`, fallbackMap[value]);
  }, [t]);

  const loadShop = useCallback(async (forceRefresh = false) => {
    setIsLoadingShop(true);
    setShopError(null);
    try {
      const payload = await fetchShop({ forceRefresh });
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

    if (purchasingItemId === item.shopItemId) {
      return;
    }

    try {
      setPurchasingItemId(item.shopItemId);
      setSelectedItem(null);
      const result = await buyShopItem(item.shopItemId);
      setRecentPurchase({
        name: item.name,
        requiredLevel: item.requiredLevel,
        statEntries: toStatEntries(item, t).slice(0, 3),
        isChest: result.kind === "chest",
      });
      await Promise.all([refreshGame(true), loadShop(true)]);

      if (result.kind === "chest") {
        void pushToast({
          title: t("screens.shop.quick.chestPurchased"),
          description: result.chest_item?.name ?? t("screens.shop.quick.openInInventory"),
          icon: result.chest_item?.icon ?? item.iconName,
          tone: "reward",
        }, { sound: "item" });
      } else {
        void pushToast({
          title: t("screens.shop.quick.itemPurchased"),
          description: item.name,
          icon: item.iconName,
          tone: "reward",
        }, { sound: "item" });
      }
    } catch (error) {
      void pushToast({
        title: t("shop.purchaseFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setPurchasingItemId(null);
    }
  }

  async function handleBuyService(service: ShopServicePayload) {
    if (!service.available) {
      void pushToast({
        title: t("screens.shop.quick.services.notAvailableTitle"),
        description: service.unavailable_reason || t("screens.shop.quick.services.notAvailableDescription"),
        icon: "alert-circle",
        tone: "warning",
      });
      return;
    }

    if (shopGold < service.price_crystals) {
      void pushToast({
        title: t("screens.shop.quick.notEnoughGold"),
        description: t("screens.shop.quick.notEnoughGoldDescription"),
        icon: "cash-remove",
        tone: "warning",
      });
      return;
    }

    if (purchasingItemId === service.id) {
      return;
    }

    try {
      setPurchasingItemId(service.id);
      setSelectedItem(null);
      const result = await buyShopItem(service.id);
      await Promise.all([refreshGame(true), loadShop(true)]);

      const title =
        result.kind === "service" && result.service_key === "wound_cure"
          ? t("screens.shop.quick.services.woundCuredTitle")
          : result.kind === "service" && result.service_key === "full_heal"
            ? t("screens.shop.quick.services.fullHealTitle")
            : t("screens.shop.quick.services.serviceAppliedTitle");
      const description =
        result.kind === "service" && result.health
          ? t("screens.shop.quick.services.healthNow", {
              current: result.health.current_health,
              max: result.health.max_health,
            })
          : service.effect_preview;
      void pushToast(
        {
          title,
          description,
          icon: service.icon || "medical-bag",
          tone: "reward",
        },
        { sound: "item" },
      );
    } catch (error) {
      void pushToast({
        title: t("shop.purchaseFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setPurchasingItemId(null);
    }
  }

  async function handleBuyXpScroll(scroll: ShopXpScrollPayload) {
    if (!scroll.available) {
      void pushToast({
        title: t("screens.shop.quick.scrolls.notAvailableTitle"),
        description: scroll.unavailable_reason || t("screens.shop.quick.scrolls.notAvailableDescription"),
        icon: "alert-circle",
        tone: "warning",
      });
      return;
    }
    if (shopGold < scroll.price_crystals) {
      void pushToast({
        title: t("screens.shop.quick.notEnoughGold"),
        description: t("screens.shop.quick.notEnoughGoldDescription"),
        icon: "cash-remove",
        tone: "warning",
      });
      return;
    }
    if (purchasingItemId === scroll.id) {
      return;
    }
    try {
      setPurchasingItemId(scroll.id);
      const result = await buyShopItem(scroll.id);
      await Promise.all([refreshGame(true), loadShop(true)]);
      void pushToast(
        {
          title: t("screens.shop.quick.scrolls.purchasedTitle"),
          description:
            result.kind === "xp_scroll" && result.xp_gained
              ? t("screens.shop.quick.scrolls.purchasedDescription", { xp: result.xp_gained })
              : scroll.effect_preview,
          icon: scroll.icon || "script-text-outline",
          tone: "reward",
        },
        { sound: "item" },
      );
    } catch (error) {
      void pushToast({
        title: t("shop.purchaseFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setPurchasingItemId(null);
    }
  }

  async function handleBuyContract(contract: ShopQuestContractPayload) {
    if (!contract.available) {
      void pushToast({
        title: t("screens.shop.quick.contracts.notAvailableTitle"),
        description: contract.unavailable_reason || t("screens.shop.quick.contracts.notAvailableDescription"),
        icon: "alert-circle",
        tone: "warning",
      });
      return;
    }
    if (shopGold < contract.price_crystals) {
      void pushToast({
        title: t("screens.shop.quick.notEnoughGold"),
        description: t("screens.shop.quick.notEnoughGoldDescription"),
        icon: "cash-remove",
        tone: "warning",
      });
      return;
    }
    if (purchasingItemId === contract.id) {
      return;
    }
    try {
      setPurchasingItemId(contract.id);
      const result = await buyShopItem(contract.id);
      await Promise.all([refreshGame(true), loadShop(true)]);
      const remaining = result.kind === "contract" ? result.contract?.remaining_quests ?? contract.charges : contract.charges;
      void pushToast(
        {
          title: t("screens.shop.quick.contracts.purchasedTitle"),
          description: t("screens.shop.quick.contracts.purchasedDescription", { quests: remaining }),
          icon: contract.icon || "sword-cross",
          tone: "reward",
        },
        { sound: "item" },
      );
    } catch (error) {
      void pushToast({
        title: t("shop.purchaseFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setPurchasingItemId(null);
    }
  }

  async function handleBuyEnchant(enchant: ShopWeaponEnchantPayload) {
    if (!enchant.available) {
      void pushToast({
        title: t("screens.shop.quick.enchants.notAvailableTitle"),
        description: enchant.unavailable_reason || t("screens.shop.quick.enchants.notAvailableDescription"),
        icon: "alert-circle",
        tone: "warning",
      });
      return;
    }
    if (shopGold < enchant.price_crystals) {
      void pushToast({
        title: t("screens.shop.quick.notEnoughGold"),
        description: t("screens.shop.quick.notEnoughGoldDescription"),
        icon: "cash-remove",
        tone: "warning",
      });
      return;
    }
    if (purchasingItemId === enchant.id) {
      return;
    }
    try {
      setPurchasingItemId(enchant.id);
      const result = await buyShopItem(enchant.id, enchant.target_inventory_id ?? null);
      await Promise.all([refreshGame(true), loadShop(true)]);
      void pushToast(
        {
          title: t("screens.shop.quick.enchants.purchasedTitle"),
          description:
            result.kind === "enchant" && result.target_weapon_name
              ? t("screens.shop.quick.enchants.purchasedDescription", { weapon: result.target_weapon_name })
              : enchant.effect_preview,
          icon: enchant.icon || "creation",
          tone: "reward",
        },
        { sound: "item" },
      );
    } catch (error) {
      void pushToast({
        title: t("shop.purchaseFailed"),
        description: error instanceof Error ? error.message : t("errors.unknownError"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setPurchasingItemId(null);
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
              {translateOrFallback(
                t,
                "screens.shop.quick.catalogCount",
                `${getCatalogLabel(activeCatalog)}: ${activeCatalogCount}`,
                { catalog: getCatalogLabel(activeCatalog), count: activeCatalogCount },
              )}
            </Text>
          </View>

          <View style={styles.walletChip}>
            <GameIcon name="cash" size={18} color={colors.gold} />
            <Text style={styles.walletValue}>{shopGold}</Text>
          </View>
        </View>

        <View style={styles.catalogRow}>
          {SHOP_CATALOGS.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => setActiveCatalog(entry)}
              style={[styles.filterTab, activeCatalog === entry ? styles.filterTabActive : null]}
            >
              <Text style={[styles.filterTabText, activeCatalog === entry ? styles.filterTabTextActive : null]}>
                {getCatalogLabel(entry)}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeCatalog === "equipment" ? (
          <>
            <View style={styles.toolbarRow}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("screens.shop.quick.searchPlaceholder")}
                placeholderTextColor={colors.textDim}
                style={styles.searchInput}
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
          </>
        ) : null}
      </Card>

      {activeCatalog === "equipment" && showFirstPurchaseGuide ? (
        <Card tone="subtle">
          <Text style={styles.guideTitle}>
            {translateOrFallback(t, "screens.shop.quick.firstGuideTitle", "Как выбрать первый предмет")}
          </Text>
          <Text style={styles.guideDescription}>
            {translateOrFallback(
              t,
              "screens.shop.quick.firstGuideDescription",
              "Для старта не нужен идеальный набор. Достаточно одного доступного предмета, который ты сможешь сразу надеть.",
            )}
          </Text>
          <View style={styles.guideList}>
            {firstPurchaseGuideItems.map((item) => (
              <View key={item.title} style={styles.guideRow}>
                <View style={styles.guideIconWrap}>
                  <GameIcon name={item.icon} size={16} color={colors.primary} />
                </View>
                <View style={styles.guideCopy}>
                  <Text style={styles.guideItemTitle}>{item.title}</Text>
                  <Text style={styles.guideItemDescription}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {recentPurchase ? (
        <Card tone="accent">
          <Text style={styles.guideTitle}>
            {recentPurchase.isChest
              ? translateOrFallback(t, "screens.shop.quick.purchaseChestTitle", "Покупка готова к открытию")
              : translateOrFallback(t, "screens.shop.quick.purchaseTitle", "Покупка завершена")}
          </Text>
          <Text style={styles.guideDescription}>
            {recentPurchase.isChest
              ? translateOrFallback(
                  t,
                  "screens.shop.quick.purchaseChestDescription",
                  `Сундук уже в сумке. Открой персонажа, чтобы открыть его и забрать награду.`,
                )
              : translateOrFallback(
                  t,
                  "screens.shop.quick.purchaseDescription",
                  `Предмет "${recentPurchase.name}" уже в сумке. Следующий шаг — открыть персонажа и надеть его.`,
                )}
          </Text>
          {recentPurchase.statEntries.length ? (
            <View style={styles.purchaseStatsRow}>
              {recentPurchase.statEntries.map((entry) => (
                <View key={`${entry.label}-${entry.value}`} style={styles.purchaseStatChip}>
                  <Text style={styles.purchaseStatLabel}>{entry.label}</Text>
                  <Text style={styles.purchaseStatValue}>{entry.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.purchaseActionRow}>
            <Button
              label={t("screens.home.character")}
              icon="shield-account"
              onPress={() => navigation.navigate("Character")}
              style={styles.sortButton}
            />
            <Button
              label={translateOrFallback(t, "common.close", "Закрыть")}
              icon="check"
              variant="secondary"
              onPress={() => setRecentPurchase(null)}
              style={styles.sortButton}
            />
          </View>
        </Card>
      ) : null}

      {shopError ? (
        <StateBlock
          tone="warning"
          icon="alert-circle"
          title={t("screens.shop.quick.loadFailed")}
          description={shopError}
          actionLabel={t("common.retry")}
          onAction={() => {
            void loadShop(true);
          }}
        />
      ) : null}

      {isLoadingShop && !shopPayload ? (
        <StateBlock tone="info" icon="timer-sand" title={t("common.loading")} />
      ) : null}

      {activeCatalog === "equipment" ? (
        visibleItems.length ? (
          <View style={styles.grid}>
            {visibleItems.map((item, index) => {
              const rarityLabel = getRarityLabel(item.rarity);
              const lockedByLevel = heroLevel < item.requiredLevel;

              return (
                <View key={String(item.shopItemId)} style={[styles.gridCell, { width: cardWidth }]}>
                  <ItemCard
                    itemId={item.id}
                    itemType={toItemCardType(item.category)}
                    itemSlot={item.slot}
                    itemSubclass={item.subclass}
                    icon={item.iconName}
                    name={item.name}
                    rarity={item.rarity}
                    description={item.description}
                    statEntries={toStatEntries(item, t)}
                    price={item.priceGold}
                    badge={t("screens.shop.quick.itemBadge", {
                      rarity: rarityLabel,
                      level: item.requiredLevel,
                      levelShort: t("common.levelShort"),
                    })}
                    actionLabel={t("screens.shop.buy")}
                    onAction={() => handleBuy(item)}
                    onPress={() => setSelectedItem(item)}
                    compact
                    shopStyle
                    chestStyle={item.category === "chest"}
                    locked={lockedByLevel}
                    delay={index * 10}
                  />
                </View>
              );
            })}
          </View>
        ) : !isLoadingShop ? (
          <StateBlock
            icon="package-variant-closed"
            title={t("screens.shop.quick.emptyTitle")}
            description={t("screens.shop.quick.emptyDescription")}
            actionLabel={t("screens.shop.quick.resetFilters")}
            onAction={resetFilters}
          />
        ) : null
      ) : null}

      {activeCatalog === "services" ? (
        shopServices.length ? (
          <Card style={styles.servicesCard}>
            <Text style={styles.guideTitle}>
              {translateOrFallback(t, "screens.shop.quick.services.title", "Merchant Services")}
            </Text>
            <Text style={styles.guideDescription}>
              {translateOrFallback(
                t,
                "screens.shop.quick.services.subtitle",
                "Spend gold on quick recovery and battlefield treatment.",
              )}
            </Text>
            <View style={styles.servicesList}>
              {sortedShopServices.map((service) => (
                <View key={service.key} style={styles.serviceCard}>
                  <View style={styles.serviceTopRow}>
                    <View style={styles.serviceIconWrap}>
                      <GameIcon name={service.icon || "medical-bag"} size={16} color={colors.primary} />
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <Text style={styles.serviceDescription}>{service.description}</Text>
                    </View>
                  </View>
                  <Text style={styles.serviceEffect}>
                    {translateOrFallback(
                      t,
                      "screens.shop.quick.services.effectLabel",
                      `Effect: ${service.effect_preview}`,
                      { effect: service.effect_preview },
                    )}
                  </Text>
                  {!service.available && service.unavailable_reason ? (
                    <Text style={styles.serviceBlocked}>{service.unavailable_reason}</Text>
                  ) : null}
                  <View style={styles.serviceActionRow}>
                    <View style={styles.servicePriceChip}>
                      <GameIcon name="cash" size={14} color={colors.gold} />
                      <Text style={styles.servicePriceText}>
                        {translateOrFallback(
                          t,
                          "screens.shop.quick.services.priceLabel",
                          `${service.price_crystals} gold`,
                          { price: service.price_crystals },
                        )}
                      </Text>
                    </View>
                    <Button
                      label={translateOrFallback(t, "screens.shop.quick.services.buy", "Buy service")}
                      icon="cash"
                      onPress={() => {
                        void handleBuyService(service);
                      }}
                      disabled={!service.available}
                      loading={purchasingItemId === service.id}
                      style={styles.serviceButton}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : !isLoadingShop ? (
          <StateBlock
            icon="medical-bag"
            title={translateOrFallback(t, "screens.shop.quick.services.emptyTitle", "No services available")}
            description={translateOrFallback(
              t,
              "screens.shop.quick.services.emptyDescription",
              "Merchant services are temporarily unavailable.",
            )}
          />
        ) : null
      ) : null}

      {activeCatalog === "xp_scrolls" ? (
        shopXpScrolls.length ? (
          <Card style={styles.servicesCard}>
            <Text style={styles.guideTitle}>
              {translateOrFallback(t, "screens.shop.quick.scrolls.title", "XP Scrolls")}
            </Text>
            <Text style={styles.guideDescription}>
              {translateOrFallback(
                t,
                "screens.shop.quick.scrolls.subtitle",
                "Instantly boost hero progression with experience scrolls.",
              )}
            </Text>
            <View style={styles.servicesList}>
              {sortedShopXpScrolls.map((scroll) => (
                <View key={scroll.key} style={styles.serviceCard}>
                  <View style={styles.serviceTopRow}>
                    <View style={styles.serviceIconWrap}>
                      <GameIcon name={scroll.icon || "script-text-outline"} size={16} color={colors.primary} />
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceName}>{scroll.name}</Text>
                      <Text style={styles.serviceDescription}>{scroll.description}</Text>
                    </View>
                  </View>
                  <Text style={styles.serviceEffect}>{scroll.effect_preview}</Text>
                  {!scroll.available && scroll.unavailable_reason ? (
                    <Text style={styles.serviceBlocked}>{scroll.unavailable_reason}</Text>
                  ) : null}
                  <View style={styles.serviceActionRow}>
                    <View style={styles.servicePriceChip}>
                      <GameIcon name="cash" size={14} color={colors.gold} />
                      <Text style={styles.servicePriceText}>
                        {translateOrFallback(
                          t,
                          "screens.shop.quick.services.priceLabel",
                          `${scroll.price_crystals} gold`,
                          { price: scroll.price_crystals },
                        )}
                      </Text>
                    </View>
                    <Button
                      label={translateOrFallback(t, "screens.shop.quick.scrolls.buy", "Buy scroll")}
                      icon="cash"
                      onPress={() => {
                        void handleBuyXpScroll(scroll);
                      }}
                      disabled={!scroll.available}
                      loading={purchasingItemId === scroll.id}
                      style={styles.serviceButton}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : !isLoadingShop ? (
          <StateBlock
            icon="script-text-outline"
            title={translateOrFallback(t, "screens.shop.quick.scrolls.emptyTitle", "No scrolls available")}
            description={translateOrFallback(
              t,
              "screens.shop.quick.scrolls.emptyDescription",
              "Experience scrolls are temporarily unavailable.",
            )}
          />
        ) : null
      ) : null}

      {activeCatalog === "contracts" ? (
        shopContracts.length ? (
          <Card style={styles.servicesCard}>
            <Text style={styles.guideTitle}>
              {translateOrFallback(t, "screens.shop.quick.contracts.title", "Quest Contracts")}
            </Text>
            <Text style={styles.guideDescription}>
              {translateOrFallback(
                t,
                "screens.shop.quick.contracts.subtitle",
                "Temporary quest bonuses with limited charges.",
              )}
            </Text>
            {activeContract ? (
              <View style={styles.purchaseStatChip}>
                <Text style={styles.purchaseStatLabel}>
                  {translateOrFallback(t, "screens.shop.quick.contracts.activeTitle", "Active contract")}
                </Text>
                <Text style={styles.purchaseStatValue}>{activeContract.name ?? activeContract.key ?? "-"}</Text>
                {typeof activeContract.remaining_quests === "number" ? (
                  <Text style={styles.serviceEffect}>
                    {translateOrFallback(
                      t,
                      "screens.shop.quick.contracts.activeDescription",
                      `${activeContract.remaining_quests} quests remaining`,
                      { quests: activeContract.remaining_quests },
                    )}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.servicesList}>
              {sortedShopContracts.map((contract) => {
                const xpBonusPercent = Math.round((contract.xp_bonus || 0) * 100);
                const goldBonusPercent = Math.round((contract.gold_bonus || 0) * 100);
                return (
                  <View key={contract.key} style={styles.serviceCard}>
                    <View style={styles.serviceTopRow}>
                      <View style={styles.serviceIconWrap}>
                        <GameIcon name={contract.icon || "sword-cross"} size={16} color={colors.primary} />
                      </View>
                      <View style={styles.serviceCopy}>
                        <Text style={styles.serviceName}>{contract.name}</Text>
                        <Text style={styles.serviceDescription}>{contract.description}</Text>
                      </View>
                    </View>
                    <Text style={styles.serviceEffect}>{contract.effect_preview}</Text>
                    <Text style={styles.serviceDescription}>
                      {translateOrFallback(
                        t,
                        "screens.shop.quick.contracts.bonusLine",
                        `+${xpBonusPercent}% XP, +${goldBonusPercent}% gold, ${contract.charges} quests`,
                        { xp: xpBonusPercent, gold: goldBonusPercent, quests: contract.charges },
                      )}
                    </Text>
                    {!contract.available && contract.unavailable_reason ? (
                      <Text style={styles.serviceBlocked}>{contract.unavailable_reason}</Text>
                    ) : null}
                    <View style={styles.serviceActionRow}>
                      <View style={styles.servicePriceChip}>
                        <GameIcon name="cash" size={14} color={colors.gold} />
                        <Text style={styles.servicePriceText}>
                          {translateOrFallback(
                            t,
                            "screens.shop.quick.services.priceLabel",
                            `${contract.price_crystals} gold`,
                            { price: contract.price_crystals },
                          )}
                        </Text>
                      </View>
                      <Button
                        label={translateOrFallback(t, "screens.shop.quick.contracts.buy", "Buy contract")}
                        icon="cash"
                        onPress={() => {
                          void handleBuyContract(contract);
                        }}
                        disabled={!contract.available}
                        loading={purchasingItemId === contract.id}
                        style={styles.serviceButton}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : !isLoadingShop ? (
          <StateBlock
            icon="sword-cross"
            title={translateOrFallback(t, "screens.shop.quick.contracts.emptyTitle", "No contracts available")}
            description={translateOrFallback(
              t,
              "screens.shop.quick.contracts.emptyDescription",
              "Quest contracts are temporarily unavailable.",
            )}
          />
        ) : null
      ) : null}

      {activeCatalog === "enchants" ? (
        shopEnchants.length ? (
          <Card style={styles.servicesCard}>
            <Text style={styles.guideTitle}>
              {translateOrFallback(t, "screens.shop.quick.enchants.title", "Weapon Enchants")}
            </Text>
            <Text style={styles.guideDescription}>
              {translateOrFallback(
                t,
                "screens.shop.quick.enchants.subtitle",
                "Apply permanent bonuses to your active weapon.",
              )}
            </Text>
            <View style={styles.servicesList}>
              {sortedShopEnchants.map((enchant) => (
                <View key={enchant.key} style={styles.serviceCard}>
                  <View style={styles.serviceTopRow}>
                    <View style={styles.serviceIconWrap}>
                      <GameIcon name={enchant.icon || "creation"} size={16} color={colors.primary} />
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceName}>{enchant.name}</Text>
                      <Text style={styles.serviceDescription}>{enchant.description}</Text>
                    </View>
                  </View>
                  <Text style={styles.serviceEffect}>{enchant.effect_preview}</Text>
                  <Text style={styles.serviceDescription}>
                    {translateOrFallback(
                      t,
                      "screens.shop.quick.enchants.targetLabel",
                      `Target weapon: ${enchant.target_weapon_name ?? "-"}`,
                      { weapon: enchant.target_weapon_name ?? "-" },
                    )}
                  </Text>
                  {enchant.current_enchant?.name ? (
                    <Text style={styles.serviceDescription}>
                      {translateOrFallback(
                        t,
                        "screens.shop.quick.enchants.currentLabel",
                        `Current enchant: ${enchant.current_enchant.name}`,
                        { enchant: enchant.current_enchant.name },
                      )}
                    </Text>
                  ) : null}
                  {!enchant.available && enchant.unavailable_reason ? (
                    <Text style={styles.serviceBlocked}>{enchant.unavailable_reason}</Text>
                  ) : null}
                  <View style={styles.serviceActionRow}>
                    <View style={styles.servicePriceChip}>
                      <GameIcon name="cash" size={14} color={colors.gold} />
                      <Text style={styles.servicePriceText}>
                        {translateOrFallback(
                          t,
                          "screens.shop.quick.services.priceLabel",
                          `${enchant.price_crystals} gold`,
                          { price: enchant.price_crystals },
                        )}
                      </Text>
                    </View>
                    <Button
                      label={translateOrFallback(t, "screens.shop.quick.enchants.buy", "Buy enchant")}
                      icon="cash"
                      onPress={() => {
                        void handleBuyEnchant(enchant);
                      }}
                      disabled={!enchant.available}
                      loading={purchasingItemId === enchant.id}
                      style={styles.serviceButton}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : !isLoadingShop ? (
          <StateBlock
            icon="creation"
            title={translateOrFallback(t, "screens.shop.quick.enchants.emptyTitle", "No enchants available")}
            description={translateOrFallback(
              t,
              "screens.shop.quick.enchants.emptyDescription",
              "Weapon enchants are temporarily unavailable.",
            )}
          />
        ) : null
      ) : null}

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
        statEntries={selectedItem ? toStatEntries(selectedItem, t) : []}
        comparisonTitle={selectedComparison?.comparisonTitle}
        comparisonIntro={selectedComparison?.comparisonIntro}
        comparisonRows={selectedComparison?.comparisonRows}
        actions={
          selectedItem && heroLevel >= selectedItem.requiredLevel
            ? [
                {
                  label: t("screens.shop.buyNow"),
                  icon: "cash",
                  onPress: () => handleBuy(selectedItem),
                  variant: "gold" as const,
                  loading: purchasingItemId === selectedItem.shopItemId,
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
    servicesCard: {
      gap: 10,
    },
    servicesList: {
      gap: 10,
    },
    serviceCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.85)" : "rgba(255,255,255,0.1)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(9,14,24,0.75)",
      padding: 12,
      gap: 8,
    },
    serviceTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    serviceIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
      backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(9,14,24,0.8)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    serviceCopy: {
      flex: 1,
      gap: 2,
    },
    serviceName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    serviceDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    serviceEffect: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    serviceBlocked: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "700",
    },
    serviceActionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    servicePriceChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(183,121,31,0.38)" : "rgba(245,158,11,0.28)",
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245,158,11,0.12)",
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    servicePriceText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    serviceButton: {
      flex: 1,
      minWidth: 120,
    },
    guideTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    guideDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    guideList: {
      gap: 10,
    },
    guideRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    guideIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
      backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(9,14,24,0.8)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    guideCopy: {
      flex: 1,
      gap: 2,
    },
    guideItemTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    guideItemDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    purchaseStatsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    purchaseStatChip: {
      flexGrow: 1,
      minWidth: 100,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeMode === "light" ? "rgba(214,199,170,0.7)" : "rgba(255,255,255,0.08)",
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.92)" : "rgba(8,13,23,0.78)",
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
    },
    purchaseStatLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
    },
    purchaseStatValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    purchaseActionRow: {
      flexDirection: "row",
      gap: 8,
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
    catalogRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
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
