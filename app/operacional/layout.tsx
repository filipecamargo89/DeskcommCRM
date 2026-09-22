import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions/auth/signOut";
import { requireRole } from "@/lib/auth/require-role";
import { loadAuthUser } from "@/lib/auth/server";
import { ClipboardText, House, SignOut } from "@/lib/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cssDaMarca, ESCOPO_DA_ORGANIZACAO } from "@/lib/branding/css";
import { marcaDaInstalacao } from "@/lib/branding/instalacao";
import { resolverMarcaDaOrganizacao } from "@/lib/branding/organizacao";
import { env } from "@/lib/env";
import { EstiloDaMarcaDaOrganizacao } from "@/app/app/_components/EstiloDaMarcaDaOrganizacao";

export const metadata: Metadata = { title: "Zion Operacional" };
export const dynamic = "force-dynamic";

export default async function OperationalLayout({ children }: { children: React.ReactNode }) {
  const user = await loadAuthUser();
  if (!user) redirect("/login?next=/operacional");

  const authz = await requireRole("viewer", {
    resource: "credit_proposals",
    allowPlatformAdmin: true,
  });
  if (!authz.ok || user.support) {
    return <AccessDenied />;
  }

  const supabase = await createClient();
  const { data: isOperator, error } = await supabase.rpc("fn_is_credit_operator" as never, {
    p_org: authz.org.orgId,
    p_min_role: "operator",
  } as never);
  const allowed = !error && (
  (user.is_platform_admin && !user.support)
  || authz.org.role === "admin"
  || isOperator === true
);

  if (!allowed) return <AccessDenied />;

  // Reutiliza exatamente a mesma marca da organização aplicada no CRM.
  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();

  const marca = resolverMarcaDaOrganizacao(
    orgRow?.settings ?? null,
    await marcaDaInstalacao(),
    env,
  );

  const cssDaOrganizacao =
    marca.origens.cor === "organizacao"
      ? cssDaMarca(marca.cor, ESCOPO_DA_ORGANIZACAO).css
      : null;

  return (
    <div data-marca-org="" className="contents">
      <EstiloDaMarcaDaOrganizacao css={cssDaOrganizacao} />
      <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/operacional" className="flex min-w-0 items-center gap-3 font-semibold" aria-label="Zion Operacional, início">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground">
              <ClipboardText size={20} aria-hidden />
            </span>
            <span className="truncate text-base">Zion <span className="font-normal text-muted-foreground">Operacional</span></span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground md:inline">{authz.org.name}</span>
            <Link href="/app" className="inline-flex h-9 items-center gap-2 rounded-sm px-2 text-sm text-muted-foreground hover:bg-accent-soft hover:text-foreground" title="Abrir CRM">
              <House size={17} aria-hidden />
              <span className="hidden sm:inline">CRM</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-sm px-2 text-sm text-muted-foreground hover:bg-accent-soft hover:text-foreground" title="Sair">
                <SignOut size={17} aria-hidden />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Acesso ao operacional indisponível</h1>
      <p className="text-sm text-muted-foreground">Seu usuário precisa estar vinculado a esta operação como digitador, supervisor ou gestor. Peça a liberação ao administrador da Zion.</p>
      <Link href="/app" className="text-sm font-medium text-accent underline underline-offset-4">Voltar ao CRM</Link>
    </main>
  );
}
