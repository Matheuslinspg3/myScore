"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";

interface PersonFormProps {
  disabled?: boolean;
}

export function PersonForm({ disabled = false }: PersonFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          nickname: form.get("nickname") || null,
          phone: form.get("phone") || null,
          notes: form.get("notes") || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível cadastrar.");
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível cadastrar.",
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
        disabled={disabled}
        title={disabled ? "Disponível no modo conectado" : "Cadastrar pessoa"}
        className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="plus" className="h-4 w-4" /> Nova pessoa
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
            aria-labelledby="new-person-title"
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">
                  Pessoas
                </p>
                <h2
                  id="new-person-title"
                  className="mt-1 text-xl font-bold text-slate-950"
                >
                  Cadastrar pessoa
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use depois para dividir gastos e controlar reembolsos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nome *</span>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoFocus
                  placeholder="Ex.: Guilherme Silva"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">
                    Apelido
                  </span>
                  <input
                    name="nickname"
                    maxLength={80}
                    placeholder="Ex.: Gui"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">
                    Telefone
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    maxLength={30}
                    placeholder="(00) 00000-0000"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Observações
                </span>
                <textarea
                  name="notes"
                  maxLength={2000}
                  rows={3}
                  placeholder="Informações úteis para você"
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </label>
              {error && (
                <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
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
                  {pending ? "Salvando..." : "Cadastrar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
