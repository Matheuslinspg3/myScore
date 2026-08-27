import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPluggyProvider } from "@/lib/banking/pluggy-provider";
import { syncPluggyItem } from "@/lib/banking/sync";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ itemId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const user = await requireUser();
    if (!checkRateLimit("import-item:" + user.id, 6, 60_000)) {
      return NextResponse.json(
        { error: "Sincronizações demais. Aguarde um minuto." },
        { status: 429 },
      );
    }

    const { itemId } = bodySchema.parse(await request.json());
    const supabase = createAdminClient();
    const pluggy = getPluggyProvider();
    const item = await pluggy.getItem(itemId);
    const { data: existing } = await supabase
      .from("bank_connections")
      .select("owner_id")
      .eq("provider", "pluggy")
      .eq("external_item_id", itemId)
      .maybeSingle();

    if (existing && existing.owner_id !== user.id) {
      return NextResponse.json({ error: "Item não autorizado." }, { status: 403 });
    }

    const { error } = await supabase.from("bank_connections").upsert(
      {
        owner_id: user.id,
        provider: "pluggy",
        external_item_id: itemId,
        status: item.status.toLowerCase(),
        metadata: {
          connectorId: item.connector.id,
          source: "meu_pluggy_proxy",
        },
      },
      { onConflict: "owner_id,provider,external_item_id" },
    );
    if (error) throw error;

    return NextResponse.json(await syncPluggyItem(user.id, itemId));
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
      { error: "Não foi possível importar e sincronizar o item." },
      { status: 500 },
    );
  }
}
