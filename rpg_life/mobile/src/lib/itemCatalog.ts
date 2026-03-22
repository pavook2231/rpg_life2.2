import type { ItemStatEntry } from "./equipment";
import { getItemSourceAssetByName, getItemSourceEntries, type ItemSourceEntry } from "./itemSourceCatalog";

type ItemCategory = "weapon" | "armor" | "accessory" | "chest" | "misc";
type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "immortal";

const RARITY_RANK: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  immortal: 5,
};

const RARITY_PRICE_BASE: Record<ItemRarity, number> = {
  common: 90,
  uncommon: 170,
  rare: 320,
  epic: 560,
  legendary: 900,
  immortal: 1300,
};

const RARITY_LEVEL_BASE: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 4,
  rare: 10,
  epic: 18,
  legendary: 28,
  immortal: 40,
};

const RARITY_LEVEL_FLOOR: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 3,
  rare: 8,
  epic: 16,
  legendary: 26,
  immortal: 38,
};

const RARITY_LEVEL_FLOOR_ARMOR: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 6,
  epic: 12,
  legendary: 20,
  immortal: 30,
};

const THEME_WORDS = [
  "Рассвета",
  "Сумерек",
  "Шторма",
  "Пепла",
  "Северного Ветра",
  "Теней",
  "Луны",
  "Солнца",
  "Бездны",
  "Стража",
  "Охотника",
  "Мудреца",
  "Дракона",
  "Феникса",
  "Рун",
  "Льда",
  "Искр",
  "Грозы",
  "Ночи",
  "Звезд",
];

const EXACT_BASE_NAMES: Record<string, string> = {
  dagger: "Кинжал послушника",
  dagger1: "Костяной кинжал",
  dagger2: "Кинжал ночного охотника",
  dagger3: "Кинжал капитана стражи",
  dagger_purple: "Аметистовый кинжал",
  weapon_101: "Клинок новобранца",
  weapon_102: "Лук следопыта",
  weapon_103_apprentice_staff: "Посох ученика",
  weapon_104: "Топор дозорного",
  weapon_201_steel_sword: "Стальной меч",
  weapon_202_hunter_bow: "Охотничий лук",
  weapon_203: "Посох рун",
  weapon_204: "Секира стража",
  weapon_301_elven_blade: "Эльфийский клинок",
  weapon_302: "Посох архимага",
  weapon_303: "Двуручная секира",
  weapon_304: "Дальний лук",
  weapon_305_spellbook: "Гримуар искр",
  weapon_401: "Клинок дракона",
  weapon_403: "Лук бури",
  weapon_501_excalibur: "Экскалибур",
  weapon_502: "Грозовая секира",
  weapon_503: "Посох вечности",
  weapon_504: "Лук бездны",
  armor_1101_leather_armor: "Кожаный доспех",
  armor_1301_full_plate: "Полные латы",
  armor_1501_immortal_armor: "Бессмертный доспех",
  armor_1102_chain_helmet: "Кольчужный шлем",
  armor_1205_ranger_hood: "Капюшон следопыта",
  armor_1304_wizard_hat: "Шляпа мага",
  accessory_2101_copper_ring: "Медное кольцо",
  accessory_2201_ring_of_strength: "Кольцо силы",
  accessory_2301_critical_ring: "Кольцо точности",
  accessory_2401_dragon_ring: "Кольцо дракона",
  accessory_2501_ring_of_immortality: "Кольцо бессмертия",
  accessory_2102_leather_amulet: "Кожаный амулет",
  accessory_2203_pendant_of_wisdom: "Подвеска мудреца",
  accessory_2302_lucky_amulet: "Амулет удачи",
  accessory_2403_shadow_totem: "Тотем теней",
  accessory_2503_soul_of_world: "Душа мира",
  shop_chest_rare: "Редкий сундук",
  shop_chest_epic: "Эпический сундук",
  shop_chest_legendary: "Легендарный сундук",
  gloves1: "Кожаные перчатки",
  gloves2: "Укрепленные перчатки",
  gloves_black: "Черные перчатки",
  gloves_green: "Изумрудные перчатки",
  gloves_red: "Алые перчатки",
  poyas: "Пояс новобранца",
  poyas1: "Стальной пояс",
  poyas2: "Пояс следопыта",
  poyas3: "Пояс хранителя",
  poyas_purple: "Аметистовый пояс",
  head_2: "Боевой шлем",
  e9c20b70_8880_41ec_a452_aba7dd27a517: "Шлем стража",
};

