import type { AccountType } from "@/types/finance";

export function normalizeAccountType(value?: string | null): AccountType {
  const type = value?.trim().toUpperCase() ?? "";

  if (type.includes("CREDIT") || type.includes("CARD")) return "credit";
  if (
    type.includes("INVEST") ||
    type.includes("BROKER") ||
    type.includes("PENSION")
  ) {
    return "investment";
  }
  if (type.includes("SAVING")) return "savings";
  if (type.includes("PAYMENT") || type.includes("PREPAID")) return "payment";
  if (type.includes("CASH")) return "cash";
  if (
    type.includes("CHECKING") ||
    type === "BANK" ||
    type === "CURRENT_ACCOUNT"
  ) {
    return "checking";
  }
  return "other";
}

export function isLiquidAccountType(type: AccountType): boolean {
  return ["checking", "savings", "payment", "cash"].includes(type);
}
