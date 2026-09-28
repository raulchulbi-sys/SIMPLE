-- Staging only. Refuses to destroy any Coach data. Revoke/delete only manifest fixtures first.
begin;
do $$declare n text;busy boolean;begin
 foreach n in array array['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions'] loop
  execute format('select exists(select 1 from public.%I)',n) into busy;
  if busy then raise exception 'coach_rollback_requires_empty_data: %',n;end if;
 end loop;
end $$;
drop trigger coach_guard_routines on public.routines;
drop trigger coach_guard_days on public.routine_days;
drop trigger coach_guard_exercises on public.routine_exercises;
drop function public.accept_basic_plan(uuid);
drop function public.coach_backend_finish(uuid,uuid,jsonb,text);
drop function public.coach_backend_context(uuid,uuid);
drop function public.reserve_basic_generation(uuid,uuid);
drop function public.set_my_coach_context_permission(text,boolean);
drop function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean);
drop function public.get_my_coach_access();
drop table public.routine_management;
drop table public.routine_revisions;
drop table public.coach_operations;
drop table public.intake_health;
drop table public.context_grants;
drop table public.training_intakes;
drop function coach_private.guard_structure();
drop function coach_private.require_context(uuid);
drop function coach_private.validate_proposal(jsonb);
drop function coach_private.validate_intake(jsonb,jsonb);
drop function coach_private.valid_text(jsonb,int,int);
drop function coach_private.valid_int(jsonb,int,int);
drop function coach_private.keys_exact(jsonb,text[]);
drop function coach_private.actor();
drop function coach_private.allowed(uuid);
drop function coach_private.pilot_config();
drop schema coach_private;
commit;
-- For a permanent rollback, disable/remove ONLY simple-coach-mock in staging too.
-- This task tests schema rollback then restores the candidate; existing Edge functions stay untouched.
