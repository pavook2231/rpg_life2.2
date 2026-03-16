export type GoalType =
  | "self_realization"
  | "self_development"
  | "weight_loss"
  | "financial_independence"
  | "new_profession";

export type GoalDurationDays = 100 | 200 | 300;

export type GoalStatus = "active" | "completed";

export type Goal = {
  id: string;
  title: string;
  description: string;
  goalType: GoalType;
  durationDays: GoalDurationDays;
  startedAt: string;
  deadlineAt: string;
  requiredQuestPoints: number;
  icon: string;
  accentColor: string;
  status: GoalStatus;
};

export type GoalProgress = {
  goalId: string;
  currentQuestPoints: number;
  requiredQuestPoints: number;
  completionPercent: number;
  currentDay: number;
  daysRemaining: number;
  completedQuests: number;
  streak: number;
};

