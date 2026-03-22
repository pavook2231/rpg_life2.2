export type ItemStatKey =
  | "attack"
  | "defense"
  | "hp"
  | "damage_min"
  | "damage_max"
  | "armor_value"
  | "strength_bonus"
  | "agility_bonus"
  | "intellect_bonus"
  | "stamina_bonus"
  | "critical_bonus"
  | "luck_bonus"
  | "xp_bonus"
  | "crystal_bonus"
  | "health_bonus";

export type ItemStats = Partial<Record<ItemStatKey, number>>;

export type ItemWeaponStats = {
  weapon_type?: string;
  weapon_category?: string;
  damage_min: number;
  damage_max: number;
  speed?: number;
  dps?: number;
  critical_strike_chance?: number;
  required_strength?: number;
  required_agility?: number;
  required_intellect?: number;
} | null;

export type ItemArmorStats = {
  armor_type?: string;
  armor_value: number;
  slot?: string;
  dodge_chance?: number;
  block_chance?: number;
} | null;

export type CanonicalItem = {
  id: number;
  name: string;
  description?: string;
  rarity: string;
  image: string;
  icon: string;
  type: string;
  subclass?: string | null;
  slot: string | null;
  strength_bonus?: number;
  agility_bonus?: number;
  intellect_bonus?: number;
  stamina_bonus?: number;
  critical_bonus?: number;
  luck_bonus?: number;
  xp_bonus?: number;
  crystal_bonus?: number;
  health_bonus?: number;
  required_level: number;
  required_class?: string | null;
  set_name?: string | null;
  price: number;
  price_crystals: number;
  stats: ItemStats;
  weapon_stats?: ItemWeaponStats;
  armor_stats?: ItemArmorStats;
};

export type InventoryItem = {
  id: number;
  inventory_id: number;
  item_id: number;
  quantity: number;
  is_equipped: boolean;
  acquired_at?: string | null;
  item: CanonicalItem;
  weapon_stats?: ItemWeaponStats;
  armor_stats?: ItemArmorStats;
  sell_price?: number;
};

export type EquipmentEntry = {
  slot: string;
  inventory_id: number;
  item: CanonicalItem;
  weapon_stats?: ItemWeaponStats;
  armor_stats?: ItemArmorStats;
};

export type EquipmentOverviewPayload = {
  class_info: {
    id: number;
    class_name: string;
    display_name: string | null;
    level: number;
    current_xp: number;
    crystals: number;
    strength: number;
    agility: number;
    intellect: number;
    stamina: number;
  };
  equipment_totals: {
    strength: number;
    agility: number;
    intellect: number;
    stamina: number;
    critical_chance: number;
    luck: number;
    health: number;
    armor: number;
    damage_min: number;
    damage_max: number;
    dps: number;
  };
  reward_effects: {
    xp_bonus_percent: number;
    gold_bonus_percent: number;
    crit_reward_chance_percent: number;
    loot_bonus_percent: number;
    armor_reduction_percent?: number;
    system_daily_cap?: number;
  };
  equipment: EquipmentEntry[];
  bag_items: InventoryItem[];
  set_bonuses?: Array<{
    set_name: string;
    name: string;
    description: string;
    active_pieces: number;
    bonus: Record<string, number>;
  }>;
  secondary_skills?: unknown;
};

export type ShopItemPayload = CanonicalItem & {
  chest_name?: string;
};

export type ShopPurchasePayload = {
  ok: boolean;
  kind: "item" | "chest";
  chest_name?: string;
  inventory_id?: number;
  chest_item?: {
    id?: number | null;
    name: string;
    rarity: string;
    icon: string;
    image?: string;
  } | null;
};

export type ShopPayload = {
  items: ShopItemPayload[];
  crystals: number;
  character_level: number;
  refresh_cost: number;
  refresh_cooldown_seconds: number;
  refresh_available_at?: string | null;
  refresh_remaining_seconds: number;
  can_refresh: boolean;
  next_rotation_at: string;
};

export type ChestRewardItem = {
  id?: number;
  name: string;
  icon?: string;
  image?: string;
  rarity?: string;
  type?: string | null;
  slot?: string | null;
  subclass?: string | null;
};

export type ChestRewardPayload = {
  item: ChestRewardItem;
  rarity?: string;
  chest_name?: string;
  chest_rarity?: string;
  luck_bonus_percent?: number;
  opened_from_inventory?: boolean;
};

export type InventoryPagePayload = {
  items: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
};
