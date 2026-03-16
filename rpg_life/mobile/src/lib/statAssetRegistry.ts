import type { ImageSourcePropType } from "react-native";

const STAT_ASSET_REGISTRY: Record<string, ImageSourcePropType> = {
  strength: require("../../assets/stat-icons/strength.png"),
  agility: require("../../assets/stat-icons/agil.png"),
  agil: require("../../assets/stat-icons/agil.png"),
  intellect: require("../../assets/stat-icons/intellect.png"),
  stamina: require("../../assets/stat-icons/stamina.png"),
  armor: require("../../assets/stat-icons/armor.png"),
  crit: require("../../assets/stat-icons/creet.png"),
  creet: require("../../assets/stat-icons/creet.png"),
  luck: require("../../assets/stat-icons/lucky.png"),
  lucky: require("../../assets/stat-icons/lucky.png"),
  mana: require("../../assets/stat-icons/mana.png"),
  xp: require("../../assets/stat-icons/xp_bonus.png"),
  xp_bonus: require("../../assets/stat-icons/xp_bonus.png"),
};

const STAT_ALIASES: Record<string, string> = {
  arm_flex: "strength",
  run_fast: "agility",
  brain: "intellect",
  heart_pulse: "stamina",
  heart_plus: "stamina",
  shield: "armor",
  flash: "crit",
  clover: "luck",
  auto_fix: "mana",
  chart_line: "xp_bonus",
  agil: "agility",
  creet: "crit",
  lucky: "luck",
};

function normalizeStatKey(key?: string | null) {
  if (!key) return null;
  const normalized = key.toLowerCase().replace(/[-\s]/g, "_");
  return STAT_ALIASES[normalized] ?? normalized;
}

export function getStatAsset(key?: string | null) {
  const normalized = normalizeStatKey(key);
  if (!normalized) return null;
  return STAT_ASSET_REGISTRY[normalized] ?? null;
}
