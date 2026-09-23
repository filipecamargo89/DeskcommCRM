import Image from "next/image";
import Link from "next/link";

import { EntrarComGoogle } from "@/components/auth/EntrarComGoogle";
import { OperationalLoginForm } from "@/components/auth/OperationalLoginForm";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const { next, reset, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = await idiomaDoVisitante(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );
  const t = (texto: string) => traduzir(texto, idioma);

  const isOperationalLogin = next === "/operacional" || next?.startsWith("/operacional/");
  const titulo = isOperationalLogin ? "Bem-vindo à Gestão" : "Bem-vindo ao Atendimento Zion";
  const destinoPadrao = isOperationalLogin ? "/operacional" : "/app";
  const aviso =
    reset === "success"
      ? t("Senha redefinida com sucesso. Entre com a nova senha.")
      : error === "link_invalido"
        ? t("Link inválido ou expirado. Peça um novo em Recuperar senha ou refaça o cadastro.")
        : error === "convite_invalido"
          ? t(
              "Sua conta foi confirmada, mas o convite não vale mais. Peça um novo a quem te convidou.",
            )
          : error === "cadastro_por_convite"
            ? t(
                "Esta instalação aceita cadastro apenas por convite. Peça um convite a quem administra o sistema.",
              )
            : error === "template_padrao"
              ? t(
                  "O modelo de e-mail da instalação precisa ser configurado por quem administra o sistema.",
                )
              : error === "provisionamento"
                ? t("Houve um erro ao preparar seu ambiente. Tente entrar novamente em instantes.")
                : error === "entrada_com_google"
                  ? t(
                      "Não foi possível concluir a entrada com o Google. Tente novamente ou entre com e-mail e senha.",
                    )
                  : error === "entrada_com_google_cancelada"
                    ? t(
                        "A entrada com o Google foi cancelada antes de terminar. Nada mudou na sua conta.",
                      )
                    : error === "acesso_revogado"
                      ? t("O acesso desta conta foi retirado por quem administra o sistema.")
                      : null;

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-[#080808] md:overflow-hidden">
      <div className="relative min-h-screen w-screen md:h-screen">
        <Image
          src="/gestao/login-zion.png"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-center md:block"
        />

        <div className="absolute inset-0 hidden md:block">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 left-[50.5%] bg-[#0c0b09] shadow-[-24px_0_64px_34px_rgba(12,11,9,0.98)]"
          />
        </div>

        <div className="relative z-20 flex min-h-screen items-center justify-center px-5 py-8 md:absolute md:inset-y-0 md:left-[52.5%] md:w-[33%] md:max-w-[600px] md:min-w-[460px] md:p-0">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#0c0b09]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-[2px] md:max-w-none md:bg-black/15 md:p-10">
            <div className="mb-7 md:mb-9">
              <p className="text-[12px] font-semibold text-[#dfb64f] uppercase">
                {isOperationalLogin ? "Área restrita" : "Central de atendimento"}
              </p>
              <h1 className="mt-4 text-[28px] leading-tight font-semibold text-white md:mt-5 md:text-[34px]">
                {titulo}
              </h1>
              <p className="mt-3 max-w-[430px] text-[15px] leading-6 text-white/70 md:text-[16px] md:leading-7">
                Entre com suas credenciais para acessar o ambiente{" "}
                {isOperationalLogin ? "operacional" : "de atendimento"}.
              </p>
            </div>

            {aviso ? (
              <div
                className={`mb-5 rounded-md border px-4 py-3 text-sm ${reset === "success" ? "border-[#dfb64f]/35 bg-[#dfb64f]/10 text-[#f0d784]" : "border-red-400/30 bg-red-950/35 text-red-100"}`}
                role={reset === "success" ? "status" : "alert"}
              >
                {aviso}
              </div>
            ) : null}

            <OperationalLoginForm next={next} defaultDestination={destinoPadrao} />
            {!isOperationalLogin ? <EntrarComGoogle next={next} appearance="zion" /> : null}

            <div className="mt-5 space-y-2 text-center text-sm">
              <p>
                <Link
                  href="/login/forgot"
                  className="text-white/55 underline decoration-white/25 underline-offset-4 transition hover:text-[#d6ad4f]"
                >
                  {t("Esqueci minha senha")}
                </Link>
              </p>
              {!isOperationalLogin ? (
                <p className="text-white/50">
                  {t("Não tem conta?")}{" "}
                  <Link
                    href="/signup"
                    className="font-medium text-[#dfb64f] underline underline-offset-4 hover:text-[#ebca71]"
                  >
                    {t("Criar conta")}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
