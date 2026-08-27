import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getPluggyProvider,
  PluggyApiError,
} from "@/lib/banking/pluggy-provider";
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
    // This request uses the logged-in user's Supabase session. RLS therefore
    // enforces ownership for every connection, account and transaction written.
    const supabase = await createClient();
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

    return NextResponse.json(await syncPluggyItem(user.id, itemId, supabase));
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
    if (error instanceof PluggyApiError) {
      const message =
        error.status === 401
          ? "A Pluggy rejeitou as credenciais desta aplicação."
          : error.status === 403
            ? "A aplicação Pluggy não tem acesso a este item."
            : error.status === 404
              ? "Este item não pertence à aplicação Pluggy configurada."
              : "A Pluggy não conseguiu fornecer os dados deste item.";
      return NextResponse.json(
        {
          error: message,
          providerStatus: error.status,
          providerOperation: error.operation,
          providerCode: error.providerCode,
        },
        { status: 502 },
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      console.error("Falha do Supabase ao importar item", {
        code: error.code,
        message: "message" in error ? error.message : undefined,
      });
      return NextResponse.json(
        {
          error: "O Supabase recusou o registro ou a sincronização do item.",
          databaseCode: error.code,
        },
        { status: 502 },
      );
    }
    console.error("Falha inesperada ao importar item", {
      name: error instanceof Error ? error.name : "UNKNOWN",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { error: "Não foi possível importar e sincronizar o item." },
      { status: 500 },
    );
  }
}