const BASE_RARITY_OVERRIDES: Record<string, ItemRarity> = {
  dagger: "common",
  dagger1: "uncommon",
  dagger2: "rare",
  dagger3: "rare",
  dagger_purple: "epic",
  gloves1: "common",
  gloves2: "uncommon",
  gloves_black: "rare",
  gloves_green: "rare",
  gloves_red: "epic",
  poyas: "common",
  poyas1: "uncommon",
  poyas2: "rare",
  poyas3: "epic",
  poyas_purple: "epic",
};

const COLOR_WORDS: Array<{ token: string; title: string }> = [
  { token: "red", title: "Алый" },
  { token: "blue", title: "Лазурный" },
  { token: "green", title: "Изумрудный" },
  { token: "purple", title: "Аметистовый" },
  { token: "black", title: "Черный" },
  { token: "gray", title: "Серый" },
];

type StatBonusKey =
  | "strength_bonus"
  | "agility_bonus"
  | "intellect_bonus"
  | "stamina_bonus"
  | "critical_bonus"
  | "luck_bonus"
  | "xp_bonus"
  | "crystal_bonus"
  | "health_bonus";

const BONUS_FIELDS: StatBonusKey[] = [
  "strength_bonus",
  "agility_bonus",
  "intellect_bonus",
  "stamina_bonus",
  "critical_bonus",
  "luck_bonus",
  "xp_bonus",
  "crystal_bonus",
  "health_bonus",
];

export type UnifiedCatalogItem = {
  id: number;
  key: string;
  sourceId: number | null;
  iconName: string;
  aliases: string[];
  sectionKey: ItemSourceEntry["sectionKey"];
  category: ItemCategory;
  rarity: ItemRarity;
  name: string;
  description: string;
  requiredLevel: number;
  priceGold: number;
  slot: string | null;
  subclass: string | null;
  weaponStats: { damage_min: number; damage_max: number } | null;
  armorStats: { armor_value: number } | null;
  bonuses: Record<StatBonusKey, number>;
  statEntries: ItemStatEntry[];
};

