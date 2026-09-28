-- Authorized reviewer can read feedback only, independently of revoked intake context.
create policy coach_feedback_reviewer_read on public.coach_pilot_feedback for select to authenticated using ((select public.get_coach_reviewer_access()));
