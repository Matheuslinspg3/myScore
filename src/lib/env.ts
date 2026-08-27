import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PLUGGY_CLIENT_ID: z.string().min(1),
  PLUGGY_CLIENT_SECRET: z.string().min(1),
  PLUGGY_WEBHOOK_SECRET: z.string().min(24),
});

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isSupabaseConfigured()
  );
}

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase não configurado.");
  }
  return { url, anonKey };
}

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function hasPluggyCredentials(): boolean {
  return Boolean(
    process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET,
  );
}

export function hasAiCredentials(): boolean {
  return Boolean(
    process.env.AI_PROVIDER === "custom" &&
      process.env.AI_BASE_URL &&
      process.env.AI_API_KEY &&
      (process.env.AI_CHAT_MODEL || process.env.AI_MODEL) &&
      (process.env.AI_DATA_MODEL || process.env.AI_MODEL),
  );
}
