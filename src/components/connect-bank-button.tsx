"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

interface PluggyItem {
  id: string;
  status: string;
  connector: {
    name: string;
    imageUrl?: string;
    primaryColor?: string;
  };
}

export function ConnectBankButton({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<PluggyItem[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "syncing" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function loadItems() {
    if (!enabled) {
      setMessage("Configure Supabase e Pluggy para usar suas conexões reais.");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/pluggy/items", { cache: "no-store" });
      const body = (await response.json()) as {
        items?: PluggyItem[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Falha ao carregar.");
      setItems(body.items ?? []);
      if (!body.items?.length) {
        setMessage(
          "Nenhuma conexão encontrada. Conecte sua conta primeiro no Dashboard do Pluggy usando o Meu Pluggy.",
        );
      }
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao carregar.");
    }
  }

  async function importItem(itemId: string) {
    setState("syncing");
    setMessage("");
    try {
      const response = await fetch("/api/pluggy/import-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Falha ao sincronizar.");
      setMessage("Conta importada e sincronizada.");
      setState("idle");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  }

  const busy = state === "loading" || state === "syncing";

  return (
    <div>
      <button
        type="button"
        onClick={loadItems}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        <Icon name={busy ? "sync" : "plus"} className={busy ? "animate-spin" : ""} />
        {state === "loading" ? "Buscando..." : "Buscar conexões do Meu Pluggy"}
      </button>

      <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
        Primeiro conecte suas contas em meu.pluggy.ai e vincule-as à aplicação
        demo no Dashboard da Pluggy. Depois da primeira sincronização, o item
        fica vinculado à sua conta no myScore.
      </p>

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-black text-white"
                  style={{ backgroundColor: item.connector.primaryColor ?? "#475569" }}
                >
                  {item.connector.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.connector.name}
                  </p>
                  <p className="text-xs text-slate-400">{item.status}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => importItem(item.id)}
                disabled={busy}
                className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                Sincronizar
              </button>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
