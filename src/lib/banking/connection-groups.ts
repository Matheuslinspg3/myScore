import type { Account, CreditCard } from "@/types/finance";

export interface BankingConnectionGroup {
  id: string;
  name: string;
  accounts: Account[];
  cardCount: number;
}

export function groupBankingConnections(
  accounts: Account[],
  cards: CreditCard[],
): BankingConnectionGroup[] {
  const groups = new Map<string, BankingConnectionGroup>();

  for (const account of accounts) {
    if (!account.connectionId) continue;
    const current = groups.get(account.connectionId);
    if (current) {
      current.accounts.push(account);
      continue;
    }
    groups.set(account.connectionId, {
      id: account.connectionId,
      name: account.institution,
      accounts: [account],
      cardCount: 0,
    });
  }

  const connectionByAccount = new Map(
    accounts
      .filter((account) => account.connectionId)
      .map((account) => [account.id, account.connectionId as string]),
  );
  for (const card of cards) {
    if (!card.accountId) continue;
    const connectionId = connectionByAccount.get(card.accountId);
    if (!connectionId) continue;
    const group = groups.get(connectionId);
    if (group) group.cardCount += 1;
  }

  return [...groups.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}
