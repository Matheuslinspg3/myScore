import { describe, expect, it } from "vitest";
import {
  isLiquidAccountType,
  normalizeAccountType,
} from "@/lib/banking/account-type";

describe("bank account classification", () => {
  it.each([
    ["BANK", "checking"],
    ["CHECKING_ACCOUNT", "checking"],
    ["SAVINGS", "savings"],
    ["PAYMENT_ACCOUNT", "payment"],
    ["CREDIT", "credit"],
    ["INVESTMENT", "investment"],
    ["PENSION", "investment"],
    ["LOAN", "other"],
  ])("classifica %s como %s", (providerType, expected) => {
    expect(normalizeAccountType(providerType)).toBe(expected);
  });

  it("considera líquido somente o que representa dinheiro disponível", () => {
    expect(isLiquidAccountType("checking")).toBe(true);
    expect(isLiquidAccountType("payment")).toBe(true);
    expect(isLiquidAccountType("credit")).toBe(false);
    expect(isLiquidAccountType("investment")).toBe(false);
    expect(isLiquidAccountType("other")).toBe(false);
  });
});
