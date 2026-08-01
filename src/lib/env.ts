import "server-only";

import { z } from "zod";

const optionalEnvString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  GROQ_API_KEY: optionalEnvString,
  AI_MODEL: optionalEnvString,
  AI_DAILY_MESSAGE_LIMIT: z.coerce.number().int().min(1).max(1000).optional(),
  SUPABASE_SERVICE_ROLE_KEY: optionalEnvString,
  ADMIN_EMAILS: optionalEnvString,
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalEnvString,
});

export const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  AI_DAILY_MESSAGE_LIMIT: process.env.AI_DAILY_MESSAGE_LIMIT,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
