import { createHash } from "node:crypto";

export interface FingerprintInput {
  accountId: string;
  date: string;
  amount: number;
  description: string;
  providerCode?: string | null;
  balanceAfter?: number | null;
}

function normalizeDescription(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function transactionFingerprint(input: FingerprintInput): string {
  const stableParts = [
    input.accountId,
    input.date.slice(0, 16),
    String(input.amount),
    normalizeDescription(input.description),
    input.providerCode ?? "",
    input.balanceAfter == null ? "" : String(input.balanceAfter),
  ];

  return createHash("sha256").update(stableParts.join("|")).digest("hex");
}

export interface ExternalTransaction {
  externalId?: string | null;
  fingerprint: string;
}

export function isDuplicate(
  candidate: ExternalTransaction,
  existing: ExternalTransaction[],
): boolean {
  return existing.some((current) => {
    if (candidate.externalId && current.externalId) {
      return candidate.externalId === current.externalId;
    }
    return candidate.fingerprint === current.fingerprint;
  });
}
