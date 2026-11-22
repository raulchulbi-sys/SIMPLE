-- Fail-closed fallback. Does NOT restore the historical enumeration oracle.
-- Preserve OID, owner, signature, ACL, data, budgets and all other functions.
-- Review exact preimage and obtain separate authorization before remote use.
begin;
create or replace function public.premium_initial_review(p_operation uuid,p_approve boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin raise exception 'premium_initial_reviewer_required' using errcode='42501';end $$;
commit;
