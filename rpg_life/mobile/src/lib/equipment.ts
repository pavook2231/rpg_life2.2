type EquipmentEntry = {
  slot: string;
  weapon_stats?: {
    weapon_category?: string | null;
  } | null;
};

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export type ItemStatEntry = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  icon: string;
};

type ItemDetail = {
  item?: {
    type: string;
    slot?: string | null;
    subclass?: string | null;
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
  type?: string;
  slot?: string | null;
  subclass?: string | null;
  strength_bonus?: number;
  agility_bonus?: number;
  intellect_bonus?: number;
  stamina_bonus?: number;
  critical_bonus?: number;
  luck_bonus?: number;
  xp_bonus?: number;
  crystal_bonus?: number;
  health_bonus?: number;
  stats?: Record<string, number> | null;
  weapon_stats?: {
    weapon_category?: string | null;
    damage_min?: number;
    damage_max?: number;
  } | null;
  armor_stats?: {
    armor_value?: number;
  } | null;
};

const STAT_ICONS: Record<string, string> = {
  strength: "strength",
  agility: "agility",
  intellect: "intellect",
  stamina: "stamina",
  armor: "armor",
  damage: "sword",
  crit: "crit",
  luck: "luck",
  health: "heart-plus",
  xp_bonus: "chart-line",
  crystal_bonus: "cash",
};

function getItemPayload(detail: ItemDetail) {
  return detail.item ?? detail;
}

function translateOrFallback(t: TranslateFn | undefined, key: string, fallback: string) {
  if (!t) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function getAvailableSlots(detail: ItemDetail) {
  const item = getItemPayload(detail);

  if (item.type === "weapon") {
    const category = detail.weapon_stats?.weapon_category;
    if (category === "two_hand" || category === "main_hand_only") return ["main_hand"];
    if (category === "off_hand_only") return ["off_hand"];
    if (category === "ranged") return ["ranged"];
    return ["main_hand", "off_hand"];
  }

  if (item.type === "armor") {
    return item.slot ? [item.slot] : [];
  }

  if (item.type === "accessory") {
    if (item.subclass === "ring") return ["ring1", "ring2"];
    if (item.subclass === "necklace") return ["neck"];
    if (item.subclass === "trinket") return ["trinket1", "trinket2"];
  }

  return [];
}

export function pickEquipSlot(detail: ItemDetail, equipped: EquipmentEntry[] = []) {
  const item = getItemPayload(detail);
  const slots = getAvailableSlots(detail);
  if (!slots.length) return item.slot ?? "main_hand";
  if (slots.length === 1) return slots[0];

  const mainHandEntry = equipped.find((entry) => entry.slot === "main_hand");
  if (mainHandEntry?.weapon_stats?.weapon_category === "two_hand" && slots.includes("main_hand")) {
    return "main_hand";
  }

  const occupied = new Set(equipped.map((entry) => entry.slot));
  const emptySlot = slots.find((slot) => !occupied.has(slot));
  return emptySlot ?? slots[0];
}

function getStatLabel(key: string, t?: TranslateFn) {
  const baseKey = key
    .toLowerCase()
    .replace(/_bonus$/, "")
    .replace(/^bonus_/, "")
    .replace(/^stat_/, "");
  const normalizedKey = baseKey === "critical" ? "crit" : baseKey;
  const labels: Record<string, string> = {
    strength: translateOrFallback(t, "game.itemStats.strength", "Сила"),
    agility: translateOrFallback(t, "game.itemStats.agility", "Ловкость"),
    intellect: translateOrFallback(t, "game.itemStats.intellect", "Интеллект"),
    stamina: translateOrFallback(t, "game.itemStats.stamina", "Выносливость"),
    armor: translateOrFallback(t, "game.itemStats.armor", "Броня"),
    damage: translateOrFallback(t, "game.itemStats.damage", "Урон"),
    crit: translateOrFallback(t, "game.itemStats.crit", "Крит"),
    luck: translateOrFallback(t, "game.itemStats.luck", "Удача"),
    health: translateOrFallback(t, "game.itemStats.health", "Здоровье"),
    xp: translateOrFallback(t, "game.itemStats.xpBonus", "Бонус опыта"),
    xp_bonus: translateOrFallback(t, "game.itemStats.xpBonus", "Бонус опыта"),
    crystal: translateOrFallback(t, "game.itemStats.goldBonus", "Бонус золота"),
    crystal_bonus: translateOrFallback(t, "game.itemStats.goldBonus", "Бонус золота"),
    gold: translateOrFallback(t, "game.itemStats.goldBonus", "Бонус золота"),
    gold_bonus: translateOrFallback(t, "game.itemStats.goldBonus", "Бонус золота"),
  };
  return labels[normalizedKey] ?? labels[key] ?? normalizedKey;
}

function getStatIcon(key: string) {
  const baseKey = key
    .toLowerCase()
    .replace(/_bonus$/, "")
    .replace(/^bonus_/, "")
    .replace(/^stat_/, "");
  const normalizedKey = baseKey === "critical" ? "crit" : baseKey;
  return STAT_ICONS[normalizedKey] ?? STAT_ICONS[key] ?? "sparkles";
}

function buildEntry(key: string, value: number, t?: TranslateFn, displayValue?: string): ItemStatEntry {
  return {
    key,
    label: getStatLabel(key, t),
    value,
    displayValue: displayValue ?? `+${value}`,
    icon: getStatIcon(key),
  };
}

export function buildItemStatEntries(detail: ItemDetail, t?: TranslateFn) {
  const item = getItemPayload(detail);
  const stats = new Map<string, ItemStatEntry>();

  const upsertEntry = (entry: ItemStatEntry) => {
    if (!stats.has(entry.key)) {
      stats.set(entry.key, entry);
    }
  };

  if (detail.weapon_stats?.damage_min !== undefined && detail.weapon_stats?.damage_max !== undefined) {
    upsertEntry(
      buildEntry(
        "damage",
        detail.weapon_stats.damage_max,
        t,
        `${detail.weapon_stats.damage_min}-${detail.weapon_stats.damage_max}`,
      ),
    );
  }
  if (detail.armor_stats?.armor_value) upsertEntry(buildEntry("armor", detail.armor_stats.armor_value, t));
  if (item.strength_bonus) upsertEntry(buildEntry("strength", item.strength_bonus, t));
  if (item.agility_bonus) upsertEntry(buildEntry("agility", item.agility_bonus, t));
  if (item.intellect_bonus) upsertEntry(buildEntry("intellect", item.intellect_bonus, t));
  if (item.stamina_bonus) upsertEntry(buildEntry("stamina", item.stamina_bonus, t));
  if (item.critical_bonus) upsertEntry(buildEntry("critical_bonus", item.critical_bonus, t));
  if (item.luck_bonus) upsertEntry(buildEntry("luck_bonus", item.luck_bonus, t));
  if (item.health_bonus) upsertEntry(buildEntry("health", item.health_bonus, t));
  if (item.xp_bonus) upsertEntry(buildEntry("xp_bonus", item.xp_bonus, t));
  if (item.crystal_bonus) upsertEntry(buildEntry("crystal_bonus", item.crystal_bonus, t));

  if (detail.stats) {
    for (const [key, value] of Object.entries(detail.stats)) {
      if (typeof value === "number") {
        upsertEntry(buildEntry(key, value, t));
      }
    }
  }

  return [...stats.values()];
}

export function buildItemStats(detail: ItemDetail, t?: TranslateFn) {
  return buildItemStatEntries(detail, t).map((entry) => `${entry.label} ${entry.displayValue}`);
}
