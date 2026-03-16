import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Image, Text } from "react-native";

import { getItemAsset, getItemAssetScale } from "../lib/itemAssetRegistry";
import { getStatAsset } from "../lib/statAssetRegistry";
import { colors } from "./theme";

type Props = {
  name: string;
  size?: number;
  color?: string;
  itemId?: number | null;
  itemType?: string | null;
  itemSlot?: string | null;
  itemSubclass?: string | null;
  rarity?: string | null;
};

const ICON_ALIASES: Record<string, string> = {
  "store-refresh": "refresh",
};

const FALLBACK_ICON = "help-circle-outline";
const STAT_TRANSFORMS: Record<string, { scale?: number; translateX?: number; translateY?: number }> = {
  strength: { scale: 1.08, translateX: 1, translateY: 1 },
  agility: { scale: 1.08, translateX: -1, translateY: 2 },
  intellect: { scale: 1.08, translateY: -1 },
  stamina: { scale: 1.04, translateY: 0 },
  crit: { scale: 1.04, translateX: -1, translateY: 1 },
  flash: { scale: 1.04, translateX: -1, translateY: 1 },
  mana: {
    scale: 1.04,
    translateX: -1,
    translateY: 1,
  },
  "auto-fix": {
    scale: 1.04,
    translateX: -1,
    translateY: 1,
  },
  auto_fix: {
    scale: 1.04,
    translateX: -1,
    translateY: 1,
  },
  armor: { scale: 1.04, translateY: 0 },
  luck: { scale: 1.04, translateX: -1, translateY: 2 },
  clover: { scale: 1.04, translateX: -1, translateY: 2 },
};
const STAT_ASSET_SIZE_MULTIPLIER = 1.25;

export function GameIcon({ name, size = 22, color = colors.text, itemId, itemType, itemSlot, itemSubclass, rarity }: Props) {
  const iconName = String(name || "").trim() || "package-variant";
  const context = { itemType, itemSlot, itemSubclass, rarity };
  const itemAsset = getItemAsset(itemId, context, iconName);
  if (itemAsset) {
    const assetSize = Math.round(size * getItemAssetScale(itemId, context));
    return <Image source={itemAsset} style={{ width: assetSize, height: assetSize, resizeMode: "contain" }} />;
  }

  const statAsset = getStatAsset(iconName);
  if (statAsset) {
    const normalizedName = iconName.toLowerCase().replace(/[-\s]/g, "_");
    const transform = STAT_TRANSFORMS[iconName] ?? STAT_TRANSFORMS[normalizedName] ?? { scale: 1.04, translateX: 0, translateY: -2 };
    const statSize = Math.round(size * STAT_ASSET_SIZE_MULTIPLIER);
    return (
      <Image
        source={statAsset}
        style={{
          width: statSize,
          height: statSize,
          resizeMode: "contain",
          transform: [
            { scale: transform.scale ?? 1 },
            { translateX: transform.translateX ?? 0 },
            { translateY: transform.translateY ?? 0 },
          ],
        }}
      />
    );
  }

  // Render emoji/string icons directly when they are provided by server content.
  if (iconName.length <= 3 && /[^\x00-\x7F]/.test(iconName)) {
    return <Text style={{ fontSize: size, color }}>{iconName}</Text>;
  }

  const resolvedName = ICON_ALIASES[iconName] ?? iconName;

  if (Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, resolvedName)) {
    return <MaterialCommunityIcons name={resolvedName as never} size={size} color={color} />;
  }

  if (Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, FALLBACK_ICON)) {
    return <MaterialCommunityIcons name={FALLBACK_ICON as never} size={size} color={color} />;
  }

  return <Text style={{ fontSize: size, color }}>?</Text>;
}
