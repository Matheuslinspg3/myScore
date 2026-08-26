"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, anonKey } = getPublicSupabaseEnv();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
