CREATE OR REPLACE FUNCTION public.get_coach_review_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',to_jsonb(o),
 'athlete',jsonb_build_object('user_id',o.user_id,'name',(select p.name from public.profiles p where p.id=o.user_id)),
 'training',case when i.schema_version=2 then jsonb_build_object('schema_version','basic-intake-v2','experience',i.training->'experience','goal',i.training->'goal','days',i.training->'days','weekdays',i.training->'weekdays','minutes',i.training->'minutes','effort',i.training->'effort','excluded',i.training->'excluded','activity',jsonb_build_object('type',i.training->'activity'->'type','weekdays',i.training->'activity'->'weekdays'),'inventory',jsonb_build_object('equipment',i.training->'inventory'->'equipment','custom','[]'::jsonb)) else jsonb_build_object('goal',i.training->'goal','experience',i.training->'experience','days',i.training->'days',
 'minutes',i.training->'minutes','equipment',i.training->'equipment','preferred',i.training->'preferred','avoided',i.training->'avoided','preferences',i.training->'preferences') end,
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id
 where o.user_id<>auth.uid() and cardinality(o.grant_ids)=1
 and o.grant_ids=coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and scope='training_intake'
 and revoked_at is null and notice_version='pilot-supervised-v2'),'{}'::uuid[])),'[]'::jsonb);
end $function$
;
create or replace function public.review_coach_proposal(p_operation uuid,p_approve boolean,p_reason text) returns public.coach_operations language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;u uuid;i public.training_intakes;
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 if p_approve is null or length(btrim(p_reason)) not between 1 and 1000 or p_reason is null then raise exception 'coach_review_reason_required';end if;
 select user_id into u from public.coach_operations where id=p_operation;
 if u is null or u=auth.uid() then raise exception 'coach_not_authorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 select * into o from public.coach_operations where id=p_operation for update;
 if o.state<>'pending_review' or o.review_decision is not null then raise exception 'coach_review_not_pending';end if;
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 if coach_private.require_context(u) is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id;
 if i.row_version<>o.intake_version or i.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_changed';end if;
 update public.coach_operations set state=case when p_approve then 'ready' else 'rejected' end,
 review_decision=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=btrim(p_reason),updated_at=now() where id=o.id returning * into o;
 return o;
end $$;
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
create function public.get_coach_pilot_metrics() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,coach_private as $$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return jsonb_build_object(
 'authorized',(select count(*) from jsonb_object_keys(coach_private.pilot_config()) k where coach_private.allowed(k::uuid)),
 'intakes_started',(select count(distinct user_id) from public.training_intakes),
 'intakes_completed',(select count(distinct user_id) from public.training_intakes where state='submitted'),
 'generations',(select count(*) from public.coach_operations where generation_started_at is not null),
 'valid_proposals',(select count(*) from public.coach_operations where proposal is not null),
 'blocked',(select count(*) from public.coach_operations where error_code='safety_review_required'),
 'reviewer_approved',(select count(*) from public.coach_operations where review_decision='approved'),
 'reviewer_rejected',(select count(*) from public.coach_operations where review_decision='rejected'),
 'athlete_accepted',(select count(*) from public.coach_operations where state='accepted'),
 'mean_cost',(select avg(estimated_cost) from public.coach_operations where generation_started_at is not null),
 'mean_latency_ms',(select avg(latency_ms) from public.coach_operations where generation_started_at is not null),
 'users_started_routine',(select count(distinct m.user_id) from public.routine_management m where exists(select 1 from public.workouts w where w.user_id=m.user_id and w.data->>'routine_id'=m.routine_id::text)));
end $$;