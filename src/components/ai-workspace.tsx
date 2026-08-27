"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { formatMoney } from "@/lib/format";
import type { AiChatMessage, CatalogResult } from "@/types/ai";

interface DisplayMessage extends AiChatMessage {
  id: string;
  model?: string;
}

const starterMessages: DisplayMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Olá! Posso analisar seus saldos, transações, contas a pagar e receber. Eu apenas leio os dados: qualquer mudança continua dependendo da sua confirmação.",
  },
];

const suggestions = [
  "Onde estou gastando mais?",
  "Resuma meu mês financeiro.",
  "Quais despesas merecem atenção?",
];

function errorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export function AiWorkspace({
  enabled,
  hideValues,
}: {
  enabled: boolean;
  hideValues: boolean;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [catalog, setCatalog] = useState<CatalogResult | null>(null);
  const [catalogPending, setCatalogPending] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  async function sendMessage(content: string) {
    const clean = content.trim();
    if (!clean || chatPending) return;
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: clean,
    };
    const nextMessages = [...messages, userMessage].slice(-12);
    setMessages(nextMessages);
    setInput("");
    setChatPending(true);
    setChatError("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        model?: string;
        error?: string;
      };
      if (!response.ok || !payload.answer) {
        throw new Error(errorMessage(payload, "A IA não respondeu."));
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer!,
          model: payload.model,
        },
      ]);
    } catch (caught) {
      setChatError(
        caught instanceof Error ? caught.message : "A IA não respondeu.",
      );
    } finally {
      setChatPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(input);
  }

  async function generateCatalog() {
    if (catalogPending) return;
    setCatalogPending(true);
    setCatalogError("");
    try {
      const response = await fetch("/api/ai/catalog", { method: "POST" });
      const payload = (await response.json()) as {
        catalog?: CatalogResult;
        error?: string;
      };
      if (!response.ok || !payload.catalog) {
        throw new Error(errorMessage(payload, "Não foi possível catalogar."));
      }
      setCatalog(payload.catalog);
    } catch (caught) {
      setCatalogError(
        caught instanceof Error ? caught.message : "Não foi possível catalogar.",
      );
    } finally {
      setCatalogPending(false);
    }
  }

  const privacyClass = hideValues ? " select-none blur-sm" : "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">Análise assistida e planilhas</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Chat IA
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
              <Icon name="sparkles" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Catálogo inteligente</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                O Opus organiza estabelecimentos em grupos. Os totais são
                recalculados pelo myScore e nada é gravado automaticamente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={generateCatalog}
            disabled={!enabled || catalogPending}
            className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {catalogPending ? "Catalogando..." : "Catalogar com Opus 5"}
          </button>
          {catalogError && (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">
              {catalogError}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon name="transactions" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Planilha completa</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Baixe todas as transações em CSV compatível com Excel e Google
                Planilhas, mantendo categorias e pessoas.
              </p>
            </div>
          </div>
          <a
            href="/api/export/transactions"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Icon name="arrowDown" className="h-4 w-4" /> Baixar planilha CSV
          </a>
        </section>
      </div>

      {!enabled && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-950">IA aguardando configuração</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Adicione as variáveis abaixo somente na Vercel e faça um novo
            deploy. A Base URL e a API Key nunca chegam ao navegador.
          </p>
          <div className="mt-4 grid gap-2 text-xs font-semibold text-amber-950 sm:grid-cols-2">
            {[
              "AI_PROVIDER=custom",
              "AI_API_FORMAT=openai",
              "AI_AUTH_SCHEME=bearer",
              "AI_BASE_URL",
              "AI_API_KEY",
              "AI_CHAT_MODEL=claude-sonnet-5",
              "AI_DATA_MODEL=claude-opus-5",
            ].map((item) => (
              <code className="rounded-lg bg-white/70 px-3 py-2" key={item}>
                {item}
              </code>
            ))}
          </div>
        </section>
      )}

      {catalog && (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">Catálogo financeiro</h2>
              <p className="mt-1 text-xs text-slate-400">
                {catalog.analyzedTransactions} transações analisadas · {catalog.model}
              </p>
            </div>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">
              Somente leitura
            </span>
          </div>
          <p className={"mt-4 text-sm leading-relaxed text-slate-600" + privacyClass}>
            {catalog.summary}
          </p>
          <div className={"mt-5 overflow-x-auto" + privacyClass}>
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="pb-3 font-medium">Grupo</th>
                  <th className="pb-3 text-right font-medium">Entradas</th>
                  <th className="pb-3 text-right font-medium">Saídas</th>
                  <th className="pb-3 text-right font-medium">Lançamentos</th>
                  <th className="pb-3 pl-5 font-medium">Exemplos</th>
                </tr>
              </thead>
              <tbody>
                {catalog.groups.map((group) => (
                  <tr className="border-b border-slate-50 text-sm last:border-0" key={group.name}>
                    <td className="py-3 font-semibold text-slate-800">{group.name}</td>
                    <td className="py-3 text-right font-semibold text-emerald-600">
                      {formatMoney(group.inflow)}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-900">
                      {formatMoney(group.outflow)}
                    </td>
                    <td className="py-3 text-right text-slate-500">
                      {group.transactionCount}
                    </td>
                    <td className="py-3 pl-5 text-xs text-slate-500">
                      {group.merchants.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {catalog.insights.length > 0 && (
            <ul className={"mt-4 space-y-2 border-t border-slate-100 pt-4" + privacyClass}>
              {catalog.insights.map((insight) => (
                <li className="flex gap-2 text-sm text-slate-600" key={insight}>
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {enabled && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">
                <Icon name="sparkles" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-950">
                  Conversar com Sonnet 5
                </h2>
                <p className="text-xs text-slate-400">
                  Contexto financeiro enviado apenas quando você perguntar
                </p>
              </div>
            </div>
          </div>
          <div className="max-h-[520px] min-h-[360px] space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">
            {messages.map((message) => (
              <div
                className={
                  "flex " + (message.role === "user" ? "justify-end" : "justify-start")
                }
                key={message.id}
              >
                <div
                  className={
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] " +
                    (message.role === "user"
                      ? "rounded-br-md bg-slate-950 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-700")
                  }
                >
                  <p
                    className={
                      "whitespace-pre-wrap " +
                      (message.role === "assistant" && hideValues
                        ? "select-none blur-sm"
                        : "")
                    }
                  >
                    {message.content}
                  </p>
                  {message.model && (
                    <p className="mt-2 text-[10px] opacity-45">{message.model}</p>
                  )}
                </div>
              </div>
            ))}
            {chatPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
                  Analisando seus dados...
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 p-4 sm:p-5">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  onClick={() => void sendMessage(suggestion)}
                  disabled={chatPending}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
                  key={suggestion}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="ai-message">
                Mensagem para a IA
              </label>
              <textarea
                id="ai-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder="Pergunte sobre seus gastos, contas ou planejamento..."
                className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatPending}
                className="self-stretch rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
            {chatError && (
              <p className="mt-3 text-sm font-medium text-rose-600">{chatError}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
