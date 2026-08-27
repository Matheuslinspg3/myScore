"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  function changeMode(nextMode: "signin" | "signup" | "reset") {
    setMode(nextMode);
    setStatus("idle");
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (mode === "reset") {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth/callback?next=/reset-password",
        });
        if (error) throw error;
        setStatus("success");
        setMessage("Enviamos o link para redefinir sua senha.");
      } catch {
        setStatus("error");
        setMessage("Não foi possível enviar o link de recuperação.");
      }
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setStatus("error");
      setMessage("As senhas não conferem.");
      return;
    }

    try {
      const supabase = createClient();
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { name },
                emailRedirectTo: window.location.origin + "/auth/callback",
              },
            })
          : await supabase.auth.signInWithPassword({ email, password });

      const { data, error } = result;
      if (error) throw error;

      if (mode === "signup") {
        if (data.session) {
          router.push("/");
          return;
        }

        setStatus("success");
        setMessage(
          "Conta criada. Confirme seu e-mail pelo link enviado antes de entrar.",
        );
      } else {
        router.push("/");
      }
    } catch (error) {
      setStatus("error");
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";
      setMessage(
        errorMessage.includes("email not confirmed")
          ? "Confirme seu e-mail antes de entrar."
          : mode === "signup"
          ? "Não foi possível criar a conta. Verifique os dados e tente novamente."
          : "E-mail ou senha incorretos.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {mode !== "reset" && (
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => changeMode("signin")}
          className={
            "rounded-lg px-3 py-2.5 transition " +
            (mode === "signin"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500")
          }
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => changeMode("signup")}
          className={
            "rounded-lg px-3 py-2.5 transition " +
            (mode === "signup"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500")
          }
        >
          Criar conta
        </button>
        </div>
      )}

      {mode === "reset" && (
        <div>
          <button
            type="button"
            onClick={() => changeMode("signin")}
            className="text-sm font-semibold text-violet-600 hover:text-violet-800"
          >
            ← Voltar para entrar
          </button>
          <h2 className="mt-5 text-xl font-bold text-slate-950">
            Redefinir senha
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Enviaremos um link seguro para você escolher uma nova senha.
          </p>
        </div>
      )}

      {mode === "signup" && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Seu nome
          </span>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Como você quer ser chamado"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
        </label>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Seu e-mail
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
      </label>

      {mode !== "reset" && (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Senha
        </span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo de 8 caracteres"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
      </label>
      )}

      {mode === "signup" && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Confirme sua senha
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Digite a senha novamente"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
        </label>
      )}

      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        <Icon name={status === "success" ? "check" : "shield"} />
        {status === "loading"
          ? mode === "signup"
            ? "Criando conta..."
            : mode === "reset"
              ? "Enviando..."
            : "Entrando..."
          : status === "success"
            ? "E-mail enviado"
            : mode === "signup"
              ? "Criar conta"
              : mode === "reset"
                ? "Enviar link"
              : "Entrar"}
      </button>
      {message && (
        <p
          className={
            "rounded-xl px-4 py-3 text-sm " +
            (status === "error"
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-700")
          }
          role="status"
        >
          {message}
        </p>
      )}

      {mode === "signin" && (
        <button
          type="button"
          onClick={() => changeMode("reset")}
          className="block w-full text-center text-xs font-semibold text-violet-600 hover:text-violet-800"
        >
          Esqueci minha senha
        </button>
      )}
      {mode === "signup" && (
        <p className="text-center text-xs leading-relaxed text-slate-400">
          Você precisará confirmar o e-mail antes do primeiro acesso.
        </p>
      )}
    </form>
  );
}
