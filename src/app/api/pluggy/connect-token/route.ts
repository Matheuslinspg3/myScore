import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPluggyProvider } from "@/lib/banking/pluggy-provider";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const user = await requireUser();
    if (!checkRateLimit("connect:" + user.id, 5, 60_000)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um minuto." },
        { status: 429 },
      );
    }
    const token = await getPluggyProvider().createConnectToken(user.id, {
      avoidDuplicates: true,
    });
    return NextResponse.json(token, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Não autenticado." : "Falha ao iniciar conexão." },
      { status },
    );
  }
}
