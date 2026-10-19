-- UNPUBLISHED BUG CANDIDATE: isolated test only; no shared DML or business APIs.
-- DRAFT, NOT EXECUTED. Root alone may execute on verified staging.
-- Synthetic isolated-schema compatibility test, NOT JWT/RLS/real-consent evidence.
-- Exact baseline and one-literal candidate bodies with schema references renamed; guard/source
-- helpers below are explicit test doubles, never replacements in public/private.
-- Baseline input helper SHA256 30a8e3c59d22c320f93bb0f56daed9c7b34b46de3cbdf89861959cbc003a5eab; API SHA256 885425e4aea898dc68768648286c9d9347314a1cf9d012d012d0d69368710455.
-- Candidate MD5 is emitted only after the old normalized clone matches installed API fb4f1a322b8666a883184cfd04f1f017.
-- After BEGIN, operator must add BOTH SET LOCAL statements in this transaction:
-- SET LOCAL simple.reviewer_admission_list_project='dmqjexigdnfzobarhnib';
-- SET LOCAL simple.reviewer_admission_list_reviewed='historical-admission-list-isolated-v1';
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $gate$ begin
 if current_setting('simple.reviewer_admission_list_project',true) is distinct from 'dmqjexigdnfzobarhnib'
  or current_setting('simple.reviewer_admission_list_reviewed',true) is distinct from 'historical-admission-list-isolated-v1'
  or current_user<>'postgres' then raise exception 'verified_staging_root_only';end if;
 if to_regnamespace('reviewer_admission_list_test') is not null then raise exception 'exclusive_test_schema_already_exists';end if;
end $gate$;
create schema reviewer_admission_list_test;
revoke all on schema reviewer_admission_list_test from public,anon,authenticated,service_role;
-- LIKE copies column metadata/defaults and CHECKs, never shared rows, FKs or policies.
create table reviewer_admission_list_test.coach_mesocycles (like public.coach_mesocycles including defaults including constraints);
create table reviewer_admission_list_test.coach_mesocycle_weeks (like public.coach_mesocycle_weeks including defaults including constraints);
create table reviewer_admission_list_test.coach_recommendations (like public.coach_recommendations including defaults including constraints);
create table reviewer_admission_list_test.profiles(id uuid primary key,role text not null);
create table reviewer_admission_list_test.results(name text primary key,passed boolean not null);
create function reviewer_admission_list_test.test_actor() returns uuid language sql immutable as $f$ select '00000000-0000-4000-8000-000000000001'::uuid $f$;
create function reviewer_admission_list_test.premium_review_access(id uuid) returns boolean language sql stable as $f$ select current_setting('simple.reviewer_admission_list_scope_allowed',true) is distinct from 'false' and id='00000000-0000-4000-8000-000000000003'::uuid $f$;
create function reviewer_admission_list_test.premium_weekly_visible(id uuid) returns boolean language sql immutable as $f$ select true $f$;
create function reviewer_admission_list_test.premium_chat_recommendation_visible(id uuid) returns boolean language sql immutable as $f$ select true $f$;
-- Deliberately return composite JSON including unknown future columns. This
-- tests the real API's closed projection after a dependency becomes broader.
create function reviewer_admission_list_test.premium_recommendation_view(id uuid) returns jsonb language plpgsql stable as $fixture_view$
declare r reviewer_admission_list_test.coach_recommendations;begin
 select * into r from reviewer_admission_list_test.coach_recommendations where coach_recommendations.id=$1;
 if r.analysis_bundle->>'fixture_guard'='admission_stale' then raise exception 'premium_admission_stale_or_revoked' using errcode='42501';end if;
 if r.analysis_bundle->>'fixture_guard'='chat_stale_checkin' then raise exception 'premium_chat_stale_checkin';end if;
 if r.analysis_bundle->>'fixture_guard'='other_admission_failure' then raise exception 'premium_admission_required' using errcode='42501';end if;
 return to_jsonb(r)||jsonb_build_object('quality_warnings',jsonb_build_array('SYNTHETIC PUBLIC WARNING'));
