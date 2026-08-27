import type {
  BankingAccount,
  BankingItem,
  BankingProvider,
  BankingTransaction,
  ConnectTokenResult,
} from "@/lib/banking/types";

const PLUGGY_API = "https://api.pluggy.ai";
const MAX_TRANSACTION_PAGES = 100;

interface ApiKeyCache {
  value: string;
  expiresAt: number;
}

interface ListResponse<T> {
  results: T[];
  next?: string | null;
}

export class PluggyApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: "item" | "accounts" | "transactions" | "other",
    readonly providerCode?: string,
  ) {
    super("PLUGGY_API_" + status);
    this.name = "PluggyApiError";
  }
}

export class PluggyBankingProvider implements BankingProvider {
  private apiKeyCache: ApiKeyCache | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async getApiKey(): Promise<string> {
    if (
      this.apiKeyCache &&
      this.apiKeyCache.expiresAt > Date.now() + 60_000
    ) {
      return this.apiKeyCache.value;
    }

    const response = await fetch(PLUGGY_API + "/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Não foi possível autenticar com o provedor bancário.");
    }

    const body = (await response.json()) as { apiKey?: string };
    if (!body.apiKey) throw new Error("Resposta de autenticação inválida.");
    this.apiKeyCache = {
      value: body.apiKey,
      expiresAt: Date.now() + 110 * 60_000,
    };
    return body.apiKey;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const apiKey = await this.getApiKey();
    const response = await fetch(PLUGGY_API + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        ...init.headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let providerCode: string | undefined;
      try {
        const body = (await response.json()) as {
          code?: unknown;
          codeDescription?: unknown;
        };
        if (typeof body.codeDescription === "string") {
          providerCode = body.codeDescription;
        } else if (
          typeof body.code === "string" ||
          typeof body.code === "number"
        ) {
          providerCode = String(body.code);
        }
      } catch {
        // Some provider errors are returned without a JSON body.
      }
      const operation = path.startsWith("/items/")
        ? "item"
        : path.startsWith("/accounts")
          ? "accounts"
          : path.startsWith("/v2/transactions")
            ? "transactions"
            : "other";
      throw new PluggyApiError(response.status, operation, providerCode);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async getItems(): Promise<BankingItem[]> {
    const response = await this.request<ListResponse<BankingItem>>("/items");
    return response.results ?? [];
  }

  async createConnectToken(
    clientUserId: string,
    options: { avoidDuplicates?: boolean } = {},
  ): Promise<ConnectTokenResult> {
    return this.request<ConnectTokenResult>("/connect_token", {
      method: "POST",
      body: JSON.stringify({
        options: {
          clientUserId,
          avoidDuplicates: options.avoidDuplicates ?? true,
        },
      }),
    });
  }

  async disconnect(itemId: string): Promise<void> {
    await this.request<void>("/items/" + encodeURIComponent(itemId), {
      method: "DELETE",
    });
  }

  async refreshConnection(itemId: string): Promise<void> {
    await this.request<void>("/items/" + encodeURIComponent(itemId), {
      method: "PATCH",
      body: JSON.stringify({}),
    });
  }

  async getItem(itemId: string): Promise<BankingItem> {
    return this.request<BankingItem>(
      "/items/" + encodeURIComponent(itemId),
    );
  }

  async getAccounts(itemId: string): Promise<BankingAccount[]> {
    const query = new URLSearchParams({ itemId });
    const response = await this.request<ListResponse<BankingAccount>>(
      "/accounts?" + query.toString(),
    );
    return response.results ?? [];
  }

  async getTransactions(accountId: string): Promise<BankingTransaction[]> {
    const transactions: BankingTransaction[] = [];
    const query = new URLSearchParams({ accountId });
    let path: string | null = "/v2/transactions?" + query.toString();
    let pageCount = 0;

    while (path) {
      const page: ListResponse<BankingTransaction> = await this.request(
        path,
      );
      transactions.push(...(page.results ?? []));
      pageCount += 1;
      // Pluggy v2 returns the following page as an opaque query string, such
      // as ?accountId=...&after=.... It must be reused unchanged.
      path = page.next?.startsWith("?")
        ? "/v2/transactions" + page.next
        : page.next?.startsWith("/v2/transactions?")
          ? page.next
          : null;
      if (path && pageCount >= MAX_TRANSACTION_PAGES) {
        throw new Error("PLUGGY_TRANSACTION_PAGE_LIMIT");
      }
    }

    return transactions;
  }
}

let provider: PluggyBankingProvider | undefined;

export function getPluggyProvider(): PluggyBankingProvider {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Pluggy não configuradas.");
  }
  provider ??= new PluggyBankingProvider(clientId, clientSecret);
  return provider;
}
