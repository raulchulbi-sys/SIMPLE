-- Destructive reset is a separate RPC. The published metadata-only RPC stays safe
-- for old tabs whose confirmation promised to retain history.
ALTER TABLE public.client_routine_statistics_stages ADD COLUMN history_cleared boolean NOT NULL DEFAULT false;
ALTER TABLE public.routine_user_notes ADD COLUMN statistics_stage_id uuid REFERENCES public.client_routine_statistics_stages(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_client_routine_statistics_stage(p_client_id uuid,p_routine_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.client_routine_statistics_stages; reset_id uuid;
BEGIN
 IF auth.uid() IS NULL OR p_client_id IS NULL OR p_routine_id IS NULL THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.routines r WHERE r.id=p_routine_id AND r.deleted_at IS NULL AND
  ((auth.uid()=p_client_id AND r.owner_id=p_client_id) OR EXISTS(
    SELECT 1 FROM public.routine_assignments a WHERE a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id AND a.client_deleted_at IS NULL
      AND (auth.uid()=p_client_id OR a.trainer_id=auth.uid()))))
 THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id ORDER BY started_at DESC,id DESC LIMIT 1;
 SELECT id INTO reset_id FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id AND history_cleared ORDER BY started_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('id',s.id,'started_at',s.started_at,'training_reset_id',reset_id);
END $$;

CREATE FUNCTION public.reset_client_routine_training_history(p_client_id uuid,p_routine_id uuid,p_expected_stage uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.client_routine_statistics_stages; latest uuid;
BEGIN
 IF auth.uid() IS NULL OR p_request_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='trainer')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_client_id AND role='client')
    OR NOT EXISTS(SELECT 1 FROM public.routine_assignments a JOIN public.routines r ON r.id=a.trainer_routine_id
      WHERE a.trainer_id=auth.uid() AND a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id AND a.client_deleted_at IS NULL AND r.deleted_at IS NULL)
 THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.coach_mesocycles WHERE routine_id=p_routine_id AND user_id=p_client_id AND state='active')
 THEN RAISE EXCEPTION 'statistics_coach_managed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id::text||':'||p_routine_id::text||':statistics',0));
 SELECT * INTO s FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id AND request_id=p_request_id;
 IF s.id IS NOT NULL THEN
  IF NOT s.history_cleared THEN RAISE EXCEPTION 'statistics_request_not_destructive'; END IF;
  RETURN jsonb_build_object('id',s.id,'started_at',s.started_at,'training_reset_id',s.id);
 END IF;
 SELECT id INTO latest FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id ORDER BY started_at DESC,id DESC LIMIT 1;
 IF latest IS DISTINCT FROM p_expected_stage THEN RAISE EXCEPTION 'statistics_stage_conflict' USING ERRCODE='40001'; END IF;
 INSERT INTO public.client_routine_statistics_stages(client_id,routine_id,created_by,request_id,history_cleared)
 VALUES(p_client_id,p_routine_id,auth.uid(),p_request_id,true) RETURNING * INTO s;
 DELETE FROM public.workouts WHERE user_id=p_client_id AND data->>'routine_id'=p_routine_id::text;
 DELETE FROM public.routine_user_notes WHERE user_id=p_client_id AND routine_id=p_routine_id;
 RETURN jsonb_build_object('id',s.id,'started_at',s.started_at,'training_reset_id',s.id);
END $$;
REVOKE ALL ON FUNCTION public.reset_client_routine_training_history(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reset_client_routine_training_history(uuid,uuid,uuid,uuid) TO authenticated;

-- Serializes a reset with in-flight inserts/updates. A stale page cannot put
-- deleted sessions/notes back. Existing routines with no destructive reset
-- retain their current write behavior and RLS.
CREATE FUNCTION public.simple_guard_statistics_stage_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE client uuid; routine text; reset_id uuid; supplied text;
BEGIN
 client:=NEW.user_id;
 IF TG_TABLE_NAME='workouts' THEN routine:=NEW.data->>'routine_id'; supplied:=NEW.data->>'statistics_stage_id';
 ELSE routine:=NEW.routine_id::text; supplied:=NEW.statistics_stage_id::text; END IF;
 IF client IS NULL OR routine IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(client::text||':'||routine||':statistics',0));
 SELECT id INTO reset_id FROM public.client_routine_statistics_stages
 WHERE client_id=client AND routine_id::text=routine AND history_cleared ORDER BY started_at DESC,id DESC LIMIT 1;
 IF reset_id IS NOT NULL AND supplied IS DISTINCT FROM reset_id::text THEN
  RAISE EXCEPTION 'statistics_stage_conflict' USING ERRCODE='40001';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.simple_guard_statistics_stage_write() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER simple_statistics_stage_workout_guard BEFORE INSERT OR UPDATE ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.simple_guard_statistics_stage_write();
CREATE TRIGGER simple_statistics_stage_note_guard BEFORE INSERT OR UPDATE ON public.routine_user_notes FOR EACH ROW EXECUTE FUNCTION public.simple_guard_statistics_stage_write();
