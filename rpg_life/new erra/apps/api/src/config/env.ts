import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL обязателен"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET должен быть не короче 32 символов"),
  CORS_ORIGIN: z.string().default("http://localhost:8081")
});

export const env = envSchema.parse(process.env);
