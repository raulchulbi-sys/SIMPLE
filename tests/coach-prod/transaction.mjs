// Nonpersistent SQL tests: generated synthetic identities exist ONLY inside BEGIN/ROLLBACK.
// No Auth API, tokens, emails, external provider, or existing user's identity is used.
import fs from 'node:fs';import crypto from 'node:crypto';import {validFixture,cases} from '../coach-ai/cases.mjs';
const q=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>q(JSON.stringify(v))+'::jsonb';
const ids=Object.fromEntries(['owner','other','trainer','reviewer','future','rejected'].map(k=>[k,crypto.randomUUID()]));
const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString(),expiry=new Date(Date.now()+7*86400000).toISOString();
const cfg=Object.fromEntries(['owner','future','rejected'].map(k=>[ids[k],{enabled:true,adult_confirmed:true,activated_at:k==='future'?future:past,expires_at:expiry}]));
let sql=`begin;
create temp table checks(name text,pass boolean);
create temp table refs(k text primary key,id uuid);
create function pg_temp.ok(n text,b boolean) returns void language plpgsql as $$begin if b is distinct from true then raise exception 'FAIL %',n;end if;insert into checks values(n,true);end$$;
create function pg_temp.denied(n text,s text,expected text) returns void language plpgsql as $$declare caught boolean:=false;begin begin execute s;exception when others then if position(expected in sqlerrm)=0 then raise;end if;caught:=true;end;perform pg_temp.ok(n,caught);end$$;
select pg_temp.ok('starts closed',coach_private.pilot_config()='{}'::jsonb and coach_private.reviewer_config()='{}'::jsonb and coach_private.review_required());
`;
for(const [kind,id]of Object.entries(ids))sql+=`insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${id}','authenticated','authenticated','transaction-${id}@example.invalid','{}','{}',now(),now());
insert into public.profiles(id,name,role) values('${id}','TRANSACTION ONLY ${kind}','${kind==='trainer'||kind==='reviewer'?'trainer':'client'}');
`;
sql+=`create or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${json(cfg)} $cfg$;
create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${json({[ids.reviewer]:{enabled:true,expires_at:expiry}})} $cfg$;
select pg_temp.ok('future activation denied',not coach_private.allowed('${ids.future}'));
select pg_temp.ok('active adult allowed',coach_private.allowed('${ids.owner}'));
select pg_temp.ok('other client denied',not coach_private.allowed('${ids.other}'));
select pg_temp.ok('normal trainer denied',not coach_private.is_reviewer('${ids.trainer}'));
select pg_temp.ok('configured reviewer only',coach_private.is_reviewer('${ids.reviewer}'));
insert into public.routines(owner_id,name) values('${ids.trainer}','TRANSACTION normal routine');
insert into public.routine_days(routine_id,name) select id,'TRANSACTION normal day' from public.routines where owner_id='${ids.trainer}';
insert into public.routine_exercises(day_id,name,sets) select d.id,'TRANSACTION normal exercise',2 from public.routine_days d join public.routines r on r.id=d.routine_id where r.owner_id='${ids.trainer}';
select set_config('request.jwt.claims','{"sub":"${ids.trainer}","role":"authenticated"}',true);
update public.routine_exercises set sets=3 where day_id in(select d.id from public.routine_days d join public.routines r on r.id=d.routine_id where r.owner_id='${ids.trainer}');
select pg_temp.ok('normal routine structure still editable',exists(select 1 from public.routine_exercises e join public.routine_days d on d.id=e.day_id join public.routines r on r.id=d.routine_id where r.owner_id='${ids.trainer}' and e.sets=3));
select pg_temp.ok('configuration private',not has_schema_privilege('authenticated','coach_private','USAGE') and not has_function_privilege('authenticated','coach_private.pilot_config()','EXECUTE'));
select pg_temp.ok('seven tables RLS',count(*)=7 and bool_and(relrowsecurity)) from pg_class where relnamespace='public'::regnamespace and relname in ('training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions','coach_pilot_feedback');
select pg_temp.ok('no direct table writes',not bool_or(has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE'))) from pg_class where relnamespace='public'::regnamespace and relname in ('training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions','coach_pilot_feedback');
select pg_temp.ok('anon no review RPC',not has_function_privilege('anon','public.get_coach_review_queue()','EXECUTE'));
select pg_temp.ok('client no backend finish',not has_function_privilege('authenticated','public.coach_backend_finish(uuid,uuid,jsonb,text,int,jsonb)','EXECUTE'));
`;
const actor=k=>`select set_config('request.jwt.claims',${q(JSON.stringify(k==='service'?{role:'service_role'}:{sub:ids[k],role:'authenticated'}))},true);\n`;
const err=(n,s,e)=>`select pg_temp.denied(${q(n)},${q(s)},${q(e)});\n`;
const training=cases[0].context.training,health={discomfort:'',limitations:''};
for(const k of ['owner','rejected']){
sql+=actor(k)+`insert into refs select '${k}-intake',id from public.save_my_training_intake(null,null,${json({...training,days:3})},${json(health)},true);
`+err(k+' consent required',`select public.reserve_basic_generation((select id from refs where k='${k}-intake'),gen_random_uuid())`,'coach_context_required')+`
select public.set_my_coach_context_permission('training_intake',true);
select public.set_my_coach_context_permission('declared_health',true);
insert into refs select '${k}-operation',id from public.reserve_basic_generation((select id from refs where k='${k}-intake'),gen_random_uuid());
select pg_temp.ok('${k} idempotent reserve',(select id from public.reserve_basic_generation((select id from refs where k='${k}-intake'),gen_random_uuid()))=(select id from refs where k='${k}-operation'));
`+actor('service')+`
select public.coach_backend_claim('${ids[k]}',(select id from refs where k='${k}-operation'),'gpt-5.4-2026-03-05');
select public.coach_backend_finish('${ids[k]}',(select id from refs where k='${k}-operation'),${json(validFixture())},null,1,'[{"status":200,"latency_ms":1,"input_tokens":0,"output_tokens":0,"cached_input_tokens":0,"error_code":null}]');
select pg_temp.ok('${k} pending human review',(select state='pending_review' and review_required from public.coach_operations where id=(select id from refs where k='${k}-operation')));
`+actor(k)+err(k+' cannot accept before review',`select public.accept_basic_plan((select id from refs where k='${k}-operation'))`,'coach_proposal_not_ready');
}
sql+=actor('trainer')+err('normal trainer cannot review','select public.get_coach_review_queue()','coach_reviewer_required');
sql+=actor('reviewer')+`select pg_temp.ok('queue contains only these two synthetic proposals',jsonb_array_length(public.get_coach_review_queue())=2);
select pg_temp.ok('name and UUID identify athlete',exists(select 1 from jsonb_array_elements(public.get_coach_review_queue()) r where r->'athlete'->>'user_id'='${ids.owner}' and r->'athlete'->>'name'='TRANSACTION ONLY owner'));
`+err('review reason required',"select public.review_coach_proposal((select id from refs where k='owner-operation'),true,'')",'coach_review_reason_required')+`
select public.review_coach_proposal((select id from refs where k='owner-operation'),true,'Synthetic transaction validation');
select public.review_coach_proposal((select id from refs where k='rejected-operation'),false,'Synthetic rejection validation');
select pg_temp.ok('rejection persisted within transaction',(select state='rejected' from public.coach_operations where id=(select id from refs where k='rejected-operation')));
`+actor('owner')+`
insert into refs select 'routine',public.accept_basic_plan((select id from refs where k='owner-operation'));
select pg_temp.ok('atomic idempotent acceptance',public.accept_basic_plan((select id from refs where k='owner-operation'))=(select id from refs where k='routine'));
select pg_temp.ok('one owned routine',count(*)=1) from public.routines where owner_id='${ids.owner}';
select pg_temp.ok('one immutable revision',count(*)=1 and bool_and(snapshot->>'id'=routine_id::text)) from public.routine_revisions where user_id='${ids.owner}';
select pg_temp.ok('full prescription preserved',count(*)=15 and bool_and(e.sets=2 and e.target='8-10' and e.rir='3' and e.rest_seconds=60)) from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id=(select id from refs where k='routine');
select pg_temp.ok('feedback hidden before own workout',not (public.get_my_coach_access()->>'can_feedback')::boolean);
`+err('feedback backend rejects before workout',"select public.save_my_coach_feedback((select id from refs where k='routine'),4,'')",'coach_feedback_workout_required')+
err('managed exercise structure locked',"update public.routine_exercises set name='Forbidden' where day_id in(select id from public.routine_days where routine_id=(select id from refs where k='routine'))",'coach_structure_locked')+
err('managed day structure locked',"update public.routine_days set name='Forbidden' where routine_id=(select id from refs where k='routine')",'coach_structure_locked')+
err('managed routine structure locked',"update public.routines set name='Forbidden' where id=(select id from refs where k='routine')",'coach_structure_locked')+`
insert into public.workouts(user_id,variant,day,data) values('${ids.owner}','Transaction','Transaction',jsonb_build_object('routine_id',(select id from refs where k='routine'),'routine_day_id',(select id from public.routine_days where routine_id=(select id from refs where k='routine') limit 1),'exercises','[]'::jsonb));
select pg_temp.ok('feedback available after own workout',(public.get_my_coach_access()->>'can_feedback')::boolean);
select public.save_my_coach_feedback((select id from refs where k='routine'),4,'Synthetic transaction');
select public.save_my_coach_feedback((select id from refs where k='routine'),5,'Updated transaction');
select pg_temp.ok('feedback update not duplicate',count(*)=1 and bool_and(rating=5)) from public.coach_pilot_feedback where user_id='${ids.owner}';
`+err('invalid rating rejected',"select public.save_my_coach_feedback((select id from refs where k='routine'),6,'')",'coach_invalid_feedback')+
err('long comment rejected',"select public.save_my_coach_feedback((select id from refs where k='routine'),4,repeat('x',1001))",'coach_invalid_feedback')+`
select public.set_my_coach_context_permission('declared_health',false);
`+actor('reviewer')+`select pg_temp.ok('revoked context no longer in queue',not exists(select 1 from jsonb_array_elements(public.get_coach_review_queue()) r where r->'athlete'->>'user_id'='${ids.owner}'));
`+actor('other')+err('other feedback denied',"select public.save_my_coach_feedback((select id from refs where k='routine'),4,'')",'coach_feedback_workout_required')+`
grant select,insert on checks to authenticated;
grant select on refs to authenticated;
set local role authenticated;
select pg_temp.ok('RLS isolates other client',not exists(select 1 from public.training_intakes) and not exists(select 1 from public.coach_operations) and not exists(select 1 from public.coach_pilot_feedback));
reset role;
`+actor('reviewer')+`set local role authenticated;
select pg_temp.ok('reviewer feedback read only',exists(select 1 from public.coach_pilot_feedback) and not has_table_privilege(current_user,'public.coach_pilot_feedback','UPDATE'));
reset role;
select set_config('request.jwt.claims','{}',true);
select pg_temp.ok('cycle RPC unchanged',md5(pg_get_functiondef('public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure))='88c3564c3c49cf9c53fccba89a1e71b5');
select pg_temp.denied('rollback refuses evidence',${q(fs.readFileSync(new URL('../../supabase/rollback-coach-production.sql',import.meta.url),'utf8').match(/do \$guard\$[\s\S]*?end \$guard\$;/)[0])},'coach_rollback_requires_empty_data');
select jsonb_agg(to_jsonb(checks)) as checks from checks;
rollback;
`;
fs.mkdirSync(new URL('./private/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./private/transaction.sql',import.meta.url),sql);console.log('Prepared rollback-only synthetic SQL, no real accounts or API calls.');
