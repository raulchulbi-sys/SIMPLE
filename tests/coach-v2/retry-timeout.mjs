// Focused staging SQL: all identities, configuration and data disappear with ROLLBACK.
// No real JWT, network transport, provider call or real participant is used by this generator.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {validFixture} from '../coach-ai/cases.mjs';
const q=value=>"'"+String(value).replaceAll("'","''")+"'",j=value=>q(JSON.stringify(value))+'::jsonb';
const users=Object.fromEntries(['expired','live','pending','ready','accepted','closed','noConsent','reviewer','ordinary'].map(k=>[k,crypto.randomUUID()]));
const operations=Object.fromEntries(Object.keys(users).filter(k=>!['reviewer','ordinary'].includes(k)).map(k=>[k,crypto.randomUUID()]));
const intakes=Object.fromEntries(Object.keys(operations).map(k=>[k,crypto.randomUUID()]));
const grants=Object.fromEntries(Object.keys(operations).map(k=>[k,crypto.randomUUID()]));
const routine=crypto.randomUUID(),future=new Date(Date.now()+86400000).toISOString();
const training={goal:'Fuerza general',experience:'beginner',days:3,minutes:60,equipment:['Gimnasio'],preferred:'',avoided:'',preferences:''};
const pilot=Object.fromEntries(Object.keys(operations).filter(k=>k!=='closed').map(k=>[users[k],{enabled:true,adult_confirmed:true,expires_at:future}]));
const actor=kind=>`select set_config('request.jwt.claims',${j(kind==='service'?{role:'service_role'}:{sub:users[kind],role:'authenticated'})}::text,true);\n`;
const check=(name,expression)=>`select pg_temp.ok(${q(name)},${expression});\n`;
const deny=(name,expression,error)=>`select pg_temp.denied(${q(name)},${q(expression)},${q(error)});\n`;
const authorize=kind=>`select public.authorize_coach_retry('${operations[kind]}','Synthetic timeout investigation')`;
let sql=`-- STAGING ONLY. Required termination is ROLLBACK, never COMMIT.
begin;
create temp table checks(name text,pass boolean);
create function pg_temp.ok(n text,b boolean) returns void language plpgsql as $$begin if b is distinct from true then raise exception 'FAIL %',n;end if;insert into checks values(n,true);end$$;
create function pg_temp.denied(n text,s text,expected text) returns void language plpgsql as $$declare caught boolean:=false;begin begin execute s;exception when others then if position(expected in sqlerrm)=0 then raise;end if;caught:=true;end;perform pg_temp.ok(n,caught);end$$;
${check('closed whitelist before synthetic transaction',"coach_private.pilot_config()='{}'::jsonb")}
`;
for(const [kind,id] of Object.entries(users))sql+=`insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${id}','authenticated','authenticated','coach-v2-timeout-${id}@example.invalid','{}','{}',now(),now());
insert into public.profiles(id,name,role) values('${id}','V2 TIMEOUT TRANSACTION ${kind}','${['reviewer','ordinary'].includes(kind)?'trainer':'client'}');\n`;
sql+=`create or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${j(pilot)} $cfg$;
create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${j({[users.reviewer]:{enabled:true,expires_at:future}})} $cfg$;
insert into public.routines(id,owner_id,name) values('${routine}','${users.accepted}','SYNTHETIC timeout accepted fixture');\n`;
for(const kind of Object.keys(operations)){
 const state=['pending','ready','accepted'].includes(kind)?{pending:'pending_review',ready:'ready',accepted:'accepted'}[kind]:'reserved';
 sql+=`insert into public.context_grants(id,user_id,scope,notice_version,granted_at,revoked_at) values('${grants[kind]}','${users[kind]}','training_intake','pilot-supervised-v2',now()-interval '4 minutes',${kind==='noConsent'?'now()':'null'});
insert into public.training_intakes(id,user_id,revision,state,training,submitted_at) values('${intakes[kind]}','${users[kind]}',1,'submitted',${j(training)},now());
insert into public.coach_operations(id,user_id,intake_id,intake_version,idempotency_key,state,grant_ids,proposal,created_at,expires_at,generation_started_at,model_provider,model_name,prompt_version,output_schema_version,review_required,routine_id,accepted_at)
values('${operations[kind]}','${users[kind]}','${intakes[kind]}',1,'${crypto.randomUUID()}','${state}',array['${grants[kind]}'::uuid],${['pending','ready','accepted'].includes(kind)?j(validFixture()):'null'},now()-interval '3 minutes',${kind==='live'?"clock_timestamp()+interval '5 minutes'":"now()-interval '1 minute'"},now()-interval '2 minutes','openai','gpt-5.4-2026-03-05','basic-initial-v2',1,true,${kind==='accepted'?q(routine):'null'},${kind==='accepted'?'now()':'null'});\n`;
}
sql+=`create temp table original_receipts as select id,to_jsonb(o) as receipt from public.coach_operations o where id in(${Object.values(operations).map(q).join(',')});\n`;
sql+=actor('ordinary')+deny('ordinary trainer cannot close expired reservation',authorize('expired'),'coach_reviewer_required')
 +actor('expired')+deny('owner cannot authorize own timeout retry',authorize('expired'),'coach_reviewer_required')
 +actor('reviewer')+deny('timeout retry requires audit reason',`select public.authorize_coach_retry('${operations.expired}','')`,'coach_review_reason_required');
