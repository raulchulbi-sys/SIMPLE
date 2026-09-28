-- Coach pilot v2: structured training only. No pilot/reviewer configuration or central data changes.
-- Health capability remains installed but unavailable to this pilot.
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check
 check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2'));
alter table public.context_grants alter column notice_version set default 'pilot-supervised-v2';
revoke select on public.intake_health from authenticated;

create or replace function coach_private.validate_intake(t jsonb,h jsonb) returns void
language plpgsql immutable set search_path=pg_catalog,coach_private as $$
declare v jsonb;k text;names text[];all_names text[]:=array[
 'Sentadilla con peso corporal','Zancada atrás','Puente de glúteos','Flexiones','Flexiones de rodillas',
 'Dead bug','Bird dog','Elevación de talones','Sentadilla goblet','Peso muerto rumano con mancuernas',
 'Remo con mancuerna','Press de suelo con mancuernas','Press de hombros con mancuernas','Elevaciones laterales',
 'Curl con mancuernas','Remo con banda','Curl con banda','Sentadilla con barra','Peso muerto rumano con barra',
 'Remo con barra','Prensa de piernas','Curl femoral','Jalón al pecho','Remo en polea','Press de pecho en máquina','Extensión de tríceps en polea'];
begin
 if h is not null and h<>'{}'::jsonb then raise exception 'coach_health_disabled';end if;
 if not coalesce(coach_private.keys_exact(t,array['goal','experience','days','minutes','equipment','preferred','avoided','preferences']),false)
 then raise exception 'coach_invalid_intake';end if;
 if jsonb_typeof(t->'goal') is distinct from 'string' or t->>'goal' not in ('Fuerza general','Ganar masa muscular','Mejorar condición física')
 or jsonb_typeof(t->'experience') is distinct from 'string' or t->>'experience' not in ('beginner','intermediate','experienced')
 or not coach_private.valid_int(t->'days',1,5)
 or not coach_private.valid_int(t->'minutes',30,90) or (t->>'minutes')::int%15<>0
 or jsonb_typeof(t->'equipment') is distinct from 'array'
 or t->'preferences' is distinct from '""'::jsonb
 then raise exception 'coach_invalid_intake';end if;
 if jsonb_array_length(t->'equipment') not between 1 and 5
 or (select count(distinct value) from jsonb_array_elements(t->'equipment'))<>jsonb_array_length(t->'equipment')
 then raise exception 'coach_invalid_intake';end if;
 for v in select value from jsonb_array_elements(t->'equipment') loop
  if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('Gimnasio','Mancuernas','Bandas','Barra','Peso corporal')
  then raise exception 'coach_invalid_intake';end if;
 end loop;
 foreach k in array array['preferred','avoided'] loop
  if jsonb_typeof(t->k) is distinct from 'string' or char_length(t->>k)>600 then raise exception 'coach_invalid_intake';end if;
  if t->>k<>'' then
   names:=string_to_array(t->>k,', ');
   if not names<@all_names or cardinality(names)<>(select count(distinct n) from unnest(names) n)
   then raise exception 'coach_invalid_intake';end if;
  end if;
 end loop;
 if string_to_array(t->>'preferred',', ') && string_to_array(t->>'avoided',', ') then raise exception 'coach_invalid_intake';end if;
end $$;

create or replace function coach_private.require_context(u uuid) returns uuid[]
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare ids uuid[];
begin
 select array_agg(id) into ids from public.context_grants where user_id=u and scope='training_intake'
 and revoked_at is null and notice_version='pilot-supervised-v2';
 if coalesce(cardinality(ids),0)<>1 then raise exception 'coach_context_required';end if;
 return ids;
end $$;

-- Evaluate expiry after an advisory-lock wait using wall-clock time, not transaction start time.
create or replace function coach_private.allowed(u uuid) returns boolean
language sql volatile security definer set search_path=pg_catalog,public,coach_private as $$
 select coalesce((coach_private.pilot_config()->u::text->>'enabled')::boolean,false)
 and coalesce((coach_private.pilot_config()->u::text->>'activated_at')::timestamptz<=clock_timestamp(),true)
 and coalesce((coach_private.pilot_config()->u::text->>'adult_confirmed')::boolean,false)
 and coalesce((coach_private.pilot_config()->u::text->>'expires_at')::timestamptz>clock_timestamp(),false)
 and exists(select 1 from public.profiles where id=u and role='client')
