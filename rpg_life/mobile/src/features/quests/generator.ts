import type { Language } from "../../locales";
import { generateAiQuestPlan } from "../aiAssistant/generator";
import type { GoalType } from "../goals/types";
import type { Quest } from "./types";

function cloneQuest(quest: Quest, suffix: string, type: Quest["type"]): Quest {
  return {
    ...quest,
    id: `${quest.id}-${suffix}`,
    type,
    completed: false,
    currentValue: 0,
  };
}

export function generateQuestBoard(params: {
  goalType: GoalType;
  userLevel: number;
  currentStreak: number;
  completedQuests: number;
  goalQuestPoints: number;
  language: Language;
  recentQuestTitles?: string[];
}) {
  const plan = generateAiQuestPlan(
    {
      goalType: params.goalType,
      userLevel: params.userLevel,
      currentStreak: params.currentStreak,
      completedQuests: params.completedQuests,
      goalQuestPoints: params.goalQuestPoints,
      recentQuestTitles: params.recentQuestTitles,
    },
    params.language,
  );

  const mapRarity = (difficulty: Quest["difficulty"]) => {
    if (difficulty === "hard") return "legendary";
    if (difficulty === "medium") return "rare";
    return "common";
  };

  const buildQuest = (quest: Quest, suffix: string, type: Quest["type"]) => {
    const base = cloneQuest(quest, suffix, type);
    const rarity = mapRarity(base.difficulty);
    const crystalReward = Math.max(10, Math.floor(base.xpReward * 0.25));

    return {
      ...base,
      rarity,
      crystalReward,
    };
  };

  const dailyQuests = plan.quests.slice(0, 3).map((quest, index) => buildQuest(quest, `daily-${index}`, "daily"));
  const goalQuests = plan.quests.slice(1, 4).map((quest, index) => ({
    ...buildQuest(quest, `goal-${index}`, "goal"),
    xpReward: quest.xpReward + 20,
    crystalReward: Math.max(15, Math.floor((quest.xpReward + 20) * 0.25)),
    rewardHint: params.language === "en" ? "Goal milestone reward" : "Награда за прогресс цели",
  }));

  return {
    dailyQuests,
    goalQuests,
    advisorPlan: plan,
  };
}

