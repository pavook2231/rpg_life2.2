import type { Language } from "../../locales";
import { pickLocalized } from "../shared/localize";
import type { Goal, GoalDurationDays, GoalProgress, GoalType } from "./types";

type GoalTemplate = {
  goalType: GoalType;
  icon: string;
  accentColor: string;
  title: { ru: string; en: string };
  description: { ru: string; en: string };
  aiFocus: { ru: string; en: string };
};

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    goalType: "self_realization",
    icon: "star-four-points-outline",
    accentColor: "#f59e0b",
    title: { ru: "Самореализация", en: "Self-realization" },
    description: {
      ru: "Фокус на проявлении себя, дисциплине и личном вкладе в мир.",
      en: "Focus on expressing yourself, discipline, and meaningful personal impact.",
    },
    aiFocus: {
      ru: "раскрытии потенциала через публичные, творческие и дисциплинарные квесты",
      en: "unlocking potential through public, creative, and discipline-based quests",
    },
  },
  {
    goalType: "self_development",
    icon: "brain",
    accentColor: "#3b82f6",
    title: { ru: "Саморазвитие", en: "Self-development" },
    description: {
      ru: "Рост через обучение, книги, осознанность и регулярную практику.",
      en: "Grow through learning, books, mindfulness, and steady practice.",
    },
    aiFocus: {
      ru: "прокачке ума, осознанности и глубины обучения",
      en: "building mental strength, mindfulness, and depth of learning",
    },
  },
  {
    goalType: "weight_loss",
    icon: "run-fast",
    accentColor: "#22c55e",
    title: { ru: "Похудение", en: "Weight loss" },
    description: {
      ru: "Система привычек для движения, питания, воды и восстановления.",
      en: "A habit system for movement, nutrition, hydration, and recovery.",
    },
    aiFocus: {
      ru: "ежедневной активности, воде, шагам и устойчивой нагрузке",
      en: "daily activity, hydration, steps, and sustainable workload",
    },
  },
  {
    goalType: "financial_independence",
    icon: "cash-multiple",
    accentColor: "#eab308",
    title: { ru: "Финансовая независимость", en: "Financial independence" },
    description: {
      ru: "Контроль расходов, рост дохода, накопления и финансовая дисциплина.",
      en: "Control spending, grow income, build savings, and strengthen money discipline.",
    },
    aiFocus: {
      ru: "доходе, учете денег, экономии и полезных финансовых действиях",
      en: "income, money tracking, saving, and useful financial actions",
    },
  },
  {
    goalType: "new_profession",
    icon: "briefcase-variant-outline",
    accentColor: "#c084fc",
    title: { ru: "Новая профессия", en: "New profession" },
    description: {
      ru: "Переход в новую карьеру через обучение, портфолио и реальные шаги.",
      en: "Transition into a new career through learning, portfolio work, and real actions.",
    },
    aiFocus: {
      ru: "карьерных шагах, практике, проектах и трудоустройстве",
      en: "career moves, practical work, projects, and job search",
    },
  },
];

const QUEST_POINT_TARGETS: Record<GoalDurationDays, number> = {
  100: 24,
  200: 42,
  300: 60,
};

export function getGoalTemplate(goalType: GoalType) {
  return GOAL_TEMPLATES.find((goal) => goal.goalType === goalType) ?? GOAL_TEMPLATES[0];
}

export function listGoalTemplates(language: Language) {
  return GOAL_TEMPLATES.map((goal) => ({
    goalType: goal.goalType,
    icon: goal.icon,
    accentColor: goal.accentColor,
    title: pickLocalized(language, goal.title),
    description: pickLocalized(language, goal.description),
    aiFocus: pickLocalized(language, goal.aiFocus),
  }));
}

export function buildGoalCopy(goalType: GoalType, language: Language) {
  const template = getGoalTemplate(goalType);

  return {
    title: pickLocalized(language, template.title),
    description: pickLocalized(language, template.description),
    aiFocus: pickLocalized(language, template.aiFocus),
    icon: template.icon,
    accentColor: template.accentColor,
  };
}

export function getGoalQuestPointTarget(durationDays: GoalDurationDays) {
  return QUEST_POINT_TARGETS[durationDays];
}

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
