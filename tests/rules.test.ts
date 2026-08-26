import { describe, expect, it } from "vitest";
import { applyRules, type TransactionRule } from "@/lib/finance/rules";

const rules: TransactionRule[] = [
  {
    id: "netflix",
    field: "description",
    operator: "contains",
    value: "NETFLIX",
    category: "Assinaturas",
    priority: 20,
    active: true,
  },
  {
    id: "posto",
    field: "merchant",
    operator: "starts_with",
    value: "POSTO",
    category: "Combustível",
    priority: 10,
    active: true,
  },
];

describe("automatic rules", () => {
  it("matches case-insensitively", () => {
    expect(
      applyRules(
        { description: "Netflix.com", amount: -5_590 },
        rules,
      )?.category,
    ).toBe("Assinaturas");
  });

  it("obeys priority", () => {
    expect(
      applyRules(
        {
          description: "Compra Netflix",
          merchant: "Posto Avenida",
          amount: -10_000,
        },
        rules,
      )?.id,
    ).toBe("posto");
  });
});
