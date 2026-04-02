import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";

import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { questsRoutes } from "./modules/quests/quests.routes";
import { usersRoutes } from "./modules/users/users.routes";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: unknown, reply: unknown) => Promise<unknown>;
  }
}

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true
  });

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await (request as { jwtVerify: () => Promise<void> }).jwtVerify();
      return reply;
    } catch {
      return (reply as {
        code: (statusCode: number) => {
          send: (payload: unknown) => unknown;
        };
      })
        .code(401)
        .send({
          message: "Требуется авторизация."
        });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as { statusCode?: number; message?: string };
    const statusCode =
      typeof normalizedError.statusCode === "number" ? Number(normalizedError.statusCode) : 400;

    return reply.code(statusCode >= 400 ? statusCode : 400).send({
      message: normalizedError.message || "Не удалось обработать запрос."
    });
  });

  app.register(healthRoutes, { prefix: "/v1" });
  app.register(authRoutes, { prefix: "/v1" });
  app.register(dashboardRoutes, { prefix: "/v1" });
  app.register(questsRoutes, { prefix: "/v1" });
  app.register(usersRoutes, { prefix: "/v1" });

  return app;
}
