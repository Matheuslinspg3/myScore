import type {
  Account,
  Money,
  Payable,
  Receivable,
  TimelineEvent,
} from "@/types/finance";
import { isLiquidAccountType } from "@/lib/banking/account-type";

export interface SafeBalanceInput {
  bankBalance: Money;
  committedOutflows: Money;
  reserve: Money;
  confirmedReceivables?: Money;
  includeReceivables?: boolean;
}

export interface SafeBalanceResult {
  bankBalance: Money;
  committed: Money;
  reserve: Money;
  consideredReceivables: Money;
  safeBalance: Money;
}

export function accountContributesToBalance(account: Account): boolean {
  return (
    isLiquidAccountType(account.type) && account.includeInBalance !== false
  );
}

export function sumAccountBalances(accounts: Account[]): Money {
  return accounts
    .filter(accountContributesToBalance)
    .reduce((sum, account) => sum + account.balance, 0);
}

export function pendingPayables(
  payables: Payable[],
  throughDate?: string,
): Money {
  return payables
    .filter((payable) => payable.status !== "paid")
    .filter((payable) => !throughDate || payable.dueDate <= throughDate)
    .reduce((sum, payable) => sum + payable.amount, 0);
}

export function pendingReceivables(
  receivables: Receivable[],
  throughDate?: string,
): Money {
  return receivables
    .filter((receivable) => receivable.status !== "paid")
    .filter((receivable) => !throughDate || receivable.dueDate <= throughDate)
    .reduce(
      (sum, receivable) =>
        sum + Math.max(0, receivable.total - receivable.received),
      0,
    );
}

export function calculateSafeBalance(
  input: SafeBalanceInput,
): SafeBalanceResult {
  const consideredReceivables = input.includeReceivables
    ? Math.max(0, input.confirmedReceivables ?? 0)
    : 0;
  const committed = Math.max(0, input.committedOutflows);
  const reserve = Math.max(0, input.reserve);

  return {
    bankBalance: input.bankBalance,
    committed,
    reserve,
    consideredReceivables,
    safeBalance:
      input.bankBalance + consideredReceivables - committed - reserve,
  };
}

export function splitInstallments(total: Money, count: number): Money[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error("O total deve ser um inteiro não negativo em centavos.");
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("A quantidade de parcelas deve ser um inteiro positivo.");
  }

  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export interface ProjectionPoint {
  date: string;
  description: string;
  delta: Money;
  balance: Money;
}

export function projectBalance(
  initialBalance: Money,
  events: TimelineEvent[],
  throughDate?: string,
): ProjectionPoint[] {
  let balance = initialBalance;

  return [...events]
    .filter((event) => !throughDate || event.date <= throughDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => {
      const delta =
        event.kind === "income" ? Math.abs(event.amount) : -Math.abs(event.amount);
      balance += delta;

      return {
        date: event.date,
        description: event.description,
        delta,
        balance,
      };
    });
}
