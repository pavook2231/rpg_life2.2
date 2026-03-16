import type { ImageSourcePropType } from "react-native";

type SectionKey =
  | "weapons"
  | "weapon-components"
  | "armor"
  | "armor-parts"
  | "accessories"
  | "rings"
  | "trinkets"
  | "chests"
  | "misc"
  | "armory";

type SectionMeta = {
  title: string;
  description: string;
  accent: string;
};

export type ItemSourceEntry = {
  key: string;
  label: string;
  source: ImageSourcePropType;
  path: string;
  sectionKey: SectionKey;
  aliases: string[];
};

export type ItemSourceSection = SectionMeta & {
  key: SectionKey;
  items: ItemSourceEntry[];
};

const SECTION_ORDER: SectionKey[] = [
  "weapons",
  "weapon-components",
  "armor",
  "armor-parts",
  "accessories",
  "rings",
  "trinkets",
  "chests",
  "misc",
  "armory",
];

const SECTION_META: Record<SectionKey, SectionMeta> = {
  weapons: {
    title: "Оружие и наборы",
    description: "Боевые иконки, альтернативные варианты оружия и базовые weapon tiles.",
    accent: "#f59e0b",
  },
  "weapon-components": {
    title: "Компоненты оружия",
    description: "Исходники деталей и компонентов для будущего крафта и визуальных наборов.",
    accent: "#fb7185",
  },
  armor: {
    title: "Броня",
    description: "Основные комплекты брони, плащи, шлемы и high-tier доспехи.",
    accent: "#38bdf8",
  },
  "armor-parts": {
    title: "Части брони",
    description: "Отдельные belt/head/cloak/glove исходники для экипировки и paper-doll слоев.",
    accent: "#60a5fa",
  },
  accessories: {
    title: "Аксессуары",
    description: "Полная витрина амулетов, тотемов и accessory-наборов по редкостям.",
    accent: "#a78bfa",
  },
  rings: {
    title: "Кольца",
    description: "Отдельные ring-ассеты для предметов, которые лучше читаются как украшения.",
    accent: "#f472b6",
  },
  trinkets: {
    title: "Талисманы",
    description: "Амулеты, подвески и кристаллы для магических и utility-предметов.",
    accent: "#34d399",
  },
  chests: {
    title: "Сундуки",
    description: "Common, rare, epic и legendary chest-исходники для витрины и наград.",
    accent: "#fbbf24",
  },
  misc: {
    title: "Misc-предметы",
    description: "Расходники и вспомогательные исходники, которые раньше не были видны в приложении.",
    accent: "#22c55e",
  },
  armory: {
    title: "Armory набор",
    description: "Большие декоративные иконки для будущих витрин, складов и тематических экранов.",
    accent: "#c084fc",
  },
};

function getSectionKey(path: string): SectionKey {
  if (path.startsWith("weapons/components/")) {
    return "weapon-components";
  }
  if (path.startsWith("weapons/") || path.startsWith("daggers/")) {
    return "weapons";
  }
  if (path.startsWith("armor/")) {
    return "armor";
  }
  if (
    path.startsWith("belts/")
    || path.startsWith("cloaks/")
    || path.startsWith("heads/")
    || path.startsWith("gloves/")
  ) {
    return "armor-parts";
  }
  if (path.startsWith("accessories/")) {
    return "accessories";
  }
  if (path.startsWith("rings/")) {
    return "rings";
  }
  if (path.startsWith("trinkets/")) {
    return "trinkets";
  }
  if (path.startsWith("chests/")) {
    return "chests";
  }
  if (path.startsWith("misc/")) {
    return "misc";
  }
  return "armory";
}

