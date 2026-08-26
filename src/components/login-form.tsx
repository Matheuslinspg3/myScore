"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "/auth/callback",
        },
      });
      if (error) throw error;
      setStatus("sent");
      setMessage("Enviamos um link seguro para o seu e-mail.");
    } catch {
      setStatus("error");
      setMessage("Não foi possível enviar o link. Confira o e-mail.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
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
      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        <Icon name={status === "sent" ? "check" : "shield"} />
        {status === "loading"
          ? "Enviando..."
          : status === "sent"
            ? "Link enviado"
            : "Entrar com link seguro"}
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
    </form>
  );
}
