-- Narrow fail-closed fallback for the Basic enumeration fix. Does not restore
-- either vulnerable writer, global access, assignments, or generation rights.
-- Keep reviewer admissions closed; preflight identities/ACL before applying.
begin;
create or replace function public.review_coach_proposal(p_operation uuid,p_approve boolean,p_reason text)
returns public.coach_operations language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'coach_review_scope_required' using errcode='42501';end $$;
create or replace function public.authorize_coach_retry(p_operation uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'coach_review_scope_required' using errcode='42501';end $$;
commit;
