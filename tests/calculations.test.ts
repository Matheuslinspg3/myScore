import { describe, expect, it } from "vitest";
import {
  calculateSafeBalance,
  projectBalance,
  splitInstallments,
} from "@/lib/finance/calculations";

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
