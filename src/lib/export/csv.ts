export interface CsvTransaction {
  date: string;
  institution: string;
  account: string;
  description: string;
  merchant?: string | null;
  amountCents: number;
  category: string;
  person?: string | null;
  nature: string;
  status: string;
  reimbursable: boolean;
}

function safeSpreadsheetText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function csvCell(value: string, protectFormula = true): string {
  const safe = protectFormula ? safeSpreadsheetText(value) : value;
  return /[;"\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

function decimalFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function buildTransactionsCsv(rows: CsvTransaction[]): string {
  const header = [
    "Data",
    "Instituição",
    "Conta",
    "Descrição",
    "Estabelecimento",
    "Valor (R$)",
    "Categoria",
    "Pessoa",
    "Natureza",
    "Status",
    "Reembolsável",
  ];
  const lines = rows.map((row) =>
    [
      row.date,
      row.institution,
      row.account,
      row.description,
      row.merchant ?? "",
      decimalFromCents(row.amountCents),
      row.category,
      row.person ?? "",
      row.nature,
      row.status,
      row.reimbursable ? "Sim" : "Não",
    ]
      .map((value, index) => csvCell(value, index !== 5))
      .join(";"),
  );
  return "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
}
