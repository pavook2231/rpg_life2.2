import React, { useMemo } from "react";
import { Image, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export type Equipment = {
  head?: string;
  shoulders?: string;
  chest?: string;
  wrists?: string;
  belt?: string;
  legs?: string;
  boots?: string;
  cloak?: string;
  weapon?: string;
};

type EquipmentSlot = keyof Equipment;

type LayeredEquipmentAsset = {
  main?: ImageSourcePropType;
  front?: ImageSourcePropType;
  back?: ImageSourcePropType;
};

type EquipmentRegistry = Partial<Record<EquipmentSlot, Record<string, LayeredEquipmentAsset>>>;

type CharacterLayer = {
  key: string;
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
};

type CharacterViewProps = {
  equipment: Equipment;
  characterClass?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const BASE_CHARACTER_SOURCE = require("../../assets/characters/base.png");
const CLASS_BASE_SOURCES: Record<string, ImageSourcePropType> = {
  warrior: require("../../assets/characters/warrior_base.png"),
  archer: require("../../assets/characters/archer_base.png"),
  mage: require("../../assets/characters/mage_base.png"),
};

const CLASS_BASE_STYLES: Record<string, StyleProp<ImageStyle>> = {
  archer: {
    transform: [{ scale: 2.15 }, { translateY: 10 }],
  },
};

/**
 * React Native / Expo cannot reliably require local PNG files from a runtime string path.
 * The registry below is the safe way to bind an item id to a bundled PNG layer.
 *
 * Add new items here as you add files to assets/equipment/*.
 */
export const CHARACTER_EQUIPMENT_ASSETS: EquipmentRegistry = {
  head: {
    helmet1: {
      main: require("../../assets/equipment/head/helmet1.png"),
    },
  },
  shoulders: {
    shoulders1: {
      main: require("../../assets/equipment/shoulders/shoulders1.png"),
    },
  },
  chest: {
    armor1: {
      back: require("../../assets/equipment/chest/armor1_back.png"),
      front: require("../../assets/equipment/chest/armor1_front.png"),
    },
  },
  wrists: {
    wrists1: {
      main: require("../../assets/equipment/wrists/wrists1.png"),
    },
  },
  belt: {
    belt1: {
      main: require("../../assets/equipment/belt/belt1.png"),
    },
  },
  legs: {
    pants1: {
      main: require("../../assets/equipment/legs/pants1.png"),
    },
  },
  boots: {
    boots1: {
      main: require("../../assets/equipment/boots/boots1.png"),
    },
  },
  cloak: {
    cloak1: {
      main: require("../../assets/equipment/cloak/cloak1.png"),
    },
  },
  weapon: {
    sword1: {
      main: require("../../assets/equipment/weapons/sword1.png"),
    },
  },
};

function resolveEquipmentAsset(slot: EquipmentSlot, itemId?: string): LayeredEquipmentAsset | null {
  if (!itemId) {
    return null;
  }

  // Missing layered art should fail quietly so beta builds don't spam device logs.
  return CHARACTER_EQUIPMENT_ASSETS[slot]?.[itemId] ?? null;
}

function buildLayers(equipment: Equipment, characterClass?: string): CharacterLayer[] {
  const baseSource = (characterClass && CLASS_BASE_SOURCES[characterClass]) || BASE_CHARACTER_SOURCE;
  const baseStyle = (characterClass && CLASS_BASE_STYLES[characterClass]) || undefined;
  const layers: CharacterLayer[] = [{ key: "base", source: baseSource, style: baseStyle }];

  const legs = resolveEquipmentAsset("legs", equipment.legs);
  if (legs?.main) {
    layers.push({ key: `legs:${equipment.legs}`, source: legs.main });
  }

  const boots = resolveEquipmentAsset("boots", equipment.boots);
  if (boots?.main) {
    layers.push({ key: `boots:${equipment.boots}`, source: boots.main });
  }

  const belt = resolveEquipmentAsset("belt", equipment.belt);
  if (belt?.main) {
    layers.push({ key: `belt:${equipment.belt}`, source: belt.main });
  }

  const chest = resolveEquipmentAsset("chest", equipment.chest);
  if (chest?.back) {
    layers.push({ key: `chest_back:${equipment.chest}`, source: chest.back });
  }
  if (chest?.front) {
    layers.push({ key: `chest_front:${equipment.chest}`, source: chest.front });
  } else if (chest?.main) {
    layers.push({ key: `chest:${equipment.chest}`, source: chest.main });
  }

  const wrists = resolveEquipmentAsset("wrists", equipment.wrists);
  if (wrists?.main) {
    layers.push({ key: `wrists:${equipment.wrists}`, source: wrists.main });
  }

  const shoulders = resolveEquipmentAsset("shoulders", equipment.shoulders);
  if (shoulders?.main) {
    layers.push({ key: `shoulders:${equipment.shoulders}`, source: shoulders.main });
  }

  const cloak = resolveEquipmentAsset("cloak", equipment.cloak);
  if (cloak?.main) {
    layers.push({ key: `cloak:${equipment.cloak}`, source: cloak.main });
  }

  const head = resolveEquipmentAsset("head", equipment.head);
  if (head?.main) {
    layers.push({ key: `head:${equipment.head}`, source: head.main });
  }

  const weapon = resolveEquipmentAsset("weapon", equipment.weapon);
  if (weapon?.main) {
    layers.push({ key: `weapon:${equipment.weapon}`, source: weapon.main });
  }

  return layers;
}

export function CharacterView({ equipment, characterClass, size = 320, style }: CharacterViewProps) {
  const layers = useMemo(() => buildLayers(equipment, characterClass), [characterClass, equipment]);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {layers.map((layer) => (
        <Image key={layer.key} source={layer.source} resizeMode="contain" style={[styles.layer, layer.style]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignSelf: "center",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
