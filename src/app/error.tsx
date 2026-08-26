"use client";

import { Icon } from "@/components/icon";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f5f6f8] px-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <Icon name="sync" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-slate-950">
          Não conseguimos carregar seus dados
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Nenhuma alteração foi feita. Tente novamente; se persistir, confira
          as variáveis e a conexão com o Supabase.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
