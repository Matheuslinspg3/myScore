export type RuleOperator =
  | "contains"
  | "equals"
  | "starts_with"
  | "amount_greater_than"
  | "amount_less_than";

export interface TransactionRule {
  id: string;
  field: "description" | "merchant" | "amount";
  operator: RuleOperator;
  value: string;
  category: string;
  priority: number;
  active: boolean;
}

export interface RuleCandidate {
  description: string;
  merchant?: string;
  amount: number;
}

function textMatches(
  source: string,
  operator: RuleOperator,
  expected: string,
): boolean {
  const normalizedSource = source.trim().toLocaleUpperCase("pt-BR");
  const normalizedExpected = expected.trim().toLocaleUpperCase("pt-BR");

  if (operator === "contains") return normalizedSource.includes(normalizedExpected);
  if (operator === "equals") return normalizedSource === normalizedExpected;
  if (operator === "starts_with") {
    return normalizedSource.startsWith(normalizedExpected);
  }
  return false;
}

export function applyRules(
  candidate: RuleCandidate,
  rules: TransactionRule[],
): TransactionRule | null {
  const ordered = [...rules]
    .filter((rule) => rule.active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of ordered) {
    if (rule.field === "amount") {
      const threshold = Number(rule.value);
      if (
        (rule.operator === "amount_greater_than" &&
          candidate.amount > threshold) ||
        (rule.operator === "amount_less_than" &&
          candidate.amount < threshold)
      ) {
        return rule;
      }
      continue;
    }

    const source =
      rule.field === "merchant"
        ? (candidate.merchant ?? "")
        : candidate.description;
    if (textMatches(source, rule.operator, rule.value)) return rule;
  }

  return null;
}
