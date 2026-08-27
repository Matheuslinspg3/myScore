import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizeAccountType, isLiquidAccountType } from "@/lib/banking/account-type";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  customName: z.string().trim().max(80).nullable(),
  includeInBalance: z.boolean(),
  balanceOverrideCents: z
    .number()
    .int()
    .min(-100_000_000_000_000)
    .max(100_000_000_000_000)
    .nullable(),
});

const deleteBodySchema = z.object({
  confirmation: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.literal("APAGAR")),
});

function migrationMissing(code?: string): boolean {
  return ["42703", "PGRST204"].includes(code ?? "");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const { accountId } = await context.params;
    if (!z.string().uuid().safeParse(accountId).success) {
      return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
      .from("accounts")
      .select("id, account_type, raw_data")
      .eq("id", accountId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    const rawData = current.raw_data as { type?: string | null } | null;
    const type = normalizeAccountType(rawData?.type ?? current.account_type);
    const includeInBalance =
      isLiquidAccountType(type) && body.includeInBalance;
    const customName = body.customName?.trim() || null;

    const { data, error } = await supabase
      .from("accounts")
      .update({
        custom_name: customName,
        include_in_safe_balance: includeInBalance,
        balance_override_cents: body.balanceOverrideCents,
      })
      .eq("id", accountId)
      .eq("owner_id", user.id)
      .select(
        "id, name, custom_name, balance_cents, balance_override_cents, include_in_safe_balance",
      )
      .single();
    if (error) throw error;

    return NextResponse.json({
      account: {
        id: data.id,
        name: data.custom_name || data.name,
        providerName: data.name,
        customName: data.custom_name,
        balance: data.balance_override_cents ?? data.balance_cents,
        providerBalance: data.balance_cents,
        balanceOverride: data.balance_override_cents,
        includeInBalance,
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
          error: "A edição de contas ainda precisa da migration do Supabase.",
          setupRequired: true,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível atualizar a conta." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  try {
    await requireUser();
    deleteBodySchema.parse(await request.json());
    const { accountId } = await context.params;
    if (!z.string().uuid().safeParse(accountId).success) {
      return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("delete_banking_account", {
      p_account_id: accountId,
    });
    if (error) throw error;

    return NextResponse.json({ deleted: true, impact: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Digite APAGAR para confirmar." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const databaseCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : undefined;
    const databaseMessage =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
    if (databaseCode === "P0002" || databaseMessage.includes("ACCOUNT_NOT_FOUND")) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    if (["42883", "PGRST202"].includes(databaseCode ?? "")) {
      return NextResponse.json(
        {
          error: "A exclusão ainda precisa da migration do Supabase.",
          setupRequired: true,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível apagar a conta." },
      { status: 500 },
    );
  }
}
