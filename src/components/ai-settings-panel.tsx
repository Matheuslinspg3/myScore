"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";

type ApiFormat = "openai" | "anthropic";
type AuthScheme = "bearer" | "x-api-key";

interface SettingsStatus {
  source: "dashboard" | "environment" | "none";
  configured: boolean;
  enabled: boolean;
  apiKeyConfigured: boolean;
  apiFormat: ApiFormat;
  authScheme: AuthScheme;
  baseUrl: string;
  chatModel: string;
  dataModel: string;
}

interface SettingsForm {
  enabled: boolean;
  apiFormat: ApiFormat;
  authScheme: AuthScheme;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  dataModel: string;
}

const defaults: SettingsForm = {
  enabled: true,
  apiFormat: "openai",
  authScheme: "bearer",
  baseUrl: "",
  apiKey: "",
  chatModel: "claude-sonnet-5",
  dataModel: "claude-opus-5",
};

function payloadError(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export function AiSettingsPanel({
  initialEnabled,
  onStatusChange,
}: {
  initialEnabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(!initialEnabled);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"save" | "test" | null>(
    null,
  );
  const [form, setForm] = useState<SettingsForm>({
    ...defaults,
    enabled: initialEnabled,
  });
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  const applyStatus = useCallback((next: SettingsStatus) => {
    setStatus(next);
    setForm((current) => ({
      ...current,
      enabled: next.enabled,
      apiFormat: next.apiFormat,
      authScheme: next.authScheme,
      baseUrl: next.baseUrl,
      apiKey: "",
      chatModel: next.chatModel,
      dataModel: next.dataModel,
    }));
    onStatusChange(next.configured && next.enabled);
    if (!next.configured) setOpen(true);
  }, [onStatusChange]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/ai/settings", { cache: "no-store" });
        const payload = (await response.json()) as {
          settings?: SettingsStatus;
          error?: string;
          setupRequired?: boolean;
        };
        if (!active) return;
        if (!response.ok || !payload.settings) {
          setSetupRequired(Boolean(payload.setupRequired));
          throw new Error(payloadError(payload, "Não foi possível carregar."));
        }
        applyStatus(payload.settings);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Não foi possível carregar.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [applyStatus]);

  function update<K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(action: "save" | "test") {
    setPendingAction(action);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          enabled: form.enabled,
          apiFormat: form.apiFormat,
          authScheme: form.authScheme,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey.trim() || undefined,
          chatModel: form.chatModel,
          dataModel: form.dataModel,
        }),
      });
      const payload = (await response.json()) as {
        saved?: boolean;
        tested?: boolean;
        answer?: string;
        settings?: SettingsStatus;
        error?: string;
        setupRequired?: boolean;
      };
      if (!response.ok) {
        setSetupRequired(Boolean(payload.setupRequired));
        throw new Error(
          payloadError(
            payload,
            action === "test"
              ? "O teste não foi concluído."
              : "A configuração não foi salva.",
          ),
        );
      }
      if (action === "save" && payload.settings) {
        setSetupRequired(false);
        applyStatus(payload.settings);
        setMessage("Configuração salva e protegida no Supabase.");
      } else {
        setSetupRequired(false);
        setMessage("Conexão aprovada pelo modelo " + form.chatModel + ".");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível concluir.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit("save");
  }

  const active = Boolean(status?.configured && status.enabled);
  const sourceLabel =
    status?.source === "dashboard"
      ? "Dashboard"
      : status?.source === "environment"
        ? "Vercel"
        : "Não configurada";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span
            className={
              "grid h-10 w-10 place-items-center rounded-xl " +
              (active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700")
            }
          >
            <Icon name={active ? "check" : "sparkles"} className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-950">
              Configuração da IA
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              {loading
                ? "Verificando..."
                : active
                  ? "Ativa · origem: " + sourceLabel
                  : "Configure sua Base URL e API Key"}
            </span>
          </span>
        </span>
        <Icon
          name="chevron"
          className={
            "shrink-0 text-slate-400 transition " + (open ? "rotate-90" : "")
          }
        />
      </button>

      {open && (
        <form className="border-t border-slate-100 p-4 sm:p-5" onSubmit={handleSave}>
          <div className="rounded-xl bg-violet-50 px-4 py-3 text-xs leading-relaxed text-violet-800">
            A chave é criptografada antes de ser salva e nunca pode ser exibida
            novamente. Os dados financeiros só são enviados ao gateway quando
            você usa o Chat ou o Catálogo.
          </div>

          {setupRequired && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Aplique a migration <code>202608270004_ai_credentials.sql</code> no
              Supabase antes de salvar pelo dashboard.
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Base URL HTTPS</span>
              <input
                type="url"
                required
                value={form.baseUrl}
                onChange={(event) => update("baseUrl", event.target.value)}
                placeholder="https://seu-gateway.exemplo/v1"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">API Key</span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(event) => update("apiKey", event.target.value)}
                autoComplete="new-password"
                placeholder={
                  status?.apiKeyConfigured
                    ? "Chave já protegida — deixe vazio para manter"
                    : "Cole sua chave somente aqui"
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">Formato da API</span>
              <select
                value={form.apiFormat}
                onChange={(event) =>
                  update("apiFormat", event.target.value as ApiFormat)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"
              >
                <option value="openai">OpenAI compatible</option>
                <option value="anthropic">Anthropic nativa</option>
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">Autenticação</span>
              <select
                value={form.authScheme}
                onChange={(event) =>
                  update("authScheme", event.target.value as AuthScheme)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"
              >
                <option value="bearer">Authorization: Bearer</option>
                <option value="x-api-key">x-api-key</option>
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">Modelo do Chat</span>
              <input
                required
                value={form.chatModel}
                onChange={(event) => update("chatModel", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">Modelo de dados</span>
              <input
                required
                value={form.dataModel}
                onChange={(event) => update("dataModel", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => update("enabled", event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">IA ativa</span>
              <span className="block text-xs text-slate-400">
                Desmarque para bloquear Chat e Catálogo sem apagar a chave.
              </span>
            </span>
          </label>

          {message && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void submit("test")}
              disabled={Boolean(pendingAction) || setupRequired}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {pendingAction === "test" ? "Testando..." : "Testar conexão"}
            </button>
            <button
              type="submit"
              disabled={Boolean(pendingAction) || setupRequired}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {pendingAction === "save" ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
