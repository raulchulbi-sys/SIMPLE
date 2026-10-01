BEGIN; DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.training_intakes WHERE schema_version=2) THEN RAISE EXCEPTION 'Retain v2 compatibility while v2 records exist; do not delete historical intakes'; END IF; END $$;
CREATE OR REPLACE FUNCTION coach_private.validate_intake(t jsonb, h jsonb)
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
CREATE OR REPLACE FUNCTION public.save_my_training_intake(p_id uuid, p_expected bigint, p_training jsonb, p_health jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS training_intakes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
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
 prompt_version='basic-initial-v2',output_schema_version=1,updated_at=now(),expires_at=now()+interval '110 seconds' where id=o.id;
 return jsonb_build_object('claimed',true,'context',ctx);
end $function$
;
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
 'training',jsonb_build_object('goal',i.training->'goal','experience',i.training->'experience','days',i.training->'days',
 'minutes',i.training->'minutes','equipment',i.training->'equipment','preferred',i.training->'preferred','avoided',i.training->'avoided','preferences',i.training->'preferences'),
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id
 where o.user_id<>auth.uid() and cardinality(o.grant_ids)=1
 and o.grant_ids=coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and scope='training_intake'
 and revoked_at is null and notice_version='pilot-supervised-v2'),'{}'::uuid[])),'[]'::jsonb);
end $function$
;
ALTER TABLE public.training_intakes DROP CONSTRAINT training_intakes_version_payload_check; ALTER TABLE public.training_intakes DROP CONSTRAINT training_intakes_schema_version_check; ALTER TABLE public.training_intakes ADD CONSTRAINT training_intakes_schema_version_check CHECK(schema_version=1);
DROP FUNCTION coach_private.validate_intake_v1(jsonb,jsonb);
DROP FUNCTION coach_private.validate_basic_intake_v2(jsonb,boolean);
DROP FUNCTION coach_private.basic_intake_schema();
DROP FUNCTION coach_private.intake_shape_matches(jsonb,jsonb);
COMMIT;
