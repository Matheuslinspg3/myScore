"use client";

import { FormEvent, useState } from "react";
import { Icon } from "@/components/icon";

const itemIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ConnectBankButton({ enabled }: { enabled: boolean }) {
  const [itemId, setItemId] = useState("");
  const [state, setState] = useState<"idle" | "syncing" | "error">("idle");
  const [message, setMessage] = useState("");

  async function importItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedItemId = itemId.trim();

    if (!enabled) {
      setState("error");
      setMessage("Configure Supabase e Pluggy para usar suas conexões reais.");
      return;
    }
    if (!itemIdPattern.test(normalizedItemId)) {
      setState("error");
      setMessage("Informe um Item ID válido da sua conexão no Meu Pluggy.");
      return;
    }

    setState("syncing");
    setMessage("");
    try {
      const response = await fetch("/api/pluggy/import-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: normalizedItemId }),
      });
      const body = (await response.json()) as {
        error?: string;
        databaseCode?: string;
        providerStatus?: number;
      };
      if (!response.ok) {
        const diagnostic = body.databaseCode
          ? ` Código técnico: ${body.databaseCode}.`
          : body.providerStatus
            ? ` Código Pluggy: ${body.providerStatus}.`
            : "";
        throw new Error((body.error ?? "Falha ao sincronizar.") + diagnostic);
      }

      setState("idle");
      setMessage("Conta vinculada e sincronizada com sucesso.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  }

  const busy = state === "syncing";

  return (
    <form onSubmit={importItem} className="w-full max-w-md">
      <label
        htmlFor="pluggy-item-id"
        className="block text-xs font-semibold text-slate-600"
      >
        ID da conexão do Meu Pluggy
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="pluggy-item-id"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          placeholder="Cole o Item ID aqui"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
        >
          <Icon name={busy ? "sync" : "plus"} className={busy ? "animate-spin" : ""} />
          {busy ? "Sincronizando..." : "Vincular conta"}
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        No Dashboard da Pluggy, copie o <strong>Item ID</strong> da conta que
        você já conectou pelo Meu Pluggy. Cole-o aqui uma única vez. O myScore
        valida o ID pela API e o vincula somente à sua conta.
      </p>

      {message && (
        <p
          className={
            "mt-3 text-sm " +
            (state === "error" ? "text-rose-600" : "text-emerald-700")
          }
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}
