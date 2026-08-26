"use client";

import { formatCompactMoney } from "@/lib/format";
import type { CashFlowPoint } from "@/types/finance";

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  const max = Math.max(
    1,
    ...data.flatMap((point) => [point.income, point.expense]),
  );

  return (
    <div>
      <div className="mb-6 flex items-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-violet-600" /> Receitas
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-slate-300" /> Despesas
        </span>
      </div>
      <div className="flex h-44 items-end gap-3 sm:gap-5">
        {data.map((point) => (
          <div
            className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            key={point.label}
          >
            <div className="relative flex h-36 w-full items-end justify-center gap-1">
              <div
                className="relative w-2/5 rounded-t-md bg-violet-600 transition-all group-hover:bg-violet-500"
                style={{ height: String((point.income / max) * 100) + "%" }}
                title={"Receitas: " + formatCompactMoney(point.income)}
              />
              <div
                className="w-2/5 rounded-t-md bg-slate-200 transition-all group-hover:bg-slate-300"
                style={{ height: String((point.expense / max) * 100) + "%" }}
                title={"Despesas: " + formatCompactMoney(point.expense)}
              />
            </div>
            <span className="text-xs font-medium capitalize text-slate-400">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
