import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  buildTransactionsCsv,
  type CsvTransaction,
} from "@/lib/export/csv";
import { isSameOrigin } from "@/lib/security/csrf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RawInstitution {
  name?: string | null;
}

interface RawAccount {
  name?: string | null;
  institutions?: RawInstitution | RawInstitution[] | null;
}

interface RawEnrichment {
  nature?: string | null;
  reimbursable?: boolean | null;
  categories?: { name?: string | null } | null;
  people?: { name?: string | null } | null;
}

interface RawExportRow {
  booked_at: string;
  description: string;
  merchant_name?: string | null;
  amount_cents: number;
  status: string;
  provider_category?: string | null;
  accounts?: RawAccount | RawAccount[] | null;
  transaction_enrichments?: RawEnrichment[] | null;
}

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export async function GET(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  try {
    const user = await requireUser();
    const supabase = await createClient();
    const rows: RawExportRow[] = [];
    const pageSize = 1000;

    for (let offset = 0; offset < 20_000; offset += pageSize) {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "booked_at, description, merchant_name, amount_cents, status, provider_category, accounts(name, institutions(name)), transaction_enrichments(nature, reimbursable, categories(name), people(name))",
        )
        .eq("owner_id", user.id)
        .order("booked_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as RawExportRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    const csvRows: CsvTransaction[] = rows.map((row) => {
      const account = one(row.accounts);
      const institution = one(account?.institutions);
      const enrichment = row.transaction_enrichments?.[0];
      return {
        date: row.booked_at.slice(0, 10),
        institution: institution?.name ?? "Instituição",
        account: account?.name ?? "Conta",
        description: row.description,
        merchant: row.merchant_name,
        amountCents: row.amount_cents,
        category:
          enrichment?.categories?.name ?? row.provider_category ?? "Outros",
        person: enrichment?.people?.name,
        nature:
          enrichment?.nature ?? (row.amount_cents >= 0 ? "income" : "expense"),
        status: row.status,
        reimbursable: enrichment?.reimbursable ?? false,
      };
    });
    const csv = buildTransactionsCsv(csvRows);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="myscore-transacoes-' + date + '.csv"',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Não foi possível gerar a planilha." },
      { status: 500 },
    );
  }
}
