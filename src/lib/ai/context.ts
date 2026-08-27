import type { DashboardData, Transaction } from "@/types/finance";
import {
  sumAccountBalances,
  sumCreditCardInvoices,
} from "@/lib/finance/calculations";

function reais(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function buildFinancialSnapshot(
  data: DashboardData,
  maxTransactions = 140,
) {
  return {
    generatedAt: new Date().toISOString(),
    currency: "BRL",
    scope:
      "Retrato do myScore. Valores monetários estão em reais e podem refletir apenas o histórico sincronizado. Nos cartões, a Pluggy informa crédito utilizado; trate como fatura atual somente quando manuallyAdjusted for true.",
    totals: {
      bankBalance: reais(sumAccountBalances(data.accounts)),
      monthlyIncome: reais(data.monthlyIncome),
      monthlyExpense: reais(data.monthlyExpense),
      pendingReceivables: reais(
        data.receivables.reduce(
          (sum, item) => sum + item.total - item.received,
          0,
        ),
      ),
      pendingPayables: reais(
        data.payables.reduce((sum, item) => sum + item.amount, 0),
      ),
      cardCreditUsedOrAdjusted: reais(sumCreditCardInvoices(data.creditCards)),
    },
    accounts: data.accounts.map((account) => ({
      institution: account.institution,
      name: account.name,
      type: account.type,
      balance: reais(account.balance),
      availableBalance: reais(account.availableBalance ?? account.balance),
      includedInBalance: account.includeInBalance !== false,
    })),
    cards: data.creditCards.map((card) => ({
      institution: card.institution,
      name: card.name,
      amountUsedByMyScore: reais(card.invoice),
      pluggyCreditUsed: reais(card.providerInvoice ?? card.invoice),
      manuallyAdjusted: card.invoiceOverride != null,
      includedInCardTotal: card.includeInInvoice !== false,
      limit: reais(card.limit),
      availableLimit: reais(card.availableLimit),
      dueDay: card.dueDay,
    })),
    categories: data.categories.map((category) => ({
      name: category.name,
      spent: reais(category.amount),
    })),
    people: data.people.map((person) => ({
      name: person.name,
      nickname: person.nickname,
      associated: reais(person.totalAssociated),
      received: reais(person.received),
      pending: reais(person.pending),
    })),
    receivables: data.receivables.map((item) => ({
      person: item.personName,
      description: item.description,
      total: reais(item.total),
      received: reais(item.received),
      dueDate: item.dueDate,
      status: item.status,
    })),
    payables: data.payables.map((item) => ({
      description: item.description,
      amount: reais(item.amount),
      dueDate: item.dueDate,
      category: item.category,
      status: item.status,
    })),
    recentTransactions: data.transactions
      .slice(0, maxTransactions)
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        institution: transaction.institution,
        description: transaction.description,
        merchant: transaction.merchant,
        amount: reais(transaction.amount),
        category: transaction.category,
        person: transaction.personName,
        nature: transaction.nature,
        status: transaction.status,
      })),
  };
}

export interface CatalogCandidate {
  id: string;
  merchant: string;
  transactionCount: number;
  inflow: number;
  outflow: number;
  categories: string[];
  natures: string[];
  institutions: string[];
  people: string[];
  latestDate: string;
}

function merchantKey(transaction: Transaction): string {
  return (transaction.merchant ?? transaction.description)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 120);
}

export function buildCatalogCandidates(
  transactions: Transaction[],
  limit = 90,
): CatalogCandidate[] {
  const grouped = new Map<
    string,
    Omit<CatalogCandidate, "id" | "categories" | "natures" | "institutions" | "people"> & {
      categories: Set<string>;
      natures: Set<string>;
      institutions: Set<string>;
      people: Set<string>;
    }
  >();

  for (const transaction of transactions) {
    const key = merchantKey(transaction) || transaction.id;
    const current = grouped.get(key) ?? {
      merchant: transaction.merchant ?? transaction.description,
      transactionCount: 0,
      inflow: 0,
      outflow: 0,
      categories: new Set<string>(),
      natures: new Set<string>(),
      institutions: new Set<string>(),
      people: new Set<string>(),
      latestDate: transaction.date,
    };
    current.transactionCount += 1;
    if (transaction.amount >= 0) current.inflow += transaction.amount;
    else current.outflow += Math.abs(transaction.amount);
    current.categories.add(transaction.category);
    current.natures.add(transaction.nature);
    current.institutions.add(transaction.institution);
    if (transaction.personName) current.people.add(transaction.personName);
    if (transaction.date > current.latestDate) current.latestDate = transaction.date;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .sort(
      (a, b) => b.inflow + b.outflow - (a.inflow + a.outflow),
    )
    .slice(0, limit)
    .map((candidate, index) => ({
      ...candidate,
      id: "m" + String(index + 1),
      categories: [...candidate.categories],
      natures: [...candidate.natures],
      institutions: [...candidate.institutions],
      people: [...candidate.people],
    }));
}
