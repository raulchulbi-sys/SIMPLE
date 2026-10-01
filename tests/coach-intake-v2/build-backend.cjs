const fs=require('fs'),path=require('path'),I=require('../../assets/coach-intake.js');
const baseline=JSON.parse(fs.readFileSync(__dirname+'/private/baseline.json')),defs=baseline.stage_defs;
const def=name=>defs.find(x=>x.name===name).definition,quote=v=>"'"+v.replaceAll("'","''")+"'";
const en=values=>({enum:[null,...values]}),ids=a=>a.map(x=>x.id),array=(values,max=values.length)=>({type:'array',uniqueItems:true,maxItems:max,items:{enum:values}}),obj=p=>({type:'object',properties:p,required:Object.keys(p),additionalProperties:false});
const schema=obj({schema_version:{enum:['basic-intake-v2']},experience:en(ids(I.experience)),goal:en(ids(I.goals)),days:en([2,3,4,5,6]),weekdays:array(ids(I.weekdays)),minutes:en(I.minutes),effort:en(ids(I.effort)),excluded:array(ids(I.exercises),20),activity:obj({type:en(ids(I.activities)),weekdays:array(ids(I.weekdays))}),inventory:obj({equipment:array(ids(I.equipment)),custom:{type:'array',uniqueItems:true,maxItems:10,items:{type:'string',minLength:2,maxLength:40}}})});
fs.writeFileSync(__dirname+'/basic-intake-v2.schema.json',JSON.stringify(schema,null,2));
let sql=`-- Basic intake v2. Staging candidate only. Existing rows and reviewer stay unchanged.
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
CREATE OR REPLACE FUNCTION coach_private.basic_intake_schema() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$ SELECT ${quote(JSON.stringify(schema))}::jsonb $fn$;
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
${def('validate_intake').replace('coach_private.validate_intake(', 'coach_private.validate_intake_v1(')};
CREATE OR REPLACE FUNCTION coach_private.validate_intake(t jsonb,h jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,coach_private AS $fn$
begin
 if h is not null and h<>'{}'::jsonb then raise exception 'coach_health_disabled';end if;
 if t->>'schema_version'='basic-intake-v2' then perform coach_private.validate_basic_intake_v2(t,true);else perform coach_private.validate_intake_v1(t,h);end if;
end $fn$;
`;
let save=def('save_my_training_intake').replace('next_rev int;','next_rev int;sv int;');
save=save.replace('perform coach_private.validate_intake(p_training,p_health);',`if p_health is not null and p_health<>'{}'::jsonb then raise exception 'coach_health_disabled';end if;
 if p_training->>'schema_version'='basic-intake-v2' then
  perform coach_private.validate_basic_intake_v2(p_training,p_submit);sv:=2;
 else perform coach_private.validate_intake_v1(p_training,p_health);sv:=1;end if;`);
save=save.replace('training_intakes(user_id,revision,state,training,submitted_at)','training_intakes(user_id,revision,schema_version,state,training,submitted_at)').replace('values(u,next_rev,case','values(u,next_rev,sv,case').replace('set training=p_training,row_version','set training=p_training,schema_version=sv,row_version');
let context=def('coach_backend_context').replace('t:=i.training;',`t:=i.training;
 if i.schema_version=2 then return jsonb_build_object('training',jsonb_build_object(
 'schema_version','basic-intake-v2','experience',t->'experience','goal',t->'goal','days',t->'days','weekdays',t->'weekdays','minutes',t->'minutes','effort',t->'effort','excluded',t->'excluded',
 'activity',jsonb_build_object('type',t->'activity'->'type','weekdays',t->'activity'->'weekdays'),
 'inventory',jsonb_build_object('equipment',t->'inventory'->'equipment','custom','[]'::jsonb)));end if;`);
let claim=def('coach_backend_claim').replace("prompt_version='basic-initial-v2'","prompt_version=case when ctx->'training'->>'schema_version'='basic-intake-v2' then 'basic-initial-v3' else 'basic-initial-v2' end");
sql+=save+';\n'+context+';\n'+claim+';\n';
sql+=`ALTER TABLE public.training_intakes DROP CONSTRAINT training_intakes_schema_version_check;
ALTER TABLE public.training_intakes ADD CONSTRAINT training_intakes_schema_version_check CHECK(schema_version IN(1,2));
ALTER TABLE public.training_intakes ADD CONSTRAINT training_intakes_version_payload_check CHECK((schema_version=1 AND NOT training ? 'schema_version') OR (schema_version=2 AND training->>'schema_version' IS NOT DISTINCT FROM 'basic-intake-v2'));
`;
for(const [name,args] of [['intake_shape_matches','jsonb,jsonb'],['basic_intake_schema',''],['validate_basic_intake_v2','jsonb,boolean'],['validate_intake_v1','jsonb,jsonb']])sql+=`ALTER FUNCTION coach_private.${name}(${args}) OWNER TO postgres; REVOKE ALL ON FUNCTION coach_private.${name}(${args}) FROM PUBLIC,anon,authenticated,service_role;\n`;
sql+='COMMIT;\n';fs.writeFileSync(__dirname+'/private/candidate.sql',sql);
// Data-preserving rollback: refuses if new-version rows exist; never deletes or reinterprets them.
let rollback=`BEGIN; DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.training_intakes WHERE schema_version=2) THEN RAISE EXCEPTION 'Retain v2 compatibility while v2 records exist; do not delete historical intakes'; END IF; END $$;\n`;
for(const n of ['validate_intake','save_my_training_intake','coach_backend_context','coach_backend_claim','get_coach_review_queue'])rollback+=def(n)+';\n';
rollback+=`ALTER TABLE public.training_intakes DROP CONSTRAINT training_intakes_version_payload_check; ALTER TABLE public.training_intakes DROP CONSTRAINT training_intakes_schema_version_check; ALTER TABLE public.training_intakes ADD CONSTRAINT training_intakes_schema_version_check CHECK(schema_version=1);\n`;
for(const [name,args] of [['validate_intake_v1','jsonb,jsonb'],['validate_basic_intake_v2','jsonb,boolean'],['basic_intake_schema',''],['intake_shape_matches','jsonb,jsonb']])rollback+=`DROP FUNCTION coach_private.${name}(${args});\n`;
fs.writeFileSync(__dirname+'/rollback.sql',rollback+'COMMIT;\n');
console.log('Prepared versioned validation, four existing function changes, schema check and guarded rollback. No remote writes.');
