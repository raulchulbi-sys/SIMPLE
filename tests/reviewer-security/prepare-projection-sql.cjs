'use strict';
// Source preparation only: no driver, credentials, connections, sessions or SQL execution.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SCHEMA='security19_projection_regression';
const MIGRATION='supabase/migrations/20261018090206_reviewer_private_api_projection.sql';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function prepareSql(sourceRoot){
 const source=fs.readFileSync(path.join(sourceRoot,MIGRATION),'utf8').replace(/\r\n/g,'\n');
 const helper=source.match(/create function coach_private\.premium_reviewer_project\(v jsonb, shape jsonb\)[\s\S]*?\$project\$;/)?.[0];
 const api=source.match(/create function public\.premium_reviewer_state\(p_mesocycle uuid default null\)[\s\S]*?\$state\$;/)?.[0];
 assert(helper&&api,'Reviewed projection function boundaries missing; inspect source instead of broad extraction');
 const qualify=s=>s.replace(/\bcoach_private\./g,SCHEMA+'.').replace(/\bpublic\./g,SCHEMA+'.').replace(/\bauth\.uid\(\)/g,SCHEMA+'.test_actor()').replace(/set search_path=pg_catalog,public/g,'set search_path=pg_catalog,'+SCHEMA);
 const sql=`-- DRAFT, NOT EXECUTED. Root alone may execute on verified staging.
-- Synthetic isolated-schema compatibility test, NOT JWT/RLS/real-consent evidence.
-- Exact production function bodies with schema references renamed; guard/source
-- helpers below are explicit test doubles, never replacements in public/private.
-- Candidate helper SHA256 ${hash(helper)}; API SHA256 ${hash(api)}.
-- After BEGIN, operator must add BOTH SET LOCAL statements in this transaction:
-- SET LOCAL simple.security19_test_project='dmqjexigdnfzobarhnib';
-- SET LOCAL simple.security19_test_reviewed='future-fields-v1';
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $gate$ begin
 if current_setting('simple.security19_test_project',true) is distinct from 'dmqjexigdnfzobarhnib'
  or current_setting('simple.security19_test_reviewed',true) is distinct from 'future-fields-v1'
  or current_user<>'postgres' then raise exception 'verified_staging_root_only';end if;
 if to_regnamespace('${SCHEMA}') is not null then raise exception 'exclusive_test_schema_already_exists';end if;
end $gate$;
create schema ${SCHEMA};
revoke all on schema ${SCHEMA} from public,anon,authenticated,service_role;
-- LIKE copies column metadata/defaults, never shared rows, FKs or policies.
create table ${SCHEMA}.coach_mesocycles (like public.coach_mesocycles including defaults);
create table ${SCHEMA}.coach_mesocycle_weeks (like public.coach_mesocycle_weeks including defaults);
create table ${SCHEMA}.coach_recommendations (like public.coach_recommendations including defaults);
create table ${SCHEMA}.profiles(id uuid primary key,role text not null);
create table ${SCHEMA}.results(name text primary key,passed boolean not null);
create function ${SCHEMA}.test_actor() returns uuid language sql immutable as $f$ select '00000000-0000-4000-8000-000000000001'::uuid $f$;
create function ${SCHEMA}.premium_review_access(id uuid) returns boolean language sql stable as $f$ select id='00000000-0000-4000-8000-000000000003'::uuid $f$;
create function ${SCHEMA}.premium_weekly_visible(id uuid) returns boolean language sql immutable as $f$ select true $f$;
create function ${SCHEMA}.premium_chat_recommendation_visible(id uuid) returns boolean language sql immutable as $f$ select true $f$;
-- Deliberately return composite JSON including unknown future columns. This
-- tests the real API's closed projection after a dependency becomes broader.
create function ${SCHEMA}.premium_recommendation_view(id uuid) returns jsonb language sql stable as $f$
 select to_jsonb(r)||jsonb_build_object('quality_warnings',jsonb_build_array('SYNTHETIC PUBLIC WARNING')) from ${SCHEMA}.coach_recommendations r where r.id=$1
$f$;
${qualify(helper)}
${qualify(api)}
-- No API role receives EXECUTE on the test schema or its security-definer clone.
revoke all on all functions in schema ${SCHEMA} from public,anon,authenticated,service_role;
insert into ${SCHEMA}.profiles values('00000000-0000-4000-8000-000000000001','trainer');
-- Fail explicitly on a future required column before inserting any fixture.
do $fixture_columns$ declare spec record;missing text;begin
 for spec in select * from (values
  ('coach_mesocycles',array['id','routine_id','user_id','number','start_date','planned_weeks','state','objective','access_until','current_revision_id','initial_revision_id','intake','reviewer_id','tracking_week']),
  ('coach_mesocycle_weeks',array['id','mesocycle_id','routine_id','user_id','week_number','state','planned_date','revision_id']),
  ('coach_recommendations',array['id','mesocycle_id','routine_id','user_id','base_revision_id','kind','state','context_snapshot','facts','patches','interpretation','analysis_bundle','analysis_trace','analysis_week','provider_state'])
 )x(table_name,insert_columns) loop
  select string_agg(a.attname,',' order by a.attnum) into missing from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='${SCHEMA}' and c.relname=spec.table_name and a.attnum>0 and not a.attisdropped
    and a.attnotnull and not a.atthasdef and a.attidentity='' and a.attgenerated='' and not(a.attname=any(spec.insert_columns));
  if missing is not null then raise exception 'required_fixture_columns_missing: %.%',spec.table_name,missing;end if;
 end loop;
end $fixture_columns$;
insert into ${SCHEMA}.coach_mesocycles(id,routine_id,user_id,number,start_date,planned_weeks,state,objective,access_until,current_revision_id,initial_revision_id,intake,reviewer_id,tracking_week)
 values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002',1,current_date,4,'active','SYNTHETIC projection regression','2099-01-01T00:00:00Z','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000005','{"custom":"PRIVATE_FUTURE19"}','00000000-0000-4000-8000-000000000001',1);
insert into ${SCHEMA}.coach_mesocycle_weeks(id,mesocycle_id,routine_id,user_id,week_number,state,planned_date,revision_id)
 values('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002',1,'active',current_date,'00000000-0000-4000-8000-000000000005');
insert into ${SCHEMA}.coach_recommendations(id,mesocycle_id,routine_id,user_id,base_revision_id,kind,state,context_snapshot,facts,patches,interpretation,analysis_bundle,analysis_trace,analysis_week,provider_state)
 values('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','MODIFY','superseded','{"private_context":"PRIVATE_FUTURE19"}',
 '[{"exercise_ref":"exercise_1","exercise_name":"SYNTHETIC exercise","claim":"insufficient_data","observations":[{"date":"2026-10-18","sets":[{"set_number":1,"kg":20,"reps":10,"rir":3}]}]}]',
 '[{"field":"planned_sets","target_id":"00000000-0000-4000-8000-000000000008","exercise_name":"SYNTHETIC exercise","from":[{"set_number":1,"reps_min":8,"reps_max":12,"rir":3,"rest_seconds":180}],"to":[{"set_number":1,"reps_min":8,"reps_max":12,"rir":2,"rest_seconds":180}]}]',
 'SYNTHETIC PUBLIC INTERPRETATION','{"private_bundle":"PRIVATE_FUTURE19"}','{"private_trace":"PRIVATE_FUTURE19"}',1,'finished');
create function ${SCHEMA}.test_exact_keys(v jsonb,keys text[]) returns boolean language sql immutable as $f$ select coalesce(jsonb_typeof(v)='object' and v ?& keys and v-keys='{}'::jsonb,false) $f$;
revoke all on function ${SCHEMA}.test_exact_keys(jsonb,text[]) from public,anon,authenticated,service_role;
do $test$ declare baseline jsonb;actual jsonb;rec jsonb;bad boolean:=false;begin
 baseline:=${SCHEMA}.premium_reviewer_state('00000000-0000-4000-8000-000000000003');
 if baseline#>>'{recommendations,0,patches,0,to,0,rir}' is distinct from '2' or baseline#>>'{recommendations,0,facts,0,observations,0,sets,0,kg}' is distinct from '20' then raise exception 'positive_populated_projection_precondition';end if;
 rec:=baseline#>'{recommendations,0}';
 if baseline::text like '%PRIVATE_FUTURE19%'
  or not ${SCHEMA}.test_exact_keys(baseline,array['actor','mesocycle','weeks','recommendations'])
  or not ${SCHEMA}.test_exact_keys(baseline->'mesocycle',array['id','number','planned_weeks','state','current_revision_id','tracking_week'])
  or not ${SCHEMA}.test_exact_keys(baseline#>'{weeks,0}',array['id','week_number','state','planned_date','revision_id'])
  or not ${SCHEMA}.test_exact_keys(rec,array['id','mesocycle_id','routine_id','kind','state','base_revision_id','result_revision_id','analysis_week','interpretation','review_reason','facts','quality_warnings','created_at','reviewed_at','accepted_at','patches'])
  or not ${SCHEMA}.test_exact_keys(rec#>'{facts,0}',array['exercise_ref','exercise_name','claim','observations'])
  or not ${SCHEMA}.test_exact_keys(rec#>'{facts,0,observations,0}',array['date','sets'])
  or not ${SCHEMA}.test_exact_keys(rec#>'{facts,0,observations,0,sets,0}',array['set_number','kg','reps','rir'])
  or not ${SCHEMA}.test_exact_keys(rec#>'{patches,0}',array['field','target_id','exercise_name','from','to'])
  or not ${SCHEMA}.test_exact_keys(rec#>'{patches,0,to,0}',array['set_number','reps_min','reps_max','rir','rest_seconds'])
 then raise exception 'closed_field_contract_changed_or_private_baseline_exposed';end if;
 alter table ${SCHEMA}.coach_mesocycles add column future_private_column jsonb default '{"marker":"PRIVATE_FUTURE19"}';
 alter table ${SCHEMA}.coach_mesocycle_weeks add column future_private_column jsonb default '{"marker":"PRIVATE_FUTURE19"}';
 alter table ${SCHEMA}.coach_recommendations add column future_private_column jsonb default '{"marker":"PRIVATE_FUTURE19"}';
 update ${SCHEMA}.coach_recommendations set facts=jsonb_set(jsonb_set(jsonb_set(facts,'{0,future_private_json}','"PRIVATE_FUTURE19"'),'{0,observations,0,future_private_json}','"PRIVATE_FUTURE19"'),'{0,observations,0,sets,0,future_private_json}','"PRIVATE_FUTURE19"'),patches=jsonb_set(jsonb_set(jsonb_set(patches,'{0,future_private_json}','"PRIVATE_FUTURE19"'),'{0,from,0,future_private_json}','"PRIVATE_FUTURE19"'),'{0,to,0,future_private_json}','"PRIVATE_FUTURE19"');
 actual:=${SCHEMA}.premium_reviewer_state('00000000-0000-4000-8000-000000000003');
 if actual is distinct from baseline or actual::text like '%PRIVATE_FUTURE19%' then raise exception 'future_private_field_leak_or_public_value_loss';end if;
 insert into ${SCHEMA}.results values('future composite columns and nested JSON do not change populated public projection',true);
 -- Correctly named fields cannot smuggle arbitrary JSON objects through a scalar slot.
 update ${SCHEMA}.coach_recommendations set facts=jsonb_set(facts,'{0,observations,0,sets,0,kg}','{"private":"PRIVATE_FUTURE19"}');
 begin perform ${SCHEMA}.premium_reviewer_state('00000000-0000-4000-8000-000000000003');exception when raise_exception then if sqlerrm<>'premium_reviewer_projection_invalid' then raise;end if;bad:=true;end;
 if not bad then raise exception 'scalar_object_not_rejected';end if;
 insert into ${SCHEMA}.results values('known scalar slot rejects object instead of serializing it',true);
end $test$;
select jsonb_build_object('kind','isolated mock schema only, not JWT/RLS','total',count(*),'passed',count(*) filter(where passed),'checks',jsonb_agg(name order by name)) from ${SCHEMA}.results;
rollback;
`;
 return {sql,sourceSha256:hash(source),helperSha256:hash(helper),apiSha256:hash(api),plannedChecks:2};
}
module.exports={prepareSql,SCHEMA,MIGRATION};
if(require.main===module){
 const args=process.argv.slice(2),values={};for(let i=0;i<args.length;i+=2){assert(['--source-root','--output'].includes(args[i])&&args[i+1]&&!values[args[i]]);values[args[i]]=args[i+1];}
 assert(values['--source-root']&&values['--output'],'Explicit source root and ignored output required');
 const output=path.resolve(values['--output']);assert(/[\\/]tests[\\/].*[\\/](?:private|results)[\\/].+\.sql$/.test(output),'Output must be a private/results SQL draft');
 const prepared=prepareSql(path.resolve(values['--source-root']));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,prepared.sql);
 console.log(JSON.stringify({preparedOnly:true,executed:false,plannedSqlChecks:prepared.plannedChecks,sqlSha256:hash(prepared.sql),sourceSha256:prepared.sourceSha256}));
}
