-- Restore the previous Coach function implementation only; no central data/configuration changes.
-- All consent receipts, operations, routines and workouts are preserved.
-- The notice constraint continues to permit stored v2 receipts; none are converted to v1.
-- Recreate only the save RPC to remove v2 argument defaults; no CASCADE, so unexpected dependencies stop rollback.
-- Deployment must coordinate rollback of Edge/frontend and keep whitelist empty.
begin;
do $guard$ begin
 if coach_private.pilot_config()<>'{}'::jsonb then raise exception 'coach_rollback_requires_closed_pilot';end if;
 if exists(select 1 from public.coach_operations where state='reserved') then raise exception 'coach_rollback_generation_in_flight';end if;
end $guard$;
drop function public.delete_my_training_intake(uuid,bigint);
drop function public.get_coach_reviewer_status();
drop function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean);
alter table public.context_grants alter column notice_version set default 'pilot-supervised-v1';
grant select on public.intake_health to authenticated;

CREATE OR REPLACE FUNCTION coach_private.validate_intake(t jsonb, h jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'coach_private'
AS $function$
declare v jsonb;
begin
 if not coalesce(coach_private.keys_exact(t,array['goal','experience','days','minutes','equipment','preferred','avoided','preferences']),false)
 or not coalesce(coach_private.keys_exact(h,array['discomfort','limitations']),false)
 then raise exception 'coach_invalid_intake'; end if;
 if not coach_private.valid_text(t->'goal',1,120)
 or not coach_private.valid_text(t->'experience',1,30)
 or t->>'experience' not in ('beginner','intermediate','experienced')
 or not coach_private.valid_int(t->'days',1,7)
 or not coach_private.valid_int(t->'minutes',15,120)
 or not coach_private.valid_text(t->'preferred',0,500)
 or not coach_private.valid_text(t->'avoided',0,500)
 or not coach_private.valid_text(t->'preferences',0,1000)
 or not coach_private.valid_text(h->'discomfort',0,1000)
 or not coach_private.valid_text(h->'limitations',0,1000)
 or jsonb_typeof(t->'equipment') is distinct from 'array'
 then raise exception 'coach_invalid_intake'; end if;
 if jsonb_array_length(t->'equipment') not between 1 and 12 then raise exception 'coach_invalid_intake'; end if;
 for v in select value from jsonb_array_elements(t->'equipment') loop
  if not coach_private.valid_text(v,1,60) then raise exception 'coach_invalid_intake'; end if;
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.require_context(u uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare ids uuid[];
begin
 select array_agg(id order by scope) into ids from public.context_grants
 where user_id=u and revoked_at is null and notice_version='pilot-supervised-v1';
 if coalesce(array_length(ids,1),0)<>2 then raise exception 'coach_context_required';end if;
 return ids;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.allowed(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
 select coalesce((coach_private.pilot_config()->u::text->>'enabled')::boolean,false)
 and coalesce((coach_private.pilot_config()->u::text->>'activated_at')::timestamptz<=now(),true)
 and coalesce((coach_private.pilot_config()->u::text->>'adult_confirmed')::boolean,false)
 and coalesce((coach_private.pilot_config()->u::text->>'expires_at')::timestamptz>now(),false)
 and exists(select 1 from public.profiles where id=u and role='client')
$function$;

CREATE OR REPLACE FUNCTION coach_private.is_reviewer(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'coach_private'
AS $function$
 select coalesce((coach_private.reviewer_config()->u::text->>'enabled')::boolean,false)
 and coalesce((coach_private.reviewer_config()->u::text->>'expires_at')::timestamptz>now(),false)
$function$;

CREATE OR REPLACE FUNCTION public.set_my_coach_context_permission(p_scope text, p_allow boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare u uuid:=coach_private.actor();
begin
 if p_scope not in ('training_intake','declared_health') or p_scope is null or p_allow is null then raise exception 'coach_invalid_scope';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if p_allow then
  update public.context_grants set revoked_at=now() where user_id=u and scope=p_scope and revoked_at is null and notice_version<>'pilot-supervised-v1';
  insert into public.context_grants(user_id,scope) values(u,p_scope)
  on conflict(user_id,scope) where revoked_at is null do nothing;
 else
  update public.context_grants set revoked_at=now() where user_id=u and scope=p_scope and revoked_at is null;
  update public.coach_operations set state='stale',error_code='context_changed',updated_at=now()
   where user_id=u and state in ('reserved','pending_review','ready');
 end if;
 return p_allow;
end $function$;

CREATE OR REPLACE FUNCTION public.save_my_training_intake(p_id uuid, p_expected bigint, p_training jsonb, p_health jsonb, p_submit boolean)
 RETURNS training_intakes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare u uuid:=coach_private.actor(); r public.training_intakes; next_rev int;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if not coach_private.allowed(u) and not exists(select 1 from public.routine_management where user_id=u) then raise exception 'coach_pilot_required';end if;
 perform coach_private.validate_intake(p_training,p_health);
 if p_submit is null then raise exception 'coach_invalid_intake';end if;
 if p_id is null and exists(select 1 from public.training_intakes where user_id=u) then raise exception 'coach_intake_conflict';end if;
 if p_id is not null then
  select * into r from public.training_intakes where id=p_id and user_id=u for update;
  if not found then raise exception 'coach_not_authorized';end if;
  if r.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_conflict';end if;
  if r.row_version is distinct from p_expected then raise exception 'coach_intake_conflict';end if;
 end if;
 if p_id is null or r.state='submitted' then
  if exists(select 1 from public.training_intakes where user_id=u and state='draft') then raise exception 'coach_intake_conflict';end if;
  select coalesce(max(revision),0)+1 into next_rev from public.training_intakes where user_id=u;
  insert into public.training_intakes(user_id,revision,state,training,submitted_at)
  values(u,next_rev,case when p_submit then 'submitted' else 'draft' end,p_training,case when p_submit then now() end) returning * into r;
 else
  update public.training_intakes set training=p_training,row_version=row_version+1,updated_at=now(),
   state=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() end
  where id=r.id returning * into r;
 end if;
 insert into public.intake_health(intake_id,user_id,declarations) values(r.id,u,p_health)
 on conflict(intake_id) do update set declarations=excluded.declarations,updated_at=now();
 update public.coach_operations set state='stale',error_code='intake_changed',updated_at=now()
 where user_id=u and state in ('reserved','pending_review','ready');
 return r;
end $function$;

CREATE OR REPLACE FUNCTION public.coach_backend_context(p_user uuid, p_operation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare o public.coach_operations;i public.training_intakes;g uuid[];
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 if not coach_private.allowed(p_user) then raise exception 'coach_pilot_required';end if;
 select * into o from public.coach_operations where id=p_operation and user_id=p_user and state='reserved' and expires_at>now();
 if not found then raise exception 'coach_operation_unavailable';end if;
 g:=coach_private.require_context(p_user);
 if g is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id and user_id=p_user and row_version=o.intake_version and state='submitted';
 if not found or i.revision<>(select max(revision) from public.training_intakes where user_id=p_user) then raise exception 'coach_intake_changed';end if;
 return jsonb_build_object('training',i.training,'health',(select declarations from public.intake_health where intake_id=i.id and user_id=p_user));
end $function$;

CREATE OR REPLACE FUNCTION public.get_coach_review_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',to_jsonb(o),'athlete',jsonb_build_object('user_id',o.user_id,'name',(select p.name from public.profiles p where p.id=o.user_id)),'training',i.training,'health',h.declarations,
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id join public.intake_health h on h.intake_id=i.id
 where o.user_id<>auth.uid() and o.grant_ids <@ coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and revoked_at is null and notice_version='pilot-supervised-v1'),'{}'::uuid[])),'[]'::jsonb);
end $function$;

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
 'generation_consumed',o.id is not null,
 'can_feedback',exists(select 1 from public.routine_management m join public.workouts w on w.user_id=m.user_id and w.data->>'routine_id'=m.routine_id::text where m.user_id=u),
 'can_generate',coach_private.allowed(u) and (o.id is null or (o.state in ('failed','stale','rejected','athlete_declined') and o.retry_authorized_at is not null and not exists(select 1 from public.coach_operations where retry_source=o.id))),
 'routine_id',(select routine_id from public.coach_operations where user_id=u and state='accepted'));
end $function$;

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
end $function$;

CREATE OR REPLACE FUNCTION public.review_coach_proposal(p_operation uuid, p_approve boolean, p_reason text)
 RETURNS coach_operations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare o public.coach_operations;u uuid;i public.training_intakes;
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 if p_approve is null or length(btrim(p_reason)) not between 1 and 1000 or p_reason is null then raise exception 'coach_review_reason_required';end if;
 select user_id into u from public.coach_operations where id=p_operation;
 if u is null or u=auth.uid() then raise exception 'coach_not_authorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 select * into o from public.coach_operations where id=p_operation for update;
 if o.state<>'pending_review' or o.review_decision is not null then raise exception 'coach_review_not_pending';end if;
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 if coach_private.require_context(u) is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id;
 if i.row_version<>o.intake_version or i.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_changed';end if;
 update public.coach_operations set state=case when p_approve then 'ready' else 'rejected' end,
 review_decision=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=btrim(p_reason),updated_at=now() where id=o.id returning * into o;
 return o;
end $function$;

CREATE OR REPLACE FUNCTION public.authorize_coach_retry(p_operation uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare o public.coach_operations;u uuid;
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'coach_review_reason_required';end if;
 select user_id into u from public.coach_operations where id=p_operation;
 if u is null or u=auth.uid() then raise exception 'coach_not_authorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 select * into o from public.coach_operations where id=p_operation for update;
 if o.state not in ('failed','stale','rejected','athlete_declined') or not coach_private.allowed(u)
 or exists(select 1 from public.coach_operations where user_id=u and state in ('reserved','pending_review','ready','accepted'))
 or exists(select 1 from public.coach_operations where retry_source=o.id)
 then raise exception 'coach_retry_unavailable';end if;
 perform coach_private.require_context(u);
 if o.retry_authorized_at is not null then return true;end if;
 update public.coach_operations set retry_authorized_by=auth.uid(),retry_authorized_at=now(),retry_reason=btrim(p_reason),updated_at=now() where id=o.id;
 return true;
end $function$;

alter function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean) owner to postgres;
revoke all on function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean) to authenticated;
revoke all on all functions in schema coach_private from public,anon,authenticated,service_role;
commit;
