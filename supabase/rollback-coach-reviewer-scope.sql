-- Fail-closed rollback: retain assignments/history, disable reviewer operations.
-- Restoring the previous global reviewer surface would reintroduce the diagnosed exposure.
begin;
create or replace function public.get_coach_reviewer_access() returns boolean language sql security definer set search_path=pg_catalog as $$select false$$;
create or replace function public.get_coach_reviewer_status() returns jsonb language sql security definer set search_path=pg_catalog as $$select jsonb_build_object('authorized',false,'expires_at',null)$$;
create or replace function public.get_coach_review_queue() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'coach_reviewer_required' using errcode='42501';end$$;
create or replace function public.get_coach_pilot_metrics() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'coach_reviewer_required' using errcode='42501';end$$;
create or replace function public.review_coach_proposal(p_operation uuid,p_approve boolean,p_reason text) returns public.coach_operations language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'coach_reviewer_required' using errcode='42501';end$$;
create or replace function public.authorize_coach_retry(p_operation uuid,p_reason text) returns boolean language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'coach_reviewer_required' using errcode='42501';end$$;
drop policy coach_feedback_read on public.coach_pilot_feedback;
create policy coach_feedback_read on public.coach_pilot_feedback for select to authenticated using (user_id=(select auth.uid()));
commit;
