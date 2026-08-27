import { describe, expect, it } from "vitest";
import { buildTransactionsCsv } from "@/lib/export/csv";

describe("transaction CSV", () => {
  it("preserva centavos e neutraliza fórmulas em texto", () => {
    const csv = buildTransactionsCsv([
      {
        date: "2026-08-27",
        institution: "Banco",
        account: "Conta",
        description: "=IMPORTXML(\"https://example.test\")",
        amountCents: -12_345,
        category: "Mercado; casa",
        nature: "expense",
        status: "posted",
        reimbursable: false,
      },
    ]);

    expect(csv.startsWith("\uFEFFData;Instituição")).toBe(true);
    expect(csv).toContain("'=IMPORTXML");
    expect(csv).toContain("-123,45");
    expect(csv).toContain('"Mercado; casa"');
  });
});