end $fixture_view$;
create function reviewer_admission_list_test.premium_reviewer_project(v jsonb, shape jsonb) returns jsonb
language plpgsql immutable parallel safe security invoker set search_path=pg_catalog as $project$
declare item record;out_value jsonb;key_name text;kind text;
begin
 if v is null or v='null'::jsonb then return v;end if;
 kind:=jsonb_typeof(shape);
 if kind='string' then
  if jsonb_typeof(v) is distinct from shape#>>'{}' then raise exception 'premium_reviewer_projection_invalid';end if;
  return v;
 elsif kind='object' then
  if jsonb_typeof(v)<>'object' then raise exception 'premium_reviewer_projection_invalid';end if;
  out_value:='{}'::jsonb;
  for item in select key,value from jsonb_each(shape) loop
   key_name:=item.key;
   if v ? key_name then out_value:=out_value||jsonb_build_object(key_name,reviewer_admission_list_test.premium_reviewer_project(v->key_name,item.value));end if;
  end loop;
  return out_value;
 elsif kind='array' and jsonb_array_length(shape)=1 then
  if jsonb_typeof(v)<>'array' then raise exception 'premium_reviewer_projection_invalid';end if;
  out_value:='[]'::jsonb;
  for item in select value from jsonb_array_elements(v) loop
   out_value:=out_value||jsonb_build_array(reviewer_admission_list_test.premium_reviewer_project(item.value,shape->0));
  end loop;
  return out_value;
 end if;
 raise exception 'premium_reviewer_projection_schema_invalid';
