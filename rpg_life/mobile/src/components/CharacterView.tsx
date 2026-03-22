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

const HEAD_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/head/helmet1.png"),
};

const SHOULDERS_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/shoulders/shoulders1.png"),
};

const CHEST_LAYER: LayeredEquipmentAsset = {
  back: require("../../assets/equipment/chest/armor1_back.png"),
  front: require("../../assets/equipment/chest/armor1_front.png"),
};

const WRISTS_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/wrists/wrists1.png"),
};

const BELT_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/belt/belt1.png"),
};

const LEGS_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/legs/pants1.png"),
};

const BOOTS_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/boots/boots1.png"),
};

const CLOAK_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/cloak/cloak1.png"),
};

const WEAPON_LAYER: LayeredEquipmentAsset = {
  main: require("../../assets/equipment/weapons/sword1.png"),
};

function aliasEntries(asset: LayeredEquipmentAsset, aliases: string[]) {
  return Object.fromEntries(aliases.map((alias) => [alias, asset])) as Record<string, LayeredEquipmentAsset>;
}

/**
 * React Native / Expo cannot reliably require local PNG files from a runtime string path.
 * The registry below is the safe way to bind an item id to a bundled PNG layer.
 *
 * Add new items here as you add files to assets/equipment/*.
 */
export const CHARACTER_EQUIPMENT_ASSETS: EquipmentRegistry = {
  head: {
    helmet1: HEAD_LAYER,
    ...aliasEntries(HEAD_LAYER, [
      "armor_1102_chain_helmet",
      "armor_1205_ranger_hood",
      "armor_1304_wizard_hat",
      "head_2",
      "e9c20b70_8880_41ec_a452_aba7dd27a517",
      "hood",
      "helmet",
      "wizard_hat",
    ]),
  },
  shoulders: {
    shoulders1: SHOULDERS_LAYER,
    ...aliasEntries(SHOULDERS_LAYER, ["armor_1202_plate_shoulders", "shoulders"]),
  },
  chest: {
    armor1: CHEST_LAYER,
    ...aliasEntries(CHEST_LAYER, [
      "armor_1101_leather_armor",
      "armor_1201_steel_breastplate",
      "armor_1204_magic_robe",
      "armor_1301_full_plate",
      "armor_1401_paladin_armor",
      "armor_1402_wind_mail",
      "armor_1403_archmage_robes",
      "armor_1501_immortal_armor",
      "armor_1502_shadow_armor",
      "armor_1503_prophet_robes",
      "chest_armor",
      "robe",
      "armor",
    ]),
  },
  wrists: {
    wrists1: WRISTS_LAYER,
    ...aliasEntries(WRISTS_LAYER, [
      "armor_1104_leather_gloves",
      "gloves1",
      "gloves2",
      "gloves_black",
      "gloves_green",
      "gloves_red",
      "glove",
      "gloves",
    ]),
  },
  belt: {
    belt1: BELT_LAYER,
    ...aliasEntries(BELT_LAYER, [
      "armor_1203_mail_belt",
      "armor_1302_dragon_belt",
      "poyas",
      "poyas1",
      "poyas2",
      "poyas3",
      "poyas_purple",
      "belt",
    ]),
  },
  legs: {
    pants1: LEGS_LAYER,
    ...aliasEntries(LEGS_LAYER, ["armor_1103_cloth_leggings", "pants", "leggings"]),
  },
  boots: {
    boots1: BOOTS_LAYER,
    ...aliasEntries(BOOTS_LAYER, ["armor_1105_leather_boots", "boots"]),
  },
  cloak: {
    cloak1: CLOAK_LAYER,
    ...aliasEntries(CLOAK_LAYER, [
      "armor_1303_shadow_cloak",
      "armor_1305_invisibility_cloak",
      "plash_blue",
      "plash_gray",
      "plash_green",
      "plash_purple",
      "plash_red",
      "cloak",
    ]),
  },
  weapon: {
    sword1: WEAPON_LAYER,
    ...aliasEntries(WEAPON_LAYER, [
      "weapon_101",
      "weapon_101_rusty_sword",
      "weapon_104",
      "weapon_104_stone_axe",
      "weapon_105",
      "weapon_105_bone_dagger",
      "weapon_106",
      "weapon_106_recruit_mace",
      "weapon_201_steel_sword",
      "weapon_204",
      "weapon_204_battle_axe",
      "weapon_205",
      "weapon_205_greatsword",
      "weapon_206",
      "weapon_206_shadow_daggers",
      "weapon_301_elven_blade",
      "weapon_401",
      "weapon_401_dragon_blade",
      "weapon_501_excalibur",
      "weapon_502",
      "weapon_502_thunder_axe",
      "sword",
      "blade",
      "axe",
      "dagger",
      "daggers",
      "mace",
      "greatsword",
    ]),
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
