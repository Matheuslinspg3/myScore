"use client";

import { useMemo, useState } from "react";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { Icon, type IconName } from "@/components/icon";
import { AiWorkspace } from "@/components/ai-workspace";
import { PersonForm } from "@/components/person-form";
import {
  calculateSafeBalance,
  pendingPayables,
  pendingReceivables,
  projectBalance,
  sumAccountBalances,
} from "@/lib/finance/calculations";
import { formatDate, formatMoney } from "@/lib/format";
import type {
  Account,
  DashboardData,
  Transaction,
} from "@/types/finance";

type View =
  | "overview"
  | "transactions"
  | "people"
  | "planning"
  | "ai"
  | "accounts";

const navigation: Array<{
  id: View;
  label: string;
  shortLabel: string;
  icon: IconName;
}> = [
  { id: "overview", label: "Visão geral", shortLabel: "Início", icon: "home" },
  {
    id: "transactions",
    label: "Transações",
    shortLabel: "Extrato",
    icon: "transactions",
  },
  { id: "people", label: "Pessoas", shortLabel: "Pessoas", icon: "people" },
  {
    id: "planning",
    label: "Planejamento",
    shortLabel: "Planejar",
    icon: "calendar",
  },
  { id: "ai", label: "Chat IA", shortLabel: "IA", icon: "sparkles" },
  { id: "accounts", label: "Contas", shortLabel: "Contas", icon: "wallet" },
];

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function AccountLogo({ account }: { account: Account }) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-sm"
      style={{ background: account.color }}
      aria-hidden="true"
    >
      {account.institution.slice(0, 1).toUpperCase()}
    </span>
  );
}

function TransactionRow({
  transaction,
  hideValues,
}: {
  transaction: Transaction;
  hideValues: boolean;
}) {
  const isIncome = transaction.amount >= 0;
  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-slate-100 py-3.5 last:border-0">
      <div
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ backgroundColor: transaction.categoryColor + "1f" }}
      >
        <Icon
          name={isIncome ? "arrowDown" : "arrowUp"}
          style={{ color: transaction.categoryColor }}
          className="h-4 w-4"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {transaction.merchant ?? transaction.description}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span>{formatDate(transaction.date)}</span>
          <span>•</span>
          <span>{transaction.category}</span>
          {transaction.personName && (
            <>
              <span>•</span>
              <span className="text-violet-600">{transaction.personName}</span>
            </>
          )}
        </p>
      </div>
      <div className="text-right">
        <p
          className={
            "text-sm font-bold tabular-nums " +
            (isIncome ? "text-emerald-600" : "text-slate-900")
          }
        >
          {hideValues
            ? "••••••"
            : (isIncome ? "+ " : "− ") +
              formatMoney(Math.abs(transaction.amount))}
        </p>
        {transaction.reimbursable && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
            Reembolsável
          </span>
        )}
      </div>
    </div>
  );
}

