import bcrypt from "bcryptjs";

import { buildDailyWeightLossQuests } from "@new-erra/shared";
import type { WeightLossQuestionnaire } from "@new-erra/shared";

import { prisma } from "../../config/prisma";

export type RegisterPayload = {
  email: string;
  password: string;
  fullName: string;
  questionnaire: WeightLossQuestionnaire;
};

export async function registerUser(payload: RegisterPayload) {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email }
  });

  if (existingUser) {
    throw new Error("Пользователь с таким email уже существует.");
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash,
      fullName: payload.fullName,
      currentWeight: payload.questionnaire.weightKg,
      goalWeight: payload.questionnaire.goalWeightKg,
      profile: {
        create: {
          age: payload.questionnaire.age,
          gender: payload.questionnaire.gender,
          heightCm: payload.questionnaire.heightCm,
          weightKg: payload.questionnaire.weightKg,
          activityLevel: payload.questionnaire.activityLevel,
          eatingPattern: payload.questionnaire.eatingPattern,
          sleepQuality: payload.questionnaire.sleepQuality,
          goalWeightKg: payload.questionnaire.goalWeightKg
        }
      }
    },
    include: {
      profile: true
    }
  });

  const quests = buildDailyWeightLossQuests(payload.questionnaire, 1, 0);

  await prisma.dailyQuest.createMany({
    data: quests.map((quest) => ({
      userId: user.id,
      questDay: 1,
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

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true }
  });

  if (!user) {
    throw new Error("Неверный email или пароль.");
  }

  const passwordIsValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordIsValid) {
    throw new Error("Неверный email или пароль.");
  }

  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error("Пользователь не найден.");
  }

  const passwordIsValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordIsValid) {
    throw new Error("Текущий пароль указан неверно.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  return { ok: true };
}

export async function createPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return {
      ok: true,
      message:
        "Если такой аккаунт существует, инструкция по восстановлению уже подготовлена."
    };
  }

  const token = `reset_${Math.random().toString(36).slice(2)}${Date.now()}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt
    }
  });

  return {
    ok: true,
    message: "Запрос на восстановление создан. Позже сюда подключится реальная отправка письма."
  };
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true
    }
  });
}
