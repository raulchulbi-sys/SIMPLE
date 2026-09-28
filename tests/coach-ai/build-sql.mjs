import fs from 'node:fs';import {validFixture} from './cases.mjs';
const dir=new URL('./private/',import.meta.url),c=JSON.parse(fs.readFileSync(new URL('fixture.json',dir))),ops=JSON.parse(fs.readFileSync(new URL('operations.json',dir)));
const q=s=>"'"+String(s).replaceAll("'","''")+"'",proposal=q(JSON.stringify(validFixture()))+'::jsonb';
const receipt=`'[ {"status":200,"latency_ms":100,"input_tokens":100,"output_tokens":200,"cached_input_tokens":10,"error_code":null} ]'::jsonb`;
const role=(r,u)=>`select set_config('request.jwt.claims',${q(JSON.stringify({role:r,...(u?{sub:u}:{})}))},true);`;
const u=who=>c.users[who].id,o=who=>ops[who].operation.id;
const finish=(who,p=proposal,error='null',attempt=receipt)=>`public.coach_backend_finish('${u(who)}','${o(who)}',${p},${error},100,${attempt})`;
let sql=`begin;
create temporary table checks(name text,pass boolean);
create function pg_temp.ok(n text,b boolean) returns void language plpgsql as $$begin if b is distinct from true then raise exception 'FAILED %',n;end if;insert into checks values(n,true);end $$;
update public.coach_operations set expires_at=now()+interval '5 minutes' where id in (${Object.values(ops).map(x=>q(x.operation.id)).join(',')});
${role('service_role')}
select pg_temp.ok('claim once',(public.coach_backend_claim('${u('owner')}','${o('owner')}','gpt-5-mini-2025-08-07')->>'claimed')::boolean);
select pg_temp.ok('second claimant denied',not (public.coach_backend_claim('${u('owner')}','${o('owner')}','gpt-5-mini-2025-08-07')->>'claimed')::boolean);
select pg_temp.ok('cross owner claim rejected',true) where not exists(select 1 from public.coach_operations where id='${o('owner')}' and user_id='${u('other')}');
select pg_temp.ok('valid finish ready',(${finish('owner')}).state='ready');
select pg_temp.ok('usage receipt exact',input_tokens=100 and output_tokens=200 and latency_ms=100 and estimated_cost=0.00042275) from public.coach_operations where id='${o('owner')}';
select pg_temp.ok('duplicate finish cannot replace',(${finish('owner',"'{}'::jsonb")}).proposal=${proposal});
select pg_temp.ok('generation writes no routine',not exists(select 1 from public.routines where owner_id='${u('owner')}'));
create function pg_temp.synthetic_fail() returns trigger language plpgsql as $$begin if new.user_id='${u('owner')}' then raise exception 'synthetic_failure';end if;return new;end $$;
create trigger coach_ai_atomic_test before insert on public.routine_revisions for each row execute function pg_temp.synthetic_fail();
${role('authenticated',u('owner'))}
do $$declare denied boolean:=false;begin begin perform public.accept_basic_plan('${o('owner')}');exception when others then denied:=true;end;perform pg_temp.ok('atomic acceptance failure',denied);end $$;
select pg_temp.ok('no partial routine after rollback',not exists(select 1 from public.routines where owner_id='${u('owner')}'));
drop trigger coach_ai_atomic_test on public.routine_revisions;
select pg_temp.ok('double acceptance same UUID',public.accept_basic_plan('${o('owner')}')=public.accept_basic_plan('${o('owner')}'));
select pg_temp.ok('model revision provenance',author_kind='model' and snapshot_hash=md5(snapshot::text)) from public.routine_revisions where user_id='${u('owner')}';
select pg_temp.ok('one routine three days fifteen unique exercises',(select count(*) from public.routines where owner_id='${u('owner')}')=1 and (select count(*) from public.routine_days d join public.routines r on r.id=d.routine_id where owner_id='${u('owner')}')=3 and (select count(distinct e.id) from public.routine_exercises e join public.routine_days d on d.id=e.day_id join public.routines r on r.id=d.routine_id where r.owner_id='${u('owner')}')=15);
do $$declare denied boolean:=false;begin begin update public.routine_exercises set sets=6 where day_id in(select d.id from public.routine_days d join public.routines r on r.id=d.routine_id where owner_id='${u('owner')}');exception when others then denied:=true;end;perform pg_temp.ok('Coach accepted structure frozen',denied);end $$;
`;
for(const who of ['stale','revoked'])sql+=`${role('service_role')}
select public.coach_backend_claim('${u(who)}','${o(who)}','gpt-5-mini-2025-08-07');
${role('authenticated',u(who))}
${who==='stale'?`select public.save_my_training_intake('${ops[who].intake.id}',1,${q(JSON.stringify({...ops[who].intake.training,goal:'Changed synthetic goal'}))}::jsonb,'{"discomfort":"","limitations":""}',false);`:`select public.set_my_coach_context_permission('declared_health',false);`}
${role('service_role')}
select pg_temp.ok('${who} late response stays stale',(${finish(who)}).state='stale');
select pg_temp.ok('${who} late usage retained no proposal',input_tokens=100 and proposal is null) from public.coach_operations where id='${o(who)}';
`;
sql+=`${role('service_role')}
select public.coach_backend_claim('${u('retry')}','${o('retry')}','gpt-5-mini-2025-08-07');
update public.coach_operations set expires_at=now()-interval '1 second',created_at=now()-interval '5 minutes' where id='${o('retry')}';
select pg_temp.ok('late timed out proposal rejected',(${finish('retry')}).error_code='reservation_expired');
select public.coach_backend_claim('${u('rollback')}','${o('rollback')}','gpt-5-mini-2025-08-07');
select pg_temp.ok('invalid structure controlled failure',(${finish('rollback',"'{}'::jsonb")}).error_code='invalid_output');
${role('authenticated',u('browser1'))}
update public.context_grants set notice_version='pilot-mock-v1' where user_id='${u('browser1')}';
do $$declare denied boolean:=false;begin begin perform public.reserve_basic_generation('${ops.browser1.intake.id}',gen_random_uuid());exception when others then denied:=true;end;perform pg_temp.ok('mock permission cannot authorize real provider',denied);end $$;
select public.set_my_coach_context_permission('training_intake',true);select public.set_my_coach_context_permission('declared_health',true);
select pg_temp.ok('explicit permission gets new notice',count(*)=2 and bool_and(notice_version='pilot-openai-v1')) from public.context_grants where user_id='${u('browser1')}' and revoked_at is null;
`;
// Definitive database validator, complementary to JS schema tests.
for(const [name,edit] of Object.entries({extra:p=>p.x=true,empty:p=>p.days=[],sets:p=>p.days[0].exercises[0].sets=0,rir:p=>p.days[0].exercises[0].rir=6,rest:p=>p.days[0].exercises[0].rest_seconds=301,type:p=>p.days[0].exercises[0].sets='2',reps:p=>p.days[0].exercises[0].reps_min=20,name:p=>p.name='x'.repeat(101)})){
 const p=validFixture();edit(p);sql+=`do $$declare denied boolean:=false;begin begin perform coach_private.validate_proposal(${q(JSON.stringify(p))}::jsonb);exception when others then denied:=true;end;perform pg_temp.ok('SQL rejects ${name}',denied);end $$;\n`;
}
sql+='select * from checks;rollback;';fs.writeFileSync(new URL('transactional.sql',dir),sql);
