-- Stop if independent generations have already been consumed. Never delete them to roll back.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.coach_operations WHERE retry_source IS NULL GROUP BY user_id HAVING count(*)>1) THEN RAISE EXCEPTION 'coach_rollback_requires_multi_generation_compatibility'; END IF; END $$;
CREATE UNIQUE INDEX coach_one_initial_operation ON public.coach_operations(user_id) WHERE state IN ('reserved','pending_review','ready','accepted');
CREATE OR REPLACE FUNCTION public.authorize_coach_retry(p_operation uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare o public.coach_operations;u uuid;
begin
 if not coach_private.is_reviewer(auth.uid()) or not coalesce((coach_private.reviewer_config()->auth.uid()::text->>'expires_at')::timestamptz>clock_timestamp(),false)
 then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'coach_review_reason_required';end if;
 select user_id into u from public.coach_operations where id=p_operation;
 if u is null or u=auth.uid() then raise exception 'coach_not_authorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 -- The permission can expire while waiting for the athlete's lock. Use wall-clock time here.
 if not coach_private.is_reviewer(auth.uid()) or not coalesce((coach_private.reviewer_config()->auth.uid()::text->>'expires_at')::timestamptz>clock_timestamp(),false)
 then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 select * into o from public.coach_operations where id=p_operation for update;
 -- A crashed Edge may leave a reserved operation without a receipt. Only an authorized
 -- reviewer can close an already expired reservation here; no provider resend or usage is invented.
 if o.state='reserved' and o.expires_at<=clock_timestamp() then
  update public.coach_operations set state='failed',error_code='provider_timeout',updated_at=clock_timestamp()
   where id=o.id and state='reserved' and expires_at<=clock_timestamp() returning * into o;
 end if;
 if o.state not in ('failed','stale','rejected','athlete_declined') or not coach_private.allowed(u)
 or exists(select 1 from public.coach_operations where user_id=u and state in ('reserved','pending_review','ready','accepted'))
 or exists(select 1 from public.coach_operations where retry_source=o.id)
 then raise exception 'coach_retry_unavailable';end if;
 perform coach_private.require_context(u);
 if o.retry_authorized_at is not null then return true;end if;
 update public.coach_operations set retry_authorized_by=auth.uid(),retry_authorized_at=now(),retry_reason=btrim(p_reason),updated_at=now() where id=o.id;
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_my_coach_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare u uuid:=coach_private.actor();o public.coach_operations;
begin
 select * into o from public.coach_operations where user_id=u order by created_at desc,id desc limit 1;
 return jsonb_build_object('authorized',coach_private.allowed(u),'plan','basic_pilot','premium',false,
 'generation_consumed',o.id is not null,'health_enabled',false,'notice_version','pilot-supervised-v2',
 'can_feedback',exists(select 1 from public.routine_management m join public.workouts w on w.user_id=m.user_id and w.data->>'routine_id'=m.routine_id::text where m.user_id=u),
 'has_feedback',exists(select 1 from public.coach_pilot_feedback where user_id=u),
 'can_generate',coach_private.allowed(u) and (o.id is null or (o.state in ('failed','stale','rejected','athlete_declined') and o.retry_authorized_at is not null and not exists(select 1 from public.coach_operations where retry_source=o.id))),
 'routine_id',(select routine_id from public.coach_operations where user_id=u and state='accepted'));
end $function$
;
CREATE OR REPLACE FUNCTION public.reserve_basic_generation(p_intake_id uuid, p_key uuid)
 RETURNS coach_operations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare u uuid:=coach_private.actor();i public.training_intakes;o public.coach_operations;g uuid[];previous public.coach_operations;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required' using errcode='42501';end if;
 g:=coach_private.require_context(u);
 select * into i from public.training_intakes where id=p_intake_id and user_id=u;
 if not found or i.state<>'submitted' or i.revision<>(select max(revision) from public.training_intakes where user_id=u)
 then raise exception 'coach_current_intake_required';end if;
 perform coach_private.validate_intake(i.training,null);
 if p_key is null then raise exception 'coach_key_required';end if;
 update public.coach_operations set state='failed',error_code='reservation_expired',updated_at=now()
  where user_id=u and state='reserved' and expires_at<now();
 select * into o from public.coach_operations where user_id=u and idempotency_key=p_key;
 if found then
  if o.intake_id<>p_intake_id then raise exception 'coach_key_conflict';end if;
  return o;
 end if;

 select * into o from public.coach_operations where user_id=u and state in ('reserved','pending_review','ready','accepted');
 if found then return o;end if;
 if (select count(*) from public.coach_operations where user_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'coach_rate_limit';end if;
 select * into previous from public.coach_operations where user_id=u order by created_at desc,id desc limit 1;
 if found and (previous.retry_authorized_at is null or exists(select 1 from public.coach_operations where retry_source=previous.id)) then raise exception 'coach_retry_review_required';end if;
 insert into public.coach_operations(user_id,intake_id,intake_version,idempotency_key,state,grant_ids,review_required,retry_source)
 values(u,i.id,i.row_version,p_key,'reserved',g,coach_private.review_required(),previous.id) returning * into o;
 return o;
end $function$
;
DROP INDEX public.coach_one_pending_operation;
DROP INDEX public.coach_one_generation_per_intake;
DROP FUNCTION coach_private.generation_limit(uuid);
