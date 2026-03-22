import type { ImageSourcePropType } from "react-native";

import { getItemSourceAssetByName } from "./itemSourceCatalog";

function sourceAsset(name: string) {
  const asset = getItemSourceAssetByName(name);
  if (asset) {
    return asset;
  }

  const fallbackNames = name.startsWith("shop_chest_")
    ? ["shop_chest_rare"]
    : name.startsWith("weapon_")
      ? ["weapon_tile_1", "weapon_101", "weapon_201_steel_sword"]
      : name.startsWith("armor_")
        ? ["armor_1101_leather_armor", "armor_1102_chain_helmet"]
        : name.startsWith("accessory_")
          ? ["accessory_2101_copper_ring", "accessory_2102_leather_amulet"]
          : [];

  for (const fallbackName of fallbackNames) {
    const fallbackAsset = getItemSourceAssetByName(fallbackName);
    if (fallbackAsset) {
      return fallbackAsset;
    }
  }

  throw new Error(`Missing bundled item source asset: ${name}`);
}

const ITEM_ASSET_REGISTRY: Record<number, ImageSourcePropType> = {
  101: sourceAsset("weapon_101_rusty_sword"),
  102: sourceAsset("weapon_102_oak_bow"),
  103: sourceAsset("weapon_103_apprentice_staff"),
  104: sourceAsset("weapon_104_stone_axe"),
  105: sourceAsset("weapon_105_bone_dagger"),
  106: sourceAsset("weapon_106_recruit_mace"),
  201: sourceAsset("weapon_201_steel_sword"),
  202: sourceAsset("weapon_202_hunter_bow"),
  203: sourceAsset("weapon_203_magic_staff"),
  204: sourceAsset("weapon_204_battle_axe"),
  205: sourceAsset("weapon_205_greatsword"),
  206: sourceAsset("weapon_206_shadow_daggers"),
  301: sourceAsset("weapon_301_elven_blade"),
  302: sourceAsset("weapon_302_archmage_staff"),
  303: sourceAsset("weapon_303_two_handed_axe"),
  304: sourceAsset("weapon_304_longbow"),
  305: sourceAsset("weapon_305_spellbook"),
  401: sourceAsset("weapon_401_dragon_blade"),
  402: sourceAsset("weapon_402_phoenix_staff"),
  403: sourceAsset("weapon_403_storm_bow"),
  501: sourceAsset("weapon_501_excalibur"),
  502: sourceAsset("weapon_502_thunder_axe"),
  503: sourceAsset("weapon_503_eternity_staff"),
  504: sourceAsset("weapon_504_abyss_bow"),
  1101: sourceAsset("armor_1101_leather_armor"),
  1102: sourceAsset("armor_1102_chain_helmet"),
  1103: sourceAsset("armor_1103_cloth_leggings"),
  1104: sourceAsset("armor_1104_leather_gloves"),
  1105: sourceAsset("armor_1105_leather_boots"),
  1201: sourceAsset("armor_1201_steel_breastplate"),
  1202: sourceAsset("armor_1202_plate_shoulders"),
  1203: sourceAsset("armor_1203_mail_belt"),
  1204: sourceAsset("armor_1204_magic_robe"),
  1205: sourceAsset("armor_1205_ranger_hood"),
  1301: sourceAsset("armor_1301_full_plate"),
  1302: sourceAsset("armor_1302_dragon_belt"),
  1303: sourceAsset("armor_1303_shadow_cloak"),
  1304: sourceAsset("armor_1304_wizard_hat"),
  1305: sourceAsset("armor_1305_invisibility_cloak"),
  1401: sourceAsset("armor_1401_paladin_armor"),
  1402: sourceAsset("armor_1402_wind_mail"),
  1403: sourceAsset("armor_1403_archmage_robes"),
  1501: sourceAsset("armor_1501_immortal_armor"),
  1502: sourceAsset("armor_1502_shadow_armor"),
  1503: sourceAsset("armor_1503_prophet_robes"),
  2101: sourceAsset("accessory_2101_copper_ring"),
  2102: sourceAsset("accessory_2102_leather_amulet"),
  2201: sourceAsset("accessory_2201_ring_of_strength"),
  2202: sourceAsset("accessory_2202_amulet_of_agility"),
  2203: sourceAsset("accessory_2203_pendant_of_wisdom"),
  2301: sourceAsset("accessory_2301_critical_ring"),
  2302: sourceAsset("accessory_2302_lucky_amulet"),
  2303: sourceAsset("accessory_2303_magic_crystal"),
  2401: sourceAsset("accessory_2401_dragon_ring"),
  2402: sourceAsset("accessory_2402_phoenix_amulet"),
  2403: sourceAsset("accessory_2403_shadow_totem"),
  2501: sourceAsset("accessory_2501_ring_of_immortality"),
  2502: sourceAsset("accessory_2502_gods_amulet"),
  2503: sourceAsset("accessory_2503_soul_of_world"),
};

