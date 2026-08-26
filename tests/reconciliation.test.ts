import { describe, expect, it } from "vitest";
import { suggestReconciliations } from "@/lib/finance/reconciliation";
import { suggestInternalTransfers } from "@/lib/finance/transfers";
import type { Receivable, Transaction } from "@/types/finance";

const income: Transaction = {
  id: "income",
  accountId: "inter",
  institution: "Inter",
  description: "PIX recebido Guilherme",
  amount: 55_000,
  date: "2026-08-30",
  category: "Receitas",
  categoryColor: "#0f0",
  nature: "income",
  status: "posted",
};

describe("receivable reconciliation", () => {
  it("suggests but does not auto-link a matching payment", () => {
    const receivable: Receivable = {
      id: "receivable",
      personId: "guilherme",
      personName: "Guilherme",
      description: "Parcela",
      total: 55_000,
      received: 0,
      dueDate: "2026-08-30",
      status: "pending",
    };
    const [suggestion] = suggestReconciliations([receivable], [income]);
    expect(suggestion).toMatchObject({
      receivableId: "receivable",
      transactionId: "income",
      score: 100,
    });
  });
});

describe("internal transfers", () => {
  it("pairs opposite transactions without treating them as income/expense", () => {
    const debit: Transaction = {
      ...income,
      id: "debit",
      accountId: "inter",
      amount: -40_000,
      description: "PIX para minha conta",
    };
    const credit: Transaction = {
      ...income,
      id: "credit",
      accountId: "nubank",
      amount: 40_000,
      description: "PIX recebido",
    };
    expect(suggestInternalTransfers([debit, credit])).toEqual([
      {
        debitTransactionId: "debit",
        creditTransactionId: "credit",
        confidence: 0.98,
      },
    ]);
  });
});
