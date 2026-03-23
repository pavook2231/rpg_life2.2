import type {
  CanonicalItem,
  ChestRewardItem,
  ChestRewardPayload,
  EquipmentEntry,
  EquipmentOverviewPayload,
  InventoryItem,
  InventoryPagePayload,
  ItemArmorStats,
  ItemStats,
  ItemWeaponStats,
  ShopItemPayload,
  ShopPayload,
} from "./types";

type RawRecord = Record<string, unknown>;

type ItemStoreSnapshot = {
  itemsById: Record<number, CanonicalItem>;
  catalogItemIds: number[];
  inventoryById: Record<number, InventoryItem>;
  equipmentBySlot: Record<string, EquipmentEntry>;
};

const snapshot: ItemStoreSnapshot = {
  itemsById: {},
  catalogItemIds: [],
  inventoryById: {},
  equipmentBySlot: {},
};

const ITEM_FIELDS_TO_COMPARE: Array<keyof CanonicalItem> = [
  "name",
  "type",
  "subclass",
  "slot",
  "rarity",
  "icon",
  "image",
  "required_level",
  "required_class",
  "price_crystals",
];

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" ? (value as RawRecord) : {};
}

function pickField(record: RawRecord, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }
  return undefined;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeStats(value: unknown): ItemStats {
  const statsRecord = asRecord(value);
  const stats: ItemStats = {};
  for (const [key, rawValue] of Object.entries(statsRecord)) {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      stats[key as keyof ItemStats] = rawValue;
    }
  }
  stats.attack = asNumber(stats.attack, 0);
  stats.defense = asNumber(stats.defense, 0);
  stats.hp = asNumber(stats.hp, 0);
  return stats;
}

function normalizeWeaponStats(value: unknown): ItemWeaponStats {
  const stats = asRecord(value);
  if (!Object.keys(stats).length) {
    return null;
  }
  return {
    weapon_type: asOptionalString(stats.weapon_type),
    weapon_category: asOptionalString(stats.weapon_category),
    damage_min: asNumber(stats.damage_min, 0),
    damage_max: asNumber(stats.damage_max, 0),
    speed: typeof stats.speed === "number" ? stats.speed : undefined,
    dps: typeof stats.dps === "number" ? stats.dps : undefined,
    critical_strike_chance: typeof stats.critical_strike_chance === "number" ? stats.critical_strike_chance : undefined,
    required_strength: typeof stats.required_strength === "number" ? stats.required_strength : undefined,
    required_agility: typeof stats.required_agility === "number" ? stats.required_agility : undefined,
    required_intellect: typeof stats.required_intellect === "number" ? stats.required_intellect : undefined,
  };
}

function normalizeArmorStats(value: unknown): ItemArmorStats {
  const stats = asRecord(value);
  if (!Object.keys(stats).length) {
    return null;
  }
  return {
    armor_type: asOptionalString(stats.armor_type),
    armor_value: asNumber(stats.armor_value, 0),
    slot: asOptionalString(stats.slot),
    dodge_chance: typeof stats.dodge_chance === "number" ? stats.dodge_chance : undefined,
    block_chance: typeof stats.block_chance === "number" ? stats.block_chance : undefined,
  };
}

function logStoreWarning(message: string, details: Record<string, unknown>) {
  console.warn(`[item-store] ${message}`, details);
}

function rememberItem(item: CanonicalItem, source: string) {
  if (!item.id) {
    logStoreWarning("Item payload without canonical id", { source, item });
    return item;
  }

  const existing = snapshot.itemsById[item.id];
  if (existing) {
    const diffs = ITEM_FIELDS_TO_COMPARE.filter((field) => existing[field] !== item[field]);
    if (JSON.stringify(existing.stats) !== JSON.stringify(item.stats)) {
      diffs.push("stats");
    }
    if (diffs.length) {
      logStoreWarning("Divergent item payload detected", {
        itemId: item.id,
        source,
        fields: diffs,
        existing,
        incoming: item,
      });
    }
  }

  snapshot.itemsById[item.id] = item;
  return item;
}

