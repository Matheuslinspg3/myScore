import type { Receivable, Transaction } from "@/types/finance";

export interface ReconciliationSuggestion {
  receivableId: string;
  transactionId: string;
  score: number;
  reasons: string[];
}

function dayDistance(left: string, right: string): number {
  const milliseconds =
    Math.abs(new Date(left).getTime() - new Date(right).getTime());
  return Math.round(milliseconds / 86_400_000);
}

export function suggestReconciliations(
  receivables: Receivable[],
  transactions: Transaction[],
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];

  for (const receivable of receivables.filter(
    (item) => item.status !== "paid",
  )) {
    const pending = receivable.total - receivable.received;
    for (const transaction of transactions.filter(
      (item) => item.amount > 0 && item.status === "posted",
    )) {
      let score = 0;
      const reasons: string[] = [];
      const normalizedDescription = transaction.description.toLocaleUpperCase(
        "pt-BR",
      );
      const normalizedPerson = receivable.personName.toLocaleUpperCase("pt-BR");

      if (transaction.amount === pending) {
        score += 60;
        reasons.push("mesmo valor");
      }
      if (normalizedDescription.includes(normalizedPerson)) {
        score += 30;
        reasons.push("nome encontrado");
      }
      if (dayDistance(transaction.date, receivable.dueDate) <= 7) {
        score += 10;
        reasons.push("data próxima");
      }

      if (score >= 60) {
        suggestions.push({
          receivableId: receivable.id,
          transactionId: transaction.id,
          score,
          reasons,
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
