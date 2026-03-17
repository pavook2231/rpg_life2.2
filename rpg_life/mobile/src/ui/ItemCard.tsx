import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTranslation } from "../context/LocalizationContext";
import { triggerHaptic } from "../lib/haptics";
import type { ItemStatEntry } from "../lib/equipment";
import { Button } from "./Button";
import { GameIcon } from "./GameIcon";
import { colors, getRaritySurface, radii, shadows, useThemeMode } from "./theme";

type Props = {
  itemId?: number | null;
  itemType?: string | null;
  itemSlot?: string | null;
  itemSubclass?: string | null;
  icon: string;
  name: string;
  rarity?: string | null;
  description?: string;
  stats?: string[];
  statEntries?: ItemStatEntry[];
  price?: number;
  badge?: string;
  locked?: boolean;
  equipped?: boolean;
  actionLabel?: string;
  onPress?: () => void;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  compact?: boolean;
  shopStyle?: boolean;
  fantasyShopCard?: boolean;
  chestStyle?: boolean;
  featuredLabel?: string;
};

const rarityIcons: Record<string, string> = {
  common: "circle-medium",
  uncommon: "leaf",
  rare: "water",
  epic: "creation",
  legendary: "crown",
  immortal: "star-shooting",
};

export function ItemCard({
  itemId,
  itemType,
  itemSlot,
  itemSubclass,
  icon,
  name,
  rarity,
  description,
  stats = [],
  statEntries = [],
  price,
  badge,
  locked = false,
  equipped = false,
  actionLabel,
  onPress,
  onAction,
  style,
  delay = 0,
  compact = false,
  shopStyle = false,
  fantasyShopCard = false,
  chestStyle = false,
  featuredLabel,
}: Props) {
  const t = useTranslation();
  const themeMode = useThemeMode();
  const surface = getRaritySurface(rarity, themeMode);
  const premium = rarity === "epic" || rarity === "legendary" || rarity === "immortal";
  const rarityIcon = rarityIcons[rarity ?? "common"] ?? "shield-star";
  const isCompactShopCard = compact && shopStyle && !chestStyle;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayEntries = statEntries.length
    ? statEntries
    : stats.map((stat, index) => ({
        key: `${stat}-${index}`,
        label: stat,
        displayValue: "",
        value: 0,
        icon: "sparkles",
      }));
  const headlineEntry = displayEntries[0];
  const secondaryEntry = displayEntries[1];
  const highlightValue = headlineEntry?.displayValue || headlineEntry?.label || null;
  const primarySummary = headlineEntry ? `${headlineEntry.displayValue} ${headlineEntry.label}` : description;
  const secondarySummary = secondaryEntry ? `${secondaryEntry.displayValue} ${secondaryEntry.label}` : description;

  function handleCardPress() {
    if (!onPress) return;
    void triggerHaptic("press");
    onPress();
  }

  function handleActionPress() {
    if (!onAction || locked) return;
    void triggerHaptic("press");
    onAction();
  }

  function renderStatRows(limit: number, compactRows = false) {
    if (!displayEntries.length) {
      return <Text style={styles.empty}>{t("common.noBonuses")}</Text>;
    }

    return displayEntries.slice(0, limit).map((entry) => (
      <View
        key={entry.key}
        style={[
          styles.statChip,
          compactRows ? styles.compactStatChip : null,
          {
                backgroundColor: locked
                  ? "rgba(255,255,255,0.06)"
                  : compactRows
                    ? themeMode === "light"
                      ? "rgba(251,247,239,0.96)"
                      : "rgba(8,15,30,0.72)"
                    : surface.panel,
            borderColor: locked
              ? colors.border
              : compactRows
                ? surface.border
                : surface.trim,
          },
        ]}
      >
        <View style={styles.statIconWrap}>
          <GameIcon name={entry.icon} size={compactRows ? 12 : 14} color={locked ? colors.textDim : surface.border} />
        </View>
        <Text style={[styles.statLabel, compactRows ? styles.compactStatLabel : null]} numberOfLines={1}>
          {entry.label}
        </Text>
        <Text
          style={[
            styles.statValue,
            compactRows ? styles.compactStatValue : null,
            { color: locked ? colors.textDim : surface.accent },
          ]}
          numberOfLines={1}
        >
          {entry.displayValue || entry.label}
        </Text>
      </View>
    ));
  }

  function renderInlineStatIcons(limit = 6) {
    if (!displayEntries.length) {
      return <Text style={styles.empty}>{t("common.noBonuses")}</Text>;
    }

    return (
      <View style={styles.inlineStatsRow}>
        {displayEntries.slice(0, limit).map((entry) => (
          <View key={entry.key} style={styles.inlineStatChip}>
            <GameIcon name={entry.icon} size={12} color={surface.accent} />
            <Text style={styles.inlineStatValue} numberOfLines={1}>
              {entry.displayValue || entry.label}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  if (fantasyShopCard) {
    return (
      <Animated.View entering={FadeInUp.delay(delay).duration(260)} style={styles.shadowWrap}>
        <Animated.View
          style={[
            animatedStyle,
            premium && !locked ? { shadowColor: surface.glow, ...shadows.glow } : null,
            style,
          ]}
        >
          <Pressable
            onPress={handleCardPress}
            onPressIn={() => {
              scale.value = withSpring(0.97, { damping: 14, stiffness: 260 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1.02, { damping: 12, stiffness: 230 }, () => {
                scale.value = withSpring(1, { damping: 16, stiffness: 220 });
              });
            }}
            style={[
              styles.shopFantasyCard,
              compact ? styles.shopFantasyCardCompact : null,
              chestStyle ? styles.shopFantasyChestCard : null,
              {
                backgroundColor: locked ? "#30263a" : "#241a2f",
                borderColor: locked ? colors.border : `${surface.border}aa`,
              },
            ]}
          >
            <View style={styles.shopFantasyBackdrop} />
            <View style={[styles.shopFantasyInnerFrame, { borderColor: locked ? "rgba(255,255,255,0.12)" : `${surface.trim}` }]} />
            <View style={styles.shopFantasyOuterGlow} />

            <View style={[styles.shopFantasyGem, { borderColor: surface.border, backgroundColor: `${surface.background}` }]}>
              <GameIcon name={rarityIcon} size={14} color={locked ? colors.textDim : surface.accent} />
            </View>

            {highlightValue ? (
              <View style={styles.shopFantasyPowerBadge}>
                <Text style={styles.shopFantasyPowerText} numberOfLines={1}>
                  {highlightValue}
                </Text>
              </View>
            ) : null}

            {featuredLabel ? (
              <View style={styles.shopFantasyFeatureRibbon}>
                <Text style={styles.shopFantasyFeatureText} numberOfLines={1}>
                  {featuredLabel}
                </Text>
              </View>
            ) : null}

            <View style={[styles.shopFantasyArtPanel, chestStyle ? styles.shopFantasyArtPanelChest : null]}>
              <View style={[styles.shopFantasyArtGlow, { backgroundColor: locked ? "rgba(255,255,255,0.08)" : surface.glow }]} />
              <GameIcon
                itemId={itemId}
                itemType={itemType}
                itemSlot={itemSlot}
                itemSubclass={itemSubclass}
                rarity={rarity}
                name={icon}
                size={chestStyle ? 88 : compact ? 64 : 76}
                color={locked ? colors.textDim : surface.accent}
              />
            </View>

            <View style={styles.shopFantasyTextBlock}>
              <Text style={[styles.shopFantasyName, { color: locked ? "#b8a9c7" : "#f7e6c2" }]} numberOfLines={2}>
                {name}
              </Text>
              {primarySummary ? (
                <Text style={styles.shopFantasyPrimaryStat} numberOfLines={1}>
                  {primarySummary}
                </Text>
              ) : null}
              {secondaryEntry ? (
                <Text style={styles.shopFantasySecondaryStat} numberOfLines={1}>
                  {secondarySummary}
                </Text>
              ) : description && !primarySummary ? (
                <Text style={styles.shopFantasySecondaryStat} numberOfLines={2}>
                  {description}
                </Text>
              ) : null}
            </View>

            {badge ? (
              <Text style={styles.shopFantasyMeta} numberOfLines={1}>
                {badge}
              </Text>
            ) : null}

            <Pressable
              onPress={handleActionPress}
              disabled={locked}
              style={[styles.shopFantasyPriceButton, locked ? styles.shopFantasyPriceButtonLocked : null]}
            >
              <View style={styles.shopFantasyPriceGlow} />
              <GameIcon name="cash" size={16} color={colors.gold} />
              <Text style={styles.shopFantasyPrice}>{typeof price === "number" ? price : actionLabel ?? t("screens.shop.buy")}</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(260)} style={styles.shadowWrap}>
      <Animated.View
        style={[
          animatedStyle,
          premium && !locked ? { shadowColor: surface.glow, ...shadows.glow } : null,
          style,
        ]}
      >
        <Pressable
          onPress={handleCardPress}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 14, stiffness: 260 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1.02, { damping: 12, stiffness: 230 }, () => {
              scale.value = withSpring(1, { damping: 16, stiffness: 220 });
            });
          }}
          style={[
            styles.card,
            compact ? styles.compactCard : null,
            shopStyle ? styles.shopCard : null,
            chestStyle ? styles.chestCard : null,
            compact && shopStyle ? styles.compactShopCard : null,
            {
                backgroundColor: locked ? (themeMode === "light" ? "#cbd5e1" : "#334155") : surface.background,
              borderColor: locked ? colors.borderSoft : surface.border,
            },
          ]}
        >
          <View style={[styles.innerFrame, { borderColor: locked ? colors.borderSoft : surface.trim }]} />
          <View style={[styles.cardGlow, { backgroundColor: locked ? "rgba(255,255,255,0.06)" : surface.glow }]} />
          <View style={[styles.topTrim, { backgroundColor: locked ? "rgba(255,255,255,0.08)" : surface.trim }]} />

          <View style={[styles.topRow, isCompactShopCard ? styles.compactTopRow : null]}>
            <View
              style={[
                styles.rarityPill,
                isCompactShopCard ? styles.compactPill : null,
                {
                  backgroundColor: locked
                    ? colors.backgroundInset
                    : isCompactShopCard
                      ? themeMode === "light"
                        ? "rgba(248,250,252,0.96)"
                        : "rgba(8,15,30,0.76)"
                      : `${surface.accent}14`,
                  borderColor: locked ? colors.border : surface.trim,
                },
              ]}
            >
              <GameIcon name={locked ? "lock" : rarityIcon} size={14} color={locked ? colors.textDim : surface.border} />
              <Text style={[styles.rarityText, isCompactShopCard ? styles.compactPillText : null, { color: locked ? colors.textDim : surface.border }]}>
                {badge ?? (rarity ? rarity.toUpperCase() : t("common.item"))}
              </Text>
            </View>
            {featuredLabel ? (
              <View
                style={[
                  styles.featuredPill,
                  isCompactShopCard ? styles.compactPill : null,
                  {
                    borderColor: `${surface.accent}66`,
                    backgroundColor: isCompactShopCard
                      ? themeMode === "light"
                        ? "rgba(248,250,252,0.96)"
                        : "rgba(8,15,30,0.82)"
                      : `${surface.accent}14`,
                  },
                ]}
              >
                <GameIcon name="star-four-points" size={12} color={surface.accent} />
                <Text style={[styles.featuredText, isCompactShopCard ? styles.compactPillText : null]}>{featuredLabel}</Text>
              </View>
            ) : null}
          </View>

          {isCompactShopCard ? (
            <View style={styles.compactShopBody}>
              <View
                style={[
                  styles.iconWrap,
                  styles.compactIconWrap,
                  {
                    borderColor: surface.border,
                    backgroundColor: locked ? "rgba(148,163,184,0.12)" : themeMode === "light" ? "rgba(248,250,252,0.96)" : "rgba(7,12,24,0.78)",
                  },
                ]}
              >
                <View style={[styles.iconHalo, styles.compactIconHalo, { backgroundColor: locked ? "rgba(255,255,255,0.08)" : surface.glow }]} />
                <GameIcon itemId={itemId} itemType={itemType} itemSlot={itemSlot} itemSubclass={itemSubclass} rarity={rarity} name={icon} size={56} color={locked ? colors.textDim : surface.accent} />
              </View>

              <View style={styles.compactShopContent}>
                <View style={[styles.titleBlock, styles.compactTitleBlock]}>
                  <Text style={[styles.name, styles.compactName, { color: locked ? colors.textDim : surface.accent }]} numberOfLines={2}>
                    {name}
                  </Text>
                  {description ? (
                    <Text style={[styles.description, styles.compactDescription]} numberOfLines={1}>
                      {description}
                    </Text>
                  ) : null}
                </View>

                {equipped ? (
                  <View style={[styles.statusPill, styles.compactStatusPill]}>
                    <GameIcon name="shield-check" size={13} color={colors.success} />
                    <Text style={styles.equipped}>{t("common.equipped")}</Text>
                  </View>
                ) : null}

                <View style={[styles.stats, styles.compactStats]}>{renderInlineStatIcons(8)}</View>

                <View style={styles.compactFooter}>
                  {typeof price === "number" ? (
                    <View style={styles.compactPriceRow}>
                      <View style={styles.compactPriceBadge}>
                        <GameIcon name="cash" size={14} color={colors.gold} />
                      </View>
                      <View style={styles.compactPriceCopy}>
                        <Text style={styles.compactPriceLabel}>{shopStyle ? t("screens.shop.priceLabel") : t("common.price")}</Text>
                        <Text style={styles.compactPrice}>{price}</Text>
                      </View>
                    </View>
                  ) : null}

                  {actionLabel && onAction ? (
                    <Pressable
                      onPress={handleActionPress}
                      disabled={locked}
                      style={[styles.compactActionButton, themeMode === "light" ? styles.compactActionButtonLight : null, locked ? styles.compactActionButtonDisabled : null]}
                    >
                      <GameIcon name={locked ? "lock" : "cash"} size={14} color={colors.text} />
                      <Text style={styles.compactActionLabel} numberOfLines={1}>
                        {actionLabel}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.iconWrap,
                  compact && shopStyle ? styles.compactIconWrap : null,
                  chestStyle ? styles.chestIconWrap : null,
                  { borderColor: surface.border, backgroundColor: locked ? "rgba(148,163,184,0.12)" : surface.panel },
                ]}
              >
                <View style={[styles.iconHalo, chestStyle ? styles.chestIconHalo : null, { backgroundColor: locked ? "rgba(255,255,255,0.08)" : surface.glow }]} />
                <GameIcon
                  itemId={itemId}
                  itemType={itemType}
                  itemSlot={itemSlot}
                  itemSubclass={itemSubclass}
                  rarity={rarity}
                  name={icon}
                  size={compact && shopStyle ? 40 : compact ? 48 : 68}
                  color={locked ? colors.textDim : surface.accent}
                />
              </View>

              <View style={styles.titleBlock}>
                <Text style={[styles.name, { color: locked ? colors.textDim : surface.accent }]} numberOfLines={2}>
                  {name}
                </Text>
                {description ? (
                  <Text style={styles.description} numberOfLines={compact ? 2 : chestStyle ? 3 : 2}>
                    {description}
                  </Text>
                ) : null}
              </View>

              {equipped ? (
                <View style={styles.statusPill}>
                  <GameIcon name="shield-check" size={14} color={colors.success} />
                  <Text style={styles.equipped}>{t("common.equipped")}</Text>
                </View>
              ) : null}

              <View style={styles.stats}>{renderStatRows(compact ? 3 : chestStyle ? 4 : 3)}</View>

              {typeof price === "number" ? (
                <View style={[styles.priceRow, chestStyle ? styles.chestPriceRow : null]}>
                  <View style={styles.priceBadge}>
                    <GameIcon name="cash" size={16} color={colors.gold} />
                  </View>
                  <View style={styles.priceCopy}>
                    <Text style={styles.priceLabel}>{shopStyle ? t("screens.shop.priceLabel") : t("common.price")}</Text>
                    <Text style={styles.price}>{price}</Text>
                  </View>
                </View>
              ) : null}

              {actionLabel && onAction ? (
                <Button label={actionLabel} onPress={onAction} disabled={locked} icon="cash" variant={shopStyle ? "gold" : "primary"} />
              ) : null}
            </>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radii.md,
  },
  card: {
    position: "relative",
    overflow: "hidden",
    minHeight: 220,
    borderRadius: radii.md,
    borderWidth: 2,
    padding: 10,
    gap: 8,
    ...shadows.card,
  },
  shopCard: {
    minHeight: 268,
    padding: 10,
  },
  compactShopCard: {
    minHeight: 108,
    padding: 7,
    gap: 3,
  },
  chestCard: {
    minHeight: 352,
    padding: 16,
  },
  compactCard: {
    minHeight: 200,
    padding: 10,
  },
  innerFrame: {
    position: "absolute",
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  cardGlow: {
    position: "absolute",
    top: -40,
    right: -16,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.16,
  },
  topTrim: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  compactTopRow: {
    gap: 3,
  },
  rarityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
    maxWidth: "100%",
  },
  compactPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: "900",
    flexShrink: 1,
  },
  compactPillText: {
    fontSize: 7,
  },
  featuredPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
    maxWidth: "100%",
  },
  featuredText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
  },
  iconWrap: {
    position: "relative",
    alignSelf: "center",
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  compactIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 18,
  },
  compactIconHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  chestIconWrap: {
    width: 122,
    height: 122,
    borderRadius: 34,
  },
  iconHalo: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  chestIconHalo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  titleBlock: {
    gap: 6,
  },
  compactTitleBlock: {
    gap: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  compactName: {
    fontSize: 11,
    lineHeight: 13,
    textAlign: "left",
  },
  description: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  compactDescription: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: "left",
    color: colors.textMuted,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  compactStatusPill: {
    justifyContent: "flex-start",
  },
  equipped: {
    color: colors.success,
    fontWeight: "800",
    fontSize: 12,
  },
  stats: {
    gap: 6,
    marginTop: "auto",
  },
  compactStats: {
    gap: 1,
    marginTop: 0,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: "hidden",
  },
  compactStatChip: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    gap: 3,
  },
  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.22)",
  },
  statLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  compactStatLabel: {
    fontSize: 7,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 11,
    fontWeight: "900",
  },
  compactStatValue: {
    fontSize: 7,
    color: colors.text,
  },
  empty: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chestPriceRow: {
    paddingVertical: 12,
  },
  priceBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  priceCopy: {
    flex: 1,
    gap: 2,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  price: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  compactShopBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactShopContent: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  compactFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  compactPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    borderRadius: 8,
    backgroundColor: colors.backgroundInset,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  compactPriceBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.18)",
  },
  compactPriceCopy: {
    gap: 1,
  },
  compactPriceLabel: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  compactPrice: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 13,
  },
  compactActionButton: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "#6f4204",
  },
  compactActionButtonLight: {
    backgroundColor: "#b7791f",
  },
  compactActionButtonDisabled: {
    opacity: 0.45,
  },
  compactActionLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "800",
  },
  inlineStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 4,
  },
  inlineStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundInset,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 0,
  },
  inlineStatValue: {
    color: colors.text,
    fontSize: 8,
    fontWeight: "800",
  },
  shopFantasyCard: {
    position: "relative",
    overflow: "hidden",
    minHeight: 306,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
    backgroundColor: "#241a2f",
    ...shadows.card,
  },
  shopFantasyCardCompact: {
    minHeight: 284,
    padding: 10,
    gap: 8,
  },
  shopFantasyChestCard: {
    minHeight: 340,
  },
  shopFantasyBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,196,106,0.04)",
  },
  shopFantasyInnerFrame: {
    position: "absolute",
    top: 6,
    right: 6,
    bottom: 6,
    left: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  shopFantasyOuterGlow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    height: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: "rgba(255,198,87,0.8)",
    opacity: 0.75,
  },
  shopFantasyGem: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 3,
  },
  shopFantasyPowerBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(35,72,31,0.92)",
    borderWidth: 1,
    borderColor: "rgba(132,255,123,0.22)",
    zIndex: 3,
  },
  shopFantasyPowerText: {
    color: "#a8ff76",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  shopFantasyFeatureRibbon: {
    position: "absolute",
    top: 46,
    left: 10,
    right: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,189,72,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,189,72,0.24)",
    zIndex: 2,
  },
  shopFantasyFeatureText: {
    color: "#fbd38d",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  shopFantasyArtPanel: {
    marginTop: 24,
    minHeight: 138,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16,10,28,0.88)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shopFantasyArtPanelChest: {
    minHeight: 158,
  },
  shopFantasyArtGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.48,
  },
  shopFantasyTextBlock: {
    gap: 4,
    minHeight: 70,
  },
  shopFantasyName: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  shopFantasyPrimaryStat: {
    color: "#9eff6c",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  shopFantasySecondaryStat: {
    color: "#d6c2dd",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  shopFantasyMeta: {
    color: "#9f8faa",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  shopFantasyPriceButton: {
    position: "relative",
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#f5c35b",
    backgroundColor: "#6c3f10",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    overflow: "hidden",
    marginTop: "auto",
  },
  shopFantasyPriceButtonLocked: {
    opacity: 0.5,
  },
  shopFantasyPriceGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: "58%",
    backgroundColor: "rgba(255,220,147,0.22)",
  },
  shopFantasyPrice: {
    color: "#fff1c3",
    fontSize: 18,
    fontWeight: "900",
  },
});
