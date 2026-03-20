import type { BootstrapPayload, CharacterProfilePayload, InventoryItem, ProfilePayload } from "../api/game";

type EquipmentOverviewLike = {
  equipment?: Array<{
    inventory_id: number;
  }> | null;
  bag_items?: InventoryItem[] | null;
} | null;

type UnlockInput = {
  profile?: ProfilePayload | null;
  hero?: CharacterProfilePayload["character"] | null;
  rewards?: BootstrapPayload["rewards_summary"] | null;
  inventory?: InventoryItem[] | null;
  equipment?: EquipmentOverviewLike;
};

export type NavigationUnlockState = {
  hasGoal: boolean;
  hasQuestProgress: boolean;
  hasInventoryItems: boolean;
  hasEquippedItems: boolean;
  hasFriends: boolean;
  inventoryResolved: boolean;
  shopUnlocked: boolean;
  socialUnlocked: boolean;
  coopUnlocked: boolean;
};

export function getNavigationUnlockState({
  profile,
  hero,
  rewards,
  inventory,
  equipment,
}: UnlockInput): NavigationUnlockState {
  const hasGoal = Boolean(profile?.goal);
  const hasQuestProgress = Boolean(
    (profile?.goal?.daily_limits?.completed_total ?? 0) > 0 ||
      (hero?.current_xp ?? 0) > 0 ||
      (hero?.level ?? 1) > 1,
  );

  const equippedCount = equipment?.equipment?.length ?? 0;
  const bagItemsCount = equipment?.bag_items?.length ?? 0;
  const inventoryCount = inventory?.length ?? 0;
  const inventoryResolved = equipment != null || inventoryCount > 0;
  const hasInventoryItems = inventoryCount > 0 || bagItemsCount > 0 || equippedCount > 0;
  const hasEquippedItems = equippedCount > 0;
  const hasFriends = (rewards?.social_pulse?.friends_count ?? 0) > 0;
  const socialUnlocked = hasEquippedItems || hasFriends || (hasQuestProgress && hasInventoryItems);

  return {
    hasGoal,
    hasQuestProgress,
    hasInventoryItems,
    hasEquippedItems,
    hasFriends,
    inventoryResolved,
    shopUnlocked: hasQuestProgress,
    socialUnlocked,
    coopUnlocked: hasFriends,
  };
}
