-- Authorize only while the closed pilot is the intended access model.
-- Retain the policy row as history; this is not permission to enable commercial generation.
begin;
drop function public.reserve_basic_generation(uuid,uuid);
drop function public.get_my_coach_access();
alter function coach_private.commercial_prior_reserve_basic_generation(uuid,uuid) rename to reserve_basic_generation;
alter function coach_private.reserve_basic_generation(uuid,uuid) set schema public;
alter function coach_private.commercial_prior_get_my_coach_access() rename to get_my_coach_access;
alter function coach_private.get_my_coach_access() set schema public;
revoke all on function public.reserve_basic_generation(uuid,uuid),public.get_my_coach_access() from public,anon,service_role;
grant execute on function public.reserve_basic_generation(uuid,uuid),public.get_my_coach_access() to authenticated;
update billing_test.commercial_policy set basic_generation_enabled=false where singleton;
commit;
