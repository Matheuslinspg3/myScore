import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncPluggyItem } from "@/lib/banking/sync";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  itemId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const user = await requireUser();
    if (!checkRateLimit("sync:" + user.id, 6, 60_000)) {
      return NextResponse.json(
        { error: "Sincronizações demais. Aguarde um minuto." },
        { status: 429 },
      );
    }
    const body = bodySchema.parse(await request.json());
    const supabase = await createClient();
    const result = await syncPluggyItem(user.id, body.itemId, supabase);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Item inválido." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN_ITEM") {
      return NextResponse.json({ error: "Item não autorizado." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Não foi possível sincronizar agora." },
      { status: 500 },
    );
  }
}
