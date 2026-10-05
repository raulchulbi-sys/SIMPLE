-- STAGING rollback only. Refuses to discard any Premium objects.
begin;
do $$ begin if exists(select 1 from public.coach_mesocycles) or exists(select 1 from public.coach_recommendations) or exists(select 1 from public.routine_revisions where origin<>'basic') or exists(select 1 from public.routine_management where plan_kind<>'basic') or exists(select 1 from public.context_grants where scope='premium_training_history') then raise exception 'premium_rollback_requires_reviewed_cleanup';end if;end $$;
CREATE OR REPLACE FUNCTION coach_private.guard_structure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare old_r uuid;new_r uuid;
begin
 -- Explicit administrative maintenance only; end-user RPCs retain auth.uid.
 if auth.uid() is null and current_setting('role',true) in ('none','postgres','service_role') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_table_name='routines' then
  if tg_op<>'INSERT' then old_r:=old.id;end if;
  if tg_op<>'DELETE' then new_r:=new.id;end if;
  if tg_op='UPDATE' and old.id=new.id and
   (to_jsonb(old)-array['routine_order','deleted_at','updated_at'])=(to_jsonb(new)-array['routine_order','deleted_at','updated_at'])
   then return new;end if;
 elsif tg_table_name='routine_days' then
  if tg_op<>'INSERT' then old_r:=old.routine_id;end if;
  if tg_op<>'DELETE' then new_r:=new.routine_id;end if;
 else
  if tg_op<>'INSERT' then select routine_id into old_r from public.routine_days where id=old.day_id;end if;
  if tg_op<>'DELETE' then select routine_id into new_r from public.routine_days where id=new.day_id;end if;
 end if;
 if exists(select 1 from public.routine_management where routine_id in (old_r,new_r))
 then raise exception 'coach_structure_locked' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $function$
;
drop policy premium_explicit_reviewer on public.coach_mesocycles;
drop policy premium_explicit_reviewer on public.coach_mesocycle_weeks;
drop policy premium_explicit_reviewer on public.coach_recommendations;
drop trigger premium_revision_immutable on public.routine_revisions;
drop function coach_private.premium_access(uuid,uuid);
drop function coach_private.premium_catalogue();
drop function coach_private.premium_check_patch(jsonb,uuid,boolean);
drop function coach_private.premium_exercise_identity(text,uuid,uuid,uuid);
drop function coach_private.premium_history(uuid,uuid);
drop function coach_private.premium_immutable_revision();
drop function coach_private.premium_metrics(jsonb);
drop function coach_private.premium_number(text);
drop function coach_private.premium_review_access(uuid);
drop function coach_private.premium_snapshot(uuid);
drop function coach_private.premium_validate_intake(jsonb,boolean);
drop function premium_accept_recommendation(uuid);
drop function premium_assign_reviewer(uuid,uuid);
drop function premium_mock_recommendation(uuid,text,jsonb,jsonb,text);
drop function premium_permission(uuid,boolean);
drop function premium_provider_context(uuid);
drop function premium_provision(uuid,uuid,date,integer,timestamp with time zone);
drop function premium_review_recommendation(uuid,boolean,text);
drop function premium_save_intake(uuid,bigint,jsonb,boolean);
drop function premium_training_history(uuid);
alter table public.routine_revisions drop constraint premium_revision_rec_fk;
drop table public.coach_mesocycle_weeks;
drop table public.coach_recommendations;
drop table public.coach_mesocycles;
alter table public.routine_revisions drop constraint premium_revision_origin,drop constraint premium_revision_identity,drop constraint premium_revision_recommendation_unique;
alter table public.routine_revisions drop column recommendation_id,drop column origin;
alter table public.routine_revisions alter column operation_id set not null;
alter table public.routine_revisions drop constraint routine_revisions_revision_no_check;
alter table public.routine_revisions add constraint routine_revisions_revision_no_check check(revision_no=1);
alter table public.routine_management drop constraint premium_management_origin;
alter table public.routine_management drop column plan_kind;
alter table public.routine_management alter column operation_id set not null;
alter table public.context_grants drop constraint context_grants_scope_check,drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health'));
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2'));
commit;
