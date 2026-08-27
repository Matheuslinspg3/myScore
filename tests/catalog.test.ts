import { describe, expect, it } from "vitest";
import { buildCatalogResult } from "@/lib/ai/catalog";
import type { CatalogCandidate } from "@/lib/ai/context";

const candidates: CatalogCandidate[] = [
  {
    id: "m1",
    merchant: "Mercado Teste",
    transactionCount: 2,
    inflow: 0,
    outflow: 12_345,
    categories: ["Mercado"],
    natures: ["expense"],
    institutions: ["Banco"],
    people: [],
    latestDate: "2026-08-27",
  },
  {
    id: "m2",
    merchant: "Salário",
    transactionCount: 1,
    inflow: 500_000,
    outflow: 0,
    categories: ["Receitas"],
    natures: ["income"],
    institutions: ["Banco"],
    people: [],
    latestDate: "2026-08-25",
  },
];

describe("AI catalog", () => {
  it("usa a IA para nomes, mas calcula totais com os dados originais", () => {
    const result = buildCatalogResult(
      candidates,
      JSON.stringify({
        summary: "Catálogo pronto.",
        assignments: [
          { candidateId: "m1", group: "Alimentação" },
          { candidateId: "m2", group: "Receitas" },
        ],
        insights: ["Revise gastos recorrentes."],
      }),
      "claude-opus-5",
    );

    expect(result.groups).toEqual([
      expect.objectContaining({
        name: "Receitas",
        inflow: 500_000,
        outflow: 0,
        transactionCount: 1,
      }),
      expect.objectContaining({
        name: "Alimentação",
        inflow: 0,
        outflow: 12_345,
        transactionCount: 2,
      }),
    ]);
    expect(result.analyzedTransactions).toBe(3);
  });
});
