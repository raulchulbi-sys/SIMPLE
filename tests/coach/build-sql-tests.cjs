// Supplemental transactional database tests. Real HTTP JWT tests are security.cjs.
const fs=require('fs'),p=require('path'),c=JSON.parse(fs.readFileSync(p.join(__dirname,'private/fixture.json'))),op=JSON.parse(fs.readFileSync(p.join(__dirname,'private/rollback-operation.json')));
const base=op.proposal,variants=[];
function bad(name,fn){const v=structuredClone(base);fn(v);variants.push([name,v]);}
bad('zero days',p=>p.days=[]);bad('eight days',p=>p.days=Array(8).fill(p.days[0]));bad('empty exercise',p=>p.days[0].exercises[0].name='');bad('seven sets',p=>p.days[0].exercises[0].sets=7);bad('zero sets',p=>p.days[0].exercises[0].sets=0);bad('negative RIR',p=>p.days[0].exercises[0].rir=-1);bad('large RIR',p=>p.days[0].exercises[0].rir=6);bad('negative rest',p=>p.days[0].exercises[0].rest_seconds=-1);bad('large rest',p=>p.days[0].exercises[0].rest_seconds=301);bad('long name',p=>p.name='x'.repeat(101));bad('wrong number type',p=>p.days[0].exercises[0].sets='2');bad('unknown key',p=>p.premium=true);bad('unknown exercise key',p=>p.days[0].exercises[0].sql='DROP');bad('reversed reps',p=>p.days[0].exercises[0].reps_min=20);bad('null RIR',p=>p.days[0].exercises[0].rir=null);bad('no exercises',p=>p.days[0].exercises=[]);bad('nine exercises',p=>p.days[0].exercises=Array(9).fill(p.days[0].exercises[0]));bad('fraction sets',p=>p.days[0].exercises[0].sets=1.5);bad('version two',p=>p.schema_version=2);bad('missing field',p=>delete p.days[0].exercises[0].rest_seconds);
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
let sql=`begin;
create temp table coach_test_results(name text,pass boolean);
create function pg_temp.assert_coach(n text,v boolean) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'FAIL %',n;end if;insert into coach_test_results values(n,true);end $$;
do $$begin perform coach_private.validate_proposal(${q(JSON.stringify(base))}::jsonb);perform pg_temp.assert_coach('strict valid proposal',true);end $$;
`;
for(const[n,v]of variants)sql+=`do $$declare rejected boolean:=false;begin begin perform coach_private.validate_proposal(${q(JSON.stringify(v))}::jsonb);exception when others then rejected:=true;end;perform pg_temp.assert_coach(${q(n)},rejected);end $$;\n`;
sql+=`create function pg_temp.fail_coach_revision() returns trigger language plpgsql as $$begin if new.user_id='${c.users.rollback.id}' then raise exception 'synthetic_failure';end if;return new;end $$;
create trigger coach_test_atomic_failure before insert on public.routine_revisions for each row execute function pg_temp.fail_coach_revision();
select set_config('request.jwt.claims','{"sub":"${c.users.rollback.id}","role":"authenticated"}',true);
do $$declare rejected boolean:=false;begin
 begin perform public.accept_basic_plan('${op.id}');exception when others then if sqlerrm<>'synthetic_failure' then raise;end if;rejected:=true;end;
 perform pg_temp.assert_coach('atomic failure injected',rejected);
 perform pg_temp.assert_coach('no partial routine',not exists(select 1 from public.routines where owner_id='${c.users.rollback.id}'));
 perform pg_temp.assert_coach('operation still ready',(select state='ready' and routine_id is null from public.coach_operations where id='${op.id}'));
 perform pg_temp.assert_coach('no partial revision',not exists(select 1 from public.routine_revisions where user_id='${c.users.rollback.id}'));
 perform pg_temp.assert_coach('no partial management',not exists(select 1 from public.routine_management where user_id='${c.users.rollback.id}'));
end $$;
drop trigger coach_test_atomic_failure on public.routine_revisions;
do $$declare r uuid;begin r:=public.accept_basic_plan('${op.id}');perform pg_temp.assert_coach('accept retry after rollback',r is not null);perform pg_temp.assert_coach('same revision snapshot UUID',(select snapshot->>'id'=r::text from public.routine_revisions where routine_id=r));end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare x public.coach_operations;begin
 update public.coach_operations set state='reserved',proposal=null,error_code=null where user_id='${c.users.retry.id}' and state='ready' returning * into x;
 perform public.coach_backend_finish(x.user_id,x.id,null,'technical_error');
 perform pg_temp.assert_coach('backend controlled technical failure',(select state='failed' and error_code='technical_error' from public.coach_operations where id=x.id));
 perform set_config('request.jwt.claims','{"sub":"${c.users.retry.id}","role":"authenticated"}',true);
 x:=public.reserve_basic_generation(x.intake_id,gen_random_uuid());
 perform pg_temp.assert_coach('technical failure permits new attempt',x.state='reserved');
end $$;
select jsonb_agg(to_jsonb(t)) as results from coach_test_results t;
rollback;`;
fs.writeFileSync(p.join(__dirname,'private/transaction-tests.sql'),sql);console.log('Transactional tests prepared (fixture IDs only).');
