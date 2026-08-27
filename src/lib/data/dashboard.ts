import { demoData } from "@/lib/demo-data";
import { hasAiCredentials, isDemoMode } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  CashFlowPoint,
  CategorySpend,
  CreditCard,
  DashboardData,
  Payable,
  Person,
  Receivable,
  TimelineEvent,
  Transaction,
  TransactionNature,
} from "@/types/finance";

interface RawInstitution {
  name?: string;
  primary_color?: string | null;
}

interface RawAccount {
  id: string;
  name: string;
  account_type: string;
  balance_cents: number;
  available_balance_cents?: number | null;
  last_synced_at?: string | null;
  connection_id?: string;
  institutions?: RawInstitution | RawInstitution[] | null;
}

interface RawCard {
  id: string;
  name: string;
  invoice_cents: number;
  total_limit_cents?: number | null;
  available_limit_cents?: number | null;
  closing_date?: string | null;
  due_date?: string | null;
  accounts?: {
    institutions?: RawInstitution | RawInstitution[] | null;
  } | null;
}

interface RawTransaction {
  id: string;
  account_id: string;
  description: string;
  merchant_name?: string | null;
  amount_cents: number;
  booked_at: string;
  status: string;
  provider_category?: string | null;
  accounts?: {
    institutions?: RawInstitution | RawInstitution[] | null;
  } | null;
  transaction_enrichments?: Array<{
    nature?: string | null;
    reimbursable?: boolean | null;
    categories?: { name?: string; color?: string | null } | null;
    people?: { id?: string; name?: string } | null;
  }> | null;
}

interface RawPerson {
  id: string;
  name: string;
  nickname?: string | null;
}

interface RawReceivable {
  id: string;
  person_id: string;
  description: string;
  total_cents: number;
  received_cents: number;
  due_date: string;
  status: string;
  current_installment?: number | null;
  installment_count?: number | null;
  people?: { name?: string } | null;
}

interface RawPayable {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  recurrence?: string | null;
  categories?: { name?: string } | null;
}

function oneInstitution(
  value: RawInstitution | RawInstitution[] | null | undefined,
): RawInstitution {
  if (Array.isArray(value)) return value[0] ?? {};
  return value ?? {};
}

function toAccountType(value: string): Account["type"] {
  if (value === "savings") return "savings";
  if (value === "payment") return "payment";
  if (value === "investment") return "investment";
  return "checking";
}

function colorForCategory(name: string): string {
  const palette: Record<string, string> = {
    Moradia: "#7d6df2",
    Mercado: "#75c68f",
    Transporte: "#f0a14a",
    Combustível: "#f0a14a",
    Assinaturas: "#e56b79",
    Alimentação: "#f2c14e",
    Receitas: "#46b5a7",
    Reembolsos: "#46b5a7",
  };
  return palette[name] ?? "#7d8799";
}

function buildCashFlow(transactions: Transaction[]): CashFlowPoint[] {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: date.toISOString().slice(0, 7),
      label: formatter.format(date).replace(".", ""),
      income: 0,
      expense: 0,
    };
  });

  for (const transaction of transactions) {
    if (transaction.nature === "transfer") continue;
    const month = months.find((item) => transaction.date.startsWith(item.key));
    if (!month) continue;
    if (transaction.amount >= 0) month.income += transaction.amount;
    else month.expense += Math.abs(transaction.amount);
  }
  return months;
}

