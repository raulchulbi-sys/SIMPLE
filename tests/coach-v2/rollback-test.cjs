// Generate transaction-only rollback + reapply verification. Root executes it in staging only.
const fs=require('node:fs');
const before=JSON.parse(fs.readFileSync('tests/coach-v2/private/before.json','utf8')).production.functions;
const migration=fs.readFileSync('supabase/migrations/20260928223506_coach_pilot_training_only_v2.sql','utf8');
const names=[...migration.matchAll(/create\s+(?:or\s+replace\s+)?function\s+((?:public|coach_private)\.\w+)/gi)].map(x=>x[1].toLowerCase());
let rollback=fs.readFileSync('supabase/rollback-coach-pilot-v2.sql','utf8').replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const snapshot=`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'hash',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='coach_private' or (n.nspname='public' and p.proname in ('get_my_coach_access','save_my_training_intake','set_my_coach_context_permission','reserve_basic_generation','accept_basic_plan','coach_backend_context','coach_backend_claim','coach_backend_finish','delete_my_training_intake','get_coach_reviewer_status','get_coach_review_queue','get_coach_reviewer_access','review_coach_proposal','authorize_coach_retry','decline_my_coach_proposal','get_coach_pilot_metrics','save_my_coach_feedback'))`;
let sql=`begin;
create temp table checks(name text,pass boolean);
create function pg_temp.ok(n text,b boolean) returns void language plpgsql as $$begin if b is distinct from true then raise exception 'FAIL %',n;end if;insert into checks values(n,true);end$$;
create temp table original_v2 as ${snapshot};
${rollback}
`;
for(const f of before.filter(f=>names.includes(f.schema+'.'+f.name)))sql+=`select pg_temp.ok(${q('exact old function '+f.schema+'.'+f.name)},md5(pg_get_functiondef(${q((f.signature.includes('.')?'':'public.')+f.signature)}::regprocedure))=${q(f.hash)});\n`;
sql+=`select pg_temp.ok('new endpoints removed',to_regprocedure('public.delete_my_training_intake(uuid,bigint)') is null and to_regprocedure('public.get_coach_reviewer_status()') is null);
select pg_temp.ok('health read privilege restored',has_table_privilege('authenticated','public.intake_health','SELECT'));
select pg_temp.ok('save owner ACL restored',(select pg_get_userbyid(proowner)='postgres' and proacl::text='{postgres=X/postgres,authenticated=X/postgres}' from pg_proc where oid='public.save_my_training_intake(uuid,bigint,jsonb,jsonb,boolean)'::regprocedure));
${migration}
select pg_temp.ok('reapply exact v2 functions owners ACL settings',(${snapshot})=(select * from original_v2));
select pg_temp.ok('reapply disables health read',not has_table_privilege('authenticated','public.intake_health','SELECT'));
select jsonb_agg(to_jsonb(checks)) as checks from checks;
rollback;
`;
fs.writeFileSync('tests/coach-v2/private/rollback-test.sql',sql);
console.log('Prepared '+(sql.match(/select pg_temp\.ok\(/g)||[]).length+' rollback/reapply checks. No network calls.');
