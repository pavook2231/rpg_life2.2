import type { Goal, GoalProgress } from "./types";

export function buildGoalProgress(params: {
  goal: Goal | null;
  currentQuestPoints: number;
  completedQuests: number;
  streak: number;
  nowIso?: string;
}): GoalProgress | null {
  const { goal, currentQuestPoints, completedQuests, streak, nowIso } = params;

  if (!goal) {
    return null;
  }

  const now = nowIso ? new Date(nowIso) : new Date();
  const startedAt = new Date(goal.startedAt);
  const deadlineAt = new Date(goal.deadlineAt);
  const currentDay = Math.max(1, Math.min(goal.durationDays, Math.floor((now.getTime() - startedAt.getTime()) / 86400000) + 1));
  const daysRemaining = Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / 86400000));
  const completionPercent = Math.max(0, Math.min(100, Math.round((currentQuestPoints / Math.max(goal.requiredQuestPoints, 1)) * 100)));

  return {
    goalId: goal.id,
    currentQuestPoints,
    requiredQuestPoints: goal.requiredQuestPoints,
    completionPercent,
    currentDay,
    daysRemaining,
    completedQuests,
    streak,
  };
}

