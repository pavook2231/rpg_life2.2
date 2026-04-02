import type { FastifyInstance } from "fastify";

import { buildDashboardSummary } from "@new-erra/shared";

import { prisma } from "../../config/prisma";
import { getOrCreateCurrentDailyQuests } from "../quests/quests.service";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", { preHandler: [app.authenticate] }, async (request) => {
    const userId = String((request.user as { sub: string }).sub);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user?.profile) {
      throw new Error("Профиль пользователя не найден.");
    }

    const { questDay, quests } = await getOrCreateCurrentDailyQuests(userId);

    const summary = buildDashboardSummary(
      {
        age: user.profile.age,
        gender: user.profile.gender,
        heightCm: user.profile.heightCm,
        weightKg: user.profile.weightKg,
        activityLevel: user.profile.activityLevel,
        eatingPattern: user.profile.eatingPattern,
        sleepQuality: user.profile.sleepQuality,
        goalWeightKg: user.profile.goalWeightKg
      },
      {
        currentWeightKg: user.currentWeight,
        streakDays: user.streakDays,
        totalXp: user.totalXp,
        programDay: questDay
      }
    );

    return {
      message: "Данные главного экрана загружены.",
      data: {
        intro: {
          title: "Твоя система реального прогресса",
          description:
            "New Erra превращает цель по снижению веса в понятный ежедневный маршрут: полезные задания, серия дней и прозрачный результат."
        },
        summary,
        questDay,
        todayQuests: quests
      }
    };
  });
}
