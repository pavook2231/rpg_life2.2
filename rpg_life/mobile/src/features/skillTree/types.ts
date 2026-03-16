export type SkillCategory = "body" | "mind" | "career" | "social" | "finance";

export type SkillNode = {
  id: string;
  title: string;
  description: string;
  /** Extended description explaining skill mechanics and interactions */
  extendedDescription?: string;
  /** How this skill affects game mechanics */
  mechanics?: string[];
  /** Synergies with other skills/systems */
  synergies?: string[];
  requiredNodes: string[];
  unlockCondition: string;
  progress: number;
  xpReward: number;
  category: SkillCategory;
  unlocked: boolean;
  icon: string;
  accentColor: string;
};
