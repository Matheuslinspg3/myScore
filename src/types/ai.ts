export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CatalogGroup {
  name: string;
  transactionCount: number;
  inflow: number;
  outflow: number;
  merchants: string[];
  note?: string;
}

export interface CatalogResult {
  summary: string;
  groups: CatalogGroup[];
  insights: string[];
  model: string;
  analyzedTransactions: number;
}
