export interface BankingAccount {
  id: string;
  type: string;
  subtype?: string;
  name: string;
  number?: string;
  balance: number;
  currencyCode: string;
  creditData?: {
    level?: string;
    brand?: string;
    balanceCloseDate?: string;
    balanceDueDate?: string;
    availableCreditLimit?: number;
    creditLimit?: number;
    balanceForeignCurrency?: number;
    minimumPayment?: number;
  };
}

export interface BankingTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  descriptionRaw?: string;
  amount: number;
  currencyCode?: string;
  type: "CREDIT" | "DEBIT";
  status?: "POSTED" | "PENDING";
  providerCode?: string;
  providerId?: string;
  balance?: number;
  category?: string;
  categoryId?: string;
  merchant?: {
    name?: string;
    businessName?: string;
    cnpj?: string;
  };
}

export interface BankingItem {
  id: string;
  connector: {
    id: number;
    name: string;
    imageUrl?: string;
    primaryColor?: string;
  };
  status: string;
  clientUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectTokenResult {
  accessToken: string;
}

export interface BankingProvider {
  getItems(): Promise<BankingItem[]>;
  createConnectToken(
    clientUserId: string,
    options?: { avoidDuplicates?: boolean },
  ): Promise<ConnectTokenResult>;
  disconnect(itemId: string): Promise<void>;
  refreshConnection(itemId: string): Promise<void>;
  getItem(itemId: string): Promise<BankingItem>;
  getAccounts(itemId: string): Promise<BankingAccount[]>;
  getTransactions(accountId: string): Promise<BankingTransaction[]>;
}
