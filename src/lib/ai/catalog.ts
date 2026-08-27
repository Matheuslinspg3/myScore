import { z } from "zod";
import type { CatalogResult } from "@/types/ai";
import type { CatalogCandidate } from "@/lib/ai/context";

const modelCatalogSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  assignments: z
    .array(
      z.object({
        candidateId: z.string().trim().min(1).max(40),
        group: z.string().trim().min(1).max(80),
        note: z.string().trim().max(240).optional(),
      }),
    )
    .max(120),
  insights: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
});

function parseJsonObject(text: string): unknown {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("CATALOG_INVALID_JSON");
  }
  return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

export function buildCatalogResult(
  candidates: CatalogCandidate[],
  modelText: string,
  model: string,
): CatalogResult {
  const parsed = modelCatalogSchema.parse(parseJsonObject(modelText));
  const assignments = new Map(
    parsed.assignments.map((assignment) => [assignment.candidateId, assignment]),
  );
  const groups = new Map<
    string,
    {
      name: string;
      transactionCount: number;
      inflow: number;
      outflow: number;
      merchants: string[];
      notes: string[];
    }
  >();

  for (const candidate of candidates) {
    const assignment = assignments.get(candidate.id);
    const name = assignment?.group ?? "Não catalogado";
    const current = groups.get(name) ?? {
      name,
      transactionCount: 0,
      inflow: 0,
      outflow: 0,
      merchants: [],
      notes: [],
    };
    current.transactionCount += candidate.transactionCount;
    current.inflow += candidate.inflow;
    current.outflow += candidate.outflow;
    current.merchants.push(candidate.merchant);
    if (assignment?.note) current.notes.push(assignment.note);
    groups.set(name, current);
  }

  return {
    summary: parsed.summary,
    groups: [...groups.values()]
      .map((group) => ({
        name: group.name,
        transactionCount: group.transactionCount,
        inflow: group.inflow,
        outflow: group.outflow,
        merchants: [...new Set(group.merchants)].slice(0, 6),
        note: [...new Set(group.notes)].slice(0, 2).join(" ") || undefined,
      }))
      .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow)),
    insights: parsed.insights,
    model,
    analyzedTransactions: candidates.reduce(
      (sum, candidate) => sum + candidate.transactionCount,
      0,
    ),
  };
}
