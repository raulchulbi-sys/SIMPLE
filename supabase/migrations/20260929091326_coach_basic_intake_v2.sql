-- Basic intake v2. Staging candidate only. Existing rows and reviewer stay unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION coach_private.intake_shape_matches(v jsonb,s jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,coach_private AS $fn$
declare k text; item jsonb;
begin
 if v is null then return false;end if;
 if s ? 'enum' then return exists(select 1 from jsonb_array_elements(s->'enum') e where e=v);end if;
 if jsonb_typeof(v) is distinct from s->>'type' then return false;end if;
 if s->>'type'='object' then
  if (select count(*) from jsonb_object_keys(v))<>(select count(*) from jsonb_object_keys(s->'properties')) then return false;end if;
  for k in select jsonb_object_keys(s->'properties') loop if not coach_private.intake_shape_matches(v->k,s->'properties'->k) then return false;end if;end loop;
 elsif s->>'type'='array' then
  if jsonb_array_length(v)>(s->>'maxItems')::int or (select count(distinct value) from jsonb_array_elements(v))<>jsonb_array_length(v) then return false;end if;
  for item in select value from jsonb_array_elements(v) loop if not coach_private.intake_shape_matches(item,s->'items') then return false;end if;end loop;
 elsif s->>'type'='string' then
  if char_length(v#>>'{}')<(s->>'minLength')::int or char_length(v#>>'{}')>(s->>'maxLength')::int then return false;end if;
 else return false;
 end if;
 return true;
end $fn$;
CREATE OR REPLACE FUNCTION coach_private.basic_intake_schema() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$ SELECT '{"type":"object","properties":{"schema_version":{"enum":["basic-intake-v2"]},"experience":{"enum":[null,"lt6","m6_12","y1_2","y2_4","gt4"]},"goal":{"enum":[null,"balanced_mass","regain_mass","structured_return"]},"days":{"enum":[null,2,3,4,5,6]},"weekdays":{"type":"array","uniqueItems":true,"maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}},"minutes":{"enum":[null,30,45,60,75,90]},"effort":{"enum":[null,"unknown","learning","confident","habitual"]},"excluded":{"type":"array","uniqueItems":true,"maxItems":20,"items":{"enum":["body_squat","reverse_lunge","glute_bridge","pushup","knee_pushup","dead_bug","bird_dog","calf_raise","goblet","db_rdl","db_row","floor_press","db_shoulder","db_lateral","db_curl","band_row","band_curl","bar_squat","bar_rdl","bar_row","leg_press","leg_curl","pulldown","cable_row","chest_press","cable_triceps","incline_press","convergent_press","pec_deck","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","horizontal_press","leg_extension","seated_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith_squat","bench_press"]}},"activity":{"type":"object","properties":{"type":{"enum":[null,"none","football","running","cycling","crossfit","martial_arts","other_sport","physical_work"]},"weekdays":{"type":"array","uniqueItems":true,"maxItems":7,"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"]}}},"required":["type","weekdays"],"additionalProperties":false},"inventory":{"type":"object","properties":{"equipment":{"type":"array","uniqueItems":true,"maxItems":37,"items":{"enum":["chest_press","incline_press","convergent_press","pec_deck","pulldown","horizontal_row","convergent_row","supported_row","high_row","low_row","pullover","pullup","hack","pendulum","press45","horizontal_press","leg_extension","seated_curl","lying_curl","adductor","abductor","hip_thrust","seated_calf","standing_calf","shoulder_press","lateral","rear_delt","preacher","curl","triceps","smith","bench","barbell","rack","dumbbells","cables","bands"]}},"custom":{"type":"array","uniqueItems":true,"maxItems":10,"items":{"type":"string","minLength":2,"maxLength":40}}},"required":["equipment","custom"],"additionalProperties":false}},"required":["schema_version","experience","goal","days","weekdays","minutes","effort","excluded","activity","inventory"],"additionalProperties":false}'::jsonb $fn$;
CREATE OR REPLACE FUNCTION coach_private.validate_basic_intake_v2(t jsonb,complete boolean) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,coach_private AS $fn$
declare k text; s text;
begin
 if complete is null or not coach_private.intake_shape_matches(t,coach_private.basic_intake_schema()) then raise exception 'coach_invalid_intake';end if;
 if complete then
  foreach k in array array['experience','goal','days','minutes','effort'] loop if t->k='null'::jsonb then raise exception 'coach_invalid_intake';end if;end loop;
  if jsonb_array_length(t->'weekdays')<>(t->>'days')::int or t->'activity'->'type'='null'::jsonb then raise exception 'coach_invalid_intake';end if;
  if t->'activity'->>'type'<>'none' and jsonb_array_length(t->'activity'->'weekdays')=0 then raise exception 'coach_invalid_intake';end if;
 end if;
 if jsonb_array_length(t->'weekdays')>coalesce((t->>'days')::int,0) then raise exception 'coach_invalid_intake';end if;
 if (t->'activity'->>'type' is null or t->'activity'->>'type'='none') and jsonb_array_length(t->'activity'->'weekdays')<>0 then raise exception 'coach_invalid_intake';end if;
 if (select count(distinct lower(value)) from jsonb_array_elements_text(t->'inventory'->'custom'))<>jsonb_array_length(t->'inventory'->'custom') then raise exception 'coach_invalid_intake';end if;
 for s in select value from jsonb_array_elements_text(t->'inventory'->'custom') loop
  if s !~ '^[[:alnum:] ()º°+./-]+$' or s ~* '[0-9]{5}|https?|www[.]|dolor|lesi[oó]n|diagn[oó]st|medic|cirug|@' then raise exception 'coach_invalid_intake';end if;
 end loop;
end $fn$;
CREATE OR REPLACE FUNCTION coach_private.validate_intake_v1(t jsonb, h jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'coach_private'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.validate_intake(t jsonb,h jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,coach_private AS $fn$
begin
 if h is not null and h<>'{}'::jsonb then raise exception 'coach_health_disabled';end if;
 if t->>'schema_version'='basic-intake-v2' then perform coach_private.validate_basic_intake_v2(t,true);else perform coach_private.validate_intake_v1(t,h);end if;
end $fn$;
CREATE OR REPLACE FUNCTION public.save_my_training_intake(p_id uuid, p_expected bigint, p_training jsonb, p_health jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS training_intakes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare u uuid:=coach_private.actor();r public.training_intakes;next_rev int;sv int;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 perform coach_private.require_context(u);
 if p_health is not null and p_health<>'{}'::jsonb then raise exception 'coach_health_disabled';end if;
 if p_training->>'schema_version'='basic-intake-v2' then
  perform coach_private.validate_basic_intake_v2(p_training,p_submit);sv:=2;
 else perform coach_private.validate_intake_v1(p_training,p_health);sv:=1;end if;
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
  insert into public.training_intakes(user_id,revision,schema_version,state,training,submitted_at)
  values(u,next_rev,sv,case when p_submit then 'submitted' else 'draft' end,p_training,case when p_submit then now() end) returning * into r;
 else
  update public.training_intakes set training=p_training,schema_version=sv,row_version=row_version+1,updated_at=now(),
   state=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() end where id=r.id returning * into r;
 end if;
 -- No insert, upsert, copy, or return of intake_health in v2.
 update public.coach_operations set state='stale',error_code='intake_changed',updated_at=now()
 where user_id=u and state in ('reserved','pending_review','ready');
 return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.coach_backend_context(p_user uuid, p_operation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
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
 if i.schema_version=2 then return jsonb_build_object('training',jsonb_build_object(
 'schema_version','basic-intake-v2','experience',t->'experience','goal',t->'goal','days',t->'days','weekdays',t->'weekdays','minutes',t->'minutes','effort',t->'effort','excluded',t->'excluded',
 'activity',jsonb_build_object('type',t->'activity'->'type','weekdays',t->'activity'->'weekdays'),
 'inventory',jsonb_build_object('equipment',t->'inventory'->'equipment','custom','[]'::jsonb)));end if;
 -- Explicit positive projection; never select health or other account data.
 return jsonb_build_object('training',jsonb_build_object('goal',t->'goal','experience',t->'experience',
 'days',t->'days','minutes',t->'minutes','equipment',t->'equipment','preferred',t->'preferred','avoided',t->'avoided','preferences',t->'preferences'));
end $function$
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
 prompt_version=case when ctx->'training'->>'schema_version'='basic-intake-v2' then 'basic-initial-v3' else 'basic-initial-v2' end,output_schema_version=1,updated_at=now(),expires_at=now()+interval '110 seconds' where id=o.id;
 return jsonb_build_object('claimed',true,'context',ctx);
end $function$
;
ALTER TABLE public.training_intakes DROP CONSTRAINT training_intakes_schema_version_check;
ALTER TABLE public.training_intakes ADD CONSTRAINT training_intakes_schema_version_check CHECK(schema_version IN(1,2));
ALTER TABLE public.training_intakes ADD CONSTRAINT training_intakes_version_payload_check CHECK((schema_version=1 AND NOT training ? 'schema_version') OR (schema_version=2 AND training->>'schema_version' IS NOT DISTINCT FROM 'basic-intake-v2'));
ALTER FUNCTION coach_private.intake_shape_matches(jsonb,jsonb) OWNER TO postgres; REVOKE ALL ON FUNCTION coach_private.intake_shape_matches(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION coach_private.basic_intake_schema() OWNER TO postgres; REVOKE ALL ON FUNCTION coach_private.basic_intake_schema() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION coach_private.validate_basic_intake_v2(jsonb,boolean) OWNER TO postgres; REVOKE ALL ON FUNCTION coach_private.validate_basic_intake_v2(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION coach_private.validate_intake_v1(jsonb,jsonb) OWNER TO postgres; REVOKE ALL ON FUNCTION coach_private.validate_intake_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