const WEAPON_ASSET_IDS = new Set<number>([
  101,
  102,
  103,
  104,
  105,
  106,
  201,
  202,
  203,
  204,
  205,
  206,
  301,
  302,
  303,
  304,
  305,
  401,
  402,
  403,
  501,
  502,
  503,
  504,
]);

const CHEST_ASSETS: Record<string, ImageSourcePropType> = {
  common: sourceAsset("shop_chest_common"),
  uncommon: sourceAsset("shop_chest_rare"),
  rare: sourceAsset("shop_chest_rare"),
  epic: sourceAsset("shop_chest_epic"),
  legendary: sourceAsset("shop_chest_legendary"),
  immortal: sourceAsset("shop_chest_legendary"),
};

export type ItemAssetContext = {
  itemType?: string | null;
  rarity?: string | null;
  itemSlot?: string | null;
  itemSubclass?: string | null;
};

function normalizeToken(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const ICON_ALIAS_ASSETS: Record<string, ImageSourcePropType> = {
  sword: sourceAsset("weapon_101_rusty_sword"),
  shield: sourceAsset("weapon_305_spellbook"),
  spellbook: sourceAsset("weapon_305_spellbook"),
  book_open_variant: sourceAsset("weapon_305_spellbook"),
  bow: sourceAsset("weapon_102_oak_bow"),
  bow_arrow: sourceAsset("weapon_102_oak_bow"),
  staff: sourceAsset("weapon_103_apprentice_staff"),
  magic_staff: sourceAsset("weapon_103_apprentice_staff"),
  axe: sourceAsset("weapon_104_stone_axe"),
  dagger: sourceAsset("weapon_105_bone_dagger"),
  daggers: sourceAsset("weapon_206_shadow_daggers"),
  mace: sourceAsset("weapon_106_recruit_mace"),
  hammer_sledge: sourceAsset("weapon_106_recruit_mace"),
  chest_armor: sourceAsset("armor_1101_leather_armor"),
  hood: sourceAsset("armor_1205_ranger_hood"),
  wizard_hat: sourceAsset("armor_1304_wizard_hat"),
  robe: sourceAsset("armor_1204_magic_robe"),
  helmet: sourceAsset("armor_1102_chain_helmet"),
  glove: sourceAsset("armor_1104_leather_gloves"),
  boots: sourceAsset("armor_1105_leather_boots"),
  belt: sourceAsset("armor_1203_mail_belt"),
  cloak: sourceAsset("armor_1303_shadow_cloak"),
  ring: sourceAsset("accessory_2101_copper_ring"),
  amulet: sourceAsset("accessory_2102_leather_amulet"),
  necklace: sourceAsset("accessory_2102_leather_amulet"),
  pendant: sourceAsset("accessory_2203_pendant_of_wisdom"),
  crystal: sourceAsset("accessory_2303_magic_crystal"),
  totem: sourceAsset("accessory_2403_shadow_totem"),
  trinket: sourceAsset("accessory_2303_magic_crystal"),
  h1: sourceAsset("armor_1102_chain_helmet"),
  h2: sourceAsset("armor_1205_ranger_hood"),
  h3: sourceAsset("armor_1304_wizard_hat"),
  h4: sourceAsset("armor_1205_ranger_hood"),
  h5: sourceAsset("armor_1304_wizard_hat"),
  c1: sourceAsset("armor_1101_leather_armor"),
  c2: sourceAsset("armor_1204_magic_robe"),
  c3: sourceAsset("armor_1201_steel_breastplate"),
  c4: sourceAsset("armor_1401_paladin_armor"),
  c5: sourceAsset("armor_1501_immortal_armor"),
  s1: sourceAsset("armor_1202_plate_shoulders"),
  s2: sourceAsset("armor_1202_plate_shoulders"),
  s3: sourceAsset("armor_1202_plate_shoulders"),
  s4: sourceAsset("armor_1202_plate_shoulders"),
  s5: sourceAsset("armor_1202_plate_shoulders"),
  p1: sourceAsset("armor_1103_cloth_leggings"),
  p2: sourceAsset("armor_1103_cloth_leggings"),
  p3: sourceAsset("armor_1103_cloth_leggings"),
  p4: sourceAsset("armor_1103_cloth_leggings"),
  p5: sourceAsset("armor_1103_cloth_leggings"),
  l1: sourceAsset("armor_1105_leather_boots"),
  l2: sourceAsset("armor_1105_leather_boots"),
  l3: sourceAsset("armor_1105_leather_boots"),
  l4: sourceAsset("armor_1105_leather_boots"),
  l5: sourceAsset("armor_1105_leather_boots"),
};

const SLOT_FALLBACK_ASSETS: Record<string, ImageSourcePropType> = {
  weapon: sourceAsset("weapon_101_rusty_sword"),
  main_hand: sourceAsset("weapon_101_rusty_sword"),
  off_hand: sourceAsset("weapon_305_spellbook"),
  ranged: sourceAsset("weapon_102_oak_bow"),
  weapon_sword: sourceAsset("weapon_101_rusty_sword"),
  weapon_bow: sourceAsset("weapon_102_oak_bow"),
  weapon_staff: sourceAsset("weapon_103_apprentice_staff"),
  weapon_axe: sourceAsset("weapon_104_stone_axe"),
  weapon_dagger: sourceAsset("weapon_105_bone_dagger"),
  weapon_daggers: sourceAsset("weapon_206_shadow_daggers"),
  weapon_mace: sourceAsset("weapon_106_recruit_mace"),
  weapon_spellbook: sourceAsset("weapon_305_spellbook"),
  weapon_main_hand: sourceAsset("weapon_101_rusty_sword"),
  weapon_off_hand: sourceAsset("weapon_305_spellbook"),
  weapon_ranged: sourceAsset("weapon_102_oak_bow"),
  armor_head: sourceAsset("armor_1102_chain_helmet"),
  armor_shoulders: sourceAsset("armor_1202_plate_shoulders"),
  armor_chest: sourceAsset("armor_1101_leather_armor"),
  armor_wrist: sourceAsset("armor_1104_leather_gloves"),
  armor_hands: sourceAsset("armor_1104_leather_gloves"),
  armor_waist: sourceAsset("armor_1203_mail_belt"),
  armor_belt: sourceAsset("armor_1203_mail_belt"),
  armor_legs: sourceAsset("armor_1103_cloth_leggings"),
  armor_pants: sourceAsset("armor_1103_cloth_leggings"),
  armor_feet: sourceAsset("armor_1105_leather_boots"),
  armor_back: sourceAsset("armor_1303_shadow_cloak"),
  armor_cloak: sourceAsset("armor_1303_shadow_cloak"),
  armor_boots: sourceAsset("armor_1105_leather_boots"),
  accessory_neck: sourceAsset("accessory_2102_leather_amulet"),
  accessory_necklace: sourceAsset("accessory_2102_leather_amulet"),
  accessory_ring: sourceAsset("accessory_2101_copper_ring"),
  accessory_ring1: sourceAsset("accessory_2101_copper_ring"),
  accessory_ring2: sourceAsset("accessory_2101_copper_ring"),
  accessory_trinket: sourceAsset("accessory_2303_magic_crystal"),
  accessory_trinket1: sourceAsset("accessory_2303_magic_crystal"),
  accessory_trinket2: sourceAsset("accessory_2303_magic_crystal"),
  accessory_amulet: sourceAsset("accessory_2102_leather_amulet"),
  accessory_pendant: sourceAsset("accessory_2203_pendant_of_wisdom"),
  accessory_crystal: sourceAsset("accessory_2303_magic_crystal"),
  accessory_totem: sourceAsset("accessory_2403_shadow_totem"),
};

function getSemanticFallback(context?: ItemAssetContext, iconName?: string | null) {
  const iconAlias = ICON_ALIAS_ASSETS[normalizeToken(iconName)];
  if (iconAlias) {
    return iconAlias;
  }

  const subclassKey = normalizeToken(context?.itemSubclass);
  const slotKey = normalizeToken(context?.itemSlot);
  const typeKey = normalizeToken(context?.itemType);

  if (typeKey && subclassKey) {
    const typedSubclass = SLOT_FALLBACK_ASSETS[`${typeKey}_${subclassKey}`];
    if (typedSubclass) {
      return typedSubclass;
    }
  }

  if (typeKey && slotKey) {
    const typedSlot = SLOT_FALLBACK_ASSETS[`${typeKey}_${slotKey}`];
    if (typedSlot) {
      return typedSlot;
    }
  }

  if (subclassKey && SLOT_FALLBACK_ASSETS[subclassKey]) {
    return SLOT_FALLBACK_ASSETS[subclassKey];
  }

  if (slotKey && SLOT_FALLBACK_ASSETS[slotKey]) {
    return SLOT_FALLBACK_ASSETS[slotKey];
  }

  if (typeKey && SLOT_FALLBACK_ASSETS[typeKey]) {
    return SLOT_FALLBACK_ASSETS[typeKey];
  }

  return null;
}

export function getItemAsset(itemId?: number | null, context?: ItemAssetContext, iconName?: string | null) {
  const namedAsset = getItemSourceAssetByName(iconName);
  if (namedAsset) {
    return namedAsset;
  }

  const semanticFallback = getSemanticFallback(context, iconName);
  if (semanticFallback) {
    return semanticFallback;
  }

  if (itemId && ITEM_ASSET_REGISTRY[itemId]) {
    return ITEM_ASSET_REGISTRY[itemId];
  }

  if (context?.itemType === "chest") {
    return CHEST_ASSETS[context.rarity ?? "common"] ?? CHEST_ASSETS.common;
  }

  return null;
}

export function hasItemAsset(itemId?: number | null, context?: ItemAssetContext) {
  return Boolean(getItemAsset(itemId, context));
}

export function isWeaponAsset(itemId?: number | null) {
  return Boolean(itemId && WEAPON_ASSET_IDS.has(itemId));
}

export function getItemAssetScale(itemId?: number | null, context?: ItemAssetContext) {
  return 1.2;
}
