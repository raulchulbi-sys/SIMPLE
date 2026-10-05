-- STAGING ONLY. Restore Phase 4 exact prior functions without deleting live data.
-- Private owner/global usage columns survive disabled; consumption is never reset.
begin;
do $guard$
begin
 if exists(select 1 from coach_private.premium_admissions) or exists(select 1 from public.context_grants where scope='premium_admission' or notice_version='premium-followup-v1') or exists(select 1 from public.routine_management where plan_kind='premium' and operation_id is not null) then
  raise exception 'premium_upgrade_rollback_live_admission';
 end if;
 if exists(select 1 from public.coach_recommendations where analysis_bundle ? 'admission_guard') or exists(select 1 from public.coach_messages where context_bundle ? 'admission_guard') then raise exception 'premium_upgrade_rollback_captured_operations';end if;
 if exists(select 1 from coach_private.premium_analysis_budget where id and (reserved_usd<>0 or chat_reserved_usd<>0)) then raise exception 'premium_upgrade_rollback_reserved_cost';end if;
end $guard$;
update coach_private.premium_entitlements set enabled=false;
update coach_private.premium_analysis_budget set shared_enabled=false where id;
-- Original OIDs and EXECUTE ACLs remain unchanged by CREATE OR REPLACE restoration.
do $restore$
declare signature text;definition text;old_name text;prior_name text;
begin
 foreach signature in array array[
 'coach_private.premium_access(uuid,uuid)','coach_private.premium_bundle(uuid,uuid)',
 'coach_private.premium_weekly_assert(public.coach_recommendations,boolean)',
 'coach_private.premium_chat_assert_bundle(jsonb,uuid,boolean)',
 'coach_private.premium_chat_expire(uuid)',
 'coach_private.premium_revision_sets(uuid,uuid)',
 'coach_private.premium_weekly_grant(uuid,uuid)','coach_private.premium_chat_grant(uuid,uuid)',
 'coach_private.premium_review_access(uuid)',
 'coach_private.guard_structure()',
 'coach_private.premium_history(uuid,uuid)','coach_private.premium_history_context(uuid,uuid)',
 'public.premium_weekly_permission(uuid,boolean)','public.premium_chat_permission(uuid,boolean)',
 'public.premium_reserve_analysis(uuid,uuid)',
 'public.premium_provision(uuid,uuid,date,integer,timestamp with time zone)',
 'public.premium_analysis_claim(uuid,uuid,integer,text)',
 'public.premium_chat_claim(uuid,uuid,integer,text)',
 'public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb)',
 'public.reserve_basic_generation(uuid,uuid)'] loop
  select n.nspname||'.'||p.proname,'coach_private.premium_upgrade_prior_'||p.proname into old_name,prior_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=signature::regprocedure;
  definition:=pg_get_functiondef((prior_name||substring(signature from position('(' in signature)))::regprocedure);
  execute replace(definition,'FUNCTION '||prior_name||'(','FUNCTION '||old_name||'(');
 end loop;
end $restore$;
drop function public.premium_my_access();
drop function public.premium_recommendation_view(uuid);
drop function public.premium_start_followup(uuid,uuid,date,integer);
drop function public.upgrade_basic_routine_to_premium(uuid,uuid,uuid,date,integer);
drop function public.premium_admission_permission(boolean,text);
drop function public.premium_set_entitlement(uuid,boolean,timestamptz,text[],integer,integer,integer);
drop function coach_private.premium_chat_telemetry(jsonb,boolean,text,text);
drop function coach_private.premium_check_dispatch(uuid,text,integer,integer);
drop function coach_private.premium_assert_admission(jsonb,uuid,text);
drop function coach_private.premium_admission_guard(uuid,uuid);
drop function coach_private.premium_basic_faithful(uuid,uuid,uuid);
drop function coach_private.premium_entitled(uuid,text);
drop function coach_private.premium_admission_grant(uuid);
drop function coach_private.premium_upgrade_lock(uuid);
drop function coach_private.premium_upgrade_provision_admitted(uuid,uuid,date,integer,timestamptz);
do $drop_backups$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='coach_private' and p.proname like 'premium_upgrade_prior_%' loop execute 'drop function '||f.signature;end loop;
end $drop_backups$;
drop table coach_private.premium_admissions;
alter table public.routine_management drop constraint premium_management_origin;
alter table public.routine_management add constraint premium_management_origin check((plan_kind='basic' and operation_id is not null) or (plan_kind='premium' and operation_id is null));
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history','premium_weekly_checkin','premium_chat'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1','premium-checkin-v1','premium-chat-v1'));
commit;
