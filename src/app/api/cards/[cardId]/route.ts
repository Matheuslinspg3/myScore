import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  customName: z.string().trim().max(80).nullable(),
  includeInInvoice: z.boolean(),
  invoiceOverrideCents: z
    .number()
    .int()
    .min(0)
    .max(100_000_000_000_000)
    .nullable(),
});

function migrationMissing(code?: string): boolean {
  return ["42703", "PGRST204"].includes(code ?? "");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const { cardId } = await context.params;
    if (!z.string().uuid().safeParse(cardId).success) {
      return NextResponse.json({ error: "Cartão inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const customName = body.customName?.trim() || null;
    const { data, error } = await supabase
      .from("credit_cards")
      .update({
        custom_name: customName,
        invoice_override_cents: body.invoiceOverrideCents,
        include_in_invoice: body.includeInInvoice,
      })
      .eq("id", cardId)
      .eq("owner_id", user.id)
      .select(
        "id, name, custom_name, invoice_cents, invoice_override_cents, include_in_invoice",
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      card: {
        id: data.id,
        name: data.custom_name || data.name,
        providerName: data.name,
        customName: data.custom_name,
        invoice: data.invoice_override_cents ?? data.invoice_cents,
        providerInvoice: data.invoice_cents,
        invoiceOverride: data.invoice_override_cents,
        includeInInvoice: data.include_in_invoice,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const databaseCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : undefined;
    if (migrationMissing(databaseCode)) {
      return NextResponse.json(
        {
          error: "O ajuste de fatura ainda precisa da migration do Supabase.",
          setupRequired: true,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível atualizar o cartão." },
      { status: 500 },
    );
  }
}
