export type RewardType = "xp" | "item" | "title" | "cosmetic" | "skill_unlock";
export type RewardRarity = "rare" | "mythical" | "legendary";

export type Reward = {
  id: string;
  type: RewardType;
  title: string;
  description: string;
  rarity: RewardRarity;
  icon: string;
  xpAmount?: number;
  payload?: string;
  claimedAt: string;
};

