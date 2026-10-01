-- Independent Basic generations; legacy operations are not rewritten or renumbered.
-- A generation is the root operation (retry_source IS NULL). Reviewed retries remain
-- attempts of that generation, not another entitlement or a replacement routine.
CREATE FUNCTION coach_private.generation_limit(u uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,coach_private AS $$
 SELECT CASE coalesce(coach_private.pilot_config()->u::text->>'generation_limit','1')
 WHEN '1' THEN 1 WHEN '2' THEN 2 ELSE 0 END
$$;
ALTER FUNCTION coach_private.generation_limit(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION coach_private.generation_limit(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Substitute protections are installed before removing the lifetime-wide index.
CREATE UNIQUE INDEX coach_one_pending_operation ON public.coach_operations(user_id)
 WHERE state IN ('reserved','pending_review','ready');
CREATE UNIQUE INDEX coach_one_generation_per_intake ON public.coach_operations(user_id,intake_id)
 WHERE retry_source IS NULL;
DROP INDEX public.coach_one_initial_operation;

CREATE OR REPLACE FUNCTION public.get_my_coach_access() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,coach_private AS $$
DECLARE u uuid:=coach_private.actor();o public.coach_operations;used integer;lim integer;retry_ok boolean;
BEGIN
 SELECT * INTO o FROM public.coach_operations WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT count(*) INTO used FROM public.coach_operations WHERE user_id=u AND retry_source IS NULL;
 lim:=coach_private.generation_limit(u);
 retry_ok:=o.state IN ('failed','stale','rejected','athlete_declined') AND o.retry_authorized_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.coach_operations WHERE retry_source=o.id);
 RETURN jsonb_build_object('authorized',coach_private.allowed(u),'plan','basic_pilot','premium',false,
 'generation_consumed',used>0,'consumed_generations',used,'authorized_generations',lim,
 'remaining_generations',greatest(lim-used,0),'health_enabled',false,'notice_version','pilot-supervised-v2',
 'can_feedback',EXISTS(SELECT 1 FROM public.routine_management m JOIN public.workouts w ON w.user_id=m.user_id
  AND w.data->>'routine_id'=m.routine_id::text WHERE m.user_id=u),
 'has_feedback',EXISTS(SELECT 1 FROM public.coach_pilot_feedback WHERE user_id=u),
 'can_generate',coach_private.allowed(u) AND (coalesce(retry_ok,false) OR
  (used<lim AND (o.id IS NULL OR o.state='accepted'))),
 'latest_operation_id',o.id,'latest_operation_state',o.state,
 -- Keep the legacy scalar stable. The existing home already lists all managed routines.
 'routine_id',(SELECT routine_id FROM public.coach_operations WHERE user_id=u AND state='accepted' ORDER BY created_at,id LIMIT 1),
 'accepted_routines',coalesce((SELECT jsonb_agg(jsonb_build_object('routine_id',c.routine_id,'name',r.name) ORDER BY c.created_at,c.id)
  FROM public.coach_operations c JOIN public.routines r ON r.id=c.routine_id WHERE c.user_id=u AND c.state='accepted'),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.reserve_basic_generation(p_intake_id uuid,p_key uuid)
RETURNS public.coach_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,coach_private AS $$
DECLARE u uuid:=coach_private.actor();i public.training_intakes;o public.coach_operations;g uuid[];
 previous public.coach_operations;source uuid;used integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 IF NOT coach_private.allowed(u) THEN RAISE EXCEPTION 'coach_pilot_required' USING errcode='42501';END IF;
 g:=coach_private.require_context(u);
 SELECT * INTO i FROM public.training_intakes WHERE id=p_intake_id AND user_id=u;
 IF NOT FOUND OR i.state<>'submitted' OR i.revision<>(SELECT max(revision) FROM public.training_intakes WHERE user_id=u)
 THEN RAISE EXCEPTION 'coach_current_intake_required';END IF;
 PERFORM coach_private.validate_intake(i.training,null);
 IF p_key IS NULL THEN RAISE EXCEPTION 'coach_key_required';END IF;
 UPDATE public.coach_operations SET state='failed',error_code='reservation_expired',updated_at=now()
  WHERE user_id=u AND state='reserved' AND expires_at<now();
 SELECT * INTO o FROM public.coach_operations WHERE user_id=u AND idempotency_key=p_key;
 IF FOUND THEN
  IF o.intake_id<>p_intake_id THEN RAISE EXCEPTION 'coach_key_conflict';END IF;
  RETURN o;
 END IF;
 SELECT * INTO o FROM public.coach_operations WHERE user_id=u AND state IN ('reserved','pending_review','ready');
 IF FOUND THEN
  IF o.intake_id<>p_intake_id THEN RAISE EXCEPTION 'coach_current_intake_required';END IF;
  RETURN o;
 END IF;
 IF (SELECT count(*) FROM public.coach_operations WHERE user_id=u AND created_at>now()-interval '1 hour')>=5
 THEN RAISE EXCEPTION 'coach_rate_limit';END IF;
 SELECT * INTO previous FROM public.coach_operations WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT count(*) INTO used FROM public.coach_operations WHERE user_id=u AND retry_source IS NULL;
 IF previous.id IS NULL OR previous.state='accepted' THEN
  IF used>=coach_private.generation_limit(u) THEN RAISE EXCEPTION 'coach_generation_limit';END IF;
  IF previous.id IS NOT NULL AND (i.schema_version<>2 OR EXISTS(SELECT 1 FROM public.coach_operations WHERE user_id=u AND intake_id=i.id))
  THEN RAISE EXCEPTION 'coach_new_intake_required';END IF;
  source:=null;
 ELSE
  IF previous.state NOT IN ('failed','stale','rejected','athlete_declined') OR previous.retry_authorized_at IS NULL
   OR EXISTS(SELECT 1 FROM public.coach_operations WHERE retry_source=previous.id)
  THEN RAISE EXCEPTION 'coach_retry_review_required';END IF;
  source:=previous.id;
 END IF;
 INSERT INTO public.coach_operations(user_id,intake_id,intake_version,idempotency_key,state,grant_ids,review_required,retry_source)
 VALUES(u,i.id,i.row_version,p_key,'reserved',g,coach_private.review_required(),source) RETURNING * INTO o;
 RETURN o;
END $$;

CREATE OR REPLACE FUNCTION public.authorize_coach_retry(p_operation uuid,p_reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,coach_private AS $$
DECLARE o public.coach_operations;u uuid;
BEGIN
 IF NOT coach_private.is_reviewer(auth.uid()) OR NOT coalesce((coach_private.reviewer_config()->auth.uid()::text->>'expires_at')::timestamptz>clock_timestamp(),false)
 THEN RAISE EXCEPTION 'coach_reviewer_required' USING errcode='42501';END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'coach_review_reason_required';END IF;
 SELECT user_id INTO u FROM public.coach_operations WHERE id=p_operation;
 IF u IS NULL OR u=auth.uid() THEN RAISE EXCEPTION 'coach_not_authorized' USING errcode='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 IF NOT coach_private.is_reviewer(auth.uid()) OR NOT coalesce((coach_private.reviewer_config()->auth.uid()::text->>'expires_at')::timestamptz>clock_timestamp(),false)
 THEN RAISE EXCEPTION 'coach_reviewer_required' USING errcode='42501';END IF;
 SELECT * INTO o FROM public.coach_operations WHERE id=p_operation FOR UPDATE;
 IF o.state='reserved' AND o.expires_at<=clock_timestamp() THEN
  UPDATE public.coach_operations SET state='failed',error_code='provider_timeout',updated_at=clock_timestamp()
   WHERE id=o.id AND state='reserved' AND expires_at<=clock_timestamp() RETURNING * INTO o;
 END IF;
 IF o.state NOT IN ('failed','stale','rejected','athlete_declined') OR NOT coach_private.allowed(u)
 OR EXISTS(SELECT 1 FROM public.coach_operations WHERE user_id=u AND state IN ('reserved','pending_review','ready'))
 OR o.id IS DISTINCT FROM (SELECT id FROM public.coach_operations WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.coach_operations WHERE retry_source=o.id)
 THEN RAISE EXCEPTION 'coach_retry_unavailable';END IF;
 PERFORM coach_private.require_context(u);
 IF o.retry_authorized_at IS NOT NULL THEN RETURN true;END IF;
 UPDATE public.coach_operations SET retry_authorized_by=auth.uid(),retry_authorized_at=now(),retry_reason=btrim(p_reason),updated_at=now() WHERE id=o.id;
 RETURN true;
END $$;
