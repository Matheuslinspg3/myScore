import { afterEach, describe, expect, it, vi } from "vitest";
import { PluggyBankingProvider } from "@/lib/banking/pluggy-provider";

afterEach(() => vi.unstubAllGlobals());

describe("PluggyBankingProvider", () => {
  it("reutiliza a próxima consulta opaca da API v2 de transações", async () => {
    const accountId = "11111111-1111-4111-8111-111111111111";
    const next = "?accountId=" + accountId + "&after=opaque%3D";
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth")) return Response.json({ apiKey: "test-key" });
      if (url.endsWith(next)) {
        return Response.json({ results: [{ id: "second" }], next: null });
      }
      return Response.json({ results: [{ id: "first" }], next });
    });
    vi.stubGlobal("fetch", fetcher);

    const provider = new PluggyBankingProvider("client", "secret");
    const transactions = await provider.getTransactions(accountId);

    expect(transactions.map((transaction) => transaction.id)).toEqual([
      "first",
      "second",
    ]);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.pluggy.ai/v2/transactions?accountId=" + accountId,
      expect.any(Object),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://api.pluggy.ai/v2/transactions" + next,
      expect.any(Object),
    );
  });
});
