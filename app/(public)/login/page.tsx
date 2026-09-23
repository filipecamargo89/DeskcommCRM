import Link from "next/link";
import Image from "next/image";

import { EntrarComGoogle } from "@/components/auth/EntrarComGoogle";
import { LoginForm } from "@/components/auth/LoginForm";
import { OperationalLoginForm } from "@/components/auth/OperationalLoginForm";
import { branding } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import { traduzir } from "@/lib/i18n/dicionario";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const { next, reset, error } = await searchParams;
  // Fora da árvore de `app/app/layout.tsx` — sem `IdiomaProvider` do lado do
  // servidor (o cliente já tem o seu, montado em `app/(public)/layout.tsx`).
  // Quase nunca há sessão aqui (é a própria tela de entrar), mas resolve do
  // mesmo jeito por segurança — `user` opcional.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = await idiomaDoVisitante(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );
  const t = (texto: string) => traduzir(texto, idioma);

  const isOperationalLogin =
    next === "/operacional" || next?.startsWith("/operacional/");

  if (isOperationalLogin) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-[#080808]">
        <div className="relative h-screen w-screen">
          <Image
            src="/gestao/login-zion.png"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />

          <div className="absolute inset-0 hidden md:block">
            <div
              aria-hidden="true"
              className="absolute left-[50.5%] top-1/2 h-[66%] w-[35%] -translate-y-1/2 bg-[#0c0b09] shadow-[0_0_64px_34px_rgba(12,11,9,0.98)]"
            />

            <div
              className="
                absolute
                left-[52.5%]
                top-1/2
                z-20
                w-[29.3%]
                min-w-[390px]
                max-w-[560px]
                -translate-y-1/2
              "
            >
              <div className="mb-7">
                <div className="mb-5 h-px w-12 bg-[#d6ad4f]" />
                <p className="text-[11px] font-medium uppercase text-[#d6ad4f]">
                  Acesso à gestão
                </p>
                <h1 className="mt-2 text-[34px] font-semibold text-white">
                  Entrar
                </h1>
                <p className="mt-1 text-[15px] text-white/55">
                  Zion Gestão de Contratos
                </p>
              </div>

              <OperationalLoginForm next={next} />

              <div className="mt-6 text-center">
                <Link
                  href="/login/forgot"
                  className="text-[14px] text-white/55 underline decoration-white/25 underline-offset-4 transition hover:text-[#d6ad4f]"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090806] p-6 md:hidden">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center">
                <div className="text-3xl font-semibold text-[#d6ad4f]">
                  ZION
                </div>

                <div className="mt-2 text-[10px] text-white/60">
                  GESTÃO DE CONTRATOS
                </div>
              </div>

              <OperationalLoginForm next={next} />

              <div className="mt-7 text-center">
                <Link
                  href="/login/forgot"
                  className="text-sm text-white/60 underline underline-offset-2"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Entrar")}</h1>
        <p className="text-sm text-muted-foreground">{branding().name}</p>
      </div>
      {reset === "success" && (
        <div
          className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
          role="status"
        >
          {t("Senha redefinida com sucesso. Entre com a nova senha.")}
        </div>
      )}
      {error === "link_invalido" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t("Link inválido ou expirado. Peça um novo em Recuperar senha ou refaça o cadastro.")}
        </div>
      )}
      {/*
        Os dois avisos abaixo chegaram por frentes diferentes e falam de erros
        diferentes — o merge os pôs no mesmo lugar, e ficar com um só apagaria um
        diagnóstico inteiro da tela de login.
      */}
      {error === "convite_invalido" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t(
            "Sua conta foi confirmada, mas o convite não vale mais — ele expirou ou foi emitido para outro e-mail. Peça um novo a quem te convidou. Não criamos uma empresa nova para você, porque não era isso que você estava fazendo.",
          )}
        </div>
      )}
      {error === "cadastro_por_convite" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t(
            "Sua conta foi confirmada, mas esta instalação aceita cadastro apenas por convite — então não criamos uma empresa para você. Peça um convite a quem administra o sistema; o link dele já traz tudo o que falta.",
          )}
        </div>
      )}
      {error === "template_padrao" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t(
            "Este link veio do modelo de e-mail padrão do Supabase, que não fecha o acesso nesta instalação — pedir outro link não resolve. Quem administra o sistema precisa configurar os modelos de e-mail: na nuvem do Supabase, com ",
          )}
          <code>marca-emails.sh</code>
          {t(
            "; num Supabase próprio, apontando GOTRUE_MAILER_TEMPLATES_* para as rotas /email-templates/ do app.",
          )}
        </div>
      )}
      {error === "provisionamento" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t(
            "Sua conta foi confirmada, mas houve um erro ao preparar seu ambiente. Tente entrar novamente em instantes.",
          )}
        </div>
      )}
      {/*
        As duas recusas da entrada com Google, separadas de propósito: uma é
        falha da volta (o `code` não virou sessão), a outra é desistência de
        quem estava do outro lado. A mesma mensagem para as duas mandaria a
        pessoa "tentar de novo" quando ela só fechou a tela — e procurar
        defeito onde não há.
      */}
      {error === "entrada_com_google" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t(
            "Não foi possível concluir a entrada com o Google. Tente novamente — se acontecer de novo, entre com e-mail e senha.",
          )}
        </div>
      )}
      {error === "entrada_com_google_cancelada" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t("A entrada com o Google foi cancelada antes de terminar. Nada mudou na sua conta.")}
        </div>
      )}
      {/* A terceira recusa da entrada com Google: a conta está confirmada, mas o
          acesso dela foi retirado. Não é convite inválido (não havia convite
          nenhum) nem falha do Google — é decisão de quem administra, e a tela
          diz exatamente isso, em vez de mandar a pessoa "tentar de novo". */}
      {error === "acesso_revogado" && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t(
            "O acesso desta conta foi retirado por quem administra o sistema — então não criamos uma empresa nova para você. Se o acesso deveria continuar, peça a quem administra para restaurá-lo; se você está entrando em outra equipe, peça um convite.",
          )}
        </div>
      )}
      <LoginForm next={next} />
      <EntrarComGoogle next={next} />
      <div className="space-y-2 text-center text-sm">
        <p>
          <Link
            href="/login/forgot"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t("Esqueci minha senha")}
          </Link>
        </p>
        <p className="text-muted-foreground">
          {t("Não tem conta?")}{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("Criar conta")}
          </Link>
        </p>
      </div>
    </div>
  );
}
