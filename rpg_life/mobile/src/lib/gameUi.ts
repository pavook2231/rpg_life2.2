type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function translateOrFallback(t: TranslateFn | undefined, key: string, fallback: string) {
  if (!t) {
    return fallback;
  }

  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function repairMojibake(value?: string | null) {
  if (!value) return "";

  const markers = ["Р ", "РЎ", "СЂ", "РІР‚", "РїС—Р…", "Рѓ", "Р‹", "в„ў"];
  if (!markers.some((marker) => value.includes(marker))) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    if (repaired && repaired !== value) {
      return repaired;
    }
  } catch {
    // Leave the original value untouched if decoding fails.
  }

  return value;
}

export function normalizeDisplayText(value?: string | null) {
  return repairMojibake(value)
    .replace(/РІР‚Сћ|вЂў/g, "•")
    .replace(/РїС—Р…/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getClassIcon(className?: string | null) {
  if (className === "warrior") return "sword-cross";
  if (className === "archer") return "bow-arrow";
  if (className === "mage") return "auto-fix";
  return "shield-account";
}

export function getClassLabel(className?: string | null, t?: TranslateFn) {
  if (className === "warrior") return translateOrFallback(t, "game.class.warrior", "Warrior");
  if (className === "archer") return translateOrFallback(t, "game.class.archer", "Archer");
  if (className === "mage") return translateOrFallback(t, "game.class.mage", "Mage");
  return translateOrFallback(t, "game.class.hero", "Hero");
}

export function getSlotLabel(slot?: string | null, t?: TranslateFn) {
  const labels: Record<string, string> = {
    head: translateOrFallback(t, "game.slots.head", "Head"),
    neck: translateOrFallback(t, "game.slots.neck", "Neck"),
    shoulders: translateOrFallback(t, "game.slots.shoulders", "Shoulders"),
    back: translateOrFallback(t, "game.slots.back", "Back"),
    chest: translateOrFallback(t, "game.slots.chest", "Chest"),
    wrist: translateOrFallback(t, "game.slots.wrist", "Wrist"),
    hands: translateOrFallback(t, "game.slots.hands", "Hands"),
    waist: translateOrFallback(t, "game.slots.waist", "Waist"),
    legs: translateOrFallback(t, "game.slots.legs", "Legs"),
    feet: translateOrFallback(t, "game.slots.feet", "Feet"),
    ring1: translateOrFallback(t, "game.slots.ring1", "Ring 1"),
    ring2: translateOrFallback(t, "game.slots.ring2", "Ring 2"),
    trinket1: translateOrFallback(t, "game.slots.trinket1", "Accessory 1"),
    trinket2: translateOrFallback(t, "game.slots.trinket2", "Accessory 2"),
    main_hand: translateOrFallback(t, "game.slots.mainHand", "Weapon"),
    off_hand: translateOrFallback(t, "game.slots.offHand", "Off-hand"),
    ranged: translateOrFallback(t, "game.slots.ranged", "Ranged"),
  };

  return (slot && labels[slot]) || translateOrFallback(t, "common.item", "Item");
}

export function normalizeItemText(value?: string | null) {
  return normalizeDisplayText(value)
    .replace(/\bpoyas\b/gi, (match) => (match[0] === match[0].toUpperCase() ? "Пояс" : "пояс"))
    .replace(/\bdager\b/gi, (match) => (match[0] === match[0].toUpperCase() ? "Кинжал" : "кинжал"))
    .replace(/\bdagger\b/gi, (match) => (match[0] === match[0].toUpperCase() ? "Кинжал" : "кинжал"))
    .replace(/\bbelt\b/gi, (match) => (match[0] === match[0].toUpperCase() ? "Пояс" : "пояс"));
}

export function getObjectiveLabel(value?: string | null, t?: TranslateFn) {
  const labels: Record<string, string> = {
    steps: translateOrFallback(t, "game.objectives.steps", "Steps"),
    quests_completed: translateOrFallback(t, "game.objectives.questsCompleted", "Quests"),
    xp_gained: translateOrFallback(t, "game.objectives.xpGained", "Experience"),
    workouts: translateOrFallback(t, "game.objectives.workouts", "Workouts"),
  };

  return (value && labels[value]) || translateOrFallback(t, "game.objectives.activity", "Activity");
}

export function getRarityLabel(rarity?: string | null, t?: TranslateFn) {
  const labels: Record<string, string> = {
    common: translateOrFallback(t, "game.rarities.common", "Common"),
    uncommon: translateOrFallback(t, "game.rarities.uncommon", "Uncommon"),
    rare: translateOrFallback(t, "game.rarities.rare", "Rare"),
    epic: translateOrFallback(t, "game.rarities.epic", "Epic"),
    legendary: translateOrFallback(t, "game.rarities.legendary", "Legendary"),
    immortal: translateOrFallback(t, "game.rarities.immortal", "Immortal"),
  };

  return (rarity && labels[rarity]) || (rarity ?? translateOrFallback(t, "game.rarities.common", "Common"));
}

export function getRarityColor(rarity?: string | null) {
  const colors: Record<string, string> = {
    common: "#94a3b8",
    uncommon: "#4ade80",
    rare: "#38bdf8",
    epic: "#c084fc",
    legendary: "#f59e0b",
    immortal: "#a855f7",
    earned: "#f59e0b",
    available: "#38bdf8",
    locked: "#94a3b8",
  };

  return (rarity && colors[rarity]) || "#94a3b8";
}

export function formatGender(value?: string | null, t?: TranslateFn) {
  if (value === "male") return translateOrFallback(t, "game.gender.male", "Male");
  if (value === "female") return translateOrFallback(t, "game.gender.female", "Female");
  if (value === "nonbinary") return translateOrFallback(t, "game.gender.nonbinary", "Non-binary");
  return translateOrFallback(t, "game.gender.unspecified", "Not specified");
}
