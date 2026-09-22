-- Zion Gestao
-- Convites com perfil operacional.
--
-- Master       = admin da organizacao
-- Coordenador  = agent + supervisor
-- Digitador    = agent + operator
--
-- Convites normais do CRM continuam com operational_role = null.

alter table public.team_invites
  add column if not exists operational_role text;

alter table public.team_invites
  drop constraint if exists team_invites_operational_role_check;

alter table public.team_invites
  add constraint team_invites_operational_role_check
  check (
    operational_role is null
    or operational_role in ('operator', 'supervisor')
  );

comment on column public.team_invites.operational_role is
'Perfil opcional do Zion Gestao. operator = Digitador; supervisor = Coordenador; null = convite normal do CRM.';


-- Aceite atomico de convite do Zion Gestao.
--
-- A funcao base continua sendo a autoridade para criar/reativar o vinculo
-- user_organizations e preservar as protecoes historicas do convite.
--
-- O perfil operacional so e concedido quando a funcao base informa
-- changed=true. Portanto, um usuario que ja seja membro ativo nao consegue
-- usar um convite antigo para elevar sua permissao operacional.

create or replace function public.fn_accept_team_invite_operational(
  p_user uuid,
  p_org uuid,
  p_role text,
  p_operational_role text,
  p_invited_by uuid,
  p_issued_at timestamptz,
  p_invited_at timestamptz,
  p_interface_settings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_member public.credit_operations_members%rowtype;
begin
  if p_operational_role is null
   or p_operational_role not in ('operator', 'supervisor') then
    raise exception 'invalid_operational_role'
      using errcode = '22023';
  end if;

  -- Coordenador e Digitador sao membros agent do CRM.
  -- Isso evita transformar um convite operacional em admin/manager global.
  if p_role <> 'agent' then
    raise exception 'operational_invite_requires_agent'
      using errcode = '22023';
  end if;

  -- Serializa o aceite do mesmo usuario/organizacao.
  perform pg_advisory_xact_lock(
    hashtextextended(p_user::text || ':' || p_org::text, 0)
  );

  v_result := public.fn_accept_team_invite(
    p_user,
    p_org,
    p_role,
    p_invited_by,
    p_issued_at,
    p_invited_at,
    p_interface_settings
  );

  -- Nao concede/eleva perfil operacional em replay ou quando o usuario
  -- ja era membro ativo antes deste convite.
  if not coalesce((v_result->>'changed')::boolean, false) then
    return v_result || jsonb_build_object(
      'operational_changed', false
    );
  end if;

  insert into public.credit_operations_members (
    organization_id,
    user_id,
    operational_role,
    created_by,
    revoked_at
  )
  values (
    p_org,
    p_user,
    p_operational_role,
    p_invited_by,
    null
  )
  on conflict (organization_id, user_id)
  do update set
    operational_role = excluded.operational_role,
    created_by = excluded.created_by,
    revoked_at = null,
    updated_at = now()
  returning * into v_member;

  return v_result || jsonb_build_object(
    'operational_changed', true,
    'operational_role', v_member.operational_role
  );
end;
$$;

comment on function public.fn_accept_team_invite_operational(
  uuid,
  uuid,
  text,
  text,
  uuid,
  timestamptz,
  timestamptz,
  jsonb
) is
'Aceita convite do Zion Gestao atomicamente. Cria o vinculo agent e concede operator (Digitador) ou supervisor (Coordenador). Nao eleva permissao em replay ou para membro que ja estava ativo.';

revoke all on function public.fn_accept_team_invite_operational(
  uuid,
  uuid,
  text,
  text,
  uuid,
  timestamptz,
  timestamptz,
  jsonb
) from public, anon, authenticated;

grant execute on function public.fn_accept_team_invite_operational(
  uuid,
  uuid,
  text,
  text,
  uuid,
  timestamptz,
  timestamptz,
  jsonb
) to service_role;


-- Mantem a tabela operacional fechada para escrita pelo navegador.
-- Toda concessao de perfil passa pela funcao protegida acima ou por
-- rotinas administrativas de backend.

revoke all on table public.credit_operations_members
from anon, authenticated;

grant select on table public.credit_operations_members
to authenticated, service_role;

grant all on table public.credit_operations_members
to service_role;

notify pgrst, 'reload schema';
