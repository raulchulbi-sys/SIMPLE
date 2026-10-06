-- Roll back the frontend first. Historical training data is never changed.
BEGIN;
DROP FUNCTION public.reset_client_routine_statistics(uuid,uuid,uuid,uuid);
DROP FUNCTION public.get_client_routine_statistics_stage(uuid,uuid);
DROP FUNCTION public.get_client_routine_stage_cycle_progress(uuid,uuid);
DROP TABLE public.client_routine_statistics_stages;
COMMIT;
