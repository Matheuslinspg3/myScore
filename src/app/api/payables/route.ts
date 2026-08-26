import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  description: z.string().trim().min(2).max(200),
  amountCents: z.number().int().positive().max(9_000_000_000_00),
  dueDate: z.iso.date(),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  recurrence: z
    .enum(["weekly", "monthly", "quarterly", "yearly"])
    .nullable()
    .optional(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payables")
      .insert({
        owner_id: user.id,
        description: body.description,
        amount_cents: body.amountCents,
        due_date: body.dueDate,
        category_id: body.categoryId ?? null,
        account_id: body.accountId ?? null,
        recurrence: body.recurrence ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ payable: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "Não foi possível salvar." }, { status });
  }
}
