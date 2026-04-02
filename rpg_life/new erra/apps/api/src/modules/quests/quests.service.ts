import { buildDailyWeightLossQuests, type WeightLossQuestionnaire } from "@new-erra/shared";

import { prisma } from "../../config/prisma";

function toQuestionnaire(profile: {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  activityLevel: "low" | "light" | "moderate" | "high";
  eatingPattern: "balanced" | "emotional" | "late_snacking" | "irregular";
  sleepQuality: "poor" | "average" | "good";
  goalWeightKg: number;
}): WeightLossQuestionnaire {
  return {
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    eatingPattern: profile.eatingPattern,
    sleepQuality: profile.sleepQuality,
    goalWeightKg: profile.goalWeightKg
  };
}

async function createQuestDay(userId: string, programDay: number, streakDays: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  if (!user?.profile) {
    throw new Error("Профиль пользователя не найден.");
  }

  const questionnaire = toQuestionnaire(user.profile);
  const quests = buildDailyWeightLossQuests(questionnaire, programDay, streakDays);

  await prisma.dailyQuest.createMany({
    data: quests.map((quest) => ({
      userId,
      questDay: programDay,
      kind: quest.kind,
      title: quest.title,
      description: quest.description,
      reasonText: quest.reasonText,
      targetValue: quest.targetValue,
      unit: quest.unit,
      xpReward: quest.xpReward,
      difficultyLevel: quest.difficultyLevel,
      status: "available"
    }))
  });
}

export async function getCurrentQuestDay(userId: string) {
  const latestQuest = await prisma.dailyQuest.findFirst({
    where: { userId },
    orderBy: [{ questDay: "desc" }, { createdAt: "desc" }]
  });

  return latestQuest?.questDay ?? 1;
}

export async function getOrCreateCurrentDailyQuests(userId: string) {
  let questDay = await getCurrentQuestDay(userId);
  let quests = await prisma.dailyQuest.findMany({
    where: { userId, questDay },
    orderBy: { createdAt: "asc" }
  });

  if (quests.length === 0) {
    await createQuestDay(userId, questDay, 0);
    quests = await prisma.dailyQuest.findMany({
      where: { userId, questDay },
      orderBy: { createdAt: "asc" }
    });
  }

  return { questDay, quests };
}

export async function completeDailyQuest(userId: string, questId: string) {
  const quest = await prisma.dailyQuest.findFirst({
    where: {
      id: questId,
      userId
    }
  });

  if (!quest) {
    throw new Error("Квест не найден.");
  }

  if (quest.status === "completed") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return {
      questId: quest.id,
      newXp: user?.totalXp ?? 0,
      streakDays: user?.streakDays ?? 0
    };
  }

  await prisma.dailyQuest.update({
    where: { id: quest.id },
    data: {
      status: "completed",
      completedAt: new Date()
    }
  });

  const sameDayQuests = await prisma.dailyQuest.findMany({
    where: {
      userId,
      questDay: quest.questDay
    }
  });

  const allCompleted = sameDayQuests.every((item: { id: string; status: string }) =>
    item.id === quest.id ? true : item.status === "completed"
  );

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      totalXp: { increment: quest.xpReward },
      ...(allCompleted ? { streakDays: { increment: 1 } } : {})
    }
  });

  if (allCompleted) {
    const nextDay = quest.questDay + 1;
    const nextDayCount = await prisma.dailyQuest.count({
      where: { userId, questDay: nextDay }
    });

    if (nextDayCount === 0) {
      await createQuestDay(userId, nextDay, updatedUser.streakDays);
    }
  }

  return {
    questId: quest.id,
    newXp: updatedUser.totalXp,
    streakDays: updatedUser.streakDays
  };
}
