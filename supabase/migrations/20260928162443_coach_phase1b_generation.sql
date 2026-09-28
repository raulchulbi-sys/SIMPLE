-- Phase 1B: staging only. Same six tables; no changes to legacy functions/policies/data.
alter table public.coach_operations add column generation_started_at timestamptz,
 add column latency_ms int check(latency_ms between 0 and 300000),
 add column provider_attempts jsonb check(provider_attempts is null or jsonb_typeof(provider_attempts)='array');
alter table public.coach_operations drop constraint coach_operations_error_code_check;
alter table public.coach_operations add constraint coach_operations_error_code_check check(error_code is null or error_code in
 ('technical_error','reservation_expired','context_changed','intake_changed','safety_review_required','configuration_error',
 'provider_timeout','provider_network','provider_rate_limit','provider_unavailable','provider_rejected','provider_incomplete','provider_refusal','invalid_output','quality_rejected'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1'));
alter table public.context_grants alter column notice_version set default 'pilot-openai-v1';
alter table public.routine_revisions drop constraint routine_revisions_author_kind_check;
alter table public.routine_revisions add constraint routine_revisions_author_kind_check check(author_kind in ('mock','model'));

create or replace function coach_private.require_context(u uuid) returns uuid[] language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare ids uuid[];
begin
 select array_agg(id order by scope) into ids from public.context_grants
 where user_id=u and revoked_at is null and notice_version='pilot-openai-v1';
 if coalesce(array_length(ids,1),0)<>2 then raise exception 'coach_context_required';end if;
 return ids;
end $$;

-- Single claim, no lease reuse: a crashed request must expire before a new operation is possible.
create function public.coach_backend_claim(p_user uuid,p_operation uuid,p_model text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;ctx jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 if p_model is null or p_model not in ('gpt-5-mini-2025-08-07','gpt-5.4-2026-03-05') then raise exception 'coach_invalid_model';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=p_user for update;
 if not found then raise exception 'coach_operation_unavailable';end if;
 if o.state<>'reserved' or o.generation_started_at is not null then return jsonb_build_object('claimed',false);end if;
 ctx:=public.coach_backend_context(p_user,p_operation);
 update public.coach_operations set generation_started_at=clock_timestamp(),model_provider='openai',model_name=p_model,
 prompt_version='basic-initial-v1',output_schema_version=1,updated_at=now(),expires_at=now()+interval '110 seconds' where id=o.id;
 return jsonb_build_object('claimed',true,'context',ctx);
end $$;
revoke all on function public.coach_backend_claim(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.coach_backend_claim(uuid,uuid,text) to service_role;

-- Remove old mock finalization route: only the real Edge with audited metadata can finish.
drop function public.coach_backend_finish(uuid,uuid,jsonb,text);
create function public.coach_backend_finish(p_user uuid,p_operation uuid,p_proposal jsonb,p_error text,p_latency_ms int,p_attempts jsonb)
returns public.coach_operations language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;ctx jsonb;a jsonb;tin int:=0;tout int:=0;cached int:=0;all_usage boolean:=true;cost numeric;err text:=p_error;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=p_user for update;
 if not found or o.generation_started_at is null then raise exception 'coach_operation_unavailable';end if;
 -- A completed receipt is immutable; a duplicate/late finisher cannot replace it.
 if o.provider_attempts is not null then return o;end if;
 if p_latency_ms is null or p_latency_ms not between 0 and 300000 or jsonb_typeof(p_attempts) is distinct from 'array'
 then raise exception 'coach_invalid_metadata';end if;
 if jsonb_array_length(p_attempts)>2 then raise exception 'coach_invalid_metadata';end if;
 for a in select value from jsonb_array_elements(p_attempts) loop
  if not coalesce(coach_private.keys_exact(a,array['status','latency_ms','input_tokens','output_tokens','cached_input_tokens','error_code']),false)
   or not coach_private.valid_int(a->'status',0,599) or not coach_private.valid_int(a->'latency_ms',0,300000)
   or not (a->'error_code'='null'::jsonb or a->>'error_code' in ('provider_timeout','provider_network','provider_rate_limit','provider_unavailable','provider_rejected','provider_incomplete','provider_refusal','invalid_output','quality_rejected'))
   then raise exception 'coach_invalid_metadata';end if;
  if a->'input_tokens'='null'::jsonb and a->'output_tokens'='null'::jsonb and a->'cached_input_tokens'='null'::jsonb then all_usage:=false;
  else
   if not coach_private.valid_int(a->'input_tokens',0,1000000) or not coach_private.valid_int(a->'output_tokens',0,1000000)
    or not coach_private.valid_int(a->'cached_input_tokens',0,1000000) or (a->>'cached_input_tokens')::int>(a->>'input_tokens')::int
    then raise exception 'coach_invalid_metadata';end if;
   tin:=tin+(a->>'input_tokens')::int;tout:=tout+(a->>'output_tokens')::int;cached:=cached+(a->>'cached_input_tokens')::int;
  end if;
 end loop;
 if err is not null and err not in ('technical_error','safety_review_required','configuration_error','provider_timeout','provider_network','provider_rate_limit','provider_unavailable','provider_rejected','provider_incomplete','provider_refusal','invalid_output','quality_rejected') then raise exception 'coach_invalid_error';end if;
 if err is null and (jsonb_array_length(p_attempts)=0 or (p_attempts->-1->>'status')::int<>200 or p_attempts->-1->'error_code'<>'null'::jsonb) then raise exception 'coach_invalid_metadata';end if;
 if all_usage then
  cost:=case o.model_name when 'gpt-5-mini-2025-08-07' then ((tin-cached)*0.25+cached*0.025+tout*2)/1000000
   when 'gpt-5.4-2026-03-05' then ((tin-cached)*2.5+cached*0.25+tout*15)/1000000 end;
 end if;
 -- Record usage even when consent/intake was changed during the request, without reviving its proposal.
 update public.coach_operations set latency_ms=p_latency_ms,provider_attempts=p_attempts,input_tokens=case when all_usage then tin end,
 output_tokens=case when all_usage then tout end,estimated_cost=cost,completed_at=clock_timestamp(),updated_at=now() where id=o.id returning * into o;
 if o.state<>'reserved' then return o;end if;
 if o.expires_at<=now() then err:='reservation_expired';
 else
  begin ctx:=public.coach_backend_context(p_user,p_operation);
  exception when others then err:='context_changed';end;
 end if;
 if err is null then
  begin
   perform coach_private.validate_proposal(p_proposal);
   if jsonb_array_length(p_proposal->'days')<>(ctx->'training'->>'days')::int then raise exception 'coach_days_mismatch';end if;
  exception when others then err:='invalid_output';end;
 end if;
 update public.coach_operations set state=case when err is null then 'ready' else 'failed' end,error_code=err,
 proposal=case when err is null then p_proposal else null end where id=o.id returning * into o;
 return o;
end $$;
revoke all on function public.coach_backend_finish(uuid,uuid,jsonb,text,int,jsonb) from public,anon,authenticated;
grant execute on function public.coach_backend_finish(uuid,uuid,jsonb,text,int,jsonb) to service_role;

create or replace function public.set_my_coach_context_permission(p_scope text,p_allow boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();
begin
 if p_scope not in ('training_intake','declared_health') or p_scope is null or p_allow is null then raise exception 'coach_invalid_scope';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if p_allow then
  update public.context_grants set revoked_at=now() where user_id=u and scope=p_scope and revoked_at is null and notice_version<>'pilot-openai-v1';
  insert into public.context_grants(user_id,scope) values(u,p_scope)
  on conflict(user_id,scope) where revoked_at is null do nothing;
 else
  update public.context_grants set revoked_at=now() where user_id=u and scope=p_scope and revoked_at is null;
  update public.coach_operations set state='stale',error_code='context_changed',updated_at=now()
   where user_id=u and state in ('reserved','ready');
 end if;
 return p_allow;
end $$;
create or replace function public.accept_basic_plan(p_operation uuid) returns uuid language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();o public.coach_operations;i public.training_intakes;g uuid[];
 rid uuid;did uuid;eid uuid;rev uuid:=gen_random_uuid();d jsonb;e jsonb;dn int:=0;en int;
 snap jsonb;sdays jsonb:='[]';sex jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=u for update;
 if not found then raise exception 'coach_not_authorized' using errcode='42501';end if;
 if o.state='accepted' then return o.routine_id;end if;
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 if o.state<>'ready' then raise exception 'coach_proposal_not_ready';end if;
 g:=coach_private.require_context(u);
 if g is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id and user_id=u and state='submitted' and row_version=o.intake_version;
 if not found or i.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_changed';end if;
 perform coach_private.validate_proposal(o.proposal);
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 insert into public.routines(owner_id,name,description,routine_order)
 values(u,o.proposal->>'name',o.proposal->>'description',
 coalesce((select max(routine_order)+1 from public.routines where owner_id=u),0)) returning id into rid;
 for d in select value from jsonb_array_elements(o.proposal->'days') loop
  insert into public.routine_days(routine_id,name,day_order) values(rid,d->>'name',dn) returning id into did;
  en:=0;sex:='[]';
  for e in select value from jsonb_array_elements(d->'exercises') loop
   insert into public.routine_exercises(day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)
   values(did,e->>'name',(e->>'sets')::int,(e->>'reps_min')||'-'||(e->>'reps_max'),e->>'rir',(e->>'rest_seconds')::int,en,null)
   returning id into eid;
   sex:=sex||jsonb_build_array(e||jsonb_build_object('id',eid,'day_id',did,'exercise_order',en));en:=en+1;
  end loop;
  sdays:=sdays||jsonb_build_array(jsonb_build_object('id',did,'routine_id',rid,'name',d->>'name','day_order',dn,'exercises',sex));dn:=dn+1;
 end loop;
 snap:=jsonb_build_object('id',rid,'owner_id',u,'name',o.proposal->>'name','description',o.proposal->>'description','days',sdays);
 insert into public.routine_revisions(id,routine_id,user_id,operation_id,snapshot,snapshot_hash,accepted_by,author_kind,reason)
 values(rev,rid,u,o.id,snap,md5(snap::text),u,case when o.model_provider='openai' then 'model' else 'mock' end,'Explicit acceptance of Basic initial proposal');
 insert into public.routine_management(routine_id,user_id,operation_id,current_revision_id) values(rid,u,o.id,rev);
 update public.coach_operations set state='accepted',routine_id=rid,accepted_at=now(),updated_at=now() where id=o.id;
 return rid;
end $$;
create or replace function public.reserve_basic_generation(p_intake_id uuid,p_key uuid)
returns public.coach_operations language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();i public.training_intakes;o public.coach_operations;g uuid[];
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

 select * into o from public.coach_operations where user_id=u and state in ('reserved','ready','accepted');
 if found then return o;end if;
 if (select count(*) from public.coach_operations where user_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'coach_rate_limit';end if;
 insert into public.coach_operations(user_id,intake_id,intake_version,idempotency_key,state,grant_ids)
 values(u,i.id,i.row_version,p_key,'reserved',g) returning * into o;
 return o;
end $$;
