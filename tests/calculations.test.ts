import { describe, expect, it } from "vitest";
import {
  calculateSafeBalance,
  projectBalance,
  splitInstallments,
  sumAccountBalances,
  sumCreditCardInvoices,
} from "@/lib/finance/calculations";
import type { Account, CreditCard } from "@/types/finance";

function account(
  type: Account["type"],
  balance: number,
  includeInBalance?: boolean,
): Account {
  return {
    id: type + String(balance),
    institution: "Banco",
    name: "Conta",
    type,
    balance,
    includeInBalance,
    color: "#000000",
    lastSync: "agora",
    status: "healthy",
  };
}

describe("sumAccountBalances", () => {
  it("soma somente dinheiro líquido incluído pelo usuário", () => {
    expect(
      sumAccountBalances([
        account("checking", 300_000),
        account("payment", 120_000),
        account("checking", 90_000, false),
        account("credit", 117_090, true),
        account("investment", 800_000, true),
        account("other", 500_000, true),
      ]),
    ).toBe(420_000);
  });
});

describe("sumCreditCardInvoices", () => {
  it("soma somente faturas incluídas e nunca subtrai valores negativos", () => {
    const card = (
      id: string,
      invoice: number,
      includeInInvoice?: boolean,
    ): CreditCard => ({
      id,
      institution: "Banco",
      name: "Cartão",
      invoice,
      includeInInvoice,
      limit: 1_000_000,
      availableLimit: 500_000,
      color: "#000000",
    });

    expect(
      sumCreditCardInvoices([
        card("a", 117_090),
        card("duplicado", 1_000_000, false),
        card("saldo-credor", -5_000),
      ]),
    ).toBe(117_090);
  });
});

describe("calculateSafeBalance", () => {
  it("does not count receivables by default", () => {
    expect(
      calculateSafeBalance({
        bankBalance: 628_000,
        committedOutflows: 286_000,
        confirmedReceivables: 110_000,
        reserve: 0,
      }).safeBalance,
    ).toBe(342_000);
  });

  it("only includes receivables when explicitly allowed", () => {
    expect(
      calculateSafeBalance({
        bankBalance: 628_000,
        committedOutflows: 286_000,
        confirmedReceivables: 55_000,
        reserve: 20_000,
        includeReceivables: true,
      }).safeBalance,
    ).toBe(377_000);
  });
});

describe("splitInstallments", () => {
  it("never loses cents when dividing", () => {
    const parts = splitInstallments(1_000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(1_000);
  });

  it("rejects invalid counts", () => {
    expect(() => splitInstallments(1_000, 0)).toThrow();
  });
});

describe("projectBalance", () => {
  it("orders events and preserves a running balance", () => {
    const projection = projectBalance(100_000, [
      {
        id: "later",
        date: "2026-09-10",
        description: "Receita",
        amount: 50_000,
        kind: "income",
        confirmed: true,
      },
      {
        id: "first",
        date: "2026-09-01",
        description: "Aluguel",
        amount: 30_000,
        kind: "expense",
        confirmed: true,
      },
    ]);
    expect(projection.map((point) => point.balance)).toEqual([70_000, 120_000]);
  });
});
