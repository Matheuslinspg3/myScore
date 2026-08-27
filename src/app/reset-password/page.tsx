import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Redefinir senha",
};

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f5f6f8] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 font-black text-white">
          m
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.04em] text-slate-950">
          Escolha uma nova senha
        </h1>
        <p className="mt-3 leading-relaxed text-slate-500">
          Sua conta continuará protegida pelo Supabase Auth.
        </p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
