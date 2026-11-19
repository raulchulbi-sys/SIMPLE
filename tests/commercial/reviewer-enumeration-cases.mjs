// SQL/roles in the guarded disposable local cluster; never JWT or staging evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sql,query,asyncSql,OWNER,OTHER} from '../billing-test/postgres-local.mjs';

export function reviewerEnumerationCases({seed,assign,call,auth,waitForDatabaseWait,REVIEWER,FOREIGN,OP,OPB,INTAKE,INTAKEB,ROUTINEB}) {
 const MISSING='ffffffff-ffff-4fff-8fff-ffffffffffff';
 const expression=(action,id)=>action==='review'
  ? `public.review_coach_proposal(${id===null?'null':`'${id}'`},true,'Synthetic review')`
  : `public.authorize_coach_retry(${id===null?'null':`'${id}'`},'Synthetic retry')`;
 const unchanged=()=>query(`select jsonb_build_object('operations',(select jsonb_agg(to_jsonb(o) order by id) from public.coach_operations o),
  'billing',(select jsonb_agg(to_jsonb(s)) from billing_test.subscriptions s),'policy',(select to_jsonb(p) from billing_test.commercial_policy p),
  'pilot',coach_private.pilot_config(),'workouts',(select count(*) from public.workouts),'routines',(select count(*) from public.routines));`);
 // Capture every public diagnostic field, including raw PL/pgSQL context, without
 // introducing a SECURITY DEFINER capture function or swallowing a successful call.
 function denial(action,id,user=REVIEWER,settings='') {
  const r=sql(auth(user,`${settings}do $capture$
   declare s text;m text;d text;h text;c text;t text;col text;k text;ctx text;
   begin
    begin perform ${expression(action,id)};
    exception when others then
     get stacked diagnostics s=returned_sqlstate,m=message_text,d=pg_exception_detail,h=pg_exception_hint,
      c=schema_name,t=table_name,col=column_name,k=constraint_name,ctx=pg_exception_context;
     raise notice 'DENIAL:%',jsonb_build_object('code',s,'message',m,'detail',d,'hint',h,'schema',c,'table',t,'column',col,'constraint',k,'context',ctx);
    end;
    if s is null then raise exception 'EXPECTED_DENIAL_BUT_RPC_SUCCEEDED';end if;
   end $capture$;`),{allowError:true});
  assert.equal(r.ok,true,r.error);
  const match=r.error.match(/DENIAL:(\{[^\r\n]*\})/);assert(match,r.error);
  const diagnostic=JSON.parse(match[1]);
  // PostgreSQL includes the caller's submitted SQL in its stack. Remove only
  // that exact known expression; retain all server-side frames/fields/values.
  diagnostic.context=diagnostic.context.replaceAll(expression(action,id),'[caller-supplied expression]');
  return diagnostic;
 }
 const checkDenial=d=>{
  assert.equal(d.code,'42501');assert.equal(d.message,'coach_review_scope_required');
  for(const key of ['detail','hint','schema','table','column','constraint'])assert.equal(d[key],'');
  for(const secret of [OP,OPB,OWNER,OTHER,'PRIVATE','grant_ids','raw_private_receipt'])assert(!JSON.stringify(d).includes(secret));
 };
 const scenarios=['unassigned','missing','null','self','view-only','wrong-action','missing-view','revoked','expired','admission-disabled','admission-expired','consent-revoked','consent-replaced'];
 for(const action of ['review','retry'])for(const scenario of scenarios)test(`enumeration: ${action} uniform denial ${scenario}`,()=>{
  seed();let target=OP;
  if(scenario==='missing')target=MISSING;
  else if(scenario==='null')target=null;
  else if(scenario==='self'){
   // Keep the composite FK valid: create a distinct synthetic own operation.
   sql(`insert into public.training_intakes(id,user_id) values('${MISSING}','${REVIEWER}');
    insert into public.coach_operations(id,user_id,intake_id,state,grant_ids) values('${MISSING}','${REVIEWER}','${MISSING}','failed','{}');`);
   target=MISSING;
  }else if(!['unassigned'].includes(scenario)){
   assign(scenario==='view-only'?['view']:scenario==='wrong-action'?['view',action==='review'?'retry':'review']:scenario==='missing-view'?[action]:undefined);
   if(scenario==='revoked')sql('update coach_private.review_assignments set revoked_at=clock_timestamp();');
   if(scenario==='expired')sql("update coach_private.review_assignments set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour';");
   if(scenario==='admission-disabled')sql("update coach_private.local_config set reviewers='{}';");
   if(scenario==='admission-expired')sql(`update coach_private.local_config set reviewers=jsonb_set(reviewers,array['${REVIEWER}','expires_at'],to_jsonb(clock_timestamp()-interval '1 second'));`);
   if(scenario.startsWith('consent-'))sql(`update public.context_grants set revoked_at=clock_timestamp() where user_id='${OWNER}';`);
   if(scenario==='consent-replaced')sql(`insert into public.context_grants(user_id) values('${OWNER}');`);
  }
  const before=unchanged(),actual=denial(action,target),absent=denial(action,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  checkDenial(actual);assert.deepEqual(actual,absent,'SQLSTATE, message, details AND context must be indistinguishable');
  assert.deepEqual(unchanged(),before);
 });

 for(const action of ['review','retry'])test(`enumeration: ${action} denied request never waits on foreign owner or operation lock`,async()=>{
  seed();assign(['view']);
  const holder=asyncSql(`set application_name='unauthorized_lock_holder';begin;
   select pg_advisory_xact_lock(hashtextextended('coach:${OWNER}',0));select 1 from public.coach_operations where id='${OP}' for update;
   select pg_sleep(1.5);commit;`);
  await waitForDatabaseWait('unauthorized_lock_holder','Timeout');
  try{
   // A lock attempt would time out (55P03), rather than produce our normal denial.
   checkDenial(denial(action,OP,REVIEWER,"set lock_timeout='100ms';"));
   checkDenial(denial(action,MISSING,REVIEWER,"set lock_timeout='100ms';"));
  }finally{assert.equal((await holder).ok,true);}
 });

 for(const action of ['review','retry'])for(const wait of ['owner','assignment','operation'])
 for(const change of ['scope-revoked','admission-disabled','consent-revoked'].filter(c=>wait!=='operation'||c!=='scope-revoked'))test(`enumeration: ${action} rechecks ${change} after ${wait} wait`,async()=>{
  seed();assign();if(action==='retry')sql(`update public.coach_operations set state='failed' where id='${OP}';`);
  const before=unchanged();
  const lock=wait==='owner'?`select pg_advisory_xact_lock(hashtextextended('coach:${OWNER}',0));`:
   wait==='assignment'?`select 1 from coach_private.review_assignments where operation_id='${OP}' for update;`:
   `select 1 from public.coach_operations where id='${OP}' for update;`;
  const mutate=change==='scope-revoked'?'update coach_private.review_assignments set revoked_at=clock_timestamp();':
   change==='admission-disabled'?"update coach_private.local_config set reviewers='{}';":
   `update public.context_grants set revoked_at=clock_timestamp() where user_id='${OWNER}';`;
  const holder=asyncSql(`set application_name='enumeration_race_holder';begin;${lock}${mutate}select pg_sleep(1.3);commit;`);
  await waitForDatabaseWait('enumeration_race_holder','Timeout');
  const pending=asyncSql(auth(REVIEWER,`set application_name='enumeration_race_action';select ${expression(action,OP)};`));
  await waitForDatabaseWait('enumeration_race_action','Lock');
  const [a,b]=await Promise.all([holder,pending]);assert.equal(a.ok,true,a.error);assert.equal(b.ok,false);
  assert.match(b.error,/coach_review_scope_required/);assert.deepEqual(unchanged(),before);
 });

 for(const action of ['review','retry'])test(`enumeration: ${action} assignment lock serializes revocation after operation wait`,async()=>{
  seed();assign();if(action==='retry')sql(`update public.coach_operations set state='failed' where id='${OP}';`);
  const holder=asyncSql(`set application_name='serial_operation_holder';begin;select 1 from public.coach_operations where id='${OP}' for update;select pg_sleep(2.2);commit;`);
  await waitForDatabaseWait('serial_operation_holder','Timeout');
  const writer=asyncSql(auth(REVIEWER,`set application_name='serial_writer';select ${expression(action,OP)};`));
  await waitForDatabaseWait('serial_writer','Lock');
  const revoke=asyncSql(`set application_name='serial_revoker';update coach_private.review_assignments set revoked_at=clock_timestamp() where operation_id='${OP}';`);
  await waitForDatabaseWait('serial_revoker','Lock');
  assert.equal(query("select to_jsonb(exists(select 1 from pg_stat_activity a join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid)) where a.application_name='serial_revoker' and b.application_name='serial_writer'));"),true);
  const results=await Promise.all([holder,writer,revoke]);for(const r of results)assert.equal(r.ok,true,r.error);
  // Review committed before revocation (not a stale permission used afterwards).
  checkDenial(denial(action,OP));
  const row=query(`select to_jsonb(o) from public.coach_operations o where id='${OP}';`);
  assert.equal(row.state,action==='review'?'ready':'failed');
  if(action==='retry')assert.equal(row.retry_authorized_by,REVIEWER);
 });

 for(const action of ['review','retry'])for(const expiry of ['assignment','admission'])test(`enumeration: ${action} rechecks ${expiry} expiry after assignment wait`,async()=>{
  seed();assign();if(action==='retry')sql(`update public.coach_operations set state='failed' where id='${OP}';`);
  const before=unchanged();
  if(expiry==='assignment')sql("update coach_private.review_assignments set expires_at=clock_timestamp()+interval '1 second';");
  else sql(`update coach_private.local_config set reviewers=jsonb_set(reviewers,array['${REVIEWER}','expires_at'],to_jsonb(clock_timestamp()+interval '1 second'));`);
  const holder=asyncSql(`set application_name='enumeration_expiry_holder';begin;select 1 from coach_private.review_assignments where operation_id='${OP}' for update;select pg_sleep(2);commit;`);
  await waitForDatabaseWait('enumeration_expiry_holder','Timeout');
  const pending=asyncSql(auth(REVIEWER,`set application_name='enumeration_expiry_action';select ${expression(action,OP)};`));
  await waitForDatabaseWait('enumeration_expiry_action','Lock');
  const [a,b]=await Promise.all([holder,pending]);assert.equal(a.ok,true);
  assert.equal(b.ok,false);assert.match(b.error,/scope_required/);assert.deepEqual(unchanged(),before);
 });

 test('enumeration: private helpers are not alternate public oracles',()=>{
  seed();assign();
  for(const role of ['anon','authenticated','service_role'])for(const name of ['coach_private.can_review_operation(uuid,uuid,text)','coach_private.lock_review_scope(uuid,text)'])
   assert.equal(query(`select to_jsonb(has_function_privilege('${role}','${name}','execute'));`),false);
  assert.equal(call(REVIEWER,`public.coach_feedback_in_review_scope('${OTHER}','${ROUTINEB}')`),false);
  assert.equal(call(REVIEWER,`public.coach_feedback_in_review_scope('${OTHER}','${MISSING}')`),false);
  assert.equal(call(FOREIGN,'public.get_coach_reviewer_access()'),false);assert.deepEqual(call(FOREIGN,'public.get_coach_review_queue()'),[]);
  assert.equal(call(FOREIGN,'public.get_coach_reviewer_status()').authorized,false);
  for(const table of ['coach_operations','training_intakes'])assert.equal(call(REVIEWER,`to_jsonb((select count(*) from public.${table}))`),0);
 });
 test('enumeration: legitimate retry is idempotent and cannot authorize a second operation',()=>{
  seed();assign(['view','retry']);sql(`update public.coach_operations set state='failed' where id='${OP}';`);
  assert.equal(call(REVIEWER,expression('retry',OP)),true);const before=unchanged();
  assert.equal(call(REVIEWER,expression('retry',OP)),true);assert.deepEqual(unchanged(),before);
  checkDenial(denial('retry',OPB));assert.deepEqual(unchanged(),before);
 });
 test('enumeration: authorized rejection has safe projection and keeps unrelated operation intact',()=>{
  seed();assign(['view','review']);const other=query(`select to_jsonb(o) from public.coach_operations o where id='${OPB}';`);
  const row=call(REVIEWER,`public.review_coach_proposal('${OP}',false,'Synthetic rejection')`);
  assert.equal(row.state,'rejected');assert.equal(row.raw_private_receipt,null);assert.equal(row.idempotency_key,null);assert.equal(row.grant_ids,null);
  assert.equal(JSON.stringify(row).includes('PRIVATE'),false);
  assert.deepEqual(query(`select to_jsonb(o) from public.coach_operations o where id='${OPB}';`),other);
 });
 test('enumeration: narrow closed rollback and replacement retain all other definitions, ACL and data',()=>{
  seed();assign();
  const catalogue=()=>query(`select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'body',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl) order by p.oid)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','coach_private','billing_test')),
   'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p),
   'tables',(select jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity) order by c.oid)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','coach_private','billing_test') and c.relkind='r'));`);
  const before=catalogue(),data=unchanged();
  const targets=['public.review_coach_proposal(uuid,boolean,text)','public.authorize_coach_retry(uuid,text)'];
  const ids=query(`select jsonb_agg(x::regprocedure::oid) from unnest(array[${targets.map(x=>`'${x}'`).join(',')}]) x;`);
  sql(fs.readFileSync(new URL('../../supabase/rollback-coach-reviewer-uniform-denial.sql',import.meta.url),'utf8'));
  for(const action of ['review','retry'])checkDenial(denial(action,OP));
  const after=catalogue();
  assert.deepEqual(after.policies,before.policies);assert.deepEqual(after.tables,before.tables);
  assert.deepEqual(after.functions.filter(f=>!ids.includes(f.oid)),before.functions.filter(f=>!ids.includes(f.oid)));
  for(const f of after.functions.filter(f=>ids.includes(f.oid))){const old=before.functions.find(x=>x.oid===f.oid);assert.equal(f.owner,old.owner);assert.deepEqual(f.acl,old.acl);}
  const source=fs.readFileSync(new URL('../../supabase/coach-reviewer-scope.sql',import.meta.url),'utf8');
  const bodies=[...source.matchAll(/create or replace function public\.(review_coach_proposal|authorize_coach_retry)\([\s\S]*?end \$\$;/gi)].map(m=>m[0]);
  assert.equal(bodies.length,2);sql('begin;\n'+bodies.join('\n')+'\ncommit;');
  assert.deepEqual(catalogue(),before);assert.deepEqual(unchanged(),data);
  assert.equal(call(REVIEWER,expression('review',OP)).state,'ready');
 });
}