export function normalizeItemModel(value: unknown, source = "api"): CanonicalItem {
  const raw = asRecord(value);
  const canonicalRaw: RawRecord = {
    ...raw,
    required_class: pickField(raw, ["required_class", "re equired_class", "required_class s"]),
    set_name: pickField(raw, ["set_name", "set_name e", "set t_name"]),
    price: pickField(raw, ["price", "pri ice"]),
  };
  const itemId = asNumber(raw.id, 0);
  const stats = normalizeStats(canonicalRaw.stats);
  const weaponStats = normalizeWeaponStats(canonicalRaw.weapon_stats);
  const armorStats = normalizeArmorStats(canonicalRaw.armor_stats);

  const item: CanonicalItem = {
    id: itemId,
    name: asString(canonicalRaw.name, "Unknown item"),
    description: asString(canonicalRaw.description, ""),
    rarity: asString(canonicalRaw.rarity, "common"),
    image: asString(canonicalRaw.image || canonicalRaw.icon, "package-variant"),
    icon: asString(canonicalRaw.icon || canonicalRaw.image, "package-variant"),
    type: asString(canonicalRaw.type, "misc"),
    subclass: asNullableString(canonicalRaw.subclass),
    slot: asNullableString(canonicalRaw.slot),
    strength_bonus: asNumber(canonicalRaw.strength_bonus, 0),
    agility_bonus: asNumber(canonicalRaw.agility_bonus, 0),
    intellect_bonus: asNumber(canonicalRaw.intellect_bonus, 0),
    stamina_bonus: asNumber(canonicalRaw.stamina_bonus, 0),
    critical_bonus: asNumber(canonicalRaw.critical_bonus, 0),
    luck_bonus: asNumber(canonicalRaw.luck_bonus, 0),
    xp_bonus: asNumber(canonicalRaw.xp_bonus, 0),
    crystal_bonus: asNumber(canonicalRaw.crystal_bonus, 0),
    health_bonus: asNumber(canonicalRaw.health_bonus, 0),
    required_level: asNumber(canonicalRaw.required_level, 1),
    required_class: asNullableString(canonicalRaw.required_class),
    set_name: asNullableString(canonicalRaw.set_name),
    price: asNumber(canonicalRaw.price, asNumber(canonicalRaw.price_crystals, 0)),
    price_crystals: asNumber(canonicalRaw.price_crystals, asNumber(canonicalRaw.price, 0)),
    stats,
    weapon_stats: weaponStats,
    armor_stats: armorStats,
  };

  return rememberItem(item, source);
}

export function normalizeShopItem(value: unknown): ShopItemPayload {
  const raw = asRecord(value);
  return {
    ...normalizeItemModel(raw, "shop"),
    chest_name: asOptionalString(raw.chest_name),
  };
}

export function normalizeShopPayload(value: unknown): ShopPayload {
  const raw = asRecord(value);
  const items = (Array.isArray(raw.items) ? raw.items : []).map((item) => normalizeShopItem(item));
  snapshot.catalogItemIds = items.map((item) => item.id).filter(Boolean);
  return {
    items,
    crystals: asNumber(raw.crystals, 0),
    character_level: asNumber(raw.character_level, 1),
    refresh_cost: asNumber(raw.refresh_cost, 0),
    refresh_cooldown_seconds: asNumber(raw.refresh_cooldown_seconds, 0),
    refresh_available_at: asNullableString(raw.refresh_available_at),
    refresh_remaining_seconds: asNumber(raw.refresh_remaining_seconds, 0),
    can_refresh: Boolean(raw.can_refresh),
    next_rotation_at: asString(raw.next_rotation_at, ""),
  };
}

