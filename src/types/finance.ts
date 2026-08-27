export type Money = number;

export type AccountType =
  | "checking"
  | "savings"
  | "payment"
  | "credit"
  | "investment"
  | "cash"
  | "other";
export type ConnectionStatus = "healthy" | "syncing" | "attention" | "offline";
export type TransactionNature =
  | "expense"
  | "income"
  | "transfer"
  | "third_party"
  | "reimbursable"
  | "loan"
  | "debt_payment"
  | "shared"
  | "investment"
  | "other";

export interface Account {
  id: string;
  institution: string;
  name: string;
  providerName?: string;
  customName?: string;
  maskedNumber?: string;
  type: AccountType;
  balance: Money;
  availableBalance?: Money;
  includeInBalance?: boolean;
  color: string;
  lastSync: string;
  status: ConnectionStatus;
}

export interface CreditCard {
  id: string;
  institution: string;
  name: string;
  invoice: Money;
  limit: Money;
  availableLimit: Money;
  closingDay?: number;
  dueDay?: number;
  color: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  institution: string;
  description: string;
  merchant?: string;
  amount: Money;
  date: string;
  category: string;
  categoryColor: string;
  personId?: string;
  personName?: string;
  nature: TransactionNature;
  status: "posted" | "pending";
  reimbursable?: boolean;
}

export interface Person {
  id: string;
  name: string;
  nickname?: string;
  avatar: string;
  totalAssociated: Money;
  received: Money;
  pending: Money;
}

export interface Receivable {
  id: string;
  personId: string;
  personName: string;
  description: string;
  total: Money;
  received: Money;
  dueDate: string;
  status: "pending" | "partial" | "paid" | "overdue";
  installmentLabel?: string;
}

export interface Payable {
  id: string;
  description: string;
  amount: Money;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  recurring?: boolean;
  category: string;
}

export interface CashFlowPoint {
  label: string;
  income: Money;
  expense: Money;
}

export interface CategorySpend {
  name: string;
  amount: Money;
  color: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  description: string;
  amount: Money;
  kind: "income" | "expense";
  confirmed: boolean;
}

export interface DashboardData {
  userName: string;
  accounts: Account[];
  creditCards: CreditCard[];
  transactions: Transaction[];
  people: Person[];
  receivables: Receivable[];
  payables: Payable[];
  cashFlow: CashFlowPoint[];
  categories: CategorySpend[];
  timeline: TimelineEvent[];
  reserve: Money;
  monthlyIncome: Money;
  monthlyExpense: Money;
  demoMode: boolean;
  aiEnabled?: boolean;
}
