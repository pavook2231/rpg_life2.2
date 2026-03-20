import { buildItemStatEntries, getAvailableSlots, pickEquipSlot, type ItemStatEntry } from "./equipment";
import { getSlotLabel, normalizeItemText } from "./gameUi";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type ComparableItemPayload = {
  name?: string;
  type?: string;
  slot?: string | null;
  subclass?: string | null;
};

type ComparableDetail = {
  inventory_id?: number;
  is_equipped?: boolean;
  item?: ComparableItemPayload;
  type?: string;
  slot?: string | null;
  subclass?: string | null;
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

type EquippedEntry = {
  slot: string;
  inventory_id?: number;
  item?: ComparableItemPayload;
  weapon_stats?: ComparableDetail["weapon_stats"];
  armor_stats?: ComparableDetail["armor_stats"];
};

type ComparisonRow = {
  label: string;
  currentValue: string;
  nextValue: string;
  delta: number;
};

export type ItemComparisonResult = {
  comparisonTitle: string;
  comparisonIntro: string;
  comparisonRows: ComparisonRow[];
};

const METRIC_ORDER: Record<string, number> = {
  damage: 0,
  armor: 1,
  strength: 2,
  agility: 3,
  intellect: 4,
  stamina: 5,
  health: 6,
  xp_bonus: 7,
  crystal_bonus: 8,
};

function getItemPayload(detail: ComparableDetail) {
  return detail.item ?? detail;
}

function dedupeStatEntries(entries: ItemStatEntry[]) {
  const map = new Map<string, ItemStatEntry>();
  for (const entry of entries) {
    if (!map.has(entry.key)) {
      map.set(entry.key, entry);
    }
  }
  return map;
}

function buildComparisonEntries(detail: ComparableDetail, t: TranslateFn) {
  return dedupeStatEntries(buildItemStatEntries(detail as never, t));
}

function buildZeroEntry(entry: ItemStatEntry): ItemStatEntry {
  if (entry.key === "damage") {
    return {
      ...entry,
      value: 0,
      displayValue: "0-0",
    };
  }

  return {
    ...entry,
    value: 0,
    displayValue: "0",
  };
}

function normalizeDelta(delta: number) {
  if (!Number.isFinite(delta)) {
    return 0;
  }
  return Number.isInteger(delta) ? delta : Number(delta.toFixed(1));
}

export function buildItemComparison(
  detail: ComparableDetail | null | undefined,
  equippedEntries: EquippedEntry[] = [],
  t: TranslateFn,
): ItemComparisonResult | null {
  if (!detail) {
    return null;
  }

  const item = getItemPayload(detail);
  if (!item?.type || item.type === "chest") {
    return null;
  }

  const availableSlots = getAvailableSlots(detail as never);
  if (!availableSlots.length) {
    return null;
  }

  const targetSlot = pickEquipSlot(detail as never, equippedEntries as never);
  const equippedEntry = equippedEntries.find((entry) => entry.slot === targetSlot) ?? null;
  if (detail.inventory_id && equippedEntry?.inventory_id === detail.inventory_id) {
    return null;
  }

  const nextEntries = buildComparisonEntries(detail, t);
  if (!nextEntries.size) {
    return null;
  }

  const currentEntries = equippedEntry
    ? buildComparisonEntries(
        {
          item: equippedEntry.item,
          weapon_stats: equippedEntry.weapon_stats ?? null,
          armor_stats: equippedEntry.armor_stats ?? null,
        },
        t,
      )
    : new Map<string, ItemStatEntry>();

  const rowCandidates = [...new Set([...nextEntries.keys(), ...currentEntries.keys()])]
    .map((key) => {
      const template = nextEntries.get(key) ?? currentEntries.get(key);
      if (!template) {
        return null;
      }

      const currentEntry = currentEntries.get(key) ?? buildZeroEntry(template);
      const nextEntry = nextEntries.get(key) ?? buildZeroEntry(template);

      return {
        key,
        label: template.label,
        currentValue: currentEntry.displayValue,
        nextValue: nextEntry.displayValue,
        delta: normalizeDelta(nextEntry.value - currentEntry.value),
      };
    });

  const rows = rowCandidates
    .filter((row): row is ComparisonRow & { key: string } => row !== null)
    .sort((left, right) => {
      const leftOrder = METRIC_ORDER[left.key] ?? 99;
      const rightOrder = METRIC_ORDER[right.key] ?? 99;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.label.localeCompare(right.label);
    })
    .map(({ key: _key, ...row }) => row);

  if (!rows.length) {
    return null;
  }

  const slotLabel = getSlotLabel(targetSlot, t);
  const equippedItemName = normalizeItemText(equippedEntry?.item?.name);

  return {
    comparisonTitle: t("common.itemComparisonTitle"),
    comparisonIntro: equippedEntry
      ? t("common.itemComparisonIntroEquipped", {
          slot: slotLabel,
          itemName: equippedItemName || t("common.item"),
        })
      : t("common.itemComparisonIntroEmpty", { slot: slotLabel }),
    comparisonRows: rows,
  };
}