end;
$project$;
create function reviewer_admission_list_test.premium_reviewer_state_before(p_mesocycle uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,reviewer_admission_list_test as $state$
declare u uuid:=reviewer_admission_list_test.test_actor();c reviewer_admission_list_test.coach_mesocycles;r reviewer_admission_list_test.coach_recommendations;
 scopes jsonb;weeks jsonb;recs jsonb:='[]'::jsonb;v jsonb;projected jsonb;p jsonb;q jsonb;patches jsonb;
begin
 if u is null or not exists(select 1 from reviewer_admission_list_test.profiles where id=u and role='trainer') then
  raise exception 'premium_not_authorized' using errcode='42501';
 end if;
 if p_mesocycle is null then
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'number',m.number,'state',m.state) order by m.created_at desc,m.id),'[]'::jsonb)
   into scopes from reviewer_admission_list_test.coach_mesocycles m where m.state in ('draft','active') and reviewer_admission_list_test.premium_review_access(m.id);
  return jsonb_build_object('actor','reviewer','scopes',scopes);
 end if;
 select * into c from reviewer_admission_list_test.coach_mesocycles where id=p_mesocycle and reviewer_admission_list_test.premium_review_access(id);
 if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'week_number',w.week_number,'state',w.state,'planned_date',w.planned_date,'revision_id',w.revision_id) order by w.week_number,w.id),'[]'::jsonb)
  into weeks from reviewer_admission_list_test.coach_mesocycle_weeks w where w.mesocycle_id=c.id;
 for r in select rr.* from reviewer_admission_list_test.coach_recommendations rr where rr.mesocycle_id=c.id
  and ((rr.analysis_bundle#>>'{provider,schema_version}') is distinct from 'premium-weekly-provider-v1' or reviewer_admission_list_test.premium_weekly_visible(rr.mesocycle_id))
  and ((rr.analysis_trace->>'origin') is distinct from 'premium_chat' or reviewer_admission_list_test.premium_chat_recommendation_visible(rr.id))
  order by rr.created_at desc,rr.id
 loop
  begin
   -- Preserve the current grant/checkin/revision binding checks and named-series projection.
   v:=reviewer_admission_list_test.premium_recommendation_view(r.id);
  exception
   when sqlstate '42501' then
    if sqlerrm in ('premium_weekly_consent_required','premium_chat_consent_required','premium_chat_context_revoked') then continue;end if;
    raise;
   when raise_exception then
    if sqlerrm in ('premium_weekly_stale_context','premium_weekly_stale_checkin','premium_chat_stale_context','premium_chat_stale_checkin') then continue;end if;
    raise;
  end;
  projected:=reviewer_admission_list_test.premium_reviewer_project(v,'{"id":"string","mesocycle_id":"string","routine_id":"string","kind":"string","state":"string","base_revision_id":"string","result_revision_id":"string","analysis_week":"number","interpretation":"string","review_reason":"string","facts":[{"exercise_ref":"string","exercise_name":"string","claim":"string","observations":[{"date":"string","sets":[{"set_number":"number","kg":"number","reps":"number","rir":"number"}]}]}],"quality_warnings":["string"],"created_at":"string","reviewed_at":"string","accepted_at":"string"}'::jsonb);
  patches:='[]'::jsonb;
  for p in select value from jsonb_array_elements(v->'patches') loop
   q:=reviewer_admission_list_test.premium_reviewer_project(p,'{"field":"string","target_id":"string","exercise_name":"string"}'::jsonb);
   case p->>'field'
    when 'sets','rest_seconds','exercise_order','day_order' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','"number"'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','"number"'::jsonb));
    when 'target','rir','day_id' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','"string"'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','"string"'::jsonb));
    when 'planned_sets' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]'::jsonb));
    when 'weekly_schedule' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','[{"day_id":"string","weekday":"string","minutes":"number"}]'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','[{"day_id":"string","weekday":"string","minutes":"number"}]'::jsonb));
    when 'replace_exercise' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','"string"'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','{"id":"string","catalogue_id":"string","source_catalogue_id":"string","prescription_policy":"string","scheme":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}],"sets":"number","target":"string","rir":"string","rest_seconds":"number"}'::jsonb));
     if p ? 'before_prescription' then q:=q||jsonb_build_object('before_prescription',reviewer_admission_list_test.premium_reviewer_project(p->'before_prescription','{"name":"string","scheme":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}'::jsonb));end if;
    when 'session_distribution' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','{"sessions":[{"name":"string","weekday":"string","minutes":"number","estimated_minutes":"number","exercises":[{"name":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}]}]}'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','{"sessions":[{"name":"string","weekday":"string","minutes":"number","estimated_minutes":"number","exercises":[{"name":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}]}],"quality":{"sets_before":"number","sets_after":"number","muscle_sets_before":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"muscle_sets_after":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"frequency_after":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"schedule":[{"day_id":"string","weekday":"string","minutes":"number"}],"volume_reason":"string","warnings":["string"]},"removed_exercises":[{"name":"string","reason":"string"}],"actions":[{"action":"string","weekday":"string"}],"removed_sessions":["string"]}'::jsonb));
    else raise exception 'premium_reviewer_projection_unknown_patch';
   end case;
   patches:=patches||jsonb_build_array(q);
  end loop;
  recs:=recs||jsonb_build_array(projected||jsonb_build_object('patches',patches));
 end loop;
 return jsonb_build_object('actor','reviewer',
  'mesocycle',jsonb_build_object('id',c.id,'number',c.number,'planned_weeks',c.planned_weeks,'state',c.state,'current_revision_id',c.current_revision_id,'tracking_week',c.tracking_week),
  'weeks',weeks,'recommendations',recs);
