import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { completeDailyQuest, getOrCreateCurrentDailyQuests } from "./quests.service";

const completeQuestSchema = z.object({
  questId: z.string().min(1)
});

export async function questsRoutes(app: FastifyInstance) {
  app.get("/quests/daily", { preHandler: [app.authenticate] }, async (request) => {
    const userId = String((request.user as { sub: string }).sub);
    const data = await getOrCreateCurrentDailyQuests(userId);

    return {
      message: "Список ежедневных квестов загружен.",
      data
    };
  });

  app.post("/quests/complete", { preHandler: [app.authenticate] }, async (request) => {
    const payload = completeQuestSchema.parse(request.body);
    const userId = String((request.user as { sub: string }).sub);

    const result = await completeDailyQuest(userId, payload.questId);

    return {
      message: "Квест выполнен.",
      data: result
    };
  });
}
