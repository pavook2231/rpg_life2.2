import {
  activityLevelLabels,
  buildDashboardSummary,
  buildDailyWeightLossQuests,
  eatingPatternLabels,
  genderLabels,
  sleepQualityLabels,
  type DailyQuest,
  type WeightLossQuestionnaire
} from "@new-erra/shared";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AppPreferences = {
  language: "ru" | "en";
  theme: "system" | "light" | "dark";
};

export type AppSession = {
  user: AppUser;
  questionnaire: WeightLossQuestionnaire;
  quests: DailyQuest[];
  programDay: number;
  streakDays: number;
  totalXp: number;
  currentWeightKg: number;
  preferences: AppPreferences;
};

export type RegisterFormPayload = {
  email: string;
  password: string;
  fullName: string;
  questionnaire: WeightLossQuestionnaire;
};

let memorySession: AppSession | null = null;
let memoryPassword = "Password123";

function createSession(payload: RegisterFormPayload): AppSession {
  return {
    user: {
      id: `demo_${Date.now()}`,
      email: payload.email,
      fullName: payload.fullName
    },
    questionnaire: payload.questionnaire,
    quests: buildDailyWeightLossQuests(payload.questionnaire, 1, 0),
    programDay: 1,
    streakDays: 0,
    totalXp: 0,
    currentWeightKg: payload.questionnaire.weightKg,
    preferences: {
      language: "ru",
      theme: "system"
    }
  };
}

export async function registerDemoSession(payload: RegisterFormPayload) {
  memoryPassword = payload.password;
  memorySession = createSession(payload);
  return memorySession;
}

export async function loginDemoSession(email: string, password: string) {
  if (!memorySession) {
    memorySession = createSession({
      email,
      password,
      fullName: "Новый герой",
      questionnaire: {
        age: 29,
        gender: "female",
        heightCm: 168,
        weightKg: 83,
        activityLevel: "light",
        eatingPattern: "late_snacking",
        sleepQuality: "average",
        goalWeightKg: 68
      }
    });
  }

  if (memorySession.user.email !== email || password !== memoryPassword) {
    throw new Error("Неверный email или пароль");
  }

  return memorySession;
}

export async function logoutDemoSession() {
  return true;
}

export async function getCurrentSession() {
  return memorySession;
}

export async function completeDemoQuest(questId: string) {
  if (!memorySession) {
    throw new Error("Сессия не найдена");
  }

  const quest = memorySession.quests.find((item) => item.id === questId);
  if (!quest || quest.status === "completed") {
    return memorySession;
  }

  const updatedQuests: DailyQuest[] = memorySession.quests.map((item) =>
    item.id === questId ? { ...item, status: "completed" as const } : item
  );
  const totalXp = memorySession.totalXp + quest.xpReward;
  const completedDay = updatedQuests.every((item) => item.status === "completed");

  if (completedDay) {
    const nextProgramDay = memorySession.programDay + 1;
    const nextStreak = memorySession.streakDays + 1;
    memorySession = {
      ...memorySession,
      totalXp,
      streakDays: nextStreak,
      programDay: nextProgramDay,
      quests: buildDailyWeightLossQuests(memorySession.questionnaire, nextProgramDay, nextStreak)
    };
    return memorySession;
  }

  memorySession = {
    ...memorySession,
    totalXp,
    quests: updatedQuests
  };

  return memorySession;
}

export async function updateDemoProfile(
  patch: Partial<Pick<AppSession, "currentWeightKg">> & { fullName?: string; goalWeightKg?: number }
) {
  if (!memorySession) {
    throw new Error("Сессия не найдена");
  }

  memorySession = {
    ...memorySession,
    currentWeightKg: patch.currentWeightKg ?? memorySession.currentWeightKg,
    user: {
      ...memorySession.user,
      fullName: patch.fullName ?? memorySession.user.fullName
    },
    questionnaire: {
      ...memorySession.questionnaire,
      goalWeightKg: patch.goalWeightKg ?? memorySession.questionnaire.goalWeightKg
    }
  };

  return memorySession;
}

export async function updateDemoPreferences(preferences: Partial<AppPreferences>) {
  if (!memorySession) {
    throw new Error("Сессия не найдена");
  }

  memorySession = {
    ...memorySession,
    preferences: {
      ...memorySession.preferences,
      ...preferences
    }
  };

  return memorySession.preferences;
}

export async function changeDemoPassword(currentPassword: string, nextPassword: string) {
  if (currentPassword !== memoryPassword) {
    throw new Error("Текущий пароль введён неверно");
  }

  memoryPassword = nextPassword;
  return true;
}

export async function requestDemoPasswordReset(email: string) {
  if (!email.trim()) {
    throw new Error("Укажи email, чтобы мы подготовили восстановление.");
  }

  return {
    ok: true,
    message:
      "Инструкция по восстановлению уже готова. В следующем шаге сюда подключится реальная отправка письма."
  };
}

export function getSummary(session: AppSession) {
  return buildDashboardSummary(session.questionnaire, {
    currentWeightKg: session.currentWeightKg,
    streakDays: session.streakDays,
    totalXp: session.totalXp,
    programDay: session.programDay
  });
}

export function getRussianProfileFacts(session: AppSession) {
  return [
    ["Пол", genderLabels[session.questionnaire.gender]],
    ["Возраст", `${session.questionnaire.age} лет`],
    ["Рост", `${session.questionnaire.heightCm} см`],
    ["Текущий вес", `${session.currentWeightKg} кг`],
    ["Цель", `${session.questionnaire.goalWeightKg} кг`],
    ["Активность", activityLevelLabels[session.questionnaire.activityLevel]],
    ["Питание", eatingPatternLabels[session.questionnaire.eatingPattern]],
    ["Сон", sleepQualityLabels[session.questionnaire.sleepQuality]]
  ];
}
