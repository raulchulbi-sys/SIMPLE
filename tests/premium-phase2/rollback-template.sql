-- STAGING ONLY. Preserve Phase 1; never silently discard Premium data.
begin;
do $$ begin if exists(select 1 from public.coach_recommendations where analysis_key is not null) or exists(select 1 from public.coach_mesocycles where catalogue_bindings<>'{}'::jsonb or tracking_week<>1) then raise exception 'premium_phase2_rollback_requires_reviewed_cleanup';end if;end $$;
__RESTORE_PROVIDER__
__RESTORE_ACCEPT__
drop function public.premium_resolve_review(uuid,text,jsonb,text);
drop function public.premium_reserve_analysis(uuid,uuid);
drop function public.premium_bind_catalogue(uuid,uuid,jsonb);
drop function public.premium_analysis_claim(uuid,uuid,int,text);
drop function public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb);
drop function coach_private.premium_output_patches(public.coach_recommendations,jsonb);
drop function coach_private.premium_bundle(uuid,uuid);
drop function coach_private.premium_history_context(uuid,uuid);
drop function coach_private.premium_accept_phase1(uuid);
drop function coach_private.premium_backend();
drop table coach_private.premium_analysis_budget;
drop index public.premium_analysis_key;
drop index public.premium_analysis_week_pending;
alter table public.coach_mesocycles drop column catalogue_bindings,drop column tracking_week;
alter table public.coach_recommendations drop column analysis_key,drop column analysis_week,drop column analysis_trace,drop column analysis_bundle,drop column provider_state,drop column reserved_usd;
alter table public.coach_recommendations drop constraint coach_recommendations_state_check;
alter table public.coach_recommendations add constraint coach_recommendations_state_check check(state in ('pending_review','ready','rejected','accepted','superseded'));
commit;
