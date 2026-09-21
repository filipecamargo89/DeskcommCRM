-- Zion Operacional
-- Fundacao do modulo de propostas de credito.

create table if not exists public.credit_operations_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operational_role text not null
    check (operational_role in ('operator', 'supervisor')),
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_operations_members_org_user_key
    unique (organization_id, user_id)
);

comment on table public.credit_operations_members is
  'Permissoes especificas do Zion Operacional, independentes dos papeis globais do CRM.';

comment on column public.credit_operations_members.operational_role is
  'operator = digitador; supervisor = supervisao operacional.';

drop trigger if exists trg_credit_operations_members_updated_at
  on public.credit_operations_members;

create trigger trg_credit_operations_members_updated_at
  before update on public.credit_operations_members
  for each row
  execute function public.fn_set_updated_at();

alter table public.credit_operations_members enable row level security;

revoke all on table public.credit_operations_members from anon;


create table if not exists public.credit_proposals (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  contact_id uuid not null
    references public.contacts(id) on delete restrict,

  conversation_id uuid
    references public.conversations(id) on delete set null,

  lead_id uuid
    references public.crm_leads(id) on delete set null,

  seller_user_id uuid
    references auth.users(id) on delete set null,

  submitted_by_user_id uuid
    references auth.users(id) on delete set null,

  assigned_operator_user_id uuid
    references auth.users(id) on delete set null,

  status text not null default 'new'
    check (status in (
      'new',
      'in_digitation',
      'digitated',
      'under_review',
      'pending',
      'approved',
      'paid',
      'rejected',
      'cancelled'
    )),

  product text not null,
  agreement_name text,
  current_bank text,
  destination_bank text,

  contract_ciphertext bytea,
  contract_iv bytea,
  contract_tag bytea,

  registration_ciphertext bytea,
  registration_iv bytea,
  registration_tag bytea,

  outstanding_balance_cents bigint
    check (outstanding_balance_cents is null or outstanding_balance_cents >= 0),

  installment_cents bigint
    check (installment_cents is null or installment_cents >= 0),

  expected_release_cents bigint
    check (expected_release_cents is null or expected_release_cents >= 0),

  approved_release_cents bigint
    check (approved_release_cents is null or approved_release_cents >= 0),

  currency text not null default 'BRL'
    check (currency ~ '^[A-Z]{3}$'),

  term_months integer
    check (term_months is null or term_months > 0),

  interest_rate numeric(9,6)
    check (interest_rate is null or interest_rate >= 0),

  notes text,

  submitted_at timestamptz not null default now(),
  started_at timestamptz,
  digitated_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint credit_proposals_contract_crypto_complete
    check (
      (contract_ciphertext is null and contract_iv is null and contract_tag is null)
      or
      (contract_ciphertext is not null and contract_iv is not null and contract_tag is not null)
    ),

  constraint credit_proposals_registration_crypto_complete
    check (
      (registration_ciphertext is null and registration_iv is null and registration_tag is null)
      or
      (registration_ciphertext is not null and registration_iv is not null and registration_tag is not null)
    ),

  constraint credit_proposals_contract_crypto_sizes
    check (
      contract_iv is null
      or (octet_length(contract_iv) = 12 and octet_length(contract_tag) = 16)
    ),

  constraint credit_proposals_registration_crypto_sizes
    check (
      registration_iv is null
      or (octet_length(registration_iv) = 12 and octet_length(registration_tag) = 16)
    )
);

comment on table public.credit_proposals is
  'Propostas de credito do Zion Operacional vinculadas ao cliente canonico do CRM.';

drop trigger if exists trg_credit_proposals_updated_at
  on public.credit_proposals;

create trigger trg_credit_proposals_updated_at
  before update on public.credit_proposals
  for each row
  execute function public.fn_set_updated_at();

alter table public.credit_proposals enable row level security;

revoke all on table public.credit_proposals from anon;


