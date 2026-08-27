"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Icon } from "@/components/icon";

const PluggyConnect = dynamic(
  () =>
    import("react-pluggy-connect").then((module) => module.PluggyConnect),
  { ssr: false },
);

interface PluggySuccess {
  item: { id: string };
}

export function ConnectBankButton({ enabled }: { enabled: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [document, setDocument] = useState("");
  const [state, setState] = useState<
    "idle" | "token" | "connecting" | "syncing" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function openConnect() {
    if (!enabled) {
      setMessage("Configure Supabase e Pluggy para conectar sua conta real.");
      return;
    }

    const normalizedDocument = document.replace(/\D/g, "");
    if (![11, 14].includes(normalizedDocument.length)) {
      setState("error");
      setMessage("Informe um CPF ou CNPJ válido para continuar.");
      return;
    }

    setState("token");
    setMessage("");
    try {
      const response = await fetch("/api/pluggy/connect-token", {
        method: "POST",
      });
      const body = (await response.json()) as {
        accessToken?: string;
        error?: string;
      };
      if (!response.ok || !body.accessToken) {
        throw new Error(body.error ?? "Falha ao iniciar.");
      }
      setToken(body.accessToken);
      setState("connecting");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao iniciar.");
    }
  }

  async function handleSuccess(result: PluggySuccess) {
    setToken(null);
    setState("syncing");
    try {
      const response = await fetch("/api/pluggy/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: result.item.id }),
      });
      if (!response.ok) throw new Error("Conectou, mas a sincronização falhou.");
      setState("done");
      setMessage("Conta conectada e sincronizada.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  }

  const busy = state === "token" || state === "syncing";

  return (
    <>
      <button
        type="button"
        onClick={openConnect}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        <Icon name={busy ? "sync" : "plus"} className={busy ? "animate-spin" : ""} />
        {busy ? "Preparando..." : "Conectar instituição"}
      </button>
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
      <label className="mt-4 block max-w-sm">
        <span className="mb-2 block text-xs font-semibold text-slate-600">
          CPF ou CNPJ para o Open Finance
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={document}
          onChange={(event) =>
            setDocument(event.target.value.replace(/\D/g, "").slice(0, 14))
          }
          placeholder="Somente números"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
        <span className="mt-1.5 block text-xs leading-relaxed text-slate-400">
          Usado apenas durante a conexão e não armazenado pelo myScore.
        </span>
      </label>
      {token && state === "connecting" && (
        <PluggyConnect
          connectToken={token}
          includeSandbox={false}
          forceOauthInBrowser
          openFinanceParameters={
            document.replace(/\D/g, "").length === 11
              ? { cpf: document.replace(/\D/g, "") }
              : { cnpj: document.replace(/\D/g, "") }
          }
          onSuccess={handleSuccess}
          onError={(error) => {
            setState("error");
            setToken(null);
            setMessage(error.message || "A conexão não foi concluída.");
          }}
          onLoadError={(error) => {
            setState("error");
            setToken(null);
            setMessage(error.message || "Não foi possível carregar a conexão.");
          }}
          onClose={() => {
            setState("idle");
            setToken(null);
          }}
        />
      )}
    </>
  );
}
