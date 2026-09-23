"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MagnifyingGlass, Plus, UsersThree } from "@/lib/ui/icons";

type Member = {
  user_id: string;
  role: string;
  email: string | null;
  full_name: string | null;
  last_sign_in_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  operational_role: "operator" | "supervisor" | null;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: { message?: string };
};

async function readApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? "Não foi possível concluir a operação.");
  }

  return body.data;
}

function profileOf(member: Member) {
  if (member.role === "admin") {
    return {
      label: "Master",
      className: "bg-amber-50 text-amber-800",
    };
  }

  if (member.operational_role === "supervisor") {
    return {
      label: "Coordenador",
      className: "bg-sky-50 text-sky-800",
    };
  }

  if (member.operational_role === "operator") {
    return {
      label: "Digitador",
      className: "bg-emerald-50 text-emerald-800",
    };
  }

  return {
    label: "Sem acesso à Gestão",
    className: "bg-neutral-100 text-neutral-700",
  };
}

function formatLastAccess(value: string | null) {
  if (!value) return "Nunca acessou";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function UsersWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteProfile, setInviteProfile] = useState<"supervisor" | "operator" | "">("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    fetch("/api/v1/team", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => readApi<Member[]>(response))
      .then(setMembers)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Falha ao carregar usuários.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function handleInvite() {
    const email = inviteEmail.trim();

    setInviteError("");

    if (!email) {
      setInviteError("Informe o e-mail do usuário.");
      return;
    }

    if (!inviteProfile) {
      setInviteError("Selecione o perfil do usuário.");
      return;
    }

    setInviteSubmitting(true);

    try {
      const result = await readApi<{
        sent: Array<{
          email: string;
          invite_id: string;
          expires_at: string;
          email_dispatched: boolean;
          accept_url: string;
        }>;
        failed: Array<{
          email: string;
          reason: string;
        }>;
      }>(
        await fetch("/api/v1/team/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invitations: [
              {
                email,
                role: "agent",
                operational_role: inviteProfile,
              },
            ],
          }),
        }),
      );

      if (result.failed[0]) {
        if (result.failed[0].reason === "already_member") {
          setInviteError("Este e-mail já pertence a um usuário da equipe.");
          return;
        }

        setInviteError("Não foi possível enviar o convite.");
        return;
      }

      if (result.sent.length === 0) {
        setInviteError("O convite não pôde ser criado.");
        return;
      }

      setInviteEmail("");
      setInviteProfile("");
      setInviteOpen(false);
    } catch (cause: unknown) {
      setInviteError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar o convite.",
      );
    } finally {
      setInviteSubmitting(false);
    }
  }

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    return members.filter((member) => {
      if (!query) return true;

      const profile = profileOf(member).label;

      return [member.full_name, member.email, profile]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(query));
    });
  }, [members, search]);

  const activeMembers = members.filter((member) => !member.revoked_at);
  const managementMembers = activeMembers.filter(
    (member) => member.role === "admin" || member.operational_role,
  );
  const coordinators = activeMembers.filter(
    (member) => member.operational_role === "supervisor",
  ).length;
  const operators = activeMembers.filter(
    (member) => member.operational_role === "operator",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Administração</p>
          <h1 className="mt-1 text-2xl font-semibold">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie quem pode acessar a Zion Gestão de Contratos e o perfil de cada usuário.
          </p>
        </div>

        <Button type="button" onClick={() => setInviteOpen(true)}>
          <Plus aria-hidden />
          Novo usuário
        </Button>
      </div>

      <div className="grid gap-4 border-b border-border pb-5 sm:grid-cols-3">
        <Metric label="Usuários da Gestão" value={String(managementMembers.length)} />
        <Metric label="Coordenadores" value={String(coordinators)} />
        <Metric label="Digitadores" value={String(operators)} />
      </div>

      <div className="relative">
        <MagnifyingGlass
          size={17}
          className="absolute left-3 top-3 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail ou perfil"
          aria-label="Buscar usuários"
          className="pl-10"
        />
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-red-600 px-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[820px] table-fixed text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-[250px] px-3 py-3 font-medium">Usuário</th>
              <th className="w-[240px] px-3 py-3 font-medium">E-mail</th>
              <th className="w-[160px] px-3 py-3 font-medium">Perfil</th>
              <th className="w-[120px] px-3 py-3 font-medium">Status</th>
              <th className="w-[180px] px-3 py-3 font-medium">Último acesso</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-muted-foreground">
                  Carregando usuários…
                </td>
              </tr>
            )}

            {!loading && visibleMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}

            {!loading &&
              visibleMembers.map((member) => {
                const profile = profileOf(member);
                const revoked = Boolean(member.revoked_at);

                return (
                  <tr key={member.user_id} className="border-t border-border hover:bg-surface">
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                          <UsersThree size={17} aria-hidden />
                        </span>
                        <span className="truncate font-medium">
                          {member.full_name || "Usuário"}
                        </span>
                      </div>
                    </td>

                    <td className="truncate px-3 py-3" title={member.email ?? ""}>
                      {member.email ?? "—"}
                    </td>

                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-sm px-2 py-1 text-xs font-medium ${profile.className}`}>
                        {profile.label}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span className={revoked ? "text-red-700" : "text-emerald-700"}>
                        {revoked ? "Inativo" : "Ativo"}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-muted-foreground">
                      {formatLastAccess(member.last_sign_in_at)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Convide um usuário para acessar a Zion Gestão de Contratos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@empresa.com"
                autoComplete="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={inviteSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-profile">Perfil</Label>
              <Select
                value={inviteProfile}
                onValueChange={(value) =>
                  setInviteProfile(value as "supervisor" | "operator")
                }
                disabled={inviteSubmitting}
              >
                <SelectTrigger id="invite-profile">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervisor">Coordenador</SelectItem>
                  <SelectItem value="operator">Digitador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {inviteError ? (
            <p className="text-sm text-red-700" role="alert">
              {inviteError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviteSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleInvite}
              disabled={inviteSubmitting}
            >
              {inviteSubmitting ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
