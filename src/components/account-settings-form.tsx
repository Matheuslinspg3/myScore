"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { DeleteBankingResourceButton } from "@/components/delete-banking-resource-button";
import { isLiquidAccountType } from "@/lib/banking/account-type";
import { centsToInput, inputToCents } from "@/lib/money-input";
import type { Account } from "@/types/finance";

export function AccountSettingsForm({ account }: { account: Account }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState(account.customName ?? "");
  const [includeInBalance, setIncludeInBalance] = useState(
    account.includeInBalance !== false,
  );
  const [balanceOverride, setBalanceOverride] = useState(
    centsToInput(account.balanceOverride),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const canInclude = isLiquidAccountType(account.type);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const balanceOverrideCents = inputToCents(balanceOverride);
      const response = await fetch(
        "/api/accounts/" + encodeURIComponent(account.id),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customName: customName.trim() || null,
            includeInBalance: canInclude && includeInBalance,
            balanceOverrideCents,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        account?: {
          customName?: string | null;
          balanceOverride?: number | null;
          includeInBalance?: boolean;
        };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar.");
      }
      setCustomName(payload.account?.customName ?? "");
      setBalanceOverride(centsToInput(payload.account?.balanceOverride ?? undefined));
      setIncludeInBalance(Boolean(payload.account?.includeInBalance));
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
        className="flex items-center gap-1.5 text-xs font-semibold text-violet-600"
      >
        <Icon name="edit" className="h-3.5 w-3.5" /> Editar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !pending) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={"account-settings-" + account.id}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">
                  {account.institution}
                </p>
                <h2
                  id={"account-settings-" + account.id}
                  className="mt-1 text-xl font-bold text-slate-950"
                >
                  Configurar conta
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  O nome original e o saldo da Pluggy não serão alterados.
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
                  autoFocus
                  placeholder={account.providerName ?? account.name}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
                <span className="mt-1.5 block text-xs text-slate-400">
                  Deixe vazio para voltar ao nome informado pelo banco.
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Saldo usado no myScore
                </span>
                <input
                  value={balanceOverride}
                  onChange={(event) => setBalanceOverride(event.target.value)}
                  inputMode="decimal"
                  placeholder={centsToInput(
                    account.providerBalance ?? account.balance,
                  )}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
                <span className="mt-1.5 block text-xs leading-relaxed text-slate-400">
                  Opcional. Deixe vazio para usar sempre o saldo da Pluggy.
                  Um ajuste fica separado e pode ser removido depois.
                </span>
              </label>

              <label
                className={
                  "flex items-start gap-3 rounded-xl border px-4 py-3 " +
                  (canInclude
                    ? "border-slate-200"
                    : "border-slate-100 bg-slate-50")
                }
              >
                <input
                  type="checkbox"
                  checked={canInclude && includeInBalance}
                  onChange={(event) => setIncludeInBalance(event.target.checked)}
                  disabled={!canInclude}
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Somar no saldo total
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                    {canInclude
                      ? "Desmarque se esta conta estiver duplicada ou não representar dinheiro disponível."
                      : "Cartões, investimentos e tipos desconhecidos ficam fora do saldo bancário."}
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

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 pt-5">
              <div>
                <p className="text-xs font-bold text-rose-700">Zona de risco</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Remove esta conta e o histórico bancário vinculado.
                </p>
              </div>
              <DeleteBankingResourceButton
                kind="account"
                resourceId={account.id}
                name={account.name}
                detail="As transações, o cartão e as classificações ligadas a esta conta serão apagados. Parcelas, recebíveis e contas a pagar são preservados, mas perdem o vínculo bancário."
                compact
                onDeleted={() => setOpen(false)}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
