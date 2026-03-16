import type { GoalType } from "../goals/types";
import type { Quest, QuestDifficulty } from "../quests/types";

export type AIQuestRequest = {
  goalType: GoalType;
  userLevel: number;
  currentStreak: number;
  completedQuests: number;
  goalQuestPoints: number;
  recentQuestTitles?: string[];
};

export type AIQuestPlan = {
  goalType: GoalType;
  focusHeadline: string;
  overview: string;
  executionMode: string;
  winCondition: string;
  priorityChecklist: string[];
  adaptationNotes: string[];
  difficultyBias: QuestDifficulty;
  quests: Quest[];
};
