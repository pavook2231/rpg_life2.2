import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { changePassword, createPasswordReset, loginUser, registerUser } from "./auth.service";

const questionnaireSchema = z.object({
  age: z.number().int().min(18).max(80),
  gender: z.enum(["male", "female", "other"]),
  heightCm: z.number().int().min(120).max(230),
  weightKg: z.number().min(35).max(250),
  activityLevel: z.enum(["low", "light", "moderate", "high"]),
  eatingPattern: z.enum(["balanced", "emotional", "late_snacking", "irregular"]),
  sleepQuality: z.enum(["poor", "average", "good"]),
  goalWeightKg: z.number().min(35).max(220)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  questionnaire: questionnaireSchema
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const resetSchema = z.object({
  email: z.string().email()
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const payload = registerSchema.parse(request.body);
    const user = await registerUser(payload);
    const accessToken = await reply.jwtSign({
      sub: user.id,
      email: user.email
    });

    return reply.code(201).send({
      message: "Регистрация выполнена.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName
        },
        accessToken
      }
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const user = await loginUser(payload.email, payload.password);
    const accessToken = await reply.jwtSign({
      sub: user.id,
      email: user.email
    });

    return {
      message: "Вход выполнен.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName
        },
        accessToken
      }
    };
  });

  app.post("/auth/logout", async () => {
    return {
      message: "Выход выполнен.",
      data: {
        ok: true
      }
    };
  });

  app.post("/auth/password/change", { preHandler: [app.authenticate] }, async (request) => {
    const payload = changePasswordSchema.parse(request.body);
    const userId = String((request.user as { sub: string }).sub);
    const result = await changePassword(userId, payload.currentPassword, payload.newPassword);
    return {
      message: "Пароль обновлён.",
      data: result
    };
  });

  app.post("/auth/password/reset", async (request) => {
    const payload = resetSchema.parse(request.body);
    const result = await createPasswordReset(payload.email);
    return {
      message: result.message,
      data: {
        ok: true
      }
    };
  });
}
