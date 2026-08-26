import type { Transaction } from "@/types/finance";

export interface TransferSuggestion {
  debitTransactionId: string;
  creditTransactionId: string;
  confidence: number;
}

function distanceInDays(left: string, right: string): number {
  return Math.abs(
    (new Date(left).getTime() - new Date(right).getTime()) / 86_400_000,
  );
}

export function suggestInternalTransfers(
  transactions: Transaction[],
): TransferSuggestion[] {
  const debits = transactions.filter(
    (item) => item.amount < 0 && item.nature !== "transfer",
  );
  const credits = transactions.filter(
    (item) => item.amount > 0 && item.nature !== "transfer",
  );
  const suggestions: TransferSuggestion[] = [];

  for (const debit of debits) {
    for (const credit of credits) {
      if (debit.accountId === credit.accountId) continue;
      if (Math.abs(debit.amount) !== credit.amount) continue;
      const dayDistance = distanceInDays(debit.date, credit.date);
      if (dayDistance > 2) continue;

      const transferText =
        (debit.description + " " + credit.description).toLocaleUpperCase(
          "pt-BR",
        );
      const hasTransferHint =
        transferText.includes("PIX") ||
        transferText.includes("TRANSFER") ||
        transferText.includes("TED");

      suggestions.push({
        debitTransactionId: debit.id,
        creditTransactionId: credit.id,
        confidence: hasTransferHint ? 0.98 : dayDistance === 0 ? 0.9 : 0.82,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
