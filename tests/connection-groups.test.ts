import { describe, expect, it } from "vitest";
import { groupBankingConnections } from "@/lib/banking/connection-groups";
import type { Account, CreditCard } from "@/types/finance";

function account(
  id: string,
  connectionId: string | undefined,
  institution: string,
): Account {
  return {
    id,
    connectionId,
    institution,
    name: id,
    type: "checking",
    balance: 0,
    color: "#000000",
    lastSync: "agora",
    status: "healthy",
  };
}

describe("groupBankingConnections", () => {
  it("agrupa contas pelo item e associa cartões pela conta", () => {
    const accounts = [
      account("inter-checking", "item-inter", "Banco Inter"),
      account("inter-savings", "item-inter", "Banco Inter"),
      account("nubank", "item-nu", "Nubank"),
      account("manual", undefined, "Manual"),
    ];
    const cards: CreditCard[] = [
      {
        id: "card-inter",
        accountId: "inter-checking",
        institution: "Banco Inter",
        name: "Gold",
        invoice: 0,
        limit: 0,
        availableLimit: 0,
        color: "#000000",
      },
    ];

    expect(groupBankingConnections(accounts, cards)).toEqual([
      expect.objectContaining({
        id: "item-inter",
        name: "Banco Inter",
        cardCount: 1,
        accounts: expect.arrayContaining([
          expect.objectContaining({ id: "inter-checking" }),
          expect.objectContaining({ id: "inter-savings" }),
        ]),
      }),
      expect.objectContaining({
        id: "item-nu",
        name: "Nubank",
        cardCount: 0,
      }),
    ]);
  });
});
