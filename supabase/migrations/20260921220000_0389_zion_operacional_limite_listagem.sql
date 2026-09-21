-- 0389: limita a listagem mesmo quando o RPC recebe NULL explicitamente.
-- A funcao continua sem expor ciphertext, IV, tag ou notes.

alter table public.credit_proposals
  drop constraint if exists credit_proposals_interest_rate_limit_chk;

alter table public.credit_proposals
  add constraint credit_proposals_interest_rate_limit_chk
  check (interest_rate is null or interest_rate <= 999.999999);

create or replace function public.fn_list_credit_proposals(
  p_org uuid,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  id uuid,
  proposal_number text,
  contact_id uuid,
  contact_name text,
  conversation_id uuid,
  lead_id uuid,
  seller_user_id uuid,
  seller_name text,
  assigned_operator_user_id uuid,
  operator_name text,
  status text,
  product text,
  agreement_name text,
  current_bank text,
  destination_bank text,
  outstanding_balance_cents bigint,
  installment_cents bigint,
  expected_release_cents bigint,
  approved_release_cents bigint,
  currency text,
  term_months integer,
  interest_rate numeric,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_org is null then
    raise exception 'organization_required' using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if public.fn_user_role_in_org(p_org) is null
     and not public.fn_is_platform_admin() then
    raise exception 'caller_not_authorized_for_org' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception 'invalid_offset' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    'ZIO-' || lpad(p.seq::text, 8, '0') as proposal_number,
    p.contact_id,
    coalesce(c.display_name, c.name, 'Cliente') as contact_name,
    p.conversation_id,
    p.lead_id,
    p.seller_user_id,
    seller.raw_user_meta_data ->> 'full_name' as seller_name,
    p.assigned_operator_user_id,
    operator_user.raw_user_meta_data ->> 'full_name' as operator_name,
    p.status,
    p.product,
    p.agreement_name,
    p.current_bank,
    p.destination_bank,
    p.outstanding_balance_cents,
    p.installment_cents,
    p.expected_release_cents,
    p.approved_release_cents,
    p.currency,
    p.term_months,
    p.interest_rate,
    p.submitted_at,
    p.created_at,
    p.updated_at
  from public.credit_proposals p
  join public.contacts c
    on c.id = p.contact_id
   and c.organization_id = p.organization_id
  left join auth.users seller
    on seller.id = p.seller_user_id
  left join auth.users operator_user
    on operator_user.id = p.assigned_operator_user_id
  where p.organization_id = p_org
    and public.fn_can_view_credit_proposal(
      p.organization_id,
      p.seller_user_id
    )
  order by p.created_at desc, p.seq desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fn_list_credit_proposals(uuid, integer, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.fn_list_credit_proposals(uuid, integer, integer)
  to authenticated;

revoke select on table public.credit_proposals from authenticated;

notify pgrst, 'reload schema';
