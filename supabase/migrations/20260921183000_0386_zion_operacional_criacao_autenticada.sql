-- Zion Operacional: RPC autenticada para criacao segura de propostas.
-- Corrige a 0385: fluxos normais usam auth.uid(), sem service_role no handler.

drop function if exists public.fn_create_credit_proposal(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text,
  bytea, bytea, bytea, bytea, bytea, bytea,
  bigint, bigint, bigint, integer, numeric, text
);

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
begin
  v_actor := auth.uid();

  if p_org is null
     or v_actor is null
     or p_contact is null
     or nullif(btrim(p_product), '') is null then
    raise exception 'credit_proposal_create_argumento_invalido'
      using errcode = '22023';
  end if;

  -- Defesa em profundidade: a RPC pode ser chamada pelo PostgREST,
  -- portanto a autorizacao precisa existir tambem dentro do banco.
  if not public.fn_role_at_least(p_org, 'agent')
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

  -- O trigger trg_credit_proposal_log_created grava o evento created
  -- automaticamente na mesma transacao.

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
  'Cria proposta do Zion Operacional usando a identidade autenticada, valida agent+ e suporte com escrita e nunca retorna os campos criptografados.';

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

notify pgrst, 'reload schema';