function normalizeAssetToken(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^\.?\//, "")
    .replace(/\.(png|webp|jpg|jpeg)$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Keep legacy item names working after source cleanup by pointing them at the
// surviving bundled assets from the same icon packs.
const LEGACY_SOURCE_ALIASES: Record<string, string> = {
  dagger: "dagger",
  daggers: "dagger_purple",
  glove: "gloves1",
  gloves: "gloves1",
  belt: "poyas1",
  waist: "poyas1",
  weapon_101_rusty_sword: "weapon_101",
  weapon_102_oak_bow: "weapon_102",
  weapon_104_stone_axe: "weapon_104",
  weapon_105_bone_dagger: "dagger1",
  weapon_106_recruit_mace: "weapon_104",
  weapon_203_magic_staff: "weapon_203",
  weapon_204_battle_axe: "weapon_204",
  weapon_205_greatsword: "weapon_201_steel_sword",
  weapon_206_shadow_daggers: "dagger_purple",
  weapon_302_archmage_staff: "weapon_302",
  weapon_303_two_handed_axe: "weapon_303",
  weapon_304_longbow: "weapon_304",
  weapon_401_dragon_blade: "weapon_401",
  weapon_402_phoenix_staff: "weapon_302",
  weapon_403_storm_bow: "weapon_403",
  weapon_502_thunder_axe: "weapon_502",
  weapon_503_eternity_staff: "weapon_503",
  weapon_504_abyss_bow: "weapon_504",
  armor_1103_cloth_leggings: "armor_r3c2",
  armor_1104_leather_gloves: "gloves1",
  armor_1105_leather_boots: "armor_r3c5",
  armor_1201_steel_breastplate: "armor_1301_full_plate",
  armor_1202_plate_shoulders: "armor_1301_full_plate",
  armor_1203_mail_belt: "poyas1",
  armor_1204_magic_robe: "armor_1101_leather_armor",
  armor_1302_dragon_belt: "poyas_purple",
  armor_1303_shadow_cloak: "plash_purple",
  armor_1305_invisibility_cloak: "plash_gray",
  armor_1401_paladin_armor: "armor_1301_full_plate",
  armor_1402_wind_mail: "armor_1101_leather_armor",
  armor_1403_archmage_robes: "armor_1501_immortal_armor",
  armor_1502_shadow_armor: "armor_1501_immortal_armor",
  armor_1503_prophet_robes: "armor_1501_immortal_armor",
  accessory_2202_amulet_of_agility: "accessory_2102_leather_amulet",
  accessory_2303_magic_crystal: "accessory_2503_soul_of_world",
  accessory_2402_phoenix_amulet: "accessory_2102_leather_amulet",
  accessory_2502_gods_amulet: "accessory_2503_soul_of_world",
  shop_chest_common: "shop_chest_rare",
  shop_chest_uncommon: "shop_chest_rare",
};

function buildAliases(path: string, baseName: string) {
  const aliases = new Set<string>();
  const normalizedPath = normalizeAssetToken(path);
  const normalizedBaseName = normalizeAssetToken(baseName);
  if (normalizedPath) aliases.add(normalizedPath);
  if (normalizedBaseName) aliases.add(normalizedBaseName);

  const parts = normalizedBaseName.split("_").filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[1] ?? "")) {
    aliases.add(`${parts[0]}_${parts[1]}`);
  }

  if (parts.length >= 3) {
    aliases.add(parts.slice(2).join("_"));
  }

  if (normalizedBaseName.startsWith("shop_")) {
    aliases.add(normalizedBaseName.replace(/^shop_/, ""));
  }

  return [...aliases];
}

function prettifyLabel(value: string) {
  return value
    .replace(/\.(png|webp|jpg|jpeg)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const context = require.context("../../assets/item-icons", true, /\.(png|webp)$/);

const ITEM_SOURCE_ENTRIES: ItemSourceEntry[] = context
  .keys()
  .map((assetPath) => {
    const normalizedPath = assetPath.replace(/^\.\//, "");
    const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
    const baseName = fileName.replace(/\.(png|webp|jpg|jpeg)$/i, "");
    const moduleValue = context<number | { default?: number }>(assetPath);
    const source = typeof moduleValue === "number" ? moduleValue : (moduleValue.default ?? 0);

    return {
      key: `${normalizedPath}-${baseName}`,
      label: prettifyLabel(baseName),
      source,
      path: normalizedPath,
      sectionKey: getSectionKey(normalizedPath),
      aliases: buildAliases(normalizedPath, baseName),
    };
  })
  .sort((left, right) => {
    const sectionDelta = SECTION_ORDER.indexOf(left.sectionKey) - SECTION_ORDER.indexOf(right.sectionKey);
    if (sectionDelta !== 0) return sectionDelta;
    return left.path.localeCompare(right.path);
  });

export const ITEM_SOURCE_LOOKUP = ITEM_SOURCE_ENTRIES.reduce<Record<string, ImageSourcePropType>>((acc, entry) => {
  entry.aliases.forEach((alias) => {
    acc[alias] = entry.source;
  });
  return acc;
}, {});

export const ITEM_SOURCE_SECTIONS: ItemSourceSection[] = SECTION_ORDER.map((sectionKey) => ({
  key: sectionKey,
  ...SECTION_META[sectionKey],
  items: ITEM_SOURCE_ENTRIES.filter((entry) => entry.sectionKey === sectionKey),
}));

export function getItemSourceAssetByName(name?: string | null) {
  const normalizedName = normalizeAssetToken(name);
  if (!normalizedName) {
    return null;
  }
  const directAsset = ITEM_SOURCE_LOOKUP[normalizedName];
  if (directAsset) {
    return directAsset;
  }

  const legacyAlias = LEGACY_SOURCE_ALIASES[normalizedName];
  if (!legacyAlias) {
    return null;
  }

  return ITEM_SOURCE_LOOKUP[legacyAlias] ?? null;
}

export function getItemSourceEntries() {
  return ITEM_SOURCE_ENTRIES;
}
