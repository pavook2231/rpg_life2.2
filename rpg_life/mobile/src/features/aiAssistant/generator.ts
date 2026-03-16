import type { Language } from "../../locales";
import { buildGoalCopy } from "../goals/catalog";
import type { GoalType } from "../goals/types";
import { pickLocalized } from "../shared/localize";
import type { AIQuestPlan, AIQuestRequest } from "./types";

type QuestSeed = {
  title: { ru: string; en: string };
  description: { ru: string; en: string };
  unit: "steps" | "glasses" | "sessions" | "tasks" | "minutes" | "actions" | "meals" | "currency";
  targetEasy: number;
  targetMedium: number;
  targetHard: number;
  requiresInput?: boolean;
  inputPrompt?: { ru: string; en: string };
  inputType?: "text" | "number";
};

const QUEST_SEEDS: Record<GoalType, QuestSeed[]> = {
  self_realization: [
    {
      title: { ru: "Сделай один смелый шаг", en: "Take one bold step" },
      description: { ru: "Сделай действие, которое продвигает тебя вперед, даже если страшно.", en: "Take one action that moves you forward, even if it feels scary." },
      unit: "actions",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
    {
      title: { ru: "Творческая практика", en: "Creative practice" },
      description: { ru: "Выдели время на творчество, идею или личный проект.", en: "Set aside time for creativity, ideas, or a personal project." },
      unit: "minutes",
      targetEasy: 20,
      targetMedium: 40,
      targetHard: 60,
    },
    {
      title: { ru: "Покажи результат миру", en: "Share your progress" },
      description: { ru: "Опубликуй, покажи или обсуди то, что создал.", en: "Publish, show, or discuss what you created." },
      unit: "actions",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
  ],
  self_development: [
    {
      title: { ru: "Глубокое обучение", en: "Deep learning session" },
      description: { ru: "Проведи сфокусированную сессию изучения без отвлечений.", en: "Complete a focused learning session without distractions." },
      unit: "minutes",
      targetEasy: 25,
      targetMedium: 45,
      targetHard: 70,
    },
    {
      title: { ru: "Конспект и выводы", en: "Notes and takeaways" },
      description: { ru: "Сделай заметки и зафиксируй главные идеи после обучения.", en: "Write notes and capture the key takeaways after learning." },
      unit: "tasks",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
    {
      title: { ru: "Осознанная пауза", en: "Mindfulness pause" },
      description: { ru: "Сделай паузу на дыхание, медитацию или тишину.", en: "Take time for breathing, meditation, or a quiet reset." },
      unit: "minutes",
      targetEasy: 5,
      targetMedium: 10,
      targetHard: 20,
    },
  ],
  new_profession: [
    {
      title: { ru: "Практика по новой профессии", en: "Career practice" },
      description: { ru: "Сделай практическое задание по новой специальности.", en: "Complete a practical task related to your new profession." },
      unit: "minutes",
      targetEasy: 30,
      targetMedium: 60,
      targetHard: 90,
    },
    {
      title: { ru: "Шаг в портфолио", en: "Portfolio progress" },
      description: { ru: "Улучши портфолио, кейс или рабочий профиль.", en: "Improve your portfolio, case study, or working profile." },
      unit: "tasks",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
    {
      title: { ru: "Контакт с рынком", en: "Market outreach" },
      description: { ru: "Сделай действие для выхода на рынок: отклик, письмо, разговор.", en: "Take one market-facing action: apply, write, or talk to someone." },
      unit: "actions",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
  ],
  weight_loss: [
    {
      title: { ru: "Отслеживай шаги", en: "Track your steps" },
      description: { ru: "Пройди определенное количество шагов для здоровья.", en: "Walk a certain number of steps for health." },
      unit: "steps",
      targetEasy: 5000,
      targetMedium: 8000,
      targetHard: 10000,
      requiresInput: true,
      inputPrompt: { ru: "Сколько шагов ты прошел?", en: "How many steps did you walk?" },
      inputType: "number",
    },
    {
      title: { ru: "Здоровое питание", en: "Healthy eating" },
      description: { ru: "Приготовь и съешь здоровую еду.", en: "Prepare and eat healthy food." },
      unit: "meals",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
    {
      title: { ru: "Физическая активность", en: "Physical activity" },
      description: { ru: "Занимайся спортом или упражнениями.", en: "Engage in sports or exercises." },
      unit: "minutes",
      targetEasy: 20,
      targetMedium: 40,
      targetHard: 60,
    },
  ],
  financial_independence: [
    {
      title: { ru: "Сэкономь деньги", en: "Save money" },
      description: { ru: "Отложи определенную сумму на сбережения.", en: "Save a certain amount for savings." },
      unit: "currency",
      targetEasy: 100,
      targetMedium: 200,
      targetHard: 500,
      requiresInput: true,
      inputPrompt: { ru: "Сколько денег ты сэкономил?", en: "How much money did you save?" },
      inputType: "number",
    },
    {
      title: { ru: "Инвестируй", en: "Invest" },
      description: { ru: "Сделай инвестицию в будущее.", en: "Make an investment in your future." },
      unit: "actions",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
    {
      title: { ru: "Увеличь доход", en: "Increase income" },
      description: { ru: "Сделай шаг к увеличению дохода.", en: "Take a step to increase your income." },
      unit: "actions",
      targetEasy: 1,
      targetMedium: 2,
      targetHard: 3,
    },
  ],
};

function pickDifficulty(options: {
  userLevel: number;
  currentStreak: number;
  completedQuests: number;
  goalQuestPoints: number;
}) {
  const { userLevel, currentStreak, completedQuests, goalQuestPoints } = options;
  const momentum = Math.min(1, completedQuests / 8);
  const goalProgress = Math.min(1, goalQuestPoints / 40);

  // If the user is still warming up, keep the plan very approachable.
  if (completedQuests < 3 || goalQuestPoints < 20) {
    return "easy" as const;
  }

  // If the user is consistently progressing, scale up difficulty.
  if (userLevel >= 8 || currentStreak >= 12 || momentum >= 0.8 || goalProgress >= 0.9) {
    return "hard" as const;
  }

  if (userLevel >= 4 || currentStreak >= 5 || momentum >= 0.5 || goalProgress >= 0.5) {
    return "medium" as const;
  }

  return "easy" as const;
}

function buildTarget(seed: QuestSeed, difficulty: "easy" | "medium" | "hard") {
  if (difficulty === "hard") {
    return seed.targetHard;
  }
  if (difficulty === "medium") {
    return seed.targetMedium;
  }
  return seed.targetEasy;
}

function buildXpReward(difficulty: "easy" | "medium" | "hard", streak: number) {
  const base = difficulty === "hard" ? 90 : difficulty === "medium" ? 55 : 30;
  return base + Math.min(40, streak * 2);
}

function buildCrystalReward(difficulty: "easy" | "medium" | "hard") {
  if (difficulty === "hard") {
    return 26;
  }
  if (difficulty === "medium") {
    return 16;
  }
  return 8;
}

function buildQuestRarity(difficulty: "easy" | "medium" | "hard") {
  if (difficulty === "hard") {
    return "epic";
  }
  if (difficulty === "medium") {
    return "rare";
  }
  return "uncommon";
}

function buildExecutionMode(difficulty: "easy" | "medium" | "hard", language: Language) {
  if (difficulty === "hard") {
    return language === "en"
      ? "Push mode: stronger stretch tasks and one epic finisher."
      : "Режим рывка: больше задач на рост и один эпический финишер.";
  }
  if (difficulty === "medium") {
    return language === "en"
      ? "Balance mode: stable progress with one meaningful stretch task."
      : "Режим баланса: стабильный прогресс плюс одна заметная задача на рост.";
  }
  return language === "en"
    ? "Momentum mode: easy wins that rebuild consistency."
    : "Режим разгона: лёгкие победы, которые возвращают ритм.";
}

function buildWinCondition(difficulty: "easy" | "medium" | "hard", language: Language) {
  if (difficulty === "hard") {
    return language === "en"
      ? "Complete 3 quests, including the epic quest."
      : "Закрой 3 задания, включая эпическое.";
  }
  if (difficulty === "medium") {
    return language === "en"
      ? "Complete 3 quests or reach about 70% of the planned effort."
      : "Закрой 3 задания или выполни около 70% общего плана.";
  }
  return language === "en"
    ? "Complete any 2 quests and protect the streak."
    : "Сделай любые 2 задания и сохрани серию.";
}

function buildPriorityChecklist(options: {
  difficulty: "easy" | "medium" | "hard";
  request: AIQuestRequest;
  goalFocus: string;
  language: Language;
}) {
  const { difficulty, request, goalFocus, language } = options;
  const isEn = language === "en";

  return [
    isEn ? `Anchor the day around ${goalFocus}.` : `Построй день вокруг фокуса: ${goalFocus}.`,
    request.currentStreak < 3
      ? isEn
        ? "Protect consistency first and avoid overload."
        : "Сначала защити консистентность и не перегружай день."
      : isEn
        ? "Use the current streak as momentum and do the key task early."
        : "Используй текущую серию как импульс и закрой главную задачу пораньше.",
    difficulty === "hard"
      ? isEn
        ? "Reserve focused time for the epic quest."
        : "Заложи отдельный сфокусированный блок времени под эпическое задание."
      : difficulty === "medium"
        ? isEn
          ? "After two wins, move into the stretch task."
          : "После двух побед переходи к задаче на рост."
        : isEn
          ? "Optimize for completion, not perfection."
          : "Ставь ставку на завершение, а не на идеальность.",
  ];
}

export function generateAiQuestPlan(request: AIQuestRequest, language: Language): AIQuestPlan {
  const difficulty = pickDifficulty({
    userLevel: request.userLevel,
    currentStreak: request.currentStreak,
    completedQuests: request.completedQuests,
    goalQuestPoints: request.goalQuestPoints,
  });
  const seeds = QUEST_SEEDS[request.goalType];
  const recentTitles = new Set(request.recentQuestTitles ?? []);
  const selectedSeeds = seeds
    .filter((seed) => !recentTitles.has(pickLocalized(language, seed.title)))
    .slice(0, 4);
  const fallbackSeeds = selectedSeeds.length >= 4 ? selectedSeeds : [...selectedSeeds, ...seeds].slice(0, 4);
  const goalCopy = buildGoalCopy(request.goalType, language);

  const quests = fallbackSeeds.map((seed, index) => {
    const targetValue = buildTarget(seed, difficulty);
    const questType: "daily" | "epic" = index === fallbackSeeds.length - 1 && difficulty !== "easy" ? "epic" : "daily";

    return {
      id: `ai-${request.goalType}-${index}-${difficulty}`,
      title: pickLocalized(language, seed.title),
      description: pickLocalized(language, seed.description),
      difficulty,
      xpReward: buildXpReward(difficulty, request.currentStreak),
      crystalReward: buildCrystalReward(difficulty),
      rarity: questType === "epic" ? "epic" : buildQuestRarity(difficulty),
      completed: false,
      type: questType,
      goalType: request.goalType,
      source: "ai" as const,
      targetValue,
      currentValue: 0,
      progressUnit: seed.unit,
      rewardHint: language === "en" ? "Adaptive quest" : "Адаптивное задание",
      requiresInput: seed.requiresInput,
      inputPrompt: seed.inputPrompt ? pickLocalized(language, seed.inputPrompt) : undefined,
      inputType: seed.inputType,
    };
  });

  const performanceNote =
    request.completedQuests < 4 || request.goalQuestPoints < 30
      ? language === "en"
        ? "Your recent completion rate is low, so the plan leans into easy wins to build momentum."
        : "Недавние завершения не частые, поэтому план ориентирован на легкие победы для набора инерции."
      : language === "en"
      ? "Your recent progress has been solid, so the plan includes more ambitious quests."
      : "Последний прогресс уверенный, поэтому план включает более амбициозные задания.";

  return {
    goalType: request.goalType,
    focusHeadline:
      language === "en"
        ? `Focus: ${goalCopy.aiFocus}`
        : `Фокус: ${goalCopy.aiFocus}`,
    overview:
      language === "en"
        ? `The plan focuses on ${goalCopy.aiFocus}, balancing consistency and stretch based on your level ${request.userLevel}, streak ${request.currentStreak}, and completed quests ${request.completedQuests}.`
        : `План делает акцент на ${goalCopy.aiFocus}, учитывая твой уровень ${request.userLevel}, серию ${request.currentStreak} и успешные задания ${request.completedQuests}.`,
    executionMode: buildExecutionMode(difficulty, language),
    winCondition: buildWinCondition(difficulty, language),
    priorityChecklist: buildPriorityChecklist({
      difficulty,
      request,
      goalFocus: goalCopy.aiFocus,
      language,
    }),
    adaptationNotes: [
      language === "en"
        ? request.currentStreak < 3
          ? "Low streak detected, so the plan prioritizes easy wins and momentum."
          : "Strong streak detected, so the plan includes stretch tasks."
        : request.currentStreak < 3
          ? "Серия пока низкая, поэтому план делает упор на легкие победы и возврат темпа."
          : "Серия уже сильная, поэтому план включает задания на рост и выход из зоны комфорта.",
      performanceNote,
      language === "en"
        ? "Recent quest names are filtered to reduce repetition."
        : "Недавние названия заданий отфильтрованы, чтобы меньше повторяться.",
    ],
    difficultyBias: difficulty,
    quests,
  };
}
