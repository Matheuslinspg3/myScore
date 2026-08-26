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
  const [state, setState] = useState<
    "idle" | "token" | "connecting" | "syncing" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function openConnect() {
    if (!enabled) {
      setMessage("Configure Supabase e Pluggy para conectar sua conta real.");
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
      {token && state === "connecting" && (
        <PluggyConnect
          connectToken={token}
          includeSandbox={false}
          onSuccess={handleSuccess}
          onError={() => {
            setState("error");
            setToken(null);
            setMessage("A conexão não foi concluída.");
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
