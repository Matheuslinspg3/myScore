import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  AiGatewayError,
  generateAiText,
  validateAiBaseUrl,
} from "@/lib/ai/gateway";
import {
  AiSettingsError,
  buildUserAiConfig,
  getUserAiSettingsStatus,
  isAiSettingsMigrationMissing,
  saveUserAiSettings,
} from "@/lib/ai/user-config";
import { isSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const settingsSchema = z.object({
  action: z.enum(["save", "test"]),
  enabled: z.boolean().default(true),
  apiFormat: z.enum(["openai", "anthropic"]),
  authScheme: z.enum(["bearer", "x-api-key"]),
  baseUrl: z.string().trim().url().max(500),
  apiKey: z.string().trim().min(8).max(12_000).optional(),
  chatModel: z.string().trim().min(1).max(200),
  dataModel: z.string().trim().min(1).max(200),
});

function setupRequiredResponse() {
  return NextResponse.json(
    {
      error: "A configuração no dashboard ainda precisa da migration do Supabase.",
      setupRequired: true,
    },
    { status: 503 },
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getUserAiSettingsStatus(user.id);
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (isAiSettingsMigrationMissing(error)) return setupRequiredResponse();
    return NextResponse.json(
      { error: "Não foi possível carregar a configuração de IA." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  let body: z.infer<typeof settingsSchema>;
  try {
    body = settingsSchema.parse(await request.json());
    validateAiBaseUrl(body.baseUrl);
  } catch {
    return NextResponse.json(
      { error: "Revise a Base URL, os modelos e a chave informada." },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    const rateLimit = body.action === "test" ? 5 : 10;
    if (
      !checkRateLimit(
        "ai-settings:" + body.action + ":" + user.id,
        rateLimit,
        10 * 60_000,
      )
    ) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429 },
      );
    }

    if (body.action === "test") {
      const config = await buildUserAiConfig(user.id, body);
      const answer = await generateAiText({
        config,
        model: config.chatModel,
        system:
          "Você está validando a conexão do myScore. Responda somente: conexão aprovada",
        messages: [{ role: "user", content: "Teste de conexão." }],
        maxTokens: 24,
        temperature: 0,
      });
      return NextResponse.json(
        { tested: true, answer: answer.slice(0, 120), model: config.chatModel },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const settings = await saveUserAiSettings(user.id, body);
    return NextResponse.json(
      { saved: true, settings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (isAiSettingsMigrationMissing(error)) return setupRequiredResponse();
    if (
      error instanceof AiSettingsError &&
      error.message === "AI_API_KEY_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "Informe a API Key na primeira configuração." },
        { status: 400 },
      );
    }
    if (error instanceof AiGatewayError) {
      const suffix = error.status ? " Código do gateway: " + error.status + "." : "";
      return NextResponse.json(
        { error: "O gateway não aprovou o teste." + suffix },
        { status: error.status === 429 ? 429 : 502 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível salvar a configuração de IA." },
      { status: 500 },
    );
  }
}
