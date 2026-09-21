-- Zion Operacional: somente platform admin com scope full pode executar
-- operacoes de escrita no modulo operacional.

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
        where uo.organization_id = p_org
          and uo.user_id = p_actor
          and uo.role in ('manager', 'admin')
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
          and m.user_id = p_actor
          and m.operational_role in ('operator', 'supervisor')
          and m.revoked_at is null
          and uo.revoked_at is null
          and uo.accepted_at is not null
      )
    );
$$;

comment on function public.fn_can_manage_credit_proposal(uuid, uuid)
is 'Autoriza escrita no Zion Operacional para platform admin full, manager/admin da organizacao ou membro operacional ativo.';

revoke execute on function public.fn_can_manage_credit_proposal(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.fn_can_manage_credit_proposal(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