end;
$state$;
-- No API role receives EXECUTE on the test schema or its security-definer clone.
revoke all on all functions in schema reviewer_admission_list_test from public,anon,authenticated,service_role;
insert into reviewer_admission_list_test.profiles values('00000000-0000-4000-8000-000000000001','trainer');
-- Fail explicitly on a future required column before inserting any fixture.
do $fixture_columns$ declare spec record;missing text;begin
 for spec in select * from (values
  ('coach_mesocycles',array['id','routine_id','user_id','number','start_date','planned_weeks','state','objective','access_until','current_revision_id','initial_revision_id','intake','reviewer_id','tracking_week']),
  ('coach_mesocycle_weeks',array['id','mesocycle_id','routine_id','user_id','week_number','state','planned_date','revision_id']),
  ('coach_recommendations',array['id','mesocycle_id','routine_id','user_id','base_revision_id','kind','state','context_snapshot','facts','patches','interpretation','analysis_bundle','analysis_trace','analysis_week','provider_state','reviewed_at','review_reason','accepted_at','result_revision_id'])
 )x(table_name,insert_columns) loop
  select string_agg(a.attname,',' order by a.attnum) into missing from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='reviewer_admission_list_test' and c.relname=spec.table_name and a.attnum>0 and not a.attisdropped
    and a.attnotnull and not a.atthasdef and a.attidentity='' and a.attgenerated='' and not(a.attname=any(spec.insert_columns));
  if missing is not null then raise exception 'required_fixture_columns_missing: %.%',spec.table_name,missing;end if;
 end loop;
end $fixture_columns$;
insert into reviewer_admission_list_test.coach_mesocycles(id,routine_id,user_id,number,start_date,planned_weeks,state,objective,access_until,current_revision_id,initial_revision_id,intake,reviewer_id,tracking_week)
 values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002',1,current_date,4,'active','SYNTHETIC projection regression','2099-01-01T00:00:00Z','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000005','{"custom":"PRIVATE_FUTURE19"}','00000000-0000-4000-8000-000000000001',1);
insert into reviewer_admission_list_test.coach_mesocycle_weeks(id,mesocycle_id,routine_id,user_id,week_number,state,planned_date,revision_id)
 values('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002',1,'active',current_date,'00000000-0000-4000-8000-000000000005');
insert into reviewer_admission_list_test.coach_recommendations(id,mesocycle_id,routine_id,user_id,base_revision_id,kind,state,context_snapshot,facts,patches,interpretation,analysis_bundle,analysis_trace,analysis_week,provider_state,reviewed_at,review_reason,accepted_at,result_revision_id)
 values('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','MODIFY','accepted','{"private_context":"PRIVATE_FUTURE19"}',
 '[{"exercise_ref":"exercise_1","exercise_name":"SYNTHETIC exercise","claim":"insufficient_data","observations":[{"date":"2026-10-18","sets":[{"set_number":1,"kg":20,"reps":10,"rir":3}]}]}]',
 '[{"field":"planned_sets","target_id":"00000000-0000-4000-8000-000000000008","exercise_name":"SYNTHETIC exercise","from":[{"set_number":1,"reps_min":8,"reps_max":12,"rir":3,"rest_seconds":180}],"to":[{"set_number":1,"reps_min":8,"reps_max":12,"rir":2,"rest_seconds":210}]}]',
 'SYNTHETIC PUBLIC INTERPRETATION','{"private_bundle":"PRIVATE_FUTURE19"}','{"private_trace":"PRIVATE_FUTURE19"}',1,'finished',now(),'SYNTHETIC accepted decision',now(),'00000000-0000-4000-8000-000000000012');
create function reviewer_admission_list_test.test_exact_keys(v jsonb,keys text[]) returns boolean language sql immutable as $f$ select coalesce(jsonb_typeof(v)='object' and v ?& keys and v-keys='{}'::jsonb,false) $f$;
revoke all on function reviewer_admission_list_test.test_exact_keys(jsonb,text[]) from public,anon,authenticated,service_role;

