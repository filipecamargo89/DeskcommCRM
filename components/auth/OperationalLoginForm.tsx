"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signInWithPassword } from "@/app/actions/auth/signInWithPassword";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import { EnvelopeSimple, Eye, Lock } from "@/lib/ui/icons";

export function OperationalLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginInput) => {
    setServerError(null);

    startTransition(async () => {
      const res = await signInWithPassword(values, next);

      if (!res) {
        router.replace(next || "/operacional");
        return;
      }

      if (res.error === "mfa_required") {
        const params = new URLSearchParams();
        if (next) params.set("next", next);
        if (res.challengeId) params.set("factor", res.challengeId);
        router.replace(`/login/mfa${params.toString() ? `?${params}` : ""}`);
        return;
      }

      if (res.error === "invalid_credentials") {
        setServerError("E-mail ou senha incorretos.");
      } else if (res.error === "rate_limited") {
        setServerError("Muitas tentativas. Aguarde alguns minutos.");
      } else if (res.error === "validation_error") {
        setServerError("Dados inválidos. Confira os campos.");
      } else {
        setServerError("Erro inesperado. Tente novamente.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-2">
        <label
          htmlFor="operational-email"
          className="block text-[15px] font-medium text-white/90"
        >
          E-mail
        </label>

        <div className="relative">
          <EnvelopeSimple
            size={23}
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/60"
          />
          <input
            id="operational-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="seu@email.com"
            aria-invalid={errors.email ? true : undefined}
            className="h-16 w-full rounded-md border border-white/20 bg-black/30 pl-14 pr-5 text-[16px] text-white outline-none transition placeholder:text-white/35 hover:border-[#d6ad4f]/45 focus:border-[#d6ad4f] focus:bg-black/45 focus:ring-1 focus:ring-[#d6ad4f]/30"
            {...register("email")}
          />
        </div>

        {errors.email ? (
          <p className="text-xs text-[#ffb4ab]">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="operational-password"
          className="block text-[15px] font-medium text-white/90"
        >
          Senha
        </label>

        <div className="relative">
          <Lock
            size={23}
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/60"
          />
          <input
            id="operational-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            aria-invalid={errors.password ? true : undefined}
            className="h-16 w-full rounded-md border border-white/20 bg-black/30 pl-14 pr-14 text-[16px] text-white outline-none transition placeholder:text-white/35 hover:border-[#d6ad4f]/45 focus:border-[#d6ad4f] focus:bg-black/45 focus:ring-1 focus:ring-[#d6ad4f]/30"
            {...register("password")}
          />

          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/55 transition hover:text-white"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            <Eye size={19} aria-hidden />
          </button>
        </div>

        {errors.password ? (
          <p className="text-xs text-[#ffb4ab]">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <div
          className="rounded-md border border-red-400/30 bg-red-950/35 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {serverError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-16 w-full rounded-md bg-[#dfb64f] text-[16px] font-semibold text-[#0b0a08] shadow-[0_12px_36px_rgba(214,173,79,0.16)] transition hover:bg-[#ebca71] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0d784] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0b09] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
