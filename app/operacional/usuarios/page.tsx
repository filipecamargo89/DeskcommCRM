import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { UsersWorkspace } from "./_client";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const authz = await requireRole("admin", {
    resource: "team",
    allowPlatformAdmin: true,
  });

  if (!authz.ok) {
    redirect("/operacional");
  }

  return <UsersWorkspace />;
}
