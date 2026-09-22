-- Zion Gestao
-- Permissoes operacionais separadas do CRM.
--
-- Master      = admin da organizacao
-- Coordenador = supervisor no Zion Gestao
-- Digitador   = operator no Zion Gestao
--
-- Usuarios comuns do CRM nao recebem acesso ao Zion Gestao
-- apenas por possuirem role agent/manager.

-- ---------------------------------------------------------------------------
-- 1. VISIBILIDADE DAS PROPOSTAS
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
  select
    p_org is not null
    and (
      -- Acesso administrativo emergencial da plataforma.
      exists (
        select 1
        from public.platform_admins pa
        where pa.user_id = auth.uid()
          and pa.revoked_at is null
          and pa.scope = 'full'
      )

      -- Master do Zion Gestao.
      or exists (
        select 1
        from public.user_organizations uo
        where uo.organization_id = p_org
          and uo.user_id = auth.uid()
          and uo.role = 'admin'
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )

      -- Digitador ou Coordenador do Zion Gestao.
      or exists (
        select 1
        from public.credit_operations_members m
        join public.user_organizations uo
          on uo.organization_id = m.organization_id
         and uo.user_id = m.user_id
        where m.organization_id = p_org
          and m.user_id = auth.uid()
          and m.operational_role in ('operator', 'supervisor')
          and m.revoked_at is null
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
    );
$$;

comment on function public.fn_can_view_credit_proposal(uuid, uuid) is
  'Zion Gestao: propostas visiveis apenas para Master, Coordenador, Digitador ou platform admin full.';

revoke all on function public.fn_can_view_credit_proposal(uuid, uuid)
  from public, anon;

grant execute on function public.fn_can_view_credit_proposal(uuid, uuid)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 2. AUTORIZACAO GERAL PARA OPERAR PROPOSTAS
-- ---------------------------------------------------------------------------

create or replace function public.fn_can_manage_credit_proposal(
  p_org uuid,
  p_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_org is not null
    and p_actor is not null
    and (
      -- Platform admin full: acesso administrativo emergencial.
      exists (
        select 1
        from public.platform_admins pa
        where pa.user_id = p_actor
          and pa.revoked_at is null
          and pa.scope = 'full'
      )

      -- Master.
      or exists (
        select 1
        from public.user_organizations uo
        where uo.organization_id = p_org
          and uo.user_id = p_actor
          and uo.role = 'admin'
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )

      -- Coordenador ou Digitador.
      or exists (
        select 1
        from public.credit_operations_members m
        join public.user_organizations uo
          on uo.organization_id = m.organization_id
         and uo.user_id = m.user_id
        where m.organization_id = p_org
          and m.user_id = p_actor
          and m.operational_role in ('operator', 'supervisor')
          and m.revoked_at is null
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
    );
$$;

comment on function public.fn_can_manage_credit_proposal(uuid, uuid) is
  'Zion Gestao: escrita permitida para Master, Coordenador, Digitador ou platform admin full.';

revoke execute on function public.fn_can_manage_credit_proposal(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.fn_can_manage_credit_proposal(uuid, uuid)
  to service_role;


-- ---------------------------------------------------------------------------
-- 3. CRIACAO DE PROPOSTAS
-- ---------------------------------------------------------------------------

create or replace function public.fn_create_credit_proposal(
  p_org uuid,
  p_contact uuid,
  p_conversation uuid,
  p_lead uuid,
  p_product text,
  p_agreement_name text,
  p_current_bank text,
  p_destination_bank text,
  p_contract_ciphertext bytea,
  p_contract_iv bytea,
  p_contract_tag bytea,
  p_registration_ciphertext bytea,
  p_registration_iv bytea,
  p_registration_tag bytea,
  p_outstanding_balance_cents bigint,
  p_installment_cents bigint,
  p_expected_release_cents bigint,
  p_term_months integer,
  p_interest_rate numeric,
  p_notes text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.credit_proposals%rowtype;
  v_actor uuid;
  v_authorized boolean;
begin
  v_actor := auth.uid();

  if p_org is null
     or v_actor is null
     or p_contact is null
     or nullif(btrim(p_product), '') is null then
    raise exception 'credit_proposal_create_argumento_invalido'
      using errcode = '22023';
  end if;

  -- Master ou membro operacional ativo.
  select (
    exists (
      select 1
      from public.user_organizations uo
      where uo.organization_id = p_org
        and uo.user_id = v_actor
        and uo.role = 'admin'
        and uo.revoked_at is null
        and uo.accepted_at is not null
    )
    or exists (
      select 1
      from public.credit_operations_members m
      join public.user_organizations uo
        on uo.organization_id = m.organization_id
       and uo.user_id = m.user_id
      where m.organization_id = p_org
        and m.user_id = v_actor
        and m.operational_role in ('operator', 'supervisor')
        and m.revoked_at is null
        and uo.revoked_at is null
        and uo.accepted_at is not null
    )
    or exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = v_actor
        and pa.revoked_at is null
        and pa.scope = 'full'
    )
  )
  into v_authorized;

  if not coalesce(v_authorized, false)
     or not public.fn_support_write_allowed(p_org) then
    raise exception 'credit_proposal_sem_permissao'
      using errcode = '42501';
  end if;

  insert into public.credit_proposals (
    organization_id,
    contact_id,
    conversation_id,
    lead_id,
    seller_user_id,
    submitted_by_user_id,
    assigned_operator_user_id,
    status,
    product,
    agreement_name,
    current_bank,
    destination_bank,
    contract_ciphertext,
    contract_iv,
    contract_tag,
    registration_ciphertext,
    registration_iv,
    registration_tag,
    outstanding_balance_cents,
    installment_cents,
    expected_release_cents,
    currency,
    term_months,
    interest_rate,
    notes,
    submitted_at
  ) values (
    p_org,
    p_contact,
    p_conversation,
    p_lead,
    v_actor,
    v_actor,
    null,
    'new',
    btrim(p_product),
    nullif(btrim(p_agreement_name), ''),
    nullif(btrim(p_current_bank), ''),
    nullif(btrim(p_destination_bank), ''),
    p_contract_ciphertext,
    p_contract_iv,
    p_contract_tag,
    p_registration_ciphertext,
    p_registration_iv,
    p_registration_tag,
    p_outstanding_balance_cents,
    p_installment_cents,
    p_expected_release_cents,
    'BRL',
    p_term_months,
    p_interest_rate,
    nullif(btrim(p_notes), ''),
    now()
  )
  returning * into v_proposal;

  return jsonb_build_object(
    'id', v_proposal.id,
    'seq', v_proposal.seq,
    'proposal_number', 'ZIO-' || lpad(v_proposal.seq::text, 8, '0'),
    'organization_id', v_proposal.organization_id,
    'contact_id', v_proposal.contact_id,
    'conversation_id', v_proposal.conversation_id,
    'lead_id', v_proposal.lead_id,
    'seller_user_id', v_proposal.seller_user_id,
    'status', v_proposal.status,
    'product', v_proposal.product,
    'agreement_name', v_proposal.agreement_name,
    'current_bank', v_proposal.current_bank,
    'destination_bank', v_proposal.destination_bank,
    'outstanding_balance_cents', v_proposal.outstanding_balance_cents,
    'installment_cents', v_proposal.installment_cents,
    'expected_release_cents', v_proposal.expected_release_cents,
    'currency', v_proposal.currency,
    'term_months', v_proposal.term_months,
    'interest_rate', v_proposal.interest_rate,
    'submitted_at', v_proposal.submitted_at,
    'created_at', v_proposal.created_at
  );
end;
$$;

comment on function public.fn_create_credit_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text,
  bytea, bytea, bytea, bytea, bytea, bytea,
  bigint, bigint, bigint, integer, numeric, text
) is
  'Zion Gestao: cria proposta somente para Master, Coordenador ou Digitador autorizado.';

revoke all on function public.fn_create_credit_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text,
  bytea, bytea, bytea, bytea, bytea, bytea,
  bigint, bigint, bigint, integer, numeric, text
) from public, anon, authenticated;

grant execute on function public.fn_create_credit_proposal(
  uuid, uuid, uuid, uuid, text, text, text, text,
  bytea, bytea, bytea, bytea, bytea, bytea,
  bigint, bigint, bigint, integer, numeric, text
) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4. ALTERACAO DE STATUS COM SEPARACAO DE RESPONSABILIDADES
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
  v_can_approve boolean;
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

  -- Somente Master, Coordenador ou platform admin full
  -- podem aprovar ou marcar uma proposta como paga/liberada.
  if p_to_status in ('approved', 'paid') then
    select (
      exists (
        select 1
        from public.platform_admins pa
        where pa.user_id = p_actor
          and pa.revoked_at is null
          and pa.scope = 'full'
      )
      or exists (
        select 1
        from public.user_organizations uo
        where uo.organization_id = v_org
          and uo.user_id = p_actor
          and uo.role = 'admin'
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
      or exists (
        select 1
        from public.credit_operations_members m
        join public.user_organizations uo
          on uo.organization_id = m.organization_id
         and uo.user_id = m.user_id
        where m.organization_id = v_org
          and m.user_id = p_actor
          and m.operational_role = 'supervisor'
          and m.revoked_at is null
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
    )
    into v_can_approve;

    if not coalesce(v_can_approve, false) then
      raise exception 'credit_proposal_aprovacao_requer_supervisor'
        using errcode = '42501';
    end if;
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
  'Zion Gestao: altera status atomicamente; approved/paid exigem Master ou Coordenador.';

revoke execute on function public.fn_credit_proposal_change_status(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.fn_credit_proposal_change_status(uuid, uuid, text, text)
  to service_role;


notify pgrst, 'reload schema';
