import {
  CHARACTER_EQUIPMENT_ASSETS,
  type Equipment as LayeredEquipment,
} from "../components/CharacterView";

type EquipmentEntry = {
  slot: string;
  item?: { icon?: string | null; subclass?: string | null };
  weapon_stats?: { weapon_category?: string | null } | null;
};

export function mapEquipmentToLayers(entries: EquipmentEntry[] = []): LayeredEquipment {
  const layered: LayeredEquipment = {};

  function resolveLayerKey(
    slot: keyof LayeredEquipment,
    preferredKey: string | null | undefined,
    fallbackKey: string,
  ) {
    if (preferredKey && CHARACTER_EQUIPMENT_ASSETS[slot]?.[preferredKey]) {
      return preferredKey;
    }
    return CHARACTER_EQUIPMENT_ASSETS[slot]?.[fallbackKey] ? fallbackKey : undefined;
  }

  for (const entry of entries) {
    const itemIcon = entry.item?.icon;

    if (entry.slot === "head") layered.head = resolveLayerKey("head", itemIcon, "helmet1");
    if (entry.slot === "shoulders") layered.shoulders = resolveLayerKey("shoulders", itemIcon, "shoulders1");
    if (entry.slot === "chest") layered.chest = resolveLayerKey("chest", itemIcon, "armor1");
    if (entry.slot === "wrist" || entry.slot === "hands") layered.wrists = resolveLayerKey("wrists", itemIcon, "wrists1");
    if (entry.slot === "waist") layered.belt = resolveLayerKey("belt", itemIcon, "belt1");
    if (entry.slot === "legs") layered.legs = resolveLayerKey("legs", itemIcon, "pants1");
    if (entry.slot === "feet") layered.boots = resolveLayerKey("boots", itemIcon, "boots1");
    if (entry.slot === "back") layered.cloak = resolveLayerKey("cloak", itemIcon, "cloak1");
    if (entry.slot === "main_hand" || entry.slot === "off_hand" || entry.slot === "ranged") {
      const weaponCategory = entry.weapon_stats?.weapon_category;
      const subclass = entry.item?.subclass;
      const hasNoMatchingLayerArt =
        weaponCategory === "ranged" ||
        subclass === "bow" ||
        subclass === "staff" ||
        subclass === "spellbook";
      if (!hasNoMatchingLayerArt) {
        layered.weapon = resolveLayerKey("weapon", itemIcon, "sword1");
      }
    }
  }

  return layered;
}