create function reviewer_admission_list_test.premium_reviewer_state(p_mesocycle uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,reviewer_admission_list_test as $state$
declare u uuid:=reviewer_admission_list_test.test_actor();c reviewer_admission_list_test.coach_mesocycles;r reviewer_admission_list_test.coach_recommendations;
 scopes jsonb;weeks jsonb;recs jsonb:='[]'::jsonb;v jsonb;projected jsonb;p jsonb;q jsonb;patches jsonb;
begin
 if u is null or not exists(select 1 from reviewer_admission_list_test.profiles where id=u and role='trainer') then
  raise exception 'premium_not_authorized' using errcode='42501';
 end if;
 if p_mesocycle is null then
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'number',m.number,'state',m.state) order by m.created_at desc,m.id),'[]'::jsonb)
   into scopes from reviewer_admission_list_test.coach_mesocycles m where m.state in ('draft','active') and reviewer_admission_list_test.premium_review_access(m.id);
  return jsonb_build_object('actor','reviewer','scopes',scopes);
 end if;
 select * into c from reviewer_admission_list_test.coach_mesocycles where id=p_mesocycle and reviewer_admission_list_test.premium_review_access(id);
 if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'week_number',w.week_number,'state',w.state,'planned_date',w.planned_date,'revision_id',w.revision_id) order by w.week_number,w.id),'[]'::jsonb)
  into weeks from reviewer_admission_list_test.coach_mesocycle_weeks w where w.mesocycle_id=c.id;
 for r in select rr.* from reviewer_admission_list_test.coach_recommendations rr where rr.mesocycle_id=c.id
  and ((rr.analysis_bundle#>>'{provider,schema_version}') is distinct from 'premium-weekly-provider-v1' or reviewer_admission_list_test.premium_weekly_visible(rr.mesocycle_id))
  and ((rr.analysis_trace->>'origin') is distinct from 'premium_chat' or reviewer_admission_list_test.premium_chat_recommendation_visible(rr.id))
  order by rr.created_at desc,rr.id
 loop
  begin
   -- Preserve the current grant/checkin/revision binding checks and named-series projection.
   v:=reviewer_admission_list_test.premium_recommendation_view(r.id);
  exception
   when sqlstate '42501' then
    if sqlerrm in ('premium_admission_stale_or_revoked','premium_weekly_consent_required','premium_chat_consent_required','premium_chat_context_revoked') then continue;end if;
    raise;
   when raise_exception then
    if sqlerrm in ('premium_weekly_stale_context','premium_weekly_stale_checkin','premium_chat_stale_context','premium_chat_stale_checkin') then continue;end if;
    raise;
  end;
  projected:=reviewer_admission_list_test.premium_reviewer_project(v,'{"id":"string","mesocycle_id":"string","routine_id":"string","kind":"string","state":"string","base_revision_id":"string","result_revision_id":"string","analysis_week":"number","interpretation":"string","review_reason":"string","facts":[{"exercise_ref":"string","exercise_name":"string","claim":"string","observations":[{"date":"string","sets":[{"set_number":"number","kg":"number","reps":"number","rir":"number"}]}]}],"quality_warnings":["string"],"created_at":"string","reviewed_at":"string","accepted_at":"string"}'::jsonb);
  patches:='[]'::jsonb;
  for p in select value from jsonb_array_elements(v->'patches') loop
   q:=reviewer_admission_list_test.premium_reviewer_project(p,'{"field":"string","target_id":"string","exercise_name":"string"}'::jsonb);
   case p->>'field'
    when 'sets','rest_seconds','exercise_order','day_order' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','"number"'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','"number"'::jsonb));
    when 'target','rir','day_id' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','"string"'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','"string"'::jsonb));
    when 'planned_sets' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]'::jsonb));
    when 'weekly_schedule' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','[{"day_id":"string","weekday":"string","minutes":"number"}]'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','[{"day_id":"string","weekday":"string","minutes":"number"}]'::jsonb));
    when 'replace_exercise' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','"string"'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','{"id":"string","catalogue_id":"string","source_catalogue_id":"string","prescription_policy":"string","scheme":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}],"sets":"number","target":"string","rir":"string","rest_seconds":"number"}'::jsonb));
     if p ? 'before_prescription' then q:=q||jsonb_build_object('before_prescription',reviewer_admission_list_test.premium_reviewer_project(p->'before_prescription','{"name":"string","scheme":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}'::jsonb));end if;
    when 'session_distribution' then
     q:=q||jsonb_build_object('from',reviewer_admission_list_test.premium_reviewer_project(p->'from','{"sessions":[{"name":"string","weekday":"string","minutes":"number","estimated_minutes":"number","exercises":[{"name":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}]}]}'::jsonb),'to',reviewer_admission_list_test.premium_reviewer_project(p->'to','{"sessions":[{"name":"string","weekday":"string","minutes":"number","estimated_minutes":"number","exercises":[{"name":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}]}],"quality":{"sets_before":"number","sets_after":"number","muscle_sets_before":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"muscle_sets_after":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"frequency_after":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"schedule":[{"day_id":"string","weekday":"string","minutes":"number"}],"volume_reason":"string","warnings":["string"]},"removed_exercises":[{"name":"string","reason":"string"}],"actions":[{"action":"string","weekday":"string"}],"removed_sessions":["string"]}'::jsonb));
    else raise exception 'premium_reviewer_projection_unknown_patch';
   end case;
   patches:=patches||jsonb_build_array(q);
  end loop;
  recs:=recs||jsonb_build_array(projected||jsonb_build_object('patches',patches));
 end loop;
 return jsonb_build_object('actor','reviewer',
  'mesocycle',jsonb_build_object('id',c.id,'number',c.number,'planned_weeks',c.planned_weeks,'state',c.state,'current_revision_id',c.current_revision_id,'tracking_week',c.tracking_week),
  'weeks',weeks,'recommendations',recs);