create table if not exists public.credit_proposal_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  proposal_id uuid not null
    references public.credit_proposals(id) on delete cascade,

  event_type text not null
    check (event_type in (
      'created',
      'assigned',
      'status_changed',
      'document_added',
      'document_removed',
      'document_accessed',
      'note_added',
      'anonymized'
    )),

  from_status text,
  to_status text,

  actor_user_id uuid
    references auth.users(id) on delete set null,

  note text,

  created_at timestamptz not null default now(),

  constraint credit_proposal_events_from_status_check
    check (
      from_status is null or from_status in (
        'new',
        'in_digitation',
        'digitated',
        'under_review',
        'pending',
        'approved',
        'paid',
        'rejected',
        'cancelled'
      )
    ),

  constraint credit_proposal_events_to_status_check
    check (
      to_status is null or to_status in (
        'new',
        'in_digitation',
        'digitated',
        'under_review',
        'pending',
        'approved',
        'paid',
        'rejected',
        'cancelled'
      )
    )
);

create index if not exists idx_credit_proposal_events_proposal
  on public.credit_proposal_events (proposal_id, created_at desc);

create index if not exists idx_credit_proposal_events_org
  on public.credit_proposal_events (organization_id, created_at desc);

alter table public.credit_proposal_events enable row level security;

revoke all on table public.credit_proposal_events from anon;


create table if not exists public.credit_proposal_documents (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  proposal_id uuid not null
    references public.credit_proposals(id) on delete cascade,

  document_type text not null
    check (document_type in (
      'identity',
      'payslip',
      'ded',
      'proof_of_address',
      'other'
    )),

  original_filename text,
  storage_path text,
  mime_type text not null
    check (mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png'
    )),

  size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 20971520),

  uploaded_by_user_id uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  redacted_at timestamptz,

  constraint credit_proposal_documents_storage_path_not_blank
    check (storage_path is null or length(trim(storage_path)) > 0)
);

create unique index if not exists idx_credit_proposal_documents_storage_path
  on public.credit_proposal_documents (storage_path)
  where storage_path is not null;

create index if not exists idx_credit_proposal_documents_proposal
  on public.credit_proposal_documents (proposal_id, created_at desc);

alter table public.credit_proposal_documents enable row level security;

revoke all on table public.credit_proposal_documents from anon;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'credit-proposal-documents',
  'credit-proposal-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Sem policies em storage.objects.
-- Upload, leitura por URL assinada e exclusao serao feitos somente
-- pelo backend autorizado usando service_role.


-- ---------------------------------------------------------------------------
-- Autorizacao do modulo Zion Operacional
-- ---------------------------------------------------------------------------