export function normalizeInventoryItem(value: unknown): InventoryItem {
  const raw = asRecord(value);
  const nestedItem = asRecord(raw.item);
  const item = normalizeItemModel(
    {
      ...nestedItem,
      id: nestedItem.id ?? raw.item_id,
      weapon_stats: raw.weapon_stats ?? nestedItem.weapon_stats,
      armor_stats: raw.armor_stats ?? nestedItem.armor_stats,
    },
    "inventory",
  );

  const inventoryId = asNumber(raw.inventory_id, asNumber(raw.id, 0));
  const itemId = asNumber(raw.item_id, item.id);
  if (item.id && itemId && item.id !== itemId) {
    logStoreWarning("Inventory payload item_id mismatch", {
      inventoryId,
      itemId,
      nestedItemId: item.id,
    });
  }

  const normalized: InventoryItem = {
    id: inventoryId,
    inventory_id: inventoryId,
    item_id: itemId,
    quantity: asNumber(raw.quantity, 1),
    is_equipped: Boolean(raw.is_equipped),
    acquired_at: asNullableString(raw.acquired_at),
    item,
    weapon_stats: normalizeWeaponStats(raw.weapon_stats ?? item.weapon_stats),
    armor_stats: normalizeArmorStats(raw.armor_stats ?? item.armor_stats),
    sell_price: typeof raw.sell_price === "number" ? raw.sell_price : undefined,
  };

  snapshot.inventoryById[inventoryId] = normalized;
  return normalized;
}

export function normalizeInventoryPagePayload(value: unknown): InventoryPagePayload {
  const raw = asRecord(value);
  return {
    items: (Array.isArray(raw.items) ? raw.items : []).map((item) => normalizeInventoryItem(item)),
    pagination: {
      page: asNumber(asRecord(raw.pagination).page, 1),
      limit: asNumber(asRecord(raw.pagination).limit, 20),
      total_items: asNumber(asRecord(raw.pagination).total_items, 0),
      total_pages: asNumber(asRecord(raw.pagination).total_pages, 1),
    },
  };
}

export function normalizeInventoryDetail(value: unknown): InventoryItem {
  return normalizeInventoryItem(value);
}

