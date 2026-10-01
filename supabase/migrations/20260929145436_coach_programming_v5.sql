-- Basic v5: structured per-set targets in existing proposal/revision JSONB. No historical data rewrite.
BEGIN;
ALTER TABLE public.coach_operations DROP CONSTRAINT coach_operations_output_schema_version_check;
ALTER TABLE public.coach_operations ADD CONSTRAINT coach_operations_output_schema_version_check CHECK (output_schema_version IN (1,2));
CREATE OR REPLACE FUNCTION coach_private.validate_proposal(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'coach_private'
AS $function$
declare d jsonb;e jsonb;s jsonb;n int;v2 boolean:=p->'schema_version'='2'::jsonb;
begin
 if not coalesce(coach_private.keys_exact(p,array['schema_version','name','description','days']),false)
 or not coalesce(p->'schema_version' in ('1'::jsonb,'2'::jsonb),false)
 or not coach_private.valid_text(p->'name',1,100)
 or not coach_private.valid_text(p->'description',0,500)
 or jsonb_typeof(p->'days') is distinct from 'array'
 then raise exception 'coach_invalid_proposal';end if;
 if jsonb_array_length(p->'days') not between 1 and 7 then raise exception 'coach_invalid_proposal';end if;
 for d in select value from jsonb_array_elements(p->'days') loop
  if not coalesce(coach_private.keys_exact(d,array['name','exercises']),false)
  or not coach_private.valid_text(d->'name',1,80)
  or jsonb_typeof(d->'exercises') is distinct from 'array'
  then raise exception 'coach_invalid_proposal';end if;
  if jsonb_array_length(d->'exercises') not between 1 and 8 then raise exception 'coach_invalid_proposal';end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if not coalesce(coach_private.keys_exact(e,case when v2 then array['name','sets','reps_min','reps_max','rir','rest_seconds','scheme','planned_sets'] else array['name','sets','reps_min','reps_max','rir','rest_seconds'] end),false)
   or not coach_private.valid_text(e->'name',1,100)
   or not coach_private.valid_int(e->'sets',1,6)
   or not coach_private.valid_int(e->'reps_min',1,30)
   or not coach_private.valid_int(e->'reps_max',1,30)
   or (e->>'reps_min')::int>(e->>'reps_max')::int
   or not coach_private.valid_int(e->'rir',0,5)
   or not coach_private.valid_int(e->'rest_seconds',0,300)
   then raise exception 'coach_invalid_proposal';end if;
   if v2 then
    if e->>'scheme' not in ('straight','varied','top_backoff') or jsonb_typeof(e->'scheme') is distinct from 'string'
     or jsonb_typeof(e->'planned_sets') is distinct from 'array' then raise exception 'coach_invalid_proposal';end if;
    if jsonb_array_length(e->'planned_sets') not between 1 and 4 or jsonb_array_length(e->'planned_sets')<>(e->>'sets')::int then raise exception 'coach_invalid_proposal';end if;
    n:=0;
    for s in select value from jsonb_array_elements(e->'planned_sets') loop
     n:=n+1;
     if not coalesce(coach_private.keys_exact(s,array['set_number','reps_min','reps_max','rir','rest_seconds']),false)
      or s->'set_number' is distinct from to_jsonb(n)
      or not coach_private.valid_int(s->'reps_min',5,20) or not coach_private.valid_int(s->'reps_max',5,20)
      or (s->>'reps_min')::int>(s->>'reps_max')::int
      or not coach_private.valid_int(s->'rir',0,4) or not coach_private.valid_int(s->'rest_seconds',60,240)
      then raise exception 'coach_invalid_proposal';end if;
     if n=1 and exists(select 1 from unnest(array['reps_min','reps_max','rir','rest_seconds']) k where s->k is distinct from e->k)
      then raise exception 'coach_invalid_proposal';end if;
     if e->>'scheme'='straight' and s-'set_number' is distinct from (e->'planned_sets'->0)-'set_number'
      then raise exception 'coach_invalid_proposal';end if;
     if e->>'scheme'='top_backoff' and n>1 and ((s->>'reps_min')::int<=(e->'planned_sets'->0->>'reps_min')::int or (s->>'reps_max')::int<=(e->'planned_sets'->0->>'reps_max')::int)
      then raise exception 'coach_invalid_proposal';end if;
    end loop;
    if e->>'scheme'='top_backoff' and n<2 then raise exception 'coach_invalid_proposal';end if;
   end if;
  end loop;
 end loop;
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.basic_intake_schema()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ SELECT '{"type":"object","properties":{"schema_version":{"enum":["basic-intake-v2"]},"experience":{"enum":[null,"lt6","m6_12","y1_2","y2_4","gt4"]},"goal":{"enum":[null,"balanced_mass","regain_mass","structured_return"]},"days":{"enum":[null,2,3,4,5,6]},"weekdays":{"type":"array","uniqueItems":true,"maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}},"minutes":{"enum":[null,30,45,60,75,90]},"effort":{"enum":[null,"unknown","learning","confident","habitual"]},"excluded":{"type":"array","uniqueItems":true,"maxItems":20,"items":{"enum":["body_squat","reverse_lunge","glute_bridge","pushup","knee_pushup","dead_bug","bird_dog","calf_raise","goblet","db_rdl","db_row","floor_press","db_shoulder","db_lateral","db_curl","band_row","band_curl","bar_squat","bar_rdl","bar_row","leg_press","leg_curl","pulldown","cable_row","chest_press","cable_triceps","incline_press","convergent_press","pec_deck","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","horizontal_press","leg_extension","seated_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith_squat","bench_press","floor_crunch","reverse_crunch","weighted_crunch","cable_crunch","machine_crunch","ab_wheel"]}},"activity":{"type":"object","properties":{"type":{"enum":[null,"none","football","running","cycling","crossfit","martial_arts","other_sport","physical_work"]},"weekdays":{"type":"array","uniqueItems":true,"maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}}},"required":["type","weekdays"],"additionalProperties":false},"inventory":{"type":"object","properties":{"equipment":{"type":"array","uniqueItems":true,"maxItems":39,"items":{"enum":["chest_press","incline_press","convergent_press","pec_deck","pulldown","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","press45","horizontal_press","leg_extension","seated_curl","lying_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith","bench","barbell","rack","dumbbells","cables","bands","ab_machine","ab_wheel"]}},"custom":{"type":"array","uniqueItems":true,"maxItems":10,"items":{"type":"string","minLength":2,"maxLength":40}}},"required":["equipment","custom"],"additionalProperties":false}},"required":["schema_version","experience","goal","days","weekdays","minutes","effort","excluded","activity","inventory"],"additionalProperties":false}'::jsonb $function$
;
CREATE OR REPLACE FUNCTION public.coach_backend_claim(p_user uuid, p_operation uuid, p_model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare o public.coach_operations;ctx jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 if p_model is null or p_model <> 'gpt-5.4-2026-03-05' then raise exception 'coach_invalid_model';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=p_user for update;
 if not found then raise exception 'coach_operation_unavailable';end if;
 if o.state<>'reserved' or o.generation_started_at is not null then return jsonb_build_object('claimed',false);end if;
 ctx:=public.coach_backend_context(p_user,p_operation);
 update public.coach_operations set generation_started_at=clock_timestamp(),model_provider='openai',model_name=p_model,
 prompt_version=case when ctx->'training'->>'schema_version'='basic-intake-v2' then 'basic-initial-v5' else 'basic-initial-v2' end,output_schema_version=case when ctx->'training'->>'schema_version'='basic-intake-v2' then 2 else 1 end,updated_at=now(),expires_at=now()+interval '110 seconds' where id=o.id;
 return jsonb_build_object('claimed',true,'context',ctx);
end $function$
;
CREATE OR REPLACE FUNCTION public.coach_backend_finish(p_user uuid, p_operation uuid, p_proposal jsonb, p_error text, p_latency_ms integer, p_attempts jsonb)
 RETURNS coach_operations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
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
   if p_proposal->'schema_version' is distinct from to_jsonb(o.output_schema_version) then raise exception 'coach_schema_mismatch';end if;
   if jsonb_array_length(p_proposal->'days')<>(ctx->'training'->>'days')::int then raise exception 'coach_days_mismatch';end if;
  exception when others then err:='invalid_output';end;
 end if;
 update public.coach_operations set state=case when err is null then case when o.review_required then 'pending_review' else 'ready' end else 'failed' end,error_code=err,
 proposal=case when err is null then p_proposal else null end where id=o.id returning * into o;
 return o;
end $function$
;
COMMIT;
