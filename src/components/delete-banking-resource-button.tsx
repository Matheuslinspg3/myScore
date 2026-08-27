"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";

interface DeleteBankingResourceButtonProps {
  kind: "account" | "connection";
  resourceId: string;
  name: string;
  detail: string;
  compact?: boolean;
  onDeleted?: () => void;
}

export function DeleteBankingResourceButton({
  kind,
  resourceId,
  name,
  detail,
  compact = false,
  onDeleted,
}: DeleteBankingResourceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const endpoint =
    kind === "account"
      ? "/api/accounts/" + encodeURIComponent(resourceId)
      : "/api/connections/" + encodeURIComponent(resourceId);
  const title = kind === "account" ? "Apagar conta" : "Apagar instituição";

  async function removeResource() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível apagar.");
      }
      setOpen(false);
      onDeleted?.();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível apagar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirmation("");
          setError("");
          setOpen(true);
        }}
        className={
          compact
            ? "inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 transition hover:text-rose-800"
            : "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        }
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
        {title}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 text-slate-900 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !pending) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={"delete-banking-resource-" + resourceId}
            className="w-full max-w-lg rounded-3xl bg-white p-5 text-left shadow-2xl sm:p-6"
          >
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <Icon name="trash" className="h-5 w-5" />
            </div>
            <h2
              id={"delete-banking-resource-" + resourceId}
              className="mt-4 text-xl font-bold text-slate-950"
            >
              {title}: {name}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {detail}
            </p>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              A exclusão vale somente para o myScore e impede que a sincronização
              automática recrie o registro. Para restaurar depois, vincule o Item
              ID novamente.
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-slate-600">
                Digite APAGAR para confirmar
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold uppercase outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
            </label>

            {error && (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={removeResource}
                disabled={pending || confirmation.trim().toUpperCase() !== "APAGAR"}
                className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Apagando..." : "Apagar definitivamente"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