end;
$state$;

create function reviewer_admission_list_test.canonical_definition(v text) returns text language plpgsql immutable set search_path=pg_catalog as $canonical$
declare name text;begin
 v:=replace(v,'reviewer_admission_list_test.premium_reviewer_state_before','reviewer_admission_list_test.premium_reviewer_state');
 v:=replace(v,'reviewer_admission_list_test.test_actor()','auth.uid()');
 foreach name in array array['premium_reviewer_project','premium_review_access','premium_weekly_visible','premium_chat_recommendation_visible'] loop v:=replace(v,'reviewer_admission_list_test.'||name,'coach_private.'||name);end loop;
 return replace(replace(v,'reviewer_admission_list_test.','public.'),quote_literal('reviewer_admission_list_test'),quote_literal('public'));
end $canonical$;
revoke all on all functions in schema reviewer_admission_list_test from public,anon,authenticated,service_role;
do $admission_test$
declare baseline jsonb;actual jsonb;observed text;code text;old_hash text;new_hash text;n integer;spec record;
begin
 baseline:=reviewer_admission_list_test.premium_reviewer_state_before('00000000-0000-4000-8000-000000000003');
 if baseline#>>'{recommendations,0,state}' is distinct from 'accepted' or baseline#>>'{recommendations,0,patches,0,to,0,rest_seconds}' is distinct from '210' or baseline#>>'{recommendations,0,facts,0,observations,0,sets,0,kg}' is distinct from '20' then raise exception 'populated_positive_missing';end if;
 for spec in select * from (values
  ('00000000-0000-4000-8000-000000000009','KEEP','superseded','admission_stale'),
  ('00000000-0000-4000-8000-000000000010','KEEP','accepted','admission_stale'),
  ('00000000-0000-4000-8000-000000000011','MODIFY','rejected','chat_stale_checkin')) v(id,kind,state,guard_mode) loop
  insert into reviewer_admission_list_test.coach_recommendations
  select (jsonb_populate_record(null::reviewer_admission_list_test.coach_recommendations,to_jsonb(r)||jsonb_build_object(
   'id',spec.id,'kind',spec.kind,'state',spec.state,
   'patches',case when spec.kind='KEEP' then '[]'::jsonb else r.patches end,
   'accepted_at',case when spec.state='accepted' then r.accepted_at else null end,
   'result_revision_id',case when spec.state<>'accepted' then null when spec.kind='KEEP' then r.base_revision_id else r.result_revision_id end,
   'analysis_bundle',jsonb_build_object('fixture_guard',spec.guard_mode,'private_bundle','PRIVATE_HISTORICAL_ADMISSION')))).*
  from reviewer_admission_list_test.coach_recommendations r where id='00000000-0000-4000-8000-000000000007';
 end loop;
 select count(*) into n from reviewer_admission_list_test.coach_recommendations;if n<>4 then raise exception 'four_populated_rows_required';end if;
 observed:=null;code:=null;begin perform reviewer_admission_list_test.premium_reviewer_state_before('00000000-0000-4000-8000-000000000003');exception when others then get stacked diagnostics observed=message_text,code=returned_sqlstate;end;
 if code is distinct from '42501' or observed is distinct from 'premium_admission_stale_or_revoked' then raise exception 'original_failure_not_reproduced';end if;
 actual:=reviewer_admission_list_test.premium_reviewer_state('00000000-0000-4000-8000-000000000003');
 if actual is distinct from baseline or jsonb_array_length(actual->'recommendations')<>1 or actual#>>'{recommendations,0,id}' is distinct from '00000000-0000-4000-8000-000000000007' or actual::text ~ 'PRIVATE_FUTURE19|PRIVATE_HISTORICAL_ADMISSION' then raise exception 'valid_projection_changed_or_private_exposure';end if;
 insert into reviewer_admission_list_test.results values('stale historical rows reproduce old denial; candidate returns only identical populated valid projection',true);
 perform set_config('simple.reviewer_admission_list_scope_allowed','false',true);
 observed:=null;code:=null;begin perform reviewer_admission_list_test.premium_reviewer_state('00000000-0000-4000-8000-000000000003');exception when others then get stacked diagnostics observed=message_text,code=returned_sqlstate;end;
 if code is distinct from '42501' or observed is distinct from 'premium_not_authorized' then raise exception 'scope_guard_relaxed';end if;
 perform set_config('simple.reviewer_admission_list_scope_allowed','true',true);
 update reviewer_admission_list_test.coach_recommendations set analysis_bundle=jsonb_set(analysis_bundle,'{fixture_guard}','"other_admission_failure"') where id='00000000-0000-4000-8000-000000000009';
 observed:=null;code:=null;begin perform reviewer_admission_list_test.premium_reviewer_state('00000000-0000-4000-8000-000000000003');exception when others then get stacked diagnostics observed=message_text,code=returned_sqlstate;end;
 if code is distinct from '42501' or observed is distinct from 'premium_admission_required' then raise exception 'unlisted_guard_swallowed';end if;
 insert into reviewer_admission_list_test.results values('scope denial and unlisted per-row permission error remain fail closed',true);
 old_hash:=md5(reviewer_admission_list_test.canonical_definition(pg_get_functiondef('reviewer_admission_list_test.premium_reviewer_state_before(uuid)'::regprocedure)));
 if old_hash is distinct from 'fb4f1a322b8666a883184cfd04f1f017' then raise exception 'old_source_normalization_not_exact: %',old_hash;end if;
 new_hash:=md5(reviewer_admission_list_test.canonical_definition(pg_get_functiondef('reviewer_admission_list_test.premium_reviewer_state(uuid)'::regprocedure)));
 if new_hash=old_hash then raise exception 'candidate_definition_not_changed';end if;
 perform set_config('simple.reviewer_admission_list_test_old_md5',old_hash,true);perform set_config('simple.reviewer_admission_list_test_new_md5',new_hash,true);
end $admission_test$;
select jsonb_build_object('kind','isolated populated test doubles; NOT JWT, real admission or production functional evidence','total',count(*),'passed',count(*) filter(where passed),'checks',jsonb_agg(name order by name),'old_api_normalized_md5',current_setting('simple.reviewer_admission_list_test_old_md5'),'candidate_api_normalized_md5',current_setting('simple.reviewer_admission_list_test_new_md5'),'shared_table_dml',0,'provider_calls',0,'cleanup','outer ROLLBACK') from reviewer_admission_list_test.results;
rollback;