create or replace function public.fn_is_credit_operator(
  p_org uuid,
  p_min_role text default 'operator'
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with levels(role, lvl) as (
    values ('operator', 1), ('supervisor', 2)
  )
  select coalesce(
    exists (
      select 1
      from public.credit_operations_members m
      join public.user_organizations uo
        on uo.organization_id = m.organization_id
       and uo.user_id = m.user_id
       and uo.revoked_at is null
       and uo.accepted_at is not null
      join levels user_level
        on user_level.role = m.operational_role
      join levels min_level
        on min_level.role = p_min_role
      where m.organization_id = p_org
        and m.user_id = auth.uid()
        and m.revoked_at is null
        and user_level.lvl >= min_level.lvl
    ),
    false
  );
$$;

comment on function public.fn_is_credit_operator(uuid, text) is
  'Verifica permissao ativa no Zion Operacional e exige vinculo ativo e aceito com a organizacao.';

revoke all on function public.fn_is_credit_operator(uuid, text)
  from public, anon;

grant execute on function public.fn_is_credit_operator(uuid, text)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Integridade entre proposta, cliente, conversa e lead
-- ---------------------------------------------------------------------------

create or replace function public.fn_validate_credit_proposal_links()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_contact_org uuid;
  v_conversation_org uuid;
  v_conversation_contact uuid;
  v_lead_org uuid;
  v_lead_contact uuid;
begin
  select organization_id
    into v_contact_org
  from public.contacts
  where id = new.contact_id;

  if v_contact_org is null then
    raise exception 'contact_not_found' using errcode = '23503';
  end if;

  if v_contact_org <> new.organization_id then
    raise exception 'contact_org_mismatch' using errcode = '23514';
  end if;

  if new.conversation_id is not null then
    select organization_id, contact_id
      into v_conversation_org, v_conversation_contact
    from public.conversations
    where id = new.conversation_id;

    if v_conversation_org is null then
      raise exception 'conversation_not_found' using errcode = '23503';
    end if;

    if v_conversation_org <> new.organization_id then
      raise exception 'conversation_org_mismatch' using errcode = '23514';
    end if;

    if v_conversation_contact <> new.contact_id then
      raise exception 'conversation_contact_mismatch' using errcode = '23514';
    end if;
  end if;

  if new.lead_id is not null then
    select organization_id, contact_id
      into v_lead_org, v_lead_contact
    from public.crm_leads
    where id = new.lead_id;

    if v_lead_org is null then
      raise exception 'lead_not_found' using errcode = '23503';
    end if;

    if v_lead_org <> new.organization_id then
      raise exception 'lead_org_mismatch' using errcode = '23514';
    end if;

    if v_lead_contact is not null and v_lead_contact <> new.contact_id then
      raise exception 'lead_contact_mismatch' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_credit_proposal_links
  on public.credit_proposals;

create trigger trg_validate_credit_proposal_links
before insert or update of organization_id, contact_id, conversation_id, lead_id
on public.credit_proposals
for each row
execute function public.fn_validate_credit_proposal_links();


-- ---------------------------------------------------------------------------
-- Visibilidade das propostas do Zion Operacional
-- ---------------------------------------------------------------------------

create or replace function public.fn_can_view_credit_proposal(
  p_org uuid,
  p_seller_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.fn_is_platform_admin() then true

    when public.fn_user_role_in_org(p_org) is null then false

    when public.fn_role_at_least(p_org, 'manager') then true

    when public.fn_is_credit_operator(p_org, 'operator') then true

    when public.fn_user_role_in_org(p_org) = 'agent'
      and p_seller_user_id = auth.uid() then true

    else false
  end;
$$;

comment on function public.fn_can_view_credit_proposal(uuid, uuid) is
  'Visibilidade do Zion Operacional: vendedor ve suas propostas; operador/supervisor ve a fila; manager/admin veem a organizacao.';

revoke all on function public.fn_can_view_credit_proposal(uuid, uuid)
  from public, anon;

grant execute on function public.fn_can_view_credit_proposal(uuid, uuid)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- RLS e privilegios minimos das propostas
-- ---------------------------------------------------------------------------

revoke all on table public.credit_proposals
  from anon, authenticated;

grant select on table public.credit_proposals
  to authenticated, service_role;

drop policy if exists credit_proposals_select
  on public.credit_proposals;

create policy credit_proposals_select
on public.credit_proposals
for select
to authenticated
using (
  public.fn_can_view_credit_proposal(
    organization_id,
    seller_user_id
  )
);


-- ---------------------------------------------------------------------------
-- Criacao segura de propostas pelo usuario autenticado
-- ---------------------------------------------------------------------------

grant insert on table public.credit_proposals
  to authenticated, service_role;

grant usage, select on sequence public.credit_proposals_seq_seq
  to authenticated, service_role;

drop policy if exists credit_proposals_insert
  on public.credit_proposals;

create policy credit_proposals_insert
on public.credit_proposals
for insert
to authenticated
with check (
  public.fn_is_platform_admin()
  or (
    organization_id in (
      select public.fn_user_org_ids()
    )
    and public.fn_role_at_least(organization_id, 'agent')
    and seller_user_id = auth.uid()
    and submitted_by_user_id = auth.uid()
    and assigned_operator_user_id is null
    and status = 'new'
  )
);


-- ---------------------------------------------------------------------------
-- Historico append-only das propostas
-- ---------------------------------------------------------------------------

revoke all on table public.credit_proposal_events
  from anon, authenticated;

grant select on table public.credit_proposal_events
  to authenticated, service_role;

drop policy if exists credit_proposal_events_select
  on public.credit_proposal_events;

create policy credit_proposal_events_select
on public.credit_proposal_events
for select
to authenticated
using (
  exists (
    select 1
    from public.credit_proposals p
    where p.id = credit_proposal_events.proposal_id
      and p.organization_id = credit_proposal_events.organization_id
      and public.fn_can_view_credit_proposal(
        p.organization_id,
        p.seller_user_id
      )
  )
);


-- ---------------------------------------------------------------------------
-- Metadados dos documentos das propostas
-- ---------------------------------------------------------------------------

revoke all on table public.credit_proposal_documents
  from anon, authenticated;

grant select on table public.credit_proposal_documents
  to authenticated, service_role;

drop policy if exists credit_proposal_documents_select
  on public.credit_proposal_documents;

create policy credit_proposal_documents_select
on public.credit_proposal_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.credit_proposals p
    where p.id = credit_proposal_documents.proposal_id
      and p.organization_id = credit_proposal_documents.organization_id
      and public.fn_can_view_credit_proposal(
        p.organization_id,
        p.seller_user_id
      )
  )
);


