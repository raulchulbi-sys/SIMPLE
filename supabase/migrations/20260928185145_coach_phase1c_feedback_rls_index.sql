drop index public.coach_feedback_routine;
create index coach_feedback_routine on public.coach_pilot_feedback(routine_id,user_id);
drop policy coach_feedback_own on public.coach_pilot_feedback;
drop policy coach_feedback_reviewer_read on public.coach_pilot_feedback;
create policy coach_feedback_read on public.coach_pilot_feedback for select to authenticated using (user_id=(select auth.uid()) or (select public.get_coach_reviewer_access()));