export function normalizeEquipmentOverview(value: unknown): EquipmentOverviewPayload {
  const raw = asRecord(value);
  const equipment = (Array.isArray(raw.equipment) ? raw.equipment : []).map((entry) => {
    const record = asRecord(entry);
    const normalized: EquipmentEntry = {
      slot: asString(record.slot, ""),
      inventory_id: asNumber(record.inventory_id, 0),
      item: normalizeItemModel(
        {
          ...asRecord(record.item),
          weapon_stats: record.weapon_stats ?? asRecord(record.item).weapon_stats,
          armor_stats: record.armor_stats ?? asRecord(record.item).armor_stats,
        },
        "equipment",
      ),
      weapon_stats: normalizeWeaponStats(record.weapon_stats),
      armor_stats: normalizeArmorStats(record.armor_stats),
    };
    snapshot.equipmentBySlot[normalized.slot] = normalized;
    return normalized;
  });

  const bagItems = (Array.isArray(raw.bag_items) ? raw.bag_items : []).map((entry) => normalizeInventoryItem(entry));

  return {
    class_info: {
      id: asNumber(asRecord(raw.class_info).id, 0),
      class_name: asString(asRecord(raw.class_info).class_name, ""),
      display_name: asNullableString(asRecord(raw.class_info).display_name),
      level: asNumber(asRecord(raw.class_info).level, 1),
      current_xp: asNumber(asRecord(raw.class_info).current_xp, 0),
      crystals: asNumber(asRecord(raw.class_info).crystals, 0),
      strength: asNumber(asRecord(raw.class_info).strength, 0),
      agility: asNumber(asRecord(raw.class_info).agility, 0),
      intellect: asNumber(asRecord(raw.class_info).intellect, 0),
      stamina: asNumber(asRecord(raw.class_info).stamina, 0),
    },
    equipment_totals: {
      strength: asNumber(asRecord(raw.equipment_totals).strength, 0),
      agility: asNumber(asRecord(raw.equipment_totals).agility, 0),
      intellect: asNumber(asRecord(raw.equipment_totals).intellect, 0),
      stamina: asNumber(asRecord(raw.equipment_totals).stamina, 0),
      critical_chance: asNumber(asRecord(raw.equipment_totals).critical_chance, 0),
      luck: asNumber(asRecord(raw.equipment_totals).luck, 0),
      health: asNumber(asRecord(raw.equipment_totals).health, 0),
      armor: asNumber(asRecord(raw.equipment_totals).armor, 0),
      damage_min: asNumber(asRecord(raw.equipment_totals).damage_min, 0),
      damage_max: asNumber(asRecord(raw.equipment_totals).damage_max, 0),
      dps: asNumber(asRecord(raw.equipment_totals).dps, 0),
    },
    reward_effects: {
      xp_bonus_percent: asNumber(asRecord(raw.reward_effects).xp_bonus_percent, 0),
      gold_bonus_percent: asNumber(asRecord(raw.reward_effects).gold_bonus_percent, 0),
      crit_reward_chance_percent: asNumber(asRecord(raw.reward_effects).crit_reward_chance_percent, 0),
      loot_bonus_percent: asNumber(asRecord(raw.reward_effects).loot_bonus_percent, 0),
      armor_reduction_percent:
        typeof asRecord(raw.reward_effects).armor_reduction_percent === "number"
          ? (asRecord(raw.reward_effects).armor_reduction_percent as number)
          : undefined,
      system_daily_cap:
        typeof asRecord(raw.reward_effects).system_daily_cap === "number"
          ? (asRecord(raw.reward_effects).system_daily_cap as number)
          : undefined,
    },
    equipment,
    bag_items: bagItems,
    set_bonuses: Array.isArray(raw.set_bonuses) ? (raw.set_bonuses as EquipmentOverviewPayload["set_bonuses"]) : undefined,
    secondary_skills: raw.secondary_skills,
  };
}

export function normalizeChestRewardItem(value: unknown): ChestRewardItem {
  const raw = asRecord(value);
  const cached = typeof raw.id === "number" ? snapshot.itemsById[raw.id] : undefined;
  return {
    id: typeof raw.id === "number" ? raw.id : cached?.id,
    name: asString(raw.name, cached?.name ?? "Reward"),
    icon: asString(raw.icon || raw.image, cached?.icon ?? "package-variant"),
    image: asString(raw.image || raw.icon, cached?.image ?? cached?.icon ?? "package-variant"),
    rarity: asString(raw.rarity, cached?.rarity ?? "common"),
    type: asNullableString(raw.type) ?? cached?.type ?? null,
    slot: asNullableString(raw.slot) ?? cached?.slot ?? null,
    subclass: asNullableString(raw.subclass) ?? cached?.subclass ?? null,
  };
}

export function normalizeChestRewardPayload(value: unknown): ChestRewardPayload {
  const raw = asRecord(value);
  return {
    item: normalizeChestRewardItem(raw.item),
    rarity: asOptionalString(raw.rarity),
    chest_name: asOptionalString(raw.chest_name),
    chest_rarity: asOptionalString(raw.chest_rarity),
    luck_bonus_percent: typeof raw.luck_bonus_percent === "number" ? raw.luck_bonus_percent : undefined,
    opened_from_inventory: typeof raw.opened_from_inventory === "boolean" ? raw.opened_from_inventory : undefined,
  };
}

export function getCachedCatalogItems() {
  return snapshot.catalogItemIds.map((itemId) => snapshot.itemsById[itemId]).filter(Boolean);
}

export function getItemStoreSnapshot() {
  return snapshot;
}