-- ---------------------------------------------------------------------------
-- Membros autorizados do Zion Operacional
-- ---------------------------------------------------------------------------

revoke all on table public.credit_operations_members
  from anon, authenticated;

grant select on table public.credit_operations_members
  to authenticated, service_role;

drop policy if exists credit_operations_members_select
  on public.credit_operations_members;

create policy credit_operations_members_select
on public.credit_operations_members
for select
to authenticated
using (
  public.fn_is_platform_admin()
  or public.fn_role_at_least(organization_id, 'manager')
  or (
    user_id = auth.uid()
    and revoked_at is null
    and public.fn_is_credit_operator(organization_id, 'operator')
  )
);


-- ---------------------------------------------------------------------------
-- Transicoes permitidas de status do Zion Operacional
-- ---------------------------------------------------------------------------

create or replace function public.fn_credit_proposal_transition_allowed(
  p_from text,
  p_to text
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_from = p_to then true

    when p_from = 'new'
      and p_to in ('in_digitation', 'cancelled') then true

    when p_from = 'in_digitation'
      and p_to in ('digitated', 'pending', 'rejected', 'cancelled') then true

    when p_from = 'digitated'
      and p_to in ('under_review', 'pending', 'rejected', 'cancelled') then true

    when p_from = 'under_review'
      and p_to in ('pending', 'approved', 'rejected', 'cancelled') then true

    when p_from = 'pending'
      and p_to in ('in_digitation', 'digitated', 'under_review', 'rejected', 'cancelled') then true

    when p_from = 'approved'
      and p_to in ('paid', 'pending', 'rejected', 'cancelled') then true

    else false
  end;
$$;

comment on function public.fn_credit_proposal_transition_allowed(text, text) is
  'Valida as transicoes permitidas entre os status das propostas do Zion Operacional. Paid, rejected e cancelled sao estados finais.';

revoke all on function public.fn_credit_proposal_transition_allowed(text, text)
  from public, anon;

grant execute on function public.fn_credit_proposal_transition_allowed(text, text)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Autorizacao de escrita no Zion Operacional
-- ---------------------------------------------------------------------------

create or replace function public.fn_can_manage_credit_proposal(
  p_org uuid,
  p_actor uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_org is not null
    and p_actor is not null
    and (
      exists (
        select 1
        from public.platform_admins pa
        where pa.user_id = p_actor
          and pa.revoked_at is null
      )
      or exists (
        select 1
        from public.user_organizations uo
        where uo.user_id = p_actor
          and uo.organization_id = p_org
          and uo.role in ('manager', 'admin')
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
      or exists (
        select 1
        from public.credit_operations_members m
        join public.user_organizations uo
          on uo.user_id = m.user_id
         and uo.organization_id = m.organization_id
        where m.user_id = p_actor
          and m.organization_id = p_org
          and m.operational_role in ('operator', 'supervisor')
          and m.revoked_at is null
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
    );
$$;

comment on function public.fn_can_manage_credit_proposal(uuid, uuid) is
  'Confere se o ator pode executar mutacoes operacionais em propostas de credito da organizacao.';

revoke execute on function public.fn_can_manage_credit_proposal(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.fn_can_manage_credit_proposal(uuid, uuid)
  to service_role;


-- ---------------------------------------------------------------------------
-- Mudanca atomica de status com auditoria
-- ---------------------------------------------------------------------------

create or replace function public.fn_credit_proposal_change_status(
  p_proposal uuid,
  p_actor uuid,
  p_to_status text,
  p_note text default null
) returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_from_status text;
begin
  if p_proposal is null or p_actor is null or p_to_status is null then
    raise exception 'credit_proposal_status_argumento_nulo'
      using errcode = '22023';
  end if;

  select organization_id, status
    into v_org, v_from_status
    from public.credit_proposals
   where id = p_proposal
   for update;

  if not found then
    raise exception 'credit_proposal_nao_encontrada'
      using errcode = 'P0002';
  end if;

  if not public.fn_can_manage_credit_proposal(v_org, p_actor) then
    raise exception 'credit_proposal_sem_permissao'
      using errcode = '42501';
  end if;

  if p_to_status not in (
    'new',
    'in_digitation',
    'digitated',
    'under_review',
    'pending',
    'approved',
    'paid',
    'rejected',
    'cancelled'
  ) then
    raise exception 'credit_proposal_status_invalido'
      using errcode = '22023';
  end if;

  if not public.fn_credit_proposal_transition_allowed(
    v_from_status,
    p_to_status
  ) then
    raise exception 'credit_proposal_transicao_invalida: % -> %',
      v_from_status, p_to_status
      using errcode = '22023';
  end if;

  if v_from_status = p_to_status then
    return v_from_status;
  end if;

  update public.credit_proposals
     set status = p_to_status,
         started_at = case
           when p_to_status = 'in_digitation'
             then coalesce(started_at, now())
           else started_at
         end,
         digitated_at = case
           when p_to_status = 'digitated'
             then coalesce(digitated_at, now())
           else digitated_at
         end,
         approved_at = case
           when p_to_status = 'approved'
             then coalesce(approved_at, now())
           else approved_at
         end,
         paid_at = case
           when p_to_status = 'paid'
             then coalesce(paid_at, now())
           else paid_at
         end,
         rejected_at = case
           when p_to_status = 'rejected'
             then coalesce(rejected_at, now())
           else rejected_at
         end,
         cancelled_at = case
           when p_to_status = 'cancelled'
             then coalesce(cancelled_at, now())
           else cancelled_at
         end
   where id = p_proposal;

  insert into public.credit_proposal_events (
    organization_id,
    proposal_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    note
  ) values (
    v_org,
    p_proposal,
    'status_changed',
    v_from_status,
    p_to_status,
    p_actor,
    nullif(btrim(p_note), '')
  );

  return p_to_status;
end;
$$;

comment on function public.fn_credit_proposal_change_status(uuid, uuid, text, text) is
  'Altera status da proposta de forma atomica, valida autorizacao e transicao e grava o historico na mesma transacao.';

revoke execute on function public.fn_credit_proposal_change_status(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.fn_credit_proposal_change_status(uuid, uuid, text, text)
  to service_role;


-- ---------------------------------------------------------------------------
-- Historico obrigatorio de criacao da proposta
-- ---------------------------------------------------------------------------

create or replace function public.fn_credit_proposal_log_created()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.credit_proposal_events (
    organization_id,
    proposal_id,
    event_type,
    from_status,
    to_status,
    actor_user_id
  ) values (
    new.organization_id,
    new.id,
    'created',
    null,
    new.status,
    new.submitted_by_user_id
  );

  return new;
end;
$$;

revoke execute on function public.fn_credit_proposal_log_created()
  from public, anon, authenticated;

grant execute on function public.fn_credit_proposal_log_created()
  to service_role;

drop trigger if exists trg_credit_proposal_log_created
  on public.credit_proposals;

create trigger trg_credit_proposal_log_created
  after insert on public.credit_proposals
  for each row
  execute function public.fn_credit_proposal_log_created();


-- ---------------------------------------------------------------------------
-- Atribuicao segura de operador com auditoria
-- ---------------------------------------------------------------------------

create or replace function public.fn_credit_proposal_assign_operator(
  p_proposal uuid,
  p_actor uuid,
  p_operator uuid,
  p_note text default null
) returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_current_operator uuid;
begin
  if p_proposal is null or p_actor is null then
    raise exception 'credit_proposal_assignment_argumento_nulo'
      using errcode = '22023';
  end if;

  select organization_id, assigned_operator_user_id
    into v_org, v_current_operator
    from public.credit_proposals
   where id = p_proposal
   for update;

  if not found then
    raise exception 'credit_proposal_nao_encontrada'
      using errcode = 'P0002';
  end if;

  if not public.fn_can_manage_credit_proposal(v_org, p_actor) then
    raise exception 'credit_proposal_sem_permissao'
      using errcode = '42501';
  end if;

  if p_operator is not null and not exists (
    select 1
      from public.credit_operations_members m
      join public.user_organizations uo
        on uo.user_id = m.user_id
       and uo.organization_id = m.organization_id
     where m.organization_id = v_org
       and m.user_id = p_operator
       and m.operational_role in ('operator', 'supervisor')
       and m.revoked_at is null
       and uo.revoked_at is null
       and uo.accepted_at is not null
  ) then
    raise exception 'credit_proposal_operador_invalido'
      using errcode = '42501';
  end if;

  if v_current_operator is not distinct from p_operator then
    return v_current_operator;
  end if;

  update public.credit_proposals
     set assigned_operator_user_id = p_operator
   where id = p_proposal;

  insert into public.credit_proposal_events (
    organization_id,
    proposal_id,
    event_type,
    actor_user_id,
    note
  ) values (
    v_org,
    p_proposal,
    'assigned',
    p_actor,
    nullif(btrim(p_note), '')
  );

  return p_operator;
end;
$$;

comment on function public.fn_credit_proposal_assign_operator(uuid, uuid, uuid, text) is
  'Atribui, troca ou remove o operador de uma proposta, validando organizacao, permissao e registrando auditoria.';

revoke execute on function public.fn_credit_proposal_assign_operator(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.fn_credit_proposal_assign_operator(uuid, uuid, uuid, text)
  to service_role;


-- ---------------------------------------------------------------------------
-- LGPD: anonimiza dados pessoais do Zion Operacional junto com o contato
-- ---------------------------------------------------------------------------

create or replace function public.fn_redact_credit_proposals_on_contact_anonymized()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Enfileira documentos privados para exclusao assincrona.
  insert into public.storage_redaction_queue (
    organization_id,
    request_id,
    bucket,
    object_path
  )
  select
    d.organization_id,
    null,
    'credit-proposal-documents',
    d.storage_path
  from public.credit_proposal_documents d
  join public.credit_proposals p
    on p.id = d.proposal_id
   and p.organization_id = d.organization_id
  where p.organization_id = new.organization_id
    and p.contact_id = new.id
    and d.storage_path is not null
    and length(d.storage_path) > 0
  on conflict (bucket, object_path) do nothing;

  -- Remove referencias e nomes dos documentos, preservando somente metadados
  -- operacionais necessarios para auditoria.
  update public.credit_proposal_documents d
     set storage_path = null,
         original_filename = null,
         redacted_at = coalesce(d.redacted_at, now())
    from public.credit_proposals p
   where p.id = d.proposal_id
     and p.organization_id = new.organization_id
     and p.contact_id = new.id;

  -- Remove campos livres e identificadores criptografados.
  -- Valores, produto, status e timestamps permanecem para historico operacional.
  update public.credit_proposals
     set contract_ciphertext = null,
         contract_iv = null,
         contract_tag = null,
         registration_ciphertext = null,
         registration_iv = null,
         registration_tag = null,
         notes = null
   where organization_id = new.organization_id
     and contact_id = new.id;

  -- Notas dos eventos tambem podem conter informacao pessoal digitada livremente.
  update public.credit_proposal_events e
     set note = null
    from public.credit_proposals p
   where p.id = e.proposal_id
     and p.organization_id = new.organization_id
     and p.contact_id = new.id;

  -- Mantem um registro tecnico de que o modulo operacional participou
  -- da mesma transacao de anonimização.
  insert into public.credit_proposal_events (
    organization_id,
    proposal_id,
    event_type,
    actor_user_id,
    note
  )
  select
    p.organization_id,
    p.id,
    'anonymized',
    null,
    null
  from public.credit_proposals p
  where p.organization_id = new.organization_id
    and p.contact_id = new.id;

  return new;
end;
$$;

revoke execute on function public.fn_redact_credit_proposals_on_contact_anonymized()
  from public, anon, authenticated;

grant execute on function public.fn_redact_credit_proposals_on_contact_anonymized()
  to service_role;

drop trigger if exists trg_redact_credit_proposals_on_contact_anonymized
  on public.contacts;

create trigger trg_redact_credit_proposals_on_contact_anonymized
after update of is_anonymized on public.contacts
for each row
when (
  new.is_anonymized is true
  and old.is_anonymized is distinct from true
)
execute function public.fn_redact_credit_proposals_on_contact_anonymized();

notify pgrst, 'reload schema';
