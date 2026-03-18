import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal as NativeModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { getUnifiedItemCatalog } from "../lib/itemCatalog";
import { getRarityColor, getRarityLabel, normalizeItemText } from "../lib/gameUi";
import { Button } from "./Button";
import { GameIcon } from "./GameIcon";
import { radii, useThemeColors, useThemeMode } from "./theme";

type ChestRewardItem = {
  id?: number;
  name: string;
  icon?: string;
  rarity?: string;
  type?: string | null;
  slot?: string | null;
  subclass?: string | null;
};

type ChestRewardPayload = {
  item: ChestRewardItem;
  rarity?: string;
  chest_name?: string;
  chest_rarity?: string;
  luck_bonus_percent?: number;
};

type RouletteItem = {
  id?: number;
  name: string;
  icon?: string;
  rarity?: string;
  type?: string | null;
  slot?: string | null;
  subclass?: string | null;
};

const TILE_WIDTH = 92;
const TILE_GAP = 8;
const WINNER_INDEX = 22;
const REEL_SIZE = 28;

function buildPool() {
  const entries = getUnifiedItemCatalog().filter((item) => item.category !== "chest");
  return entries.map((item) => ({
    id: item.id,
    name: item.name,
    icon: item.iconName,
    rarity: item.rarity,
    type: item.category,
    slot: item.slot,
    subclass: item.subclass,
  }));
}

function pickRandomItem(pool: RouletteItem[]) {
  if (!pool.length) {
    return {
      id: undefined,
      name: "Unknown loot",
      icon: "treasure-chest",
      rarity: "common",
      type: "misc",
      slot: null,
      subclass: null,
    } satisfies RouletteItem;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildRouletteItems(reward: ChestRewardItem) {
  const pool = buildPool();
  const items: RouletteItem[] = [];
  for (let index = 0; index < REEL_SIZE; index += 1) {
    items.push(pickRandomItem(pool));
  }
  items[WINNER_INDEX] = {
    id: reward.id,
    name: reward.name,
    icon: reward.icon,
    rarity: reward.rarity,
    type: reward.type,
    slot: reward.slot ?? null,
    subclass: reward.subclass ?? null,
  };
  return items;
}

export function ChestOpeningModal({
  visible,
  reward,
  onClose,
}: {
  visible: boolean;
  reward: ChestRewardPayload | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const { width } = useWindowDimensions();
  const reelTranslate = useRef(new Animated.Value(0)).current;
  const [isRolling, setIsRolling] = useState(false);
  const [landed, setLanded] = useState(false);

  const reel = useMemo(() => (reward ? buildRouletteItems(reward.item) : []), [reward?.item?.id, reward?.item?.icon, reward?.item?.name]);
  const viewportWidth = Math.max(240, Math.min(width - 34, 520));
  const targetOffset = Math.max(
    0,
    WINNER_INDEX * (TILE_WIDTH + TILE_GAP) - viewportWidth / 2 + TILE_WIDTH / 2,
  );

  useEffect(() => {
    if (!visible || !reward) {
      reelTranslate.setValue(0);
      setIsRolling(false);
      setLanded(false);
      return;
    }

    setIsRolling(true);
    setLanded(false);
    reelTranslate.setValue(0);

    const timer = setTimeout(() => {
      Animated.timing(reelTranslate, {
        toValue: -targetOffset,
        duration: 2600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIsRolling(false);
        setLanded(true);
      });
    }, 130);

    return () => {
      clearTimeout(timer);
      reelTranslate.stopAnimation();
    };
  }, [reelTranslate, reward, targetOffset, visible]);

  return (
    <NativeModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Открытие сундука</Text>
          <Text style={styles.subtitle}>
            {reward ? `${reward.chest_name ?? "Сундук"} | ${getRarityLabel(reward.chest_rarity)}` : "Лут-рулетка"}
          </Text>

          <View style={[styles.viewport, { width: viewportWidth }]}>
            <View style={styles.centerMarker} />
            <Animated.View style={[styles.track, { transform: [{ translateX: reelTranslate }] }]}>
              {reel.map((entry, index) => {
                const rarity = entry.rarity ?? "common";
                const isWinner = landed && index === WINNER_INDEX;
                const accent = getRarityColor(rarity);
                return (
                  <View
                    key={`${entry.id ?? entry.icon ?? entry.name}-${index}`}
                    style={[
                      styles.tile,
                      {
                        borderColor: isWinner ? accent : "rgba(255,255,255,0.12)",
                        backgroundColor: isWinner ? `${accent}22` : "rgba(8,13,22,0.9)",
                      },
                    ]}
                  >
                    <GameIcon
                      itemId={entry.id ?? null}
                      itemType={entry.type}
                      itemSlot={entry.slot}
                      itemSubclass={entry.subclass}
                      rarity={rarity}
                      name={entry.icon ?? "treasure-chest"}
                      size={40}
                      color={isWinner ? accent : colors.text}
                    />
                  </View>
                );
              })}
            </Animated.View>
          </View>

          {reward ? (
            <View style={styles.rewardPanel}>
              <Text style={styles.rewardTitle}>{normalizeItemText(reward.item.name)}</Text>
              <Text style={styles.rewardMeta}>
                {getRarityLabel(reward.rarity ?? reward.item.rarity)} | +{reward.luck_bonus_percent ?? 0}% luck bonus
              </Text>
            </View>
          ) : null}

          <Button
            label={isRolling ? "Рулетка крутится..." : "Забрать награду"}
            icon={isRolling ? "loading" : "treasure-chest"}
            disabled={isRolling}
            variant="gold"
            onPress={onClose}
          />
        </View>
      </View>
    </NativeModal>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: themeMode === "light" ? "rgba(31,41,55,0.28)" : "rgba(7,11,18,0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(183,121,31,0.42)" : "rgba(245,158,11,0.42)",
    backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.97)" : "rgba(10,15,25,0.97)",
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  viewport: {
    alignSelf: "center",
    height: TILE_WIDTH + 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.14)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(6,10,18,0.92)",
    overflow: "hidden",
    justifyContent: "center",
  },
  centerMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    left: "50%",
    marginLeft: -1,
    backgroundColor: "rgba(245,158,11,0.7)",
    zIndex: 2,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_WIDTH,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardPanel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeMode === "light" ? "rgba(214,199,170,0.9)" : "rgba(255,255,255,0.12)",
    backgroundColor: themeMode === "light" ? "rgba(251,247,239,0.95)" : "rgba(11,17,28,0.86)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  rewardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  rewardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  });
}
