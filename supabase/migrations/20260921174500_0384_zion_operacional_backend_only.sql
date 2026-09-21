-- Zion Operacional: propostas somente podem ser criadas pelo backend seguro.
-- authenticated continua com SELECT protegido por RLS.

revoke insert on table public.credit_proposals
  from authenticated;

revoke usage on sequence public.credit_proposals_seq_seq
  from anon, authenticated;

drop policy if exists credit_proposals_insert
  on public.credit_proposals;

-- Garante explicitamente os acessos necessarios do backend.
grant insert, select, update, delete
  on table public.credit_proposals
  to service_role;

grant usage, select
  on sequence public.credit_proposals_seq_seq
  to service_role;

notify pgrst, 'reload schema';
