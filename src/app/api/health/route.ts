import { NextResponse } from "next/server";
import {
  hasAiCredentials,
  hasPluggyCredentials,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "myScore",
    mode: isDemoMode() ? "demo" : "connected",
    integrations: {
      supabase: isSupabaseConfigured(),
      pluggy: hasPluggyCredentials(),
      ai: hasAiCredentials(),
    },
  });
}
