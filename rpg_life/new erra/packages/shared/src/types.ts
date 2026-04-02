export type Gender = "male" | "female" | "other";

export type ActivityLevel = "low" | "light" | "moderate" | "high";

export type EatingPattern = "balanced" | "emotional" | "late_snacking" | "irregular";

export type SleepQuality = "poor" | "average" | "good";

export type QuestKind = "water" | "steps" | "calories";

export type QuestStatus = "available" | "completed" | "skipped";

export type WeightLossQuestionnaire = {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  eatingPattern: EatingPattern;
  sleepQuality: SleepQuality;
  goalWeightKg: number;
};

export type DailyQuest = {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  reasonText: string;
  targetValue: number;
  unit: string;
  xpReward: number;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  status: QuestStatus;
};

export type DashboardSummary = {
  currentWeightKg: number;
  goalWeightKg: number;
  kilosLeft: number;
  streakDays: number;
  totalXp: number;
  dailyCalorieTarget: number;
  dailyWaterTargetLiters: number;
  dailyStepTarget: number;
};

export const activityLevelLabels: Record<ActivityLevel, string> = {
  low: "Низкая активность",
  light: "Лёгкая активность",
  moderate: "Средняя активность",
  high: "Высокая активность"
};

export const eatingPatternLabels: Record<EatingPattern, string> = {
  balanced: "Питание в целом стабильное",
  emotional: "Есть эмоциональные переедания",
  late_snacking: "Есть поздние вечерние перекусы",
  irregular: "Режим питания нерегулярный"
};

export const sleepQualityLabels: Record<SleepQuality, string> = {
  poor: "Сон чаще слабый",
  average: "Сон средний",
  good: "Сон хороший"
};

export const genderLabels: Record<Gender, string> = {
  male: "Мужчина",
  female: "Женщина",
  other: "Другое"
};
