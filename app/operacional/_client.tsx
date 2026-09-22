"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ClipboardText, MagnifyingGlass, Plus } from "@/lib/ui/icons";

type Proposal = {
  id: string;
  proposal_number: string;
  contact_name: string;
  status: string;
  product: string;
  agreement_name: string | null;
  current_bank: string | null;
  destination_bank: string | null;
  outstanding_balance_cents: number | null;
  installment_cents: number | null;
  expected_release_cents: number | null;
  term_months: number | null;
  seller_name: string | null;
  operator_name: string | null;
  submitted_at: string;
};

type Contact = { id: string; display_name: string | null; name: string | null; phone_number: string | null };
type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

const PAGE_SIZE = 25;
const statuses: Record<string, { label: string; className: string }> = {
  new: { label: "Aguardando digitação", className: "bg-amber-50 text-amber-800" },
  in_digitation: { label: "Em digitação", className: "bg-sky-50 text-sky-800" },
  digitated: { label: "Digitada", className: "bg-emerald-50 text-emerald-800" },
  under_review: { label: "Em análise", className: "bg-sky-50 text-sky-800" },
  pending: { label: "Pendência", className: "bg-amber-50 text-amber-800" },
  approved: { label: "Aprovada", className: "bg-emerald-50 text-emerald-800" },
  paid: { label: "Paga", className: "bg-emerald-50 text-emerald-800" },
  rejected: { label: "Reprovada", className: "bg-red-50 text-red-800" },
  cancelled: { label: "Cancelada", className: "bg-neutral-100 text-neutral-700" },
};

function formatMoney(cents: number | null) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function centsFromInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

async function readApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? "Não foi possível concluir a operação.");
  }
  return body.data;
}

