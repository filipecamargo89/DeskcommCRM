import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada do domínio Gestão.
 *
 * Enquanto o painel executivo próprio é construído, administradores e gerentes
 * entram diretamente na gestão de equipe já existente. A rota precisa existir:
 * o formulário de login usa /operacional como destino e antes concluía a
 * autenticação para, em seguida, entregar um 404.
 */
export default async function OperacionalPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  if (user.is_platform_admin && !activeOrg) redirect("/admin");
  if (!activeOrg || ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) redirect("/403");

  redirect("/app/team");
}
