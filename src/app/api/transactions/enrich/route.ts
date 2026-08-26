import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    transactionId: z.string().uuid(),
    categoryId: z.string().uuid().nullable().optional(),
    personId: z.string().uuid().nullable().optional(),
    responsibleType: z
      .enum(["self", "person", "company", "other"])
      .default("self"),
    nature: z.enum([
      "expense",
      "income",
      "transfer",
      "third_party",
      "reimbursable",
      "loan",
      "debt_payment",
      "shared",
      "investment",
      "other",
    ]),
    notes: z.string().trim().max(2000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    reimbursable: z.boolean().default(false),
    createReceivable: z.boolean().default(false),
    dueDate: z.iso.date().optional(),
  })
  .refine(
    (value) =>
      value.responsibleType !== "person" || Boolean(value.personId),
    {
      message: "Selecione a pessoa responsável.",
      path: ["personId"],
    },
  )
  .refine(
    (value) =>
      !value.createReceivable || (Boolean(value.personId) && Boolean(value.dueDate)),
    {
      message: "Pessoa e vencimento são obrigatórios para o recebível.",
      path: ["dueDate"],
    },
  );

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const supabase = await createClient();

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id, description, amount_cents")
      .eq("id", body.transactionId)
      .single();
    if (transactionError) throw transactionError;

    const { error: enrichmentError } = await supabase
      .from("transaction_enrichments")
      .upsert({
        transaction_id: body.transactionId,
        owner_id: user.id,
        category_id: body.categoryId ?? null,
        person_id: body.personId ?? null,
        responsible_type: body.responsibleType,
        nature: body.nature,
        notes: body.notes ?? null,
        tags: body.tags,
        reimbursable: body.reimbursable,
        reviewed: true,
      });
    if (enrichmentError) throw enrichmentError;

    if (body.createReceivable && body.personId && body.dueDate) {
      const { error: receivableError } = await supabase
        .from("receivables")
        .upsert(
          {
            owner_id: user.id,
            person_id: body.personId,
            source_transaction_id: body.transactionId,
            description: transaction.description,
            total_cents: Math.abs(transaction.amount_cents),
            due_date: body.dueDate,
            status: "pending",
          },
          { onConflict: "owner_id,source_transaction_id" },
        );
      if (receivableError) throw receivableError;
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Não foi possível salvar a classificação." },
      { status: 500 },
    );
  }
}
