export function centsToInput(cents?: number): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s/g, "").replace(/^R\$/i, "");
  let normalized: string;

  if (compact.includes(",")) {
    const brazilian = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
    if (!brazilian.test(compact)) {
      throw new Error("Informe um valor válido, como 1234,56.");
    }
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d+\.\d{1,2}$/.test(compact)) {
    normalized = compact;
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, "");
  } else if (/^-?\d+$/.test(compact)) {
    normalized = compact;
  } else {
    throw new Error("Informe um valor válido, como 1234,56.");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    throw new Error("Informe um valor válido.");
  }
  return Math.round(amount * 100);
}
