"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { centsToInput, inputToCents } from "@/lib/money-input";
import type { CreditCard } from "@/types/finance";

export function CardSettingsForm({ card }: { card: CreditCard }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState(card.customName ?? "");
  const [invoiceOverride, setInvoiceOverride] = useState(
    centsToInput(card.invoiceOverride),
  );
  const [includeInInvoice, setIncludeInInvoice] = useState(
    card.includeInInvoice !== false,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const invoiceOverrideCents = inputToCents(invoiceOverride);
      if (invoiceOverrideCents != null && invoiceOverrideCents < 0) {
        throw new Error("A fatura não pode ser negativa.");
      }
      const response = await fetch(
        "/api/cards/" + encodeURIComponent(card.id),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customName: customName.trim() || null,
            invoiceOverrideCents,
            includeInInvoice,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        card?: {
          customName?: string | null;
          invoiceOverride?: number | null;
          includeInInvoice?: boolean;
        };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar.");
      }
      setCustomName(payload.card?.customName ?? "");
      setInvoiceOverride(centsToInput(payload.card?.invoiceOverride ?? undefined));
      setIncludeInInvoice(Boolean(payload.card?.includeInInvoice));
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível salvar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-violet-300 transition hover:text-white"
      >
        <Icon name="edit" className="h-3.5 w-3.5" /> Ajustar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 text-slate-900 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !pending) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={"card-settings-" + card.id}
            className="w-full max-w-lg rounded-3xl bg-white p-5 text-left shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">
                  {card.institution}
                </p>
                <h2
                  id={"card-settings-" + card.id}
                  className="mt-1 text-xl font-bold text-slate-950"
                >
                  Configurar cartão
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  A fatura original da Pluggy continuará preservada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Nome personalizado
                </span>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  maxLength={80}
                  placeholder={card.providerName ?? card.name}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Fatura usada no myScore
                </span>
                <input
                  value={invoiceOverride}
                  onChange={(event) => setInvoiceOverride(event.target.value)}
                  inputMode="decimal"
                  placeholder={centsToInput(card.providerInvoice ?? card.invoice)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
                <span className="mt-1.5 block text-xs leading-relaxed text-slate-400">
                  Deixe vazio para voltar ao valor enviado pela Pluggy.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={includeInInvoice}
                  onChange={(event) => setIncludeInInvoice(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Somar na fatura atual
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                    Desmarque se este cartão estiver duplicado ou inativo.
                  </span>
                </span>
              </label>

              {error && (
                <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