function Overview({
  data,
  hideValues,
  setView,
}: {
  data: DashboardData;
  hideValues: boolean;
  setView: (view: View) => void;
}) {
  const bankBalance = sumAccountBalances(data.accounts);
  const committed = pendingPayables(data.payables);
  const toReceive = pendingReceivables(data.receivables);
  const safe = calculateSafeBalance({
    bankBalance,
    committedOutflows: committed,
    reserve: data.reserve,
  });
  const projected = projectBalance(bankBalance, data.timeline).at(-1)?.balance ??
    bankBalance;
  const display = (amount: number) =>
    hideValues ? "R$ ••••••" : formatMoney(amount);
  const totalCategory = data.categories.reduce(
    (sum, category) => sum + category.amount,
    0,
  );
  const gradient = data.categories
    .reduce<{ cursor: number; parts: string[] }>(
      (accumulator, category) => {
        const start = accumulator.cursor;
        const end =
          start +
          (totalCategory ? (category.amount / totalCategory) * 100 : 0);
        return {
          cursor: end,
          parts: [
            ...accumulator.parts,
            category.color +
              " " +
              start.toFixed(1) +
              "% " +
              end.toFixed(1) +
              "%",
          ],
        };
      },
      { cursor: 0, parts: [] },
    )
    .parts.join(", ");

  return (
    <div className="space-y-5">
      {data.demoMode && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-sm text-violet-900">
          <Icon name="sparkles" className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <p>
            <strong>Modo demonstração.</strong> Estes dados são fictícios. A
            interface já funciona; conecte Supabase e Pluggy para usar seus
            dados reais.
          </p>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[1.6rem] bg-slate-950 p-5 text-white shadow-[0_24px_70px_-38px_rgba(15,23,42,.8)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                <Icon name="shield" className="h-4 w-4 text-emerald-400" />
                Saldo Seguro
              </p>
              <p className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                {display(safe.safeBalance)}
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                O que você pode usar depois dos compromissos já previstos.
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Protegido
            </span>
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 sm:gap-5">
            <div>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                No banco
              </p>
              <p className="mt-1 truncate text-sm font-semibold sm:text-base">
                {display(bankBalance)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                Comprometido
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-rose-300 sm:text-base">
                {display(committed)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                A receber
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-emerald-300 sm:text-base">
                {display(toReceive)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Saldo total",
            value: bankBalance,
            icon: "wallet" as IconName,
            tone: "bg-violet-50 text-violet-600",
            note: String(data.accounts.length) + " contas",
          },
          {
            label: "Fatura atual",
            value: data.creditCards.reduce((sum, card) => sum + card.invoice, 0),
            icon: "card" as IconName,
            tone: "bg-rose-50 text-rose-600",
            note: "fecha em breve",
          },
          {
            label: "A receber",
            value: toReceive,
            icon: "people" as IconName,
            tone: "bg-emerald-50 text-emerald-600",
            note: String(data.receivables.length) + " pendências",
          },
          {
            label: "Em 90 dias",
            value: projected,
            icon: "calendar" as IconName,
            tone: "bg-amber-50 text-amber-600",
            note: "saldo projetado",
          },
        ].map((card) => (
          <button
            type="button"
            onClick={() =>
              setView(
                card.label === "A receber"
                  ? "people"
                  : card.label === "Em 90 dias"
                    ? "planning"
                    : "accounts",
              )
            }
            className="rounded-2xl border border-slate-200/70 bg-white p-4 text-left shadow-[0_8px_30px_-24px_rgba(15,23,42,.45)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
            key={card.label}
          >
            <span
              className={"grid h-9 w-9 place-items-center rounded-xl " + card.tone}
            >
              <Icon name={card.icon} className="h-4 w-4" />
            </span>
            <p className="mt-4 text-xs font-medium text-slate-500">
              {card.label}
            </p>
            <p className="mt-1 truncate text-lg font-bold tracking-tight text-slate-950">
              {display(card.value)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">{card.note}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(15,23,42,.35)]">
          <SectionHeader
            title="Fluxo do mês"
            subtitle="Receitas e despesas dos últimos 6 meses"
            action={
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500">
                6 meses
              </span>
            }
          />
          <CashFlowChart data={data.cashFlow} />
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(15,23,42,.35)]">
          <SectionHeader
            title="Gastos por categoria"
            subtitle={"Total " + display(data.monthlyExpense)}
          />
          <div className="flex items-center gap-6">
            <div
              className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
              style={{
                background:
                  "conic-gradient(" +
                  (gradient || "#e2e8f0 0% 100%") +
                  ")",
              }}
            >
              <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-center">
                <span className="text-[10px] text-slate-400">Este mês</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              {data.categories.map((category) => (
                <div className="flex items-center gap-2" key={category.name}>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: category.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {category.name}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-slate-800">
                    {hideValues ? "•••" : formatMoney(category.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(15,23,42,.35)]">
          <SectionHeader
            title="Movimentações recentes"
            subtitle="Seu dinheiro, já organizado"
            action={
              <button
                type="button"
                onClick={() => setView("transactions")}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800"
              >
                Ver todas
              </button>
            }
          />
          <div>
            {data.transactions.slice(0, 5).map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                hideValues={hideValues}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(15,23,42,.35)]">
          <SectionHeader
            title="Próximos eventos"
            subtitle="Entradas e saídas previstas"
            action={
              <button
                type="button"
                onClick={() => setView("planning")}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800"
              >
                Ver projeção
              </button>
            }
          />
          <div className="space-y-1">
            {data.timeline.slice(0, 4).map((event) => (
              <div
                className="flex items-center gap-3 rounded-xl px-1 py-3"
                key={event.id}
              >
                <div className="w-11 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {formatDate(event.date)}
                  </p>
                </div>
                <div
                  className={
                    "h-8 w-0.5 rounded-full " +
                    (event.kind === "income" ? "bg-emerald-400" : "bg-rose-400")
                  }
                />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  {event.description}
                </p>
                <p
                  className={
                    "text-sm font-bold tabular-nums " +
                    (event.kind === "income"
                      ? "text-emerald-600"
                      : "text-slate-800")
                  }
                >
                  {hideValues
                    ? "••••"
                    : (event.kind === "income" ? "+ " : "− ") +
                      formatMoney(event.amount)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TransactionsView({
  data,
  hideValues,
}: {
  data: DashboardData;
  hideValues: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = [
    "Todas",
    ...new Set(data.transactions.map((item) => item.category)),
  ];
  const filtered = useMemo(
    () =>
      data.transactions.filter((transaction) => {
        const matchesQuery =
          !query ||
          [
            transaction.description,
            transaction.merchant,
            transaction.personName,
            transaction.institution,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR"));
        return (
          matchesQuery &&
          (category === "Todas" || transaction.category === category)
        );
      }),
    [category, data.transactions, query],
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">Extrato consolidado</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Transações
        </h1>
      </div>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por descrição, pessoa ou banco"
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
          </label>
          <label className="relative">
            <Icon
              name="filter"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-8 text-sm outline-none sm:w-44"
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader
          title={String(filtered.length) + " movimentações"}
          subtitle="Dados bancários e classificações do myScore"
        />
        {filtered.length ? (
          filtered.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              hideValues={hideValues}
            />
          ))
        ) : (
          <div className="py-16 text-center">
            <Icon name="search" className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Nenhuma movimentação encontrada
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function PeopleView({
  data,
  hideValues,
}: {
  data: DashboardData;
  hideValues: boolean;
}) {
  const display = (value: number) => (hideValues ? "R$ ••••" : formatMoney(value));
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Gastos de terceiros e reembolsos
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Pessoas
          </h1>
        </div>
        <PersonForm disabled={data.demoMode} />
      </div>
      {data.people.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.people.map((person) => {
          const progress = person.totalAssociated
            ? (person.received / person.totalAssociated) * 100
            : 0;
          return (
            <section
              className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
              key={person.id}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 font-bold text-white">
                  {person.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold text-slate-900">
                    {person.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {person.nickname ?? "Pessoa cadastrada"}
                  </p>
                </div>
                <button type="button" aria-label="Mais opções">
                  <Icon name="more" className="text-slate-400" />
                </button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Já recebido</p>
                  <p className="mt-1 text-sm font-bold text-emerald-600">
                    {display(person.received)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pendente</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {display(person.pending)}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                  style={{ width: String(Math.min(100, progress)) + "%" }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {Math.round(progress)}% de {display(person.totalAssociated)}
              </p>
            </section>
          );
          })}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 px-5 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm">
            <Icon name="people" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-bold text-slate-900">
            Nenhuma pessoa cadastrada
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Cadastre alguém para associar compras compartilhadas, empréstimos e
            valores a receber.
          </p>
        </section>
      )}
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <SectionHeader
          title="Contas a receber"
          subtitle="Acompanhe parcelas, vencimentos e pagamentos"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="pb-3 font-medium">Pessoa</th>
                <th className="pb-3 font-medium">Origem</th>
                <th className="pb-3 font-medium">Vencimento</th>
                <th className="pb-3 font-medium">Parcela</th>
                <th className="pb-3 text-right font-medium">Pendente</th>
              </tr>
            </thead>
            <tbody>
              {data.receivables.map((receivable) => (
                <tr
                  className="border-b border-slate-50 text-sm last:border-0"
                  key={receivable.id}
                >
                  <td className="py-4 font-semibold text-slate-800">
                    {receivable.personName}
                  </td>
                  <td className="py-4 text-slate-500">
                    {receivable.description}
                  </td>
                  <td className="py-4 text-slate-500">
                    {formatDate(receivable.dueDate)}
                  </td>
                  <td className="py-4 text-slate-500">
                    {receivable.installmentLabel ?? "Única"}
                  </td>
                  <td className="py-4 text-right font-bold text-slate-900">
                    {display(receivable.total - receivable.received)}
                  </td>
                </tr>
              ))}
              {!data.receivables.length && (
                <tr>
                  <td className="py-8 text-center text-sm text-slate-400" colSpan={5}>
                    Nenhuma conta a receber cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlanningView({
  data,
  hideValues,
}: {
  data: DashboardData;
  hideValues: boolean;
}) {
  const [horizon, setHorizon] = useState(30);
  const initial = sumAccountBalances(data.accounts);
  const through = new Date();
  through.setDate(through.getDate() + horizon);
  const points = projectBalance(
    initial,
    data.timeline,
    through.toISOString().slice(0, 10),
  );
  const projected = points.at(-1)?.balance ?? initial;
  const display = (value: number) => (hideValues ? "R$ ••••" : formatMoney(value));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Linha do tempo do seu dinheiro</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Planejamento
          </h1>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[7, 15, 30, 60, 90].map((days) => (
            <button
              type="button"
              onClick={() => setHorizon(days)}
              className={
                "rounded-lg px-3 py-2 text-xs font-semibold transition " +
                (horizon === days
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50")
              }
              key={days}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-xs text-slate-400">Saldo hoje</p>
          <p className="mt-2 text-2xl font-bold">{display(initial)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-400">Saldo em {horizon} dias</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {display(projected)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-400">Variação prevista</p>
          <p
            className={
              "mt-2 text-2xl font-bold " +
              (projected - initial >= 0 ? "text-emerald-600" : "text-rose-600")
            }
          >
            {display(projected - initial)}
          </p>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <SectionHeader
          title="Linha do tempo"
          subtitle="Recebíveis não confirmados não entram no Saldo Seguro"
        />
        <div className="relative ml-2 border-l border-slate-200 pl-6">
          <div className="relative pb-6">
            <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-950 ring-1 ring-slate-300" />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Hoje
            </p>
            <p className="mt-1 font-bold text-slate-950">{display(initial)}</p>
          </div>
          {points.map((point) => (
            <div className="relative pb-6 last:pb-0" key={point.date + point.description}>
              <span
                className={
                  "absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1 ring-slate-300 " +
                  (point.delta >= 0 ? "bg-emerald-500" : "bg-rose-500")
                }
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {formatDate(point.date)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {point.description}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      "text-sm font-bold " +
                      (point.delta >= 0 ? "text-emerald-600" : "text-rose-600")
                    }
                  >
                    {hideValues
                      ? "••••"
                      : (point.delta >= 0 ? "+ " : "− ") +
                        formatMoney(Math.abs(point.delta))}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {display(point.balance)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AccountsView({
  data,
  hideValues,
}: {
  data: DashboardData;
  hideValues: boolean;
}) {
  const display = (value: number) => (hideValues ? "R$ ••••" : formatMoney(value));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Instituições e cartões</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Minhas contas
          </h1>
        </div>
        <ConnectBankButton enabled={!data.demoMode} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.accounts.map((account) => (
          <section
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
            key={account.id}
          >
            <div className="flex items-center gap-3">
              <AccountLogo account={account} />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-slate-900">
                  {account.institution}
                </h2>
                <p className="text-xs text-slate-400">{account.name}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sincronizada
              </span>
            </div>
            <p className="mt-6 text-xs text-slate-400">Saldo disponível</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {display(account.availableBalance ?? account.balance)}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-400">
                Atualizada {account.lastSync}
              </span>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600"
              >
                <Icon name="sync" className="h-3.5 w-3.5" /> Sincronizar
              </button>
            </div>
          </section>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <SectionHeader
          title="Cartões"
          subtitle="Faturas e limites informados pela instituição"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.creditCards.map((card) => {
            const used = card.limit ? (card.invoice / card.limit) * 100 : 0;
            return (
              <div
                className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white"
                key={card.id}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-400">{card.institution}</p>
                    <p className="mt-1 font-semibold">{card.name}</p>
                  </div>
                  <Icon name="card" className="text-slate-400" />
                </div>
                <p className="mt-8 text-xs text-slate-400">Fatura atual</p>
                <p className="mt-1 text-2xl font-bold">{display(card.invoice)}</p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                    style={{ width: String(Math.min(100, used)) + "%" }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                  <span>{Math.round(used)}% usado</span>
                  <span>{display(card.availableLimit)} livre</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function DashboardApp({ data }: { data: DashboardData }) {
  const [view, setView] = useState<View>("overview");
  const [hideValues, setHideValues] = useState(false);

  return (
    <div className="min-h-dvh bg-[#f5f6f8] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white px-4 py-5 lg:flex">
        <button
          type="button"
          onClick={() => setView("overview")}
          className="flex items-center gap-3 px-2"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
            m
          </span>
          <div className="text-left">
            <p className="text-lg font-black tracking-[-0.05em] text-slate-950">
              myScore
            </p>
            <p className="-mt-0.5 text-[10px] font-semibold uppercase tracking-[.18em] text-violet-500">
              financeiro
            </p>
          </div>
        </button>
        <nav className="mt-10 space-y-1.5">
          {navigation.map((item) => (
            <button
              type="button"
              onClick={() => setView(item.id)}
              className={
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition " +
                (view === item.id
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")
              }
              key={item.id}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-violet-50 p-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-white">
            <Icon name="shield" className="h-4 w-4" />
          </div>
          <p className="mt-3 text-xs font-bold text-violet-950">
            Seus dados são seus
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-violet-700/70">
            Segredos ficam no servidor e cada registro é protegido por RLS.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#f5f6f8]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white lg:hidden">
                m
              </span>
              <div>
                <p className="text-xs text-slate-400">Bom dia,</p>
                <p className="text-sm font-bold text-slate-900">
                  {data.userName} <span aria-hidden="true">👋</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHideValues((value) => !value)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950"
                aria-label={hideValues ? "Mostrar valores" : "Ocultar valores"}
                title={hideValues ? "Mostrar valores" : "Modo privacidade"}
              >
                <Icon name={hideValues ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950"
                aria-label="Notificações"
              >
                <Icon name="bell" className="h-[18px] w-[18px]" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
              </button>
              {!data.demoMode && (
                <form action="/api/auth/sign-out" method="post">
                  <button
                    type="submit"
                    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-rose-600"
                    aria-label="Sair"
                  >
                    <Icon name="logout" className="h-[18px] w-[18px]" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          {view === "overview" && (
            <Overview data={data} hideValues={hideValues} setView={setView} />
          )}
          {view === "transactions" && (
            <TransactionsView data={data} hideValues={hideValues} />
          )}
          {view === "people" && (
            <PeopleView data={data} hideValues={hideValues} />
          )}
          {view === "planning" && (
            <PlanningView data={data} hideValues={hideValues} />
          )}
          <div className={view === "ai" ? "block" : "hidden"}>
            <AiWorkspace
              enabled={Boolean(data.aiEnabled) && !data.demoMode}
              hideValues={hideValues}
            />
          </div>
          {view === "accounts" && (
            <AccountsView data={data} hideValues={hideValues} />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_18px_50px_-15px_rgba(15,23,42,.28)] backdrop-blur-xl lg:hidden">
        {navigation.map((item) => (
          <button
            type="button"
            onClick={() => setView(item.id)}
            className={
              "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition " +
              (view === item.id
                ? "bg-slate-950 text-white"
                : "text-slate-400")
            }
            key={item.id}
          >
            <Icon name={item.icon} className="h-[18px] w-[18px]" />
            {item.shortLabel}
          </button>
        ))}
      </nav>
    </div>
  );
}