type AnyItemPayload = {
  id?: number;
  name?: string;
  description?: string;
  rarity?: string;
  icon?: string;
  type?: string;
  slot?: string | null;
  subclass?: string | null;
  required_level?: number;
  strength_bonus?: number;
  agility_bonus?: number;
  intellect_bonus?: number;
  stamina_bonus?: number;
  critical_bonus?: number;
  luck_bonus?: number;
  xp_bonus?: number;
  crystal_bonus?: number;
  health_bonus?: number;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function roll(seed: number, min: number, max: number) {
  return min + (Math.abs(seed) % (max - min + 1));
}

function normalizeToken(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^\.?\//, "")
    .replace(/\.(png|webp|jpg|jpeg)$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRarity(value?: string | null): ItemRarity {
  const token = normalizeToken(value);
  if (token === "immortal") return "immortal";
  if (token === "legendary") return "legendary";
  if (token === "epic") return "epic";
  if (token === "rare") return "rare";
  if (token === "uncommon") return "uncommon";
  return "common";
}

function getRarityLevelFloor(rarity: ItemRarity, category: ItemCategory) {
  if (category === "armor") {
    return RARITY_LEVEL_FLOOR_ARMOR[rarity] ?? 1;
  }
  return RARITY_LEVEL_FLOOR[rarity] ?? 1;
}

function getCategoryLevelOffset(category: ItemCategory) {
  if (category === "armor") return -8;
  if (category === "accessory") return -4;
  if (category === "chest") return 2;
  return 0;
}

function toCategory(sectionKey: ItemSourceEntry["sectionKey"]): ItemCategory {
  if (sectionKey === "weapons" || sectionKey === "weapon-components") return "weapon";
  if (sectionKey === "armor" || sectionKey === "armor-parts") return "armor";
  if (sectionKey === "accessories" || sectionKey === "rings" || sectionKey === "trinkets") return "accessory";
  if (sectionKey === "chests") return "chest";
  return "misc";
}

function detectRarity(entry: ItemSourceEntry): ItemRarity {
  const baseToken = getBaseToken(entry.path);
  const forcedRarity = BASE_RARITY_OVERRIDES[baseToken];
  if (forcedRarity) {
    return forcedRarity;
  }

  const token = `${entry.path}_${entry.label}`.toLowerCase();

  if (token.includes("immortal")) return "immortal";
  if (token.includes("legendary") || token.includes("excalibur")) return "legendary";
  if (token.includes("epic") || token.includes("dragon") || token.includes("shadow") || token.includes("phoenix") || token.includes("purple")) {
    return "epic";
  }
  if (token.includes("rare") || token.includes("critical") || token.includes("elven") || token.includes("steel")) {
    return "rare";
  }
  if (token.includes("uncommon")) return "uncommon";

  const numericHint = Number((token.match(/_(\d{3,4})/)?.[1] ?? "0"));
  if (numericHint >= 550) return "immortal";
  if (numericHint >= 500) return "legendary";
  if (numericHint >= 400) return "epic";
  if (numericHint >= 300) return "rare";
  if (numericHint >= 200) return "uncommon";
  return "common";
}

function toRoman(value: number) {
  const symbols: Array<{ value: number; symbol: string }> = [
    { value: 10, symbol: "X" },
    { value: 9, symbol: "IX" },
    { value: 5, symbol: "V" },
    { value: 4, symbol: "IV" },
    { value: 1, symbol: "I" },
  ];
  let rest = Math.max(1, value);
  let result = "";

  for (const item of symbols) {
    while (rest >= item.value) {
      result += item.symbol;
      rest -= item.value;
    }
  }

  return result;
}

function detectSlot(path: string) {
  const token = path.toLowerCase();
  if (token.includes("head") || token.includes("helmet") || token.includes("hood") || token.includes("hat")) return "head";
  if (token.includes("shoulder")) return "shoulders";
  if (token.includes("cloak") || token.includes("plash")) return "back";
  if (token.includes("belt") || token.includes("poyas")) return "waist";
  if (token.includes("glove") || token.includes("wrist")) return "hands";
  if (token.includes("legs") || token.includes("pants")) return "legs";
  if (token.includes("boots") || token.includes("feet")) return "feet";
  if (token.includes("armor") || token.includes("robe") || token.includes("chest")) return "chest";
  return null;
}

function detectSubclass(path: string, category: ItemCategory) {
  if (category !== "weapon" && category !== "accessory") return null;
  const token = path.toLowerCase();

  if (category === "accessory") {
    if (token.includes("ring")) return "ring";
    if (token.includes("amulet") || token.includes("pendant") || token.includes("neck")) return "necklace";
    return "trinket";
  }

  if (token.includes("bow")) return "bow";
  if (token.includes("staff")) return "staff";
  if (token.includes("spellbook")) return "spellbook";
  if (token.includes("axe")) return "axe";
  if (token.includes("dagger")) return "dagger";
  if (token.includes("mace")) return "mace";
  return "sword";
}

function detectNoun(category: ItemCategory, path: string, subclass: string | null) {
  if (category === "chest") return "Сундук";
  if (category === "weapon") {
    if (subclass === "bow") return "Лук";
    if (subclass === "staff") return "Посох";
    if (subclass === "spellbook") return "Гримуар";
    if (subclass === "axe") return "Секира";
    if (subclass === "dagger") return "Кинжал";
    if (subclass === "mace") return "Булава";
    return "Клинок";
  }

  if (category === "armor") {
    const token = path.toLowerCase();
    if (token.includes("helmet") || token.includes("head")) return "Шлем";
    if (token.includes("hood")) return "Капюшон";
    if (token.includes("hat")) return "Шляпа";
    if (token.includes("shoulder")) return "Наплечники";
    if (token.includes("glove")) return "Перчатки";
    if (token.includes("belt") || token.includes("poyas")) return "Пояс";
    if (token.includes("legs") || token.includes("pants")) return "Поножи";
    if (token.includes("boots")) return "Сапоги";
    if (token.includes("cloak") || token.includes("plash")) return "Плащ";
    if (token.includes("robe")) return "Роба";
    return "Доспех";
  }

  if (category === "accessory") {
    if (subclass === "ring") return "Кольцо";
    if (subclass === "necklace") return "Амулет";
    return "Талисман";
  }

  return "Артефакт";
}

function getBaseToken(path: string) {
  const file = path.split("/").pop() ?? path;
  return normalizeToken(file);
}

function getColorTitle(baseToken: string) {
  const color = COLOR_WORDS.find((entry) => baseToken.includes(entry.token));
  return color?.title ?? null;
}

function buildName(entry: ItemSourceEntry, category: ItemCategory, rarity: ItemRarity, subclass: string | null, seed: number) {
  const baseToken = getBaseToken(entry.path);
  const exactName = EXACT_BASE_NAMES[baseToken];
  if (exactName) {
    return exactName;
  }

  const noun = detectNoun(category, entry.path, subclass);
  const color = getColorTitle(baseToken);
  if (color) {
    if (category === "accessory" || category === "chest") {
      return `${noun} ${color.toLowerCase()}`;
    }
    return `${color} ${noun.toLowerCase()}`;
  }

  const theme = THEME_WORDS[seed % THEME_WORDS.length];
  const grade = toRoman(1 + (RARITY_RANK[rarity] % 5));
  if (category === "chest") {
    return `${noun} ${theme}`;
  }
  return `${noun} ${theme} ${grade}`;
}

function buildDescription(name: string, category: ItemCategory, rarity: ItemRarity) {
  const rarityLabel: Record<ItemRarity, string> = {
    common: "обычной",
    uncommon: "необычной",
    rare: "редкой",
    epic: "эпической",
    legendary: "легендарной",
    immortal: "мифической",
  };
  const kindLabel: Record<ItemCategory, string> = {
    weapon: "Оружие",
    armor: "Экипировка",
    accessory: "Аксессуар",
    chest: "Сундук",
    misc: "Артефакт",
  };
  return `${kindLabel[category]} "${name}" ${rarityLabel[rarity]} редкости.`;
}

function buildBonuses(seed: number, category: ItemCategory, rarity: ItemRarity, subclass: string | null) {
  const rarityBoost = RARITY_RANK[rarity];
  const bonuses: Record<StatBonusKey, number> = {
    strength_bonus: 0,
    agility_bonus: 0,
    intellect_bonus: 0,
    stamina_bonus: 0,
    critical_bonus: 0,
    luck_bonus: 0,
    xp_bonus: 0,
    crystal_bonus: 0,
    health_bonus: 0,
  };

  if (category === "weapon") {
    if (subclass === "bow") {
      bonuses.agility_bonus = roll(seed + 11, 1, 4) + rarityBoost;
    } else if (subclass === "staff" || subclass === "spellbook") {
      bonuses.intellect_bonus = roll(seed + 11, 1, 4) + rarityBoost;
    } else {
      bonuses.strength_bonus = roll(seed + 11, 1, 4) + rarityBoost;
    }
    bonuses.stamina_bonus = Math.max(0, roll(seed + 31, 0, 2) + Math.floor(rarityBoost / 2));
  } else if (category === "armor") {
    bonuses.stamina_bonus = roll(seed + 13, 1, 4) + rarityBoost;
    bonuses.strength_bonus = Math.max(0, roll(seed + 37, 0, 3) + Math.floor(rarityBoost / 2));
    bonuses.health_bonus = roll(seed + 59, 8, 24) + rarityBoost * 10;
  } else if (category === "accessory") {
    bonuses.xp_bonus = Math.max(1, roll(seed + 17, 1, 3) + Math.floor(rarityBoost / 2));
    bonuses.crystal_bonus = Math.max(1, roll(seed + 23, 1, 4) + Math.floor(rarityBoost / 2));
    if (subclass === "ring") {
      bonuses.strength_bonus = Math.max(0, roll(seed + 29, 0, 2) + Math.floor(rarityBoost / 2));
    } else if (subclass === "necklace") {
      bonuses.intellect_bonus = Math.max(0, roll(seed + 29, 0, 2) + Math.floor(rarityBoost / 2));
    } else {
      bonuses.agility_bonus = Math.max(0, roll(seed + 29, 0, 2) + Math.floor(rarityBoost / 2));
    }
  } else if (category === "chest") {
    bonuses.xp_bonus = roll(seed + 41, 1, 4) + rarityBoost;
    bonuses.crystal_bonus = roll(seed + 47, 2, 6) + rarityBoost;
  } else {
    bonuses.xp_bonus = Math.max(1, roll(seed + 71, 1, 3) + Math.floor(rarityBoost / 2));
  }

  return bonuses;
}

function buildWeaponStats(seed: number, category: ItemCategory, rarity: ItemRarity) {
  if (category !== "weapon") return null;
  const rarityBoost = RARITY_RANK[rarity];
  const damageMin = roll(seed + 101, 5, 12) + rarityBoost * 3;
  const damageMax = damageMin + roll(seed + 103, 3, 9) + rarityBoost;
  return { damage_min: damageMin, damage_max: damageMax };
}

function buildArmorStats(seed: number, category: ItemCategory, rarity: ItemRarity) {
  if (category !== "armor") return null;
  const armorValue = roll(seed + 151, 4, 16) + RARITY_RANK[rarity] * 3;
  return { armor_value: armorValue };
}

function buildStatEntries(
  bonuses: Record<StatBonusKey, number>,
  weaponStats: { damage_min: number; damage_max: number } | null,
  armorStats: { armor_value: number } | null,
): ItemStatEntry[] {
  const entries: ItemStatEntry[] = [];

  if (weaponStats) {
    entries.push({
      key: "damage",
      label: "Урон",
      value: weaponStats.damage_max,
      displayValue: `${weaponStats.damage_min}-${weaponStats.damage_max}`,
      icon: "sword",
    });
  }

  if (armorStats) {
    entries.push({
      key: "armor",
      label: "Броня",
      value: armorStats.armor_value,
      displayValue: `+${armorStats.armor_value}`,
      icon: "armor",
    });
  }

  const bonusLabels: Record<string, { label: string; icon: string }> = {
    strength_bonus: { label: "Сила", icon: "strength" },
    agility_bonus: { label: "Ловкость", icon: "agility" },
    intellect_bonus: { label: "Интеллект", icon: "intellect" },
    stamina_bonus: { label: "Выносливость", icon: "stamina" },
    xp_bonus: { label: "Бонус опыта", icon: "xp_bonus" },
    crystal_bonus: { label: "Бонус золота", icon: "cash" },
    health_bonus: { label: "Здоровье", icon: "heart-plus" },
  };

  for (const key of BONUS_FIELDS) {
    const value = bonuses[key];
    if (!value) continue;
    entries.push({
      key,
      label: bonusLabels[key].label,
      value,
      displayValue: `+${value}`,
      icon: bonusLabels[key].icon,
    });
  }

  return entries;
}

function detectItemId(entry: ItemSourceEntry, seed: number) {
  const match = entry.path.match(/_(\d{3,4})/);
  if (match) {
    const idValue = Number(match[1]);
    if (idValue > 0) return idValue;
  }
  return 900000 + (seed % 99999);
}

function buildCatalogItem(entry: ItemSourceEntry): UnifiedCatalogItem {
  const seed = hashString(entry.key);
  const category = toCategory(entry.sectionKey);
  const rarity = detectRarity(entry);
  const subclass = detectSubclass(entry.path, category);
  const slot = category === "armor"
    ? detectSlot(entry.path)
    : category === "weapon"
      ? "main_hand"
      : category === "accessory"
        ? subclass === "ring"
          ? "ring1"
          : subclass === "necklace"
            ? "neck"
            : "trinket1"
        : null;
  const name = buildName(entry, category, rarity, subclass, seed);
  const bonuses = buildBonuses(seed, category, rarity, subclass);
  const weaponStats = buildWeaponStats(seed, category, rarity);
  const armorStats = buildArmorStats(seed, category, rarity);
  const statEntries = buildStatEntries(bonuses, weaponStats, armorStats);
  const requiredLevelRaw = Math.max(
    1,
    RARITY_LEVEL_BASE[rarity] + roll(seed + 221, 0, 7 + RARITY_RANK[rarity]) + getCategoryLevelOffset(category),
  );
  const requiredLevel = Math.max(requiredLevelRaw, getRarityLevelFloor(rarity, category));
  const priceGold = RARITY_PRICE_BASE[rarity] + roll(seed + 223, 20, 220) + statEntries.reduce((sum, entryValue) => sum + entryValue.value, 0);

  return {
    id: detectItemId(entry, seed),
    key: normalizeToken(entry.path),
    sourceId: typeof entry.source === "number" ? entry.source : null,
    iconName: entry.path,
    aliases: entry.aliases.map((alias) => normalizeToken(alias)).filter(Boolean),
    sectionKey: entry.sectionKey,
    category,
    rarity,
    name,
    description: buildDescription(name, category, rarity),
    requiredLevel,
    priceGold,
    slot,
    subclass,
    weaponStats,
    armorStats,
    bonuses,
    statEntries,
  };
}

function shouldSkipCatalogEntry(entry: ItemSourceEntry) {
  // `misc/*` are stat-icon assets (strength/agility/etc.) and should not be sold as equipment items.
  if (entry.sectionKey === "misc") {
    return true;
  }
  return false;
}

const CATALOG_ITEMS: UnifiedCatalogItem[] = getItemSourceEntries()
  .filter((entry) => !shouldSkipCatalogEntry(entry))
  .map(buildCatalogItem);

const BY_ICON = CATALOG_ITEMS.reduce<Record<string, UnifiedCatalogItem>>((acc, item) => {
  const iconToken = normalizeToken(item.iconName);
  if (iconToken) {
    acc[iconToken] = item;
  }
  for (const alias of item.aliases) {
    acc[alias] = item;
  }
  return acc;
}, {});

const BY_ID = CATALOG_ITEMS.reduce<Record<number, UnifiedCatalogItem>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const BY_SOURCE = CATALOG_ITEMS.reduce<Record<number, UnifiedCatalogItem>>((acc, item) => {
  if (typeof item.sourceId === "number") {
    acc[item.sourceId] = item;
  }
  return acc;
}, {});

function pickPayloadValue<T>(payloadValue: T | null | undefined, fallbackValue: T): T {
  if (payloadValue === null || payloadValue === undefined) {
    return fallbackValue;
  }
  if (typeof payloadValue === "string") {
    const normalized = payloadValue.trim();
    return (normalized ? payloadValue : fallbackValue) as T;
  }
  return payloadValue;
}

function hasObjectValues(value: unknown) {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length);
}

function buildStatsRecord(
  payloadStats: Record<string, number> | undefined,
  payloadItem: AnyItemPayload,
) {
  if (hasObjectValues(payloadStats)) {
    return { ...payloadStats };
  }

  const stats = BONUS_FIELDS.reduce<Record<string, number>>((acc, key) => {
    const value = typeof payloadItem[key] === "number" ? payloadItem[key] : 0;
    if (value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return stats;
}

export function getUnifiedItemCatalog() {
  return CATALOG_ITEMS;
}

export function findUnifiedItemByIcon(iconName?: string | null) {
  const token = normalizeToken(iconName);
  if (!token) return null;
  const direct = BY_ICON[token];
  if (direct) {
    return direct;
  }

  const resolvedAsset = getItemSourceAssetByName(token);
  if (typeof resolvedAsset === "number") {
    return BY_SOURCE[resolvedAsset] ?? null;
  }

  return null;
}

export function findUnifiedItemById(itemId?: number | null) {
  if (!itemId) return null;
  return BY_ID[itemId] ?? null;
}

function findCatalogForRemoteItem(payloadItem: AnyItemPayload) {
  return findUnifiedItemByIcon(payloadItem.icon);
}

function applyServerStats<T extends AnyItemPayload & { stats?: Record<string, number> | null }>(payloadItem: T): T {
  if (!payloadItem.stats || typeof payloadItem.stats !== "object") {
    return payloadItem;
  }

  const next = { ...payloadItem };
  for (const key of BONUS_FIELDS) {
    const statValue = payloadItem.stats[key];
    if (typeof next[key] !== "number" && typeof statValue === "number") {
      next[key] = statValue;
    }
  }
  return next;
}

export function mapPayloadItemToCatalog<T extends AnyItemPayload>(payloadItem: T): T {
  const catalog = findCatalogForRemoteItem(payloadItem);
  if (!catalog) {
    return {
      ...payloadItem,
      icon: payloadItem.icon || "package-variant",
    };
  }

  return {
    ...payloadItem,
    id: payloadItem.id ?? catalog.id,
    name: pickPayloadValue(payloadItem.name, catalog.name),
    description: pickPayloadValue(payloadItem.description, catalog.description),
    icon: pickPayloadValue(payloadItem.icon, catalog.iconName),
    rarity: normalizeRarity(payloadItem.rarity ?? catalog.rarity),
    type: pickPayloadValue(payloadItem.type, catalog.category),
    slot: payloadItem.slot ?? catalog.slot ?? null,
    subclass: payloadItem.subclass ?? catalog.subclass ?? null,
  } as T;
}

export function mapInventoryEntryToCatalog<
  T extends {
    item: AnyItemPayload & {
      weapon_stats?: { damage_min?: number; damage_max?: number } | null;
      armor_stats?: { armor_value?: number } | null;
    };
    item_id?: number;
    weapon_stats?: { damage_min?: number; damage_max?: number } | null;
    armor_stats?: { armor_value?: number } | null;
  },
>(entry: T): T {
  const item = applyServerStats(mapPayloadItemToCatalog({
    ...entry.item,
    id: entry.item.id ?? entry.item_id,
  }));

  const weaponStats = entry.weapon_stats ?? entry.item.weapon_stats ?? null;
  const armorStats = entry.armor_stats ?? entry.item.armor_stats ?? null;

  return {
    ...entry,
    item,
    weapon_stats: weaponStats,
    armor_stats: armorStats,
  };
}

export function mapInventoryDetailToCatalog<
  T extends {
    item: AnyItemPayload;
    weapon_stats?: { damage_min?: number; damage_max?: number } | null;
    armor_stats?: { armor_value?: number } | null;
  },
>(detail: T): T {
  const item = applyServerStats(mapPayloadItemToCatalog(detail.item));

  return {
    ...detail,
    item,
    weapon_stats: detail.weapon_stats ?? null,
    armor_stats: detail.armor_stats ?? null,
  };
}

export function mapShopItemToCatalog<T extends AnyItemPayload & { id: number; price_crystals?: number; required_level?: number; weapon_stats?: { damage_min: number; damage_max: number } | null; armor_stats?: { armor_value: number } | null; stats?: Record<string, number> }>(item: T): T {
  const mapped = applyServerStats(mapPayloadItemToCatalog(item));

  return {
    ...mapped,
    weapon_stats: item.weapon_stats ?? null,
    armor_stats: item.armor_stats ?? null,
    stats: buildStatsRecord(item.stats, mapped),
  };
}

export function buildCatalogLookupTokens(item: UnifiedCatalogItem) {
  const tokens = new Set<string>();
  tokens.add(normalizeToken(item.iconName));
  tokens.add(normalizeToken(item.key));
  for (const alias of item.aliases) {
    tokens.add(normalizeToken(alias));
  }
  return [...tokens].filter(Boolean);
}

export function mapChestRewardToCatalog<T extends { id?: number; name: string; icon?: string; rarity?: string; slot?: string | null }>(item: T): T {
  const catalog = findUnifiedItemByIcon(item.icon);
  if (!catalog) {
    return {
      ...item,
      icon: item.icon || "package-variant",
    };
  }
  return {
    ...item,
    id: item.id ?? catalog.id,
    name: catalog.name,
    icon: catalog.iconName,
    rarity: normalizeRarity(item.rarity ?? catalog.rarity),
    slot: item.slot ?? catalog.slot,
  };
}
