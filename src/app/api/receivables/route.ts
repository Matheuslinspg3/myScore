import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  personId: z.string().uuid(),
  description: z.string().trim().min(2).max(200),
  totalCents: z.number().int().positive().max(9_000_000_000_00),
  dueDate: z.iso.date(),
  installmentCount: z.number().int().positive().max(360).optional(),
  currentInstallment: z.number().int().positive().max(360).optional(),
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
      .from("receivables")
      .insert({
        owner_id: user.id,
        person_id: body.personId,
        description: body.description,
        total_cents: body.totalCents,
        due_date: body.dueDate,
        installment_count: body.installmentCount ?? null,
        current_installment: body.currentInstallment ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ receivable: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "Não foi possível salvar." }, { status });
  }
}
