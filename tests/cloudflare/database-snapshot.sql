-- Read-only current migration baseline; hashes only, no secrets or credentials.
with core as (select 'coach_private.premium_admissions' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from coach_private.premium_admissions t
union all
select 'coach_private.premium_analysis_budget' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from coach_private.premium_analysis_budget t
union all
select 'coach_private.premium_entitlements' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from coach_private.premium_entitlements t
union all
select 'coach_private.premium_financial_events' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from coach_private.premium_financial_events t
union all
select 'coach_private.premium_financial_items' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from coach_private.premium_financial_items t
union all
select 'coach_private.premium_initial_budget' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from coach_private.premium_initial_budget t
union all
select 'public.client_routine_customizations' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.client_routine_customizations t
union all
select 'public.client_routine_statistics_stages' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.client_routine_statistics_stages t
union all
select 'public.coach_conversations' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_conversations t
union all
select 'public.coach_mesocycle_weeks' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_mesocycle_weeks t
union all
select 'public.coach_mesocycles' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_mesocycles t
union all
select 'public.coach_messages' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_messages t
union all
select 'public.coach_operations' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_operations t
union all
select 'public.coach_pilot_feedback' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_pilot_feedback t
union all
select 'public.coach_recommendations' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_recommendations t
union all
select 'public.coach_weekly_checkins' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.coach_weekly_checkins t
union all
select 'public.context_grants' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.context_grants t
union all
select 'public.intake_health' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.intake_health t
union all
select 'public.premium_initial_intakes' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.premium_initial_intakes t
union all
select 'public.premium_initial_operations' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.premium_initial_operations t
union all
select 'public.profiles' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.profiles t
union all
select 'public.routine_assignments' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_assignments t
union all
select 'public.routine_days' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_days t
union all
select 'public.routine_exercises' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_exercises t
union all
select 'public.routine_management' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_management t
union all
select 'public.routine_revisions' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_revisions t
union all
select 'public.routine_share_code_uses' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_share_code_uses t
union all
select 'public.routine_share_codes' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_share_codes t
union all
select 'public.routine_user_notes' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routine_user_notes t
union all
select 'public.routines' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.routines t
union all
select 'public.training_intakes' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.training_intakes t
union all
select 'public.workouts' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public.workouts t
union all select 'auth.users_stable',count(*),md5(coalesce(string_agg(jsonb_build_object('id',id,'email',email,'role',role,'created_at',created_at,'deleted_at',deleted_at,'banned_until',banned_until,'is_anonymous',is_anonymous)::text,'' order by id),'')) from auth.users
union all select 'auth.identities_stable',count(*),md5(coalesce(string_agg(jsonb_build_object('id',id,'user_id',user_id,'provider',provider,'provider_id',provider_id,'created_at',created_at)::text,'' order by id),'')) from auth.identities),
functions as (select n.nspname schema,p.proname,pg_get_function_identity_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) hash,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','coach_private') and p.prokind='f'),
policies as (select * from pg_policies where schemaname in ('public','coach_private')),
security as (select n.nspname schema,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','coach_private') and c.relkind='r'),
triggers as (select n.nspname schema,c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','coach_private') and not t.tgisinternal)
select jsonb_build_object(
'captured_at',clock_timestamp(),
'core',(select jsonb_agg(to_jsonb(t) order by name) from core t),
'functions',(select jsonb_agg(to_jsonb(t) order by schema,proname,args) from functions t),
'policies_hash',md5((select jsonb_agg(to_jsonb(t) order by schemaname,tablename,policyname)::text from policies t)),
'security_hash',md5((select jsonb_agg(to_jsonb(t) order by schema,relname)::text from security t)),
'triggers_hash',md5((select jsonb_agg(to_jsonb(t) order by schema,relname,tgname)::text from triggers t)),
'budget',(select to_jsonb(b) from coach_private.premium_analysis_budget b where id),
'initial_budget',(select to_jsonb(b) from coach_private.premium_initial_budget b where id),
'cycle_hash',md5(pg_get_functiondef('public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure))
) baseline;