$$;
create or replace function coach_private.is_reviewer(u uuid) returns boolean
language sql volatile security definer set search_path=pg_catalog,coach_private as $$
 select coalesce((coach_private.reviewer_config()->u::text->>'enabled')::boolean,false)
 and coalesce((coach_private.reviewer_config()->u::text->>'expires_at')::timestamptz>clock_timestamp(),false)
$$;

create or replace function public.set_my_coach_context_permission(p_scope text,p_allow boolean) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();revoked_ids uuid[];
begin
 if p_scope not in ('training_intake','declared_health') or p_scope is null or p_allow is null then raise exception 'coach_invalid_scope';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if p_allow then
  if p_scope='declared_health' then raise exception 'coach_health_disabled';end if;
  if not coach_private.allowed(u) then raise exception 'coach_pilot_required' using errcode='42501';end if;
  select array_agg(id) into revoked_ids from public.context_grants where user_id=u and scope=p_scope and revoked_at is null and notice_version<>'pilot-supervised-v2';
  update public.context_grants set revoked_at=now() where id=any(coalesce(revoked_ids,'{}'::uuid[]));
  insert into public.context_grants(user_id,scope,notice_version) values(u,p_scope,'pilot-supervised-v2')
  on conflict(user_id,scope) where revoked_at is null do nothing;
 else
  select array_agg(id) into revoked_ids from public.context_grants where user_id=u and scope=p_scope and revoked_at is null;
  update public.context_grants set revoked_at=now() where id=any(coalesce(revoked_ids,'{}'::uuid[]));
  if p_scope='declared_health' then
   delete from public.intake_health h using public.training_intakes i
   where h.intake_id=i.id and h.user_id=u and i.user_id=u and i.state='draft';
  end if;
 end if;
 -- Revocation of a scope absent from an A-only operation must not invalidate that operation.
 update public.coach_operations set state='stale',error_code='context_changed',updated_at=now()
 where user_id=u and state in ('reserved','pending_review','ready') and grant_ids && coalesce(revoked_ids,'{}'::uuid[]);
 return p_allow;
end $$;

create or replace function public.save_my_training_intake(p_id uuid,p_expected bigint,p_training jsonb,p_health jsonb default null,p_submit boolean default false)
returns public.training_intakes language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();r public.training_intakes;next_rev int;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 perform coach_private.require_context(u);
 perform coach_private.validate_intake(p_training,p_health);
 if p_submit is null then raise exception 'coach_invalid_intake';end if;
 if p_id is null and exists(select 1 from public.training_intakes where user_id=u) then raise exception 'coach_intake_conflict';end if;
 if p_id is not null then
  select * into r from public.training_intakes where id=p_id and user_id=u for update;
  if not found then raise exception 'coach_not_authorized' using errcode='42501';end if;
  if r.revision<>(select max(revision) from public.training_intakes where user_id=u) or r.row_version is distinct from p_expected then raise exception 'coach_intake_conflict';end if;
 end if;
 if p_id is null or r.state='submitted' then
  if exists(select 1 from public.training_intakes where user_id=u and state='draft') then raise exception 'coach_intake_conflict';end if;
  select coalesce(max(revision),0)+1 into next_rev from public.training_intakes where user_id=u;
  insert into public.training_intakes(user_id,revision,state,training,submitted_at)
  values(u,next_rev,case when p_submit then 'submitted' else 'draft' end,p_training,case when p_submit then now() end) returning * into r;
 else
  update public.training_intakes set training=p_training,row_version=row_version+1,updated_at=now(),
   state=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() end where id=r.id returning * into r;
 end if;
 -- No insert, upsert, copy, or return of intake_health in v2.
 update public.coach_operations set state='stale',error_code='intake_changed',updated_at=now()
 where user_id=u and state in ('reserved','pending_review','ready');
 return r;
end $$;

create function public.delete_my_training_intake(p_id uuid,p_expected bigint) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();i public.training_intakes;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 select * into i from public.training_intakes where id=p_id and user_id=u for update;
 if not found then raise exception 'coach_not_authorized' using errcode='42501';end if;
 if i.state<>'draft' or i.row_version is distinct from p_expected
 or exists(select 1 from public.coach_operations where intake_id=i.id)
 then raise exception 'coach_draft_delete_unavailable';end if;
 delete from public.intake_health where intake_id=i.id and user_id=u;
 delete from public.training_intakes where id=i.id and user_id=u;
 return true;