export function OperationalWorkspace() {
  const [view, setView] = useState<"queue" | "new">("queue");
  const [rows, setRows] = useState<Proposal[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/v1/credit-proposals?limit=${PAGE_SIZE + 1}&offset=${offset}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => readApi<Proposal[]>(response))
      .then(setRows)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Falha ao carregar propostas.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, refresh]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return rows.slice(0, PAGE_SIZE).filter((row) =>
      (statusFilter === "all" || row.status === statusFilter)
      && (!query || [row.proposal_number, row.contact_name, row.destination_bank, row.product]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(query))),
    );
  }, [rows, search, statusFilter]);

  const hasNext = rows.length > PAGE_SIZE;
  const pending = rows.slice(0, PAGE_SIZE).filter((row) => row.status === "new" || row.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Operação de crédito</p>
          <h1 className="mt-1 text-2xl font-semibold">{view === "queue" ? "Propostas" : "Nova proposta"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === "queue" ? "Acompanhe as solicitações aprovadas pelo cliente e prontas para a equipe." : "Registre a operação escolhida pelo cliente para iniciar a digitação."}
          </p>
        </div>
        {view === "queue" ? (
          <Button onClick={() => setView("new")}><Plus aria-hidden /> Nova proposta</Button>
        ) : (
          <Button variant="outline" onClick={() => setView("queue")}>Voltar à fila</Button>
        )}
      </div>

      {view === "new" ? (
        <NewProposalForm onCreated={() => { setView("queue"); setOffset(0); setRefresh((value) => value + 1); }} />
      ) : (
        <>
          <div className="grid gap-4 border-b border-border pb-5 sm:grid-cols-3">
            <Metric label="Nesta página" value={String(Math.min(rows.length, PAGE_SIZE))} />
            <Metric label="Exigem atenção" value={String(pending)} />
            <Metric label="Página" value={String(Math.floor(offset / PAGE_SIZE) + 1)} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass size={17} className="absolute left-3 top-3 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nesta página" aria-label="Buscar propostas nesta página" className="pl-10" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar status nesta página" className="h-10 rounded-sm border border-border bg-background px-3 text-sm sm:w-60">
              <option value="all">Todos os status</option>
              {Object.entries(statuses).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </div>

          {error && <p role="alert" className="border-l-2 border-red-600 px-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-[130px] px-3 py-3 font-medium">Proposta</th>
                  <th className="w-[190px] px-3 py-3 font-medium">Cliente</th>
                  <th className="w-[150px] px-3 py-3 font-medium">Operação</th>
                  <th className="w-[135px] px-3 py-3 font-medium">Banco destino</th>
                  <th className="w-[120px] px-3 py-3 font-medium">Parcela</th>
                  <th className="w-[190px] px-3 py-3 font-medium">Status</th>
                  <th className="w-[48px] px-3 py-3 font-medium"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">Carregando propostas…</td></tr> : null}
                {!loading && visibleRows.length === 0 ? <tr><td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">Nenhuma proposta encontrada nesta página.</td></tr> : null}
                {!loading && visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-surface">
                    <td className="px-3 py-3 font-mono text-xs">{row.proposal_number}</td>
                    <td className="truncate px-3 py-3 font-medium" title={row.contact_name}>{row.contact_name}</td>
                    <td className="truncate px-3 py-3" title={row.product}>{row.product}</td>
                    <td className="truncate px-3 py-3" title={row.destination_bank ?? ""}>{row.destination_bank ?? "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{formatMoney(row.installment_cents)}</td>
                    <td className="px-3 py-3"><Status status={row.status} /></td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelected(row)} aria-label={`Abrir ${row.proposal_number}`} title="Ver proposta" className="flex h-8 w-8 items-center justify-center rounded-sm hover:bg-accent-soft"><ArrowRight size={17} aria-hidden /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{offset + 1}–{offset + Math.min(rows.length, PAGE_SIZE)} de {hasNext ? "mais de " : ""}{offset + (hasNext ? PAGE_SIZE : rows.length)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={!hasNext || loading} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Próxima</Button>
            </div>
          </div>
        </>
      )}
      {selected && <ProposalDetails proposal={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

function Status({ status }: { status: string }) {
  const entry = statuses[status] ?? { label: status, className: "bg-neutral-100 text-neutral-700" };
  return <span className={`inline-flex rounded-sm px-2 py-1 text-xs font-medium ${entry.className}`}>{entry.label}</span>;
}

function ProposalDetails({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Proposta ${proposal.proposal_number}`} className="h-full w-full max-w-xl overflow-y-auto bg-background p-5 shadow-xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div><p className="font-mono text-xs text-muted-foreground">{proposal.proposal_number}</p><h2 className="mt-1 text-xl font-semibold">{proposal.contact_name}</h2><div className="mt-2"><Status status={proposal.status} /></div></div>
          <button type="button" onClick={onClose} className="h-9 rounded-sm px-2 text-sm text-muted-foreground hover:bg-surface" aria-label="Fechar detalhes">Fechar</button>
        </div>
        <div className="grid gap-x-6 gap-y-5 py-6 sm:grid-cols-2">
          <Detail label="Operação" value={proposal.product} />
          <Detail label="Convênio" value={proposal.agreement_name} />
          <Detail label="Banco atual" value={proposal.current_bank} />
          <Detail label="Banco escolhido" value={proposal.destination_bank} />
          <Detail label="Saldo devedor" value={formatMoney(proposal.outstanding_balance_cents)} />
          <Detail label="Parcela escolhida" value={formatMoney(proposal.installment_cents)} />
          <Detail label="Valor previsto" value={formatMoney(proposal.expected_release_cents)} />
          <Detail label="Prazo" value={proposal.term_months ? `${proposal.term_months} meses` : null} />
          <Detail label="Vendedor" value={proposal.seller_name} />
          <Detail label="Digitador" value={proposal.operator_name} />
        </div>
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Conferência para digitação</h3>
          <p className="mt-2 text-sm text-muted-foreground">Confirme identificação (RG ou CNH), contracheque, comprovante de residência e, quando houver dívida atual, contrato ou DED. O envio de arquivos ainda não está habilitado neste portal.</p>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value || "—"}</p></div>;
}

function NewProposalForm({ onCreated }: { onCreated: () => void }) {
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState("Portabilidade");
  const [agreement, setAgreement] = useState("");
  const [currentBank, setCurrentBank] = useState("");
  const [destinationBank, setDestinationBank] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [installment, setInstallment] = useState("");
  const [release, setRelease] = useState("");
  const [term, setTerm] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (contact || contactQuery.trim().length < 2) { setContacts([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/v1/contacts?search=${encodeURIComponent(contactQuery.trim())}&limit=8`, { signal: controller.signal })
        .then((response) => readApi<Contact[]>(response))
        .then(setContacts)
        .catch(() => { if (!controller.signal.aborted) setContacts([]); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [contactQuery, contact]);

  const submit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!contact) { setError("Selecione um cliente do CRM."); return; }
    const balance = centsFromInput(outstanding);
    const chosenInstallment = centsFromInput(installment);
    const expectedRelease = centsFromInput(release);
    if ([balance, chosenInstallment, expectedRelease].some((value) => Number.isNaN(value))) {
      setError("Revise os valores. Use até duas casas decimais."); return;
    }
    if (!destinationBank.trim() || chosenInstallment === null || chosenInstallment <= 0) {
      setError("Informe o banco e a parcela escolhidos pelo cliente."); return;
    }
    if (product === "Portabilidade" && !currentBank.trim()) {
      setError("Informe o banco do contrato atual para portabilidade."); return;
    }

    setSaving(true);
    try {
      await readApi<Proposal>(await fetch("/api/v1/credit-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contact.id,
          product,
          agreement_name: agreement.trim() || null,
          current_bank: currentBank.trim() || null,
          destination_bank: destinationBank.trim(),
          contract_number: contractNumber.trim() || null,
          registration_number: registrationNumber.trim() || null,
          outstanding_balance_cents: balance,
          installment_cents: chosenInstallment,
          expected_release_cents: expectedRelease,
          term_months: term ? Number(term) : null,
          notes: notes.trim() || null,
        }),
      }));
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar proposta.");
    } finally {
      setSaving(false);
    }
  }, [contact, outstanding, installment, release, destinationBank, product, currentBank, agreement, contractNumber, registrationNumber, term, notes, onCreated]);

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-8 pb-10">
      <section className="space-y-4 border-b border-border pb-7">
        <div className="flex items-center gap-2"><ClipboardText size={18} className="text-accent" aria-hidden /><h2 className="text-base font-semibold">Cliente e operação</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative sm:col-span-2">
            <Label htmlFor="op-contact">Cliente do CRM *</Label>
            {contact ? (
              <div className="mt-2 flex min-h-10 items-center justify-between gap-3 border border-border bg-surface px-3 text-sm">
                <span>{contact.display_name || contact.name || "Cliente"}</span>
                <button type="button" onClick={() => { setContact(null); setContactQuery(""); }} className="text-accent underline underline-offset-4">Trocar</button>
              </div>
            ) : (
              <>
                <Input id="op-contact" className="mt-2" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder="Busque pelo nome ou telefone" autoComplete="off" />
                {contactQuery.trim().length >= 2 && <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto border border-border bg-background shadow-lg">
                  {searching ? <p className="px-3 py-3 text-sm text-muted-foreground">Buscando…</p> : contacts.length === 0 ? <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p> : contacts.map((item) => (
                    <button key={item.id} type="button" onClick={() => { setContact(item); setContacts([]); }} className="block w-full border-b border-border px-3 py-3 text-left text-sm hover:bg-surface">
                      <span className="font-medium">{item.display_name || item.name || "Cliente"}</span>
                      {item.phone_number && <span className="ml-2 text-muted-foreground">{item.phone_number}</span>}
                    </button>
                  ))}
                </div>}
              </>
            )}
          </div>
          <Field label="Tipo de operação *" id="op-product"><select id="op-product" value={product} onChange={(event) => setProduct(event.target.value)} className="h-10 w-full border border-border bg-background px-3 text-sm"><option>Portabilidade</option><option>Refinanciamento</option><option>Crédito novo</option><option>Cartão consignado</option><option>Outro</option></select></Field>
          <Field label="Convênio" id="op-agreement"><Input id="op-agreement" value={agreement} onChange={(event) => setAgreement(event.target.value)} maxLength={160} /></Field>
          <Field label="Banco atual" id="op-current-bank"><Input id="op-current-bank" value={currentBank} onChange={(event) => setCurrentBank(event.target.value)} maxLength={160} /></Field>
          <Field label="Banco escolhido *" id="op-destination-bank"><Input id="op-destination-bank" value={destinationBank} onChange={(event) => setDestinationBank(event.target.value)} maxLength={160} required /></Field>
        </div>
      </section>
      <section className="space-y-4 border-b border-border pb-7">
        <h2 className="text-base font-semibold">Condições escolhidas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Parcela (R$) *" id="op-installment"><Input id="op-installment" value={installment} onChange={(event) => setInstallment(event.target.value)} inputMode="decimal" placeholder="0,00" required /></Field>
          <Field label="Saldo devedor (R$)" id="op-outstanding"><Input id="op-outstanding" value={outstanding} onChange={(event) => setOutstanding(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          <Field label="Valor a liberar (R$)" id="op-release"><Input id="op-release" value={release} onChange={(event) => setRelease(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          <Field label="Prazo (meses)" id="op-term"><Input id="op-term" type="number" min={1} max={1200} value={term} onChange={(event) => setTerm(event.target.value)} /></Field>
        </div>
      </section>
      <section className="space-y-4 border-b border-border pb-7">
        <h2 className="text-base font-semibold">Contrato atual</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número do contrato" id="op-contract"><Input id="op-contract" value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} maxLength={200} autoComplete="off" /></Field>
          <Field label="Matrícula" id="op-registration"><Input id="op-registration" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} maxLength={200} autoComplete="off" /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Esses números são protegidos antes de serem gravados. O DED e os documentos pessoais serão anexados na próxima etapa.</p>
      </section>
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Observações</h2>
        <Label htmlFor="op-notes">Informações para o digitador</Label>
        <Textarea id="op-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} rows={4} placeholder="Registre apenas informações necessárias para esta operação." />
      </section>
      {error && <p role="alert" className="border-l-2 border-red-600 px-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Criar proposta"}</Button>
        <span className="text-xs text-muted-foreground">A proposta será criada como “Aguardando digitação”.</span>
      </div>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
