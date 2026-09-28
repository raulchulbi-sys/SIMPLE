-- Cover composite ownership FKs explicitly; no changes to existing SIMPLE indexes.
drop index public.coach_operation_intake;
create index coach_operation_intake_owner on public.coach_operations(intake_id,user_id);
create index coach_health_intake_owner on public.intake_health(intake_id,user_id);
create index coach_management_revision on public.routine_management(current_revision_id,routine_id);
create index coach_management_operation_owner on public.routine_management(operation_id,user_id);
create index coach_revision_acceptor on public.routine_revisions(accepted_by);
create index coach_revision_operation_owner on public.routine_revisions(operation_id,user_id);
