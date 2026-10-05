-- STAGING ONLY. Restore Phase 3 API; reject destruction of any surviving chat data.
-- Independent private accounting columns deliberately survive: never erase consumed cost/calls.
begin;
do $guard$
begin
 if exists(select 1 from public.coach_messages) or exists(select 1 from public.coach_conversations)
 or exists(select 1 from public.coach_recommendations where analysis_trace->>'origin'='premium_chat')
 or exists(select 1 from public.context_grants where scope='premium_chat' or notice_version='premium-chat-v1') then
  raise exception 'premium_chat_rollback_data_incompatible';
 end if;
 if exists(select 1 from coach_private.premium_analysis_budget where id and chat_reserved_usd<>0) then raise exception 'premium_chat_rollback_reserved_cost';end if;
end $guard$;
update coach_private.premium_analysis_budget set chat_enabled=false where id;
-- CREATE OR REPLACE preserves the original OID and privileges used by Phase 3 callers.
do $restore$
declare original text:=pg_get_functiondef('coach_private.premium_weekly_assert_phase3(public.coach_recommendations,boolean)'::regprocedure);
begin
 execute replace(original,'FUNCTION coach_private.premium_weekly_assert_phase3(','FUNCTION coach_private.premium_weekly_assert(');
end $restore$;
drop function coach_private.premium_weekly_assert_phase3(public.coach_recommendations,boolean);
drop function public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb);
drop function public.premium_chat_claim(uuid,uuid,integer,text);
drop function public.premium_chat_reserve(uuid,uuid,uuid,text);
drop function public.premium_chat_load(uuid);
drop function public.premium_chat_permission(uuid,boolean);
drop policy premium_explicit_reviewer on public.coach_recommendations;
create policy premium_explicit_reviewer on public.coach_recommendations for select to authenticated using(coach_private.premium_review_access(mesocycle_id) and (analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' or coach_private.premium_weekly_visible(mesocycle_id)));
drop function coach_private.premium_chat_recommendation_visible(uuid);
drop function coach_private.premium_chat_assert(public.coach_recommendations,boolean);
drop function coach_private.premium_chat_bundle(uuid,uuid,uuid,text);
drop function coach_private.premium_chat_assert_bundle(jsonb,uuid,boolean);
drop function coach_private.premium_chat_expire(uuid);
drop function coach_private.premium_chat_public(public.coach_messages);
drop function coach_private.premium_chat_grant(uuid,uuid);
drop function coach_private.premium_chat_safe_output(text);
drop function coach_private.premium_chat_input(text);
drop table public.coach_messages;
drop table public.coach_conversations;
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history','premium_weekly_checkin'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1','premium-checkin-v1'));
commit;
