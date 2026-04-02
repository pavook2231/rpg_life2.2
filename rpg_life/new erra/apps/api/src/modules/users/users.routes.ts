import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../../config/prisma";

const profileUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  currentWeight: z.number().min(35).max(250).optional(),
  goalWeight: z.number().min(35).max(220).optional()
});

const settingsSchema = z.object({
  language: z.enum(["ru", "en"]).default("ru"),
  theme: z.enum(["system", "light", "dark"]).default("system")
});

export async function usersRoutes(app: FastifyInstance) {
  app.get("/profile", { preHandler: [app.authenticate] }, async (request) => {
    const userId = String((request.user as { sub: string }).sub);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    return {
      message: "Профиль загружен.",
      data: user
    };
  });

  app.patch("/profile", { preHandler: [app.authenticate] }, async (request) => {
    const userId = String((request.user as { sub: string }).sub);
    const payload = profileUpdateSchema.parse(request.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName,
        currentWeight: payload.currentWeight,
        goalWeight: payload.goalWeight,
        profile: payload.goalWeight
          ? {
              update: {
                goalWeightKg: payload.goalWeight
              }
            }
          : undefined
      },
      include: { profile: true }
    });

    return {
      message: "Профиль обновлён.",
      data: updated
    };
  });

  app.get("/settings", { preHandler: [app.authenticate] }, async (request) => {
    const userId = String((request.user as { sub: string }).sub);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        language: true,
        theme: true
      }
    });

    return {
      message: "Настройки загружены.",
      data: user
    };
  });

  app.put("/settings", { preHandler: [app.authenticate] }, async (request) => {
    const userId = String((request.user as { sub: string }).sub);
    const payload = settingsSchema.parse(request.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: payload,
      select: {
        language: true,
        theme: true
      }
    });

    return {
      message: "Настройки сохранены.",
      data: updated
    };
  });
}
