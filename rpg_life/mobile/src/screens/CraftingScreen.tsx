import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { craftRecipe, fetchCraftingOverview, upgradeItem, type CraftingOverview } from "../api/crafting";
import { Screen } from "../components/Screen";
import { useTranslation } from "../context/LocalizationContext";
import { useFeedback } from "../context/FeedbackContext";
import { useGame } from "../context/GameContext";
import { Button, Card, GameIcon, radii, useThemeColors } from "../ui";

function formatResourceCost(
  cost: Record<string, number>,
  resourceNames: Record<string, string>,
) {
  return Object.entries(cost)
    .map(([key, amount]) => `${resourceNames[key] ?? key} x${amount}`)
    .join(", ");
}

export function CraftingScreen() {
  const navigation = useNavigation<any>();
  const t = useTranslation();
  const { refreshGame } = useGame();
  const { pushToast, playSound } = useFeedback();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [payload, setPayload] = useState<CraftingOverview | null>(null);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const isPhoneLayout = width < 420;
  const resourceColumns = width < 520 ? 2 : 3;
  const resourceGap = 10;
  const resourceCardWidth = Math.max((width - 32 - resourceGap * (resourceColumns - 1)) / resourceColumns, isPhoneLayout ? 132 : 110);

  const resourceNames = useMemo(
    () =>
      Object.fromEntries((payload?.resources ?? []).map((resource) => [resource.key, resource.name])),
    [payload?.resources],
  );

  async function loadCrafting() {
    const nextPayload = await fetchCraftingOverview();
    setPayload(nextPayload);
  }

  useEffect(() => {
    loadCrafting().catch(console.error);
  }, []);

  async function handleCraft(recipeId: string) {
    try {
      setIsBusy(recipeId);
      const result = await craftRecipe(recipeId);
      await playSound("item");
      pushToast({
        title: `${t("screens.crafting.createdTitle")}: ${result.crafted_item.name}`,
        description: result.crafted_item.description,
        icon: result.crafted_item.icon,
        tone: "reward",
      });
      await Promise.all([loadCrafting(), refreshGame()]);
    } catch (error) {
      Alert.alert(
        t("screens.crafting.craftUnavailable"),
        error instanceof Error ? error.message : t("screens.crafting.unknownError"),
      );
    } finally {
      setIsBusy(null);
    }
  }

  async function handleUpgrade(inventoryId: number) {
    try {
      setIsBusy(`upgrade-${inventoryId}`);
      const result = await upgradeItem(inventoryId);
      await playSound("item");
      pushToast({
        title: `${t("screens.crafting.upgradedTitle")}: ${result.upgraded_item.name}`,
        description: result.upgraded_item.description,
        icon: result.upgraded_item.icon,
        tone: "reward",
      });
      await Promise.all([loadCrafting(), refreshGame()]);
    } catch (error) {
      Alert.alert(
        t("screens.crafting.upgradeUnavailable"),
        error instanceof Error ? error.message : t("screens.crafting.unknownError"),
      );
    } finally {
      setIsBusy(null);
    }
  }

  return (
    <Screen title={t("screens.crafting.title")} subtitle={t("screens.crafting.subtitle")}>
      <Button
        label={t("screens.crafting.backToShop")}
        icon="arrow-left"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />

      <Card tone="accent">
        <Text style={styles.sectionTitle}>{t("screens.crafting.resources")}</Text>
        <View style={styles.resourceGrid}>
          {(payload?.resources ?? []).map((resource) => (
            <View key={resource.key} style={[styles.resourceCard, { width: resourceCardWidth }]}>
              <Text style={styles.resourceIcon}>{resource.icon}</Text>
              <Text style={styles.resourceName}>{resource.name}</Text>
              <Text style={styles.resourceQty}>x{resource.quantity}</Text>
              <Text style={styles.resourceDescription}>{resource.description}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.crafting.recipes")}</Text>
        {(payload?.recipes ?? []).map((recipe) => (
          <View key={recipe.id} style={[styles.recipeCard, isPhoneLayout ? styles.recipeCardCompact : null]}>
            {recipe.result ? (
              <View style={[styles.resultIconWrap, isPhoneLayout ? styles.resultIconWrapCompact : null]}>
                <GameIcon itemId={recipe.result.id} rarity={recipe.result.rarity} name={recipe.result.icon} size={54} color={colors.primary} />
              </View>
            ) : null}
            <View style={styles.recipeCopy}>
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              <Text style={styles.recipeMeta}>
                {t("screens.crafting.resultLabel")}: {recipe.result?.name ?? "-"}
              </Text>
              <Text style={styles.recipeMeta}>
                {t("screens.crafting.requiredLevel")}: {recipe.required_level}
              </Text>
              <Text style={styles.recipeMeta}>
                {t("screens.crafting.ingredients")}: {formatResourceCost(recipe.ingredients, resourceNames)}
              </Text>
            </View>
            <Button
              label={t("screens.crafting.craft")}
              icon="hammer-wrench"
              onPress={() => handleCraft(recipe.id)}
              disabled={!recipe.can_craft || isBusy === recipe.id}
              style={[styles.inlineButton, isPhoneLayout ? styles.inlineButtonCompact : null]}
            />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.crafting.upgrades")}</Text>
        {(payload?.upgrades ?? []).length ? (
          (payload?.upgrades ?? []).map((upgrade) => (
            <View key={`${upgrade.inventory_id}-${upgrade.to_item_id}`} style={[styles.recipeCard, isPhoneLayout ? styles.recipeCardCompact : null]}>
              <View style={styles.upgradeIconRow}>
                {upgrade.current_item ? (
                  <View style={[styles.upgradeIconWrap, isPhoneLayout ? styles.upgradeIconWrapCompact : null]}>
                    <GameIcon itemId={upgrade.current_item.id} rarity={upgrade.current_item.rarity} name={upgrade.current_item.icon} size={44} color={colors.text} />
                  </View>
                ) : null}
                <GameIcon name="arrow-right" size={18} color={colors.textDim} />
                {upgrade.upgraded_item ? (
                  <View style={[styles.upgradeIconWrap, isPhoneLayout ? styles.upgradeIconWrapCompact : null]}>
                    <GameIcon itemId={upgrade.upgraded_item.id} rarity={upgrade.upgraded_item.rarity} name={upgrade.upgraded_item.icon} size={44} color={colors.primary} />
                  </View>
                ) : null}
              </View>
              <View style={styles.recipeCopy}>
                <Text style={styles.recipeTitle}>
                  {upgrade.current_item?.name} {"->"} {upgrade.upgraded_item?.name}
                </Text>
                <Text style={styles.recipeMeta}>
                  {t("screens.crafting.upgradeCost")}: {formatResourceCost(upgrade.cost, resourceNames)}
                </Text>
              </View>
              <Button
                label={t("screens.crafting.upgrade")}
                icon="chevron-double-up"
                onPress={() => handleUpgrade(upgrade.inventory_id)}
                disabled={isBusy === `upgrade-${upgrade.inventory_id}`}
                style={[styles.inlineButton, isPhoneLayout ? styles.inlineButtonCompact : null]}
              />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t("screens.crafting.noUpgrades")}</Text>
        )}
      </Card>
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
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resourceCard: {
    backgroundColor: colors.backgroundInset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 4,
  },
  resourceIcon: {
    fontSize: 24,
  },
  resourceName: {
    color: colors.text,
    fontWeight: "800",
  },
  resourceQty: {
    color: colors.primary,
    fontWeight: "900",
  },
  resourceDescription: {
    color: colors.textMuted,
    lineHeight: 18,
    fontSize: 12,
  },
  recipeCard: {
    backgroundColor: colors.backgroundInset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  recipeCardCompact: {
    padding: 10,
  },
  recipeCopy: {
    gap: 4,
  },
  resultIconWrap: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultIconWrapCompact: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  upgradeIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  upgradeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upgradeIconWrapCompact: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  recipeTitle: {
    color: colors.text,
    fontWeight: "800",
  },
  recipeMeta: {
    color: colors.textMuted,
    lineHeight: 19,
  },
  inlineButton: {
    alignSelf: "flex-start",
    minWidth: 150,
  },
  inlineButtonCompact: {
    alignSelf: "stretch",
    minWidth: 0,
  },
  emptyText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  });
}