for(const kind of ['live','pending','ready','accepted','closed','noConsent']){
 sql+=deny(kind+' operation cannot be converted to retry',authorize(kind),kind==='noConsent'?'coach_context_required':'coach_retry_unavailable');
 sql+=check(kind+' receipt unchanged after denial',`(select to_jsonb(o)=(select receipt from original_receipts where id=o.id) from public.coach_operations o where id='${operations[kind]}')`);
}
sql+=check('expired receipt still unchanged before reviewer action',`(select to_jsonb(o)=(select receipt from original_receipts where id=o.id) from public.coach_operations o where id='${operations.expired}')`);
sql+=`${authorize('expired')};\n`+
 check('expired reservation becomes failed timeout with one audited authorization',`(select state='failed' and error_code='provider_timeout' and retry_authorized_by='${users.reviewer}' and retry_authorized_at is not null and retry_reason='Synthetic timeout investigation' from public.coach_operations where id='${operations.expired}')`)
 +check('no invented provider receipt tokens or cost',`(select provider_attempts is null and input_tokens is null and output_tokens is null and estimated_cost is null and proposal is null from public.coach_operations where id='${operations.expired}')`)+`
create temp table authorized_receipt as select to_jsonb(o) as receipt from public.coach_operations o where id='${operations.expired}';
select public.authorize_coach_retry('${operations.expired}','Different replay reason must not overwrite');
`+check('repeated authorization is idempotent and preserves first reason',`(select to_jsonb(o)=(select receipt from authorized_receipt) from public.coach_operations o where id='${operations.expired}')`)
 +actor('expired')+`create temp table retry_receipt as select * from public.reserve_basic_generation('${intakes.expired}',gen_random_uuid());\n`
 +check('exactly one successor reservation carries the retry source',`(select count(*)=1 from public.coach_operations where retry_source='${operations.expired}') and (select state='reserved' and retry_source='${operations.expired}' from retry_receipt)`)
 +check('second tab receives the same successor',`(select id from public.reserve_basic_generation('${intakes.expired}',gen_random_uuid()))=(select id from retry_receipt)`)
 +actor('reviewer')+deny('used timeout authorization cannot be granted again',authorize('expired'),'coach_retry_unavailable')
 +actor('service')+`select public.coach_backend_finish('${users.expired}','${operations.expired}',${j(validFixture())},null,100,'[{"status":200,"latency_ms":100,"input_tokens":0,"output_tokens":0,"cached_input_tokens":0,"error_code":null}]');\n`
 +check('late provider finish records receipt without reviving timed out proposal',`(select state='failed' and error_code='provider_timeout' and proposal is null and provider_attempts is not null from public.coach_operations where id='${operations.expired}')`)
 +check('late old response leaves successor untouched',`(select to_jsonb(o)=(select to_jsonb(r) from retry_receipt r) from public.coach_operations o where id=(select id from retry_receipt))`);
sql+=`-- Deliberately expires after transaction start; now() alone would incorrectly keep it enabled.
create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select jsonb_build_object('${users.reviewer}',jsonb_build_object('enabled',true,'expires_at',transaction_timestamp()+interval '50 milliseconds')) $cfg$;
select pg_sleep(0.06);
`+actor('reviewer')+check('reviewer expiry follows wall clock rather than transaction start',`not coach_private.is_reviewer('${users.reviewer}') and transaction_timestamp()<(coach_private.reviewer_config()->'${users.reviewer}'->>'expires_at')::timestamptz and (coach_private.reviewer_config()->'${users.reviewer}'->>'expires_at')::timestamptz<clock_timestamp()`)
 +deny('wall-clock expired reviewer cannot authorize retry',authorize('live'),'coach_reviewer_required')
 +check('live reservation unchanged after expired reviewer attempt',`(select to_jsonb(o)=(select receipt from original_receipts where id=o.id) from public.coach_operations o where id='${operations.live}')`)
 +check('no provider calls made in transaction',`not exists(select 1 from public.coach_operations where id in(${Object.values(operations).map(q).join(',')}) and input_tokens>0)`)
 +`select jsonb_agg(to_jsonb(checks)) as checks from checks;
rollback;
`;
fs.mkdirSync(new URL('./private/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./private/retry-timeout.sql',import.meta.url),sql);
console.log('Prepared '+(sql.match(/select pg_temp\.(?:ok|denied)\(/g)||[]).length+' rollback-only timeout assertions; no network or provider calls.');
