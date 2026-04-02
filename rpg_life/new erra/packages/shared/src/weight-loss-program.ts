import type {
  ActivityLevel,
  DailyQuest,
  DashboardSummary,
  EatingPattern,
  Gender,
  SleepQuality,
  WeightLossQuestionnaire
} from "./types";

const activityFactorMap: Record<ActivityLevel, number> = {
  low: 1.2,
  light: 1.35,
  moderate: 1.5,
  high: 1.7
};

const eatingPenaltyMap: Record<EatingPattern, number> = {
  balanced: 0,
  emotional: 120,
  late_snacking: 90,
  irregular: 100
};

const sleepPenaltyMap: Record<SleepQuality, number> = {
  poor: 120,
  average: 60,
  good: 0
};

function roundToNearestTen(value: number): number {
  return Math.max(0, Math.round(value / 10) * 10);
}

export function calculateCalorieTarget(profile: WeightLossQuestionnaire): number {
  const genderBonus: Record<Gender, number> = {
    male: 5,
    female: -161,
    other: -78
  };

  const bmr =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    genderBonus[profile.gender];

  const maintenance = bmr * activityFactorMap[profile.activityLevel];
  const deficit =
    450 +
    eatingPenaltyMap[profile.eatingPattern] * 0.2 +
    sleepPenaltyMap[profile.sleepQuality] * 0.1;

  return roundToNearestTen(Math.max(1200, maintenance - deficit));
}

export function calculateWaterTargetLiters(profile: WeightLossQuestionnaire): number {
  const base = profile.weightKg * 0.03;
  const activityBonus =
    profile.activityLevel === "high"
      ? 0.4
      : profile.activityLevel === "moderate"
        ? 0.2
        : 0;

  return Number(Math.min(4.5, Math.max(1.8, base + activityBonus)).toFixed(1));
}

export function calculateStepTarget(profile: WeightLossQuestionnaire, programDay: number): number {
  const baseByActivity: Record<ActivityLevel, number> = {
    low: 6500,
    light: 8000,
    moderate: 9500,
    high: 11000
  };

  const ramp = Math.min(2500, Math.max(0, programDay - 1) * 150);
  return Math.min(15000, baseByActivity[profile.activityLevel] + ramp);
}

export function buildDailyWeightLossQuests(
  profile: WeightLossQuestionnaire,
  programDay: number,
  streakDays: number
): DailyQuest[] {
  const calorieTarget = calculateCalorieTarget(profile);
  const waterTarget = calculateWaterTargetLiters(profile);
  const stepTarget = calculateStepTarget(profile, programDay);
  const difficulty = Math.min(5, Math.max(1, Math.ceil((programDay + streakDays) / 7))) as
    | 1
    | 2
    | 3
    | 4
    | 5;

  return [
    {
      id: `water-${programDay}`,
      kind: "water",
      title: "Выпей норму воды",
      description: `Твоя цель на сегодня — ${waterTarget} л воды.`,
      reasonText:
        "Достаточное количество воды помогает держать аппетит под контролем и легче соблюдать режим.",
      targetValue: waterTarget,
      unit: "л",
      xpReward: 40,
      difficultyLevel: difficulty,
      status: "available"
    },
    {
      id: `steps-${programDay}`,
      kind: "steps",
      title: "Пройди норму шагов",
      description: `Сделай не меньше ${stepTarget.toLocaleString("ru-RU")} шагов.`,
      reasonText:
        "Ходьба безопасно увеличивает расход энергии и помогает формировать устойчивую повседневную активность.",
      targetValue: stepTarget,
      unit: "шагов",
      xpReward: 60,
      difficultyLevel: difficulty,
      status: "available"
    },
    {
      id: `calories-${programDay}`,
      kind: "calories",
      title: "Удержись в лимите калорий",
      description: `Твой ориентир на сегодня — до ${calorieTarget.toLocaleString("ru-RU")} ккал.`,
      reasonText:
        "Контроль калорий создаёт устойчивый дефицит энергии и помогает снижать вес без резких ограничений.",
      targetValue: calorieTarget,
      unit: "ккал",
      xpReward: 80,
      difficultyLevel: difficulty,
      status: "available"
    }
  ];
}

export function buildDashboardSummary(
  profile: WeightLossQuestionnaire,
  options?: {
    currentWeightKg?: number;
    streakDays?: number;
    totalXp?: number;
    programDay?: number;
  }
): DashboardSummary {
  const currentWeightKg = options?.currentWeightKg ?? profile.weightKg;
  const streakDays = options?.streakDays ?? 0;
  const totalXp = options?.totalXp ?? 0;
  const programDay = options?.programDay ?? 1;

  return {
    currentWeightKg,
    goalWeightKg: profile.goalWeightKg,
    kilosLeft: Number(Math.max(0, currentWeightKg - profile.goalWeightKg).toFixed(1)),
    streakDays,
    totalXp,
    dailyCalorieTarget: calculateCalorieTarget(profile),
    dailyWaterTargetLiters: calculateWaterTargetLiters(profile),
    dailyStepTarget: calculateStepTarget(profile, programDay)
  };
}
