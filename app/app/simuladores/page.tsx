import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth/server";

import { SimuladoresClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simuladores" };

export default async function SimuladoresPage() {
  await requireAuth();
  return <SimuladoresClient />;
}
