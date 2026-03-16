import type { GoalType } from "../goals/types";

export type QuestType = "daily" | "goal" | "epic";
export type QuestDifficulty = "easy" | "medium" | "hard";
export type QuestProgressUnit = "steps" | "glasses" | "sessions" | "tasks" | "minutes" | "actions" | "meals" | "currency";

export type Quest = {
  id: string;
  title: string;
  description: string;
  difficulty: QuestDifficulty;
  xpReward: number;
  crystalReward?: number;
  rarity?: string;
  completed: boolean;
  type: QuestType;
  goalType: GoalType;
  source: "system" | "ai";
  targetValue: number;
  currentValue: number;
  progressUnit: QuestProgressUnit;
  rewardHint?: string;
  /** Optional backend quest id used to sync XP / achievements with the server */
  serverQuestId?: number;
  requiresInput?: boolean;
  inputPrompt?: string;
  inputType?: "text" | "number";
  userInput?: string;
};

