import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icon";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode, isSupabaseConfigured } from "@/lib/env";

export const metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  if (isSupabaseConfigured() && !isDemoMode()) {
    const user = await getCurrentUser();
    if (user) redirect("/");
  }

  return (
    <main className="grid min-h-dvh bg-[#f5f6f8] lg:grid-cols-2">
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 font-black text-white">
              m
            </span>
            <span className="text-xl font-black tracking-[-0.05em] text-slate-950">
              myScore
            </span>
          </Link>
          <div className="mt-12">
            <p className="text-sm font-semibold text-violet-600">
              Acesso pessoal
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Bem-vindo de volta.
            </h1>
            <p className="mt-3 max-w-sm leading-relaxed text-slate-500">
              Crie sua conta com e-mail e senha e confirme seu endereço antes
              do primeiro acesso. Nenhuma senha bancária é armazenada pelo
              myScore.
            </p>
          </div>
          {isSupabaseConfigured() ? (
            <LoginForm />
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Configure as variáveis do Supabase para ativar o login.
              <Link
                href="/"
                className="mt-3 block font-bold text-amber-950 underline underline-offset-4"
              >
                Abrir demonstração
              </Link>
            </div>
          )}
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
            <Icon name="shield" className="h-4 w-4 text-emerald-500" />
            Sessão protegida pelo Supabase Auth e RLS.
          </div>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-slate-950 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
            <Icon name="sparkles" className="h-4 w-4 text-violet-300" />
            Controle financeiro sem ruído
          </span>
        </div>
        <div className="relative max-w-lg">
          <blockquote className="text-3xl font-semibold leading-tight tracking-[-0.04em]">
            Saiba quanto você tem, quanto pode gastar e quanto terá no futuro.
          </blockquote>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {["Saldo Seguro", "A receber", "Projeções"].map((item) => (
              <div
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
                key={item}
              >
                <Icon name="check" className="mb-3 h-4 w-4 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
