-- Deploy the previous frontend first. Deleted training data cannot be restored
-- by this schema rollback; do not use it as a data recovery procedure.
DROP TRIGGER simple_statistics_stage_note_guard ON public.routine_user_notes;
DROP TRIGGER simple_statistics_stage_workout_guard ON public.workouts;
DROP FUNCTION public.simple_guard_statistics_stage_write();
DROP FUNCTION public.reset_client_routine_training_history(uuid,uuid,uuid,uuid);
CREATE OR REPLACE FUNCTION public.get_client_routine_statistics_stage(p_client_id uuid,p_routine_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.client_routine_statistics_stages;
BEGIN
 IF auth.uid() IS NULL OR p_client_id IS NULL OR p_routine_id IS NULL THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.routines r WHERE r.id=p_routine_id AND r.deleted_at IS NULL AND
  ((auth.uid()=p_client_id AND r.owner_id=p_client_id) OR EXISTS(
    SELECT 1 FROM public.routine_assignments a WHERE a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id AND a.client_deleted_at IS NULL
      AND (auth.uid()=p_client_id OR a.trainer_id=auth.uid()))))
 THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id ORDER BY started_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('id',s.id,'started_at',s.started_at);
END $$;
ALTER TABLE public.routine_user_notes DROP COLUMN statistics_stage_id;
ALTER TABLE public.client_routine_statistics_stages DROP COLUMN history_cleared;