function buildCategorySpend(transactions: Transaction[]): CategorySpend[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.amount >= 0 || transaction.nature === "transfer") continue;
    totals.set(
      transaction.category,
      (totals.get(transaction.category) ?? 0) +
        Math.abs(transaction.amount),
    );
  }
  return [...totals.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      color: colorForCategory(name),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

export async function getDashboardData(): Promise<DashboardData> {
  if (isDemoMode()) return demoData;

  const user = await requireUser();
  const supabase = await createClient();

  const [
    accountsResult,
    cardsResult,
    transactionsResult,
    peopleResult,
    receivablesResult,
    payablesResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("*, institutions(name, primary_color)")
      .eq("is_active", true)
      .order("balance_cents", { ascending: false }),
    supabase
      .from("credit_cards")
      .select("*, accounts(institutions(name, primary_color))")
      .order("invoice_cents", { ascending: false }),
    supabase
      .from("transactions")
      .select(
        "*, accounts(institutions(name, primary_color)), transaction_enrichments(nature, reimbursable, categories(name, color), people(id, name))",
      )
      .order("booked_at", { ascending: false })
      .limit(300),
    supabase.from("people").select("*").eq("archived", false).order("name"),
    supabase
      .from("receivables")
      .select("*, people(name)")
      .neq("status", "paid")
      .order("due_date"),
    supabase
      .from("payables")
      .select("*, categories(name)")
      .neq("status", "paid")
      .order("due_date"),
    supabase.from("settings").select("*").maybeSingle(),
  ]);

  const queryError = [
    accountsResult.error,
    cardsResult.error,
    transactionsResult.error,
    peopleResult.error,
    receivablesResult.error,
    payablesResult.error,
    settingsResult.error,
  ].find(Boolean);
  if (queryError) throw queryError;

  const rawAccounts = (accountsResult.data ?? []) as unknown as RawAccount[];
  const rawCards = (cardsResult.data ?? []) as unknown as RawCard[];
  const rawTransactions = (transactionsResult.data ??
    []) as unknown as RawTransaction[];
  const rawPeople = (peopleResult.data ?? []) as unknown as RawPerson[];
  const rawReceivables = (receivablesResult.data ??
    []) as unknown as RawReceivable[];
  const rawPayables = (payablesResult.data ?? []) as unknown as RawPayable[];

  const accounts: Account[] = rawAccounts.map((row) => {
    const institution = oneInstitution(row.institutions);
    return {
      id: row.id,
      institution: institution.name ?? "Instituição",
      name: row.name,
      type: toAccountType(row.account_type),
      balance: row.balance_cents,
      availableBalance: row.available_balance_cents ?? undefined,
      color: institution.primary_color ?? "#7d6df2",
      lastSync: row.last_synced_at
        ? new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(row.last_synced_at))
        : "Aguardando",
      status: "healthy",
    };
  });

  const creditCards: CreditCard[] = rawCards.map((row) => {
    const institution = oneInstitution(row.accounts?.institutions);
    return {
      id: row.id,
      institution: institution.name ?? "Instituição",
      name: row.name,
      invoice: row.invoice_cents,
      limit: row.total_limit_cents ?? 0,
      availableLimit: row.available_limit_cents ?? 0,
      closingDay: row.closing_date
        ? new Date(row.closing_date).getUTCDate()
        : undefined,
      dueDay: row.due_date
        ? new Date(row.due_date).getUTCDate()
        : undefined,
      color: institution.primary_color ?? "#8a3ffc",
    };
  });

  const transactions: Transaction[] = rawTransactions.map((row) => {
    const institution = oneInstitution(row.accounts?.institutions);
    const enrichment = row.transaction_enrichments?.[0];
    const category =
      enrichment?.categories?.name ?? row.provider_category ?? "Outros";
    return {
      id: row.id,
      accountId: row.account_id,
      institution: institution.name ?? "Instituição",
      description: row.description,
      merchant: row.merchant_name ?? undefined,
      amount: row.amount_cents,
      date: row.booked_at.slice(0, 10),
      category,
      categoryColor:
        enrichment?.categories?.color ?? colorForCategory(category),
      personId: enrichment?.people?.id,
      personName: enrichment?.people?.name,
      nature: (enrichment?.nature ?? (row.amount_cents >= 0
        ? "income"
        : "expense")) as TransactionNature,
      status: row.status === "pending" ? "pending" : "posted",
      reimbursable: enrichment?.reimbursable ?? false,
    };
  });

  const receivables: Receivable[] = rawReceivables.map((row) => ({
    id: row.id,
    personId: row.person_id,
    personName: row.people?.name ?? "Pessoa",
    description: row.description,
    total: row.total_cents,
    received: row.received_cents,
    dueDate: row.due_date,
    status: row.status as Receivable["status"],
    installmentLabel:
      row.current_installment && row.installment_count
        ? String(row.current_installment) + "/" + String(row.installment_count)
        : undefined,
  }));

  const people: Person[] = rawPeople.map((row) => {
    const personReceivables = receivables.filter(
      (item) => item.personId === row.id,
    );
    const totalAssociated = personReceivables.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    const received = personReceivables.reduce(
      (sum, item) => sum + item.received,
      0,
    );
    return {
      id: row.id,
      name: row.name,
      nickname: row.nickname ?? undefined,
      avatar: row.name.slice(0, 1).toUpperCase(),
      totalAssociated,
      received,
      pending: totalAssociated - received,
    };
  });

  const payables: Payable[] = rawPayables.map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount_cents,
    dueDate: row.due_date,
    status: row.status as Payable["status"],
    recurring: Boolean(row.recurrence),
    category: row.categories?.name ?? "Outros",
  }));

  const timeline: TimelineEvent[] = [
    ...receivables.map((item) => ({
      id: "receivable-" + item.id,
      date: item.dueDate,
      description: item.personName,
      amount: item.total - item.received,
      kind: "income" as const,
      confirmed: false,
    })),
    ...payables.map((item) => ({
      id: "payable-" + item.id,
      date: item.dueDate,
      description: item.description,
      amount: item.amount,
      kind: "expense" as const,
      confirmed: true,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const expenseThisMonth = transactions
    .filter((item) => item.date.startsWith(new Date().toISOString().slice(0, 7)))
    .filter((item) => item.amount < 0 && item.nature !== "transfer")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const incomeThisMonth = transactions
    .filter((item) => item.date.startsWith(new Date().toISOString().slice(0, 7)))
    .filter((item) => item.amount > 0 && item.nature !== "transfer")
    .reduce((sum, item) => sum + item.amount, 0);

  const metadata = user.user_metadata as { name?: string; full_name?: string };
  return {
    userName:
      metadata.name ??
      metadata.full_name?.split(" ")[0] ??
      user.email?.split("@")[0] ??
      "Olá",
    accounts,
    creditCards,
    transactions,
    people,
    receivables,
    payables,
    cashFlow: buildCashFlow(transactions),
    categories: buildCategorySpend(transactions),
    timeline,
    reserve:
      ((settingsResult.data as { emergency_reserve_cents?: number } | null)
        ?.emergency_reserve_cents ?? 0),
    monthlyIncome: incomeThisMonth,
    monthlyExpense: expenseThisMonth,
    demoMode: false,
    aiEnabled: hasAiCredentials(),
  };
}