end $$;

create or replace function public.coach_backend_context(p_user uuid,p_operation uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;i public.training_intakes;g uuid[];t jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 if not coach_private.allowed(p_user) then raise exception 'coach_pilot_required';end if;
 select * into o from public.coach_operations where id=p_operation and user_id=p_user and state='reserved' and expires_at>clock_timestamp();
 if not found then raise exception 'coach_operation_unavailable';end if;
 g:=coach_private.require_context(p_user);
 if g is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id and user_id=p_user and row_version=o.intake_version and state='submitted';
 if not found or i.revision<>(select max(revision) from public.training_intakes where user_id=p_user) then raise exception 'coach_intake_changed';end if;
 perform coach_private.validate_intake(i.training,null);
 t:=i.training;
 -- Explicit positive projection; never select health or other account data.
 return jsonb_build_object('training',jsonb_build_object('goal',t->'goal','experience',t->'experience',
 'days',t->'days','minutes',t->'minutes','equipment',t->'equipment','preferred',t->'preferred','avoided',t->'avoided','preferences',t->'preferences'));
end $$;

create or replace function public.get_coach_review_queue() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,coach_private as $$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',to_jsonb(o),
 'athlete',jsonb_build_object('user_id',o.user_id,'name',(select p.name from public.profiles p where p.id=o.user_id)),
 'training',jsonb_build_object('goal',i.training->'goal','experience',i.training->'experience','days',i.training->'days',
 'minutes',i.training->'minutes','equipment',i.training->'equipment','preferred',i.training->'preferred','avoided',i.training->'avoided','preferences',i.training->'preferences'),
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id
 where o.user_id<>auth.uid() and cardinality(o.grant_ids)=1
 and o.grant_ids=coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and scope='training_intake'
 and revoked_at is null and notice_version='pilot-supervised-v2'),'{}'::uuid[])),'[]'::jsonb);
end $$;

create function public.get_coach_reviewer_status() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,coach_private as $$
declare u uuid:=auth.uid();enabled boolean;
begin
 if u is null then raise exception 'coach_not_authorized' using errcode='42501';end if;
 enabled:=coach_private.is_reviewer(u);
 return jsonb_build_object('authorized',enabled,'expires_at',case when enabled then coach_private.reviewer_config()->u::text->>'expires_at' else null end);
end $$;

create or replace function public.get_my_coach_access() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();o public.coach_operations;
begin
 select * into o from public.coach_operations where user_id=u order by created_at desc,id desc limit 1;
 return jsonb_build_object('authorized',coach_private.allowed(u),'plan','basic_pilot','premium',false,
 'generation_consumed',o.id is not null,'health_enabled',false,'notice_version','pilot-supervised-v2',
 'can_feedback',exists(select 1 from public.routine_management m join public.workouts w on w.user_id=m.user_id and w.data->>'routine_id'=m.routine_id::text where m.user_id=u),
 'has_feedback',exists(select 1 from public.coach_pilot_feedback where user_id=u),
 'can_generate',coach_private.allowed(u) and (o.id is null or (o.state in ('failed','stale','rejected','athlete_declined') and o.retry_authorized_at is not null and not exists(select 1 from public.coach_operations where retry_source=o.id))),
 'routine_id',(select routine_id from public.coach_operations where user_id=u and state='accepted'));
end $$;

-- CREATE OR REPLACE preserves existing owners and grants. New entry points default deny.
revoke all on function public.delete_my_training_intake(uuid,bigint),public.get_coach_reviewer_status() from public,anon,authenticated,service_role;
grant execute on function public.delete_my_training_intake(uuid,bigint),public.get_coach_reviewer_status() to authenticated;
revoke all on all functions in schema coach_private from public,anon,authenticated,service_role;

-- Existing operation orchestration with v2 validation and post-lock reviewer expiry checks.

create or replace function public.reserve_basic_generation(p_intake_id uuid, p_key uuid)
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

create or replace function public.authorize_coach_retry(p_operation uuid,p_reason text) returns boolean language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
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
end $$;
