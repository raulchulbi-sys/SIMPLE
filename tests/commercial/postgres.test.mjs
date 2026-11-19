import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setup,reset as billingReset,sql,query,rpc,access,asyncSql,OWNER,OTHER} from '../billing-test/postgres-local.mjs';
import {harness,load} from '../billing-test/harness.mjs';
import {reviewerEnumerationCases} from './reviewer-enumeration-cases.mjs';
const read=f=>fs.readFile(new URL(f,import.meta.url),'utf8');
// setup verifies the fixed loopback server before any fixture mutation.
await setup();sql('drop schema if exists coach_private cascade;');
sql(await read('fixtures/coach-local.sql'));sql(await read('fixtures/coach-original-functions.sql'));
sql('revoke all on all functions in schema coach_private from public,anon,authenticated,service_role;');
sql(await read('../../supabase/billing-test-commercial.sql'));
sql(await read('../../supabase/billing-test-coach-gate.sql'));
sql(await read('../../supabase/coach-reviewer-scope.sql'));
const REVIEWER='33333333-3333-4333-8333-333333333333',FOREIGN='44444444-4444-4444-8444-444444444444';
const OP='aaaaaaaa-0000-4000-8000-000000000001',OPB='bbbbbbbb-0000-4000-8000-000000000002';
const INTAKE='aaaaaaaa-1111-4111-8111-111111111111',INTAKEB='bbbbbbbb-1111-4111-8111-111111111111';
const ROUTINE='aaaaaaaa-2222-4222-8222-222222222222',ROUTINEB='bbbbbbbb-2222-4222-8222-222222222222';
const auth=(user,body)=>`set role authenticated;set request.jwt.claim.sub='${user}';${body}`;
function seed(operations=true){
 billingReset();sql(`truncate coach_private.review_assignments,public.coach_operations,public.training_intakes,public.context_grants,public.routines,public.coach_pilot_feedback,public.routine_management,public.workouts cascade;
 insert into auth.users values('${REVIEWER}'),('${FOREIGN}') on conflict do nothing;
 insert into public.profiles values('${REVIEWER}','trainer','Synthetic reviewer'),('${FOREIGN}','trainer','Other synthetic reviewer') on conflict do nothing;
 update coach_private.local_config set pilot=jsonb_build_object('${OWNER}',jsonb_build_object('enabled',true,'expires_at',now()+interval '1 day','generation_limit',1),'${OTHER}',jsonb_build_object('enabled',true,'expires_at',now()+interval '1 day','generation_limit',1)),reviewers=jsonb_build_object('${REVIEWER}',jsonb_build_object('enabled',true,'expires_at',now()+interval '1 day'),'${FOREIGN}',jsonb_build_object('enabled',true,'expires_at',now()+interval '1 day'));
 update billing_test.commercial_policy set basic_generation_enabled=false;
 insert into public.training_intakes(id,user_id,training) values('${INTAKE}','${OWNER}','{"goal":"strength","inventory":{"custom":["PRIVATE"],"equipment":["dumbbell"]}}'),('${INTAKEB}','${OTHER}','{"goal":"strength"}');
 insert into public.context_grants(user_id) values('${OWNER}'),('${OTHER}');
 insert into public.routines values('${ROUTINE}','${OWNER}','Synthetic A'),('${ROUTINEB}','${OTHER}','Synthetic B');
 insert into public.coach_pilot_feedback values('${OWNER}','${ROUTINE}','A private feedback',4),('${OTHER}','${ROUTINEB}','B private feedback',5);`);
 if(operations)sql(`insert into public.coach_operations(id,user_id,intake_id,state,grant_ids,routine_id,proposal,prompt_version,raw_private_receipt)
 select '${OP}'::uuid,'${OWNER}'::uuid,'${INTAKE}'::uuid,'pending_review',array_agg(id),'${ROUTINE}'::uuid,'{}'::jsonb,'basic-initial-v5','{"hidden":"PRIVATE_RECEIPT"}'::jsonb from public.context_grants where user_id='${OWNER}'
 union all select '${OPB}'::uuid,'${OTHER}'::uuid,'${INTAKEB}'::uuid,'pending_review',array_agg(id),'${ROUTINEB}'::uuid,'{}'::jsonb,'basic-initial-v5','{}'::jsonb from public.context_grants where user_id='${OTHER}';`);
}
function assign(actions=['view','review','retry']){sql(`insert into coach_private.review_assignments(operation_id,reviewer_id,owner_id,actions,expires_at) values('${OP}','${REVIEWER}','${OWNER}',array[${actions.map(x=>"'"+x+"'").join(',')}],clock_timestamp()+interval '1 hour');`);}
const call=(user,expr)=>query(auth(user,"select coalesce(to_jsonb("+expr+"),'null'::jsonb);"));
const reject=(user,expr,pattern)=>{const r=sql(auth(user,'select '+expr+';'),{allowError:true});assert.equal(r.ok,false);if(pattern)assert.match(r.error,pattern);};
async function paid(){const h=harness();h.rpc=rpc;const now=Math.floor(Date.now()/1000);h.f.inv.lines.data[0].period={start:now-100,end:now+2591900};h.f.inv.status_transitions.paid_at=now-90;await(await load(h)).reconcile(h.stripe,h.rpc,OWNER,h.f.prices);}
test('read-only Customer RPC cannot be called by authenticated/anon or create mapping',()=>{
 seed();for(const role of ['authenticated','anon'])assert.equal(sql(`set role ${role};select public.billing_test_read_customer('${OWNER}');`,{allowError:true}).ok,false);
 assert.equal(query(`set role service_role;select coalesce(public.billing_test_read_customer('${FOREIGN}'),'null'::jsonb);`),null);
 assert.equal(query('select to_jsonb(count(*)) from billing_test.customers;'),2);
});
test('global reviewer admission alone sees zero assigned operations and no other feedback',()=>{
 seed();assert.equal(call(REVIEWER,'public.get_coach_reviewer_access()'),false);assert.deepEqual(call(REVIEWER,'public.get_coach_review_queue()'),[]);
 assert.equal(call(REVIEWER,'to_jsonb((select count(*) from public.coach_pilot_feedback))'),0);reject(REVIEWER,`public.review_coach_proposal('${OP}',true,'review')`,/scope_required/);
});
test('assignment filters queue, metrics and feedback to exactly one owner; private receipt/custom context absent',()=>{
 seed();assign();const rows=call(REVIEWER,'public.get_coach_review_queue()');assert.equal(rows.length,1);assert.equal(rows[0].operation.id,OP);
 assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);assert.equal(rows[0].operation.idempotency_key,undefined);
 assert.equal(call(REVIEWER,'public.get_coach_pilot_metrics()').authorized,1);
 assert.equal(call(REVIEWER,'to_jsonb((select count(*) from public.coach_pilot_feedback))'),1);
 assert.equal(call(FOREIGN,'to_jsonb((select count(*) from public.coach_pilot_feedback))'),0);
 reject(REVIEWER,`public.review_coach_proposal('${OPB}',true,'review')`,/scope_required/);
});
test('owner RLS still reads own proposal and feedback but cannot approve it',()=>{
 seed();assert.equal(call(OWNER,'to_jsonb((select count(*) from public.coach_operations))'),1);assert.equal(call(OWNER,'to_jsonb((select count(*) from public.coach_pilot_feedback))'),1);
 reject(OWNER,`public.review_coach_proposal('${OP}',true,'self')`,/scope_required/);
});
for(const state of ['view-only','expired','revoked','consent-revoked','reviewer-disabled'])test('review scope denies '+state,()=>{
 seed();assign(state==='view-only'?['view']:undefined);
 if(state==='expired')sql(`update coach_private.review_assignments set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour';`);
 if(state==='revoked')sql('update coach_private.review_assignments set revoked_at=now();');
 if(state==='consent-revoked')sql(`update public.context_grants set revoked_at=now() where user_id='${OWNER}';`);
 if(state==='reviewer-disabled')sql(`update coach_private.local_config set reviewers='{}';`);
 reject(REVIEWER,`public.review_coach_proposal('${OP}',true,'review')`,/scope_required|reviewer_required/);
 assert.equal(query(`select to_jsonb(state) from public.coach_operations where id='${OP}';`),'pending_review');
});
test('assigned human approval is one transition and cannot reapprove or approve another owner',()=>{
 seed();assign();const row=call(REVIEWER,`to_jsonb(public.review_coach_proposal('${OP}',true,'Synthetic reviewed'))`);assert.equal(row.state,'ready');assert.equal(row.reviewed_by,REVIEWER);
 reject(REVIEWER,`public.review_coach_proposal('${OP}',true,'again')`,/not_pending/);assert.equal(query(`select to_jsonb(review_reason) from public.coach_operations where id='${OP}';`),'Synthetic reviewed');
});
test('human review RPC returns only safe fields, preserving private receipt in storage',()=>{
 seed();assign();const row=call(REVIEWER,`to_jsonb(public.review_coach_proposal('${OP}',true,'Synthetic reviewed'))`);
 assert.equal(row.state,'ready');assert.equal(row.id,OP);
 assert.equal(row.raw_private_receipt,null);assert.equal(row.idempotency_key,null);assert.equal(row.grant_ids,null);
 assert.equal(JSON.stringify(row).includes('PRIVATE_RECEIPT'),false);
 assert.equal(query(`select to_jsonb(raw_private_receipt->>'hidden') from public.coach_operations where id='${OP}';`),'PRIVATE_RECEIPT');
});
test('reviewer cannot directly read operation/intake private rows or manipulate another identifier',()=>{
 seed();assign();
 for(const table of ['coach_operations','training_intakes'])assert.equal(call(REVIEWER,`to_jsonb((select count(*) from public.${table}))`),0);
 reject(REVIEWER,"public.review_coach_proposal('ffffffff-ffff-4fff-8fff-ffffffffffff',true,'wrong')",/scope_required/);
 reject(OTHER,`public.review_coach_proposal('${OP}',true,'wrong')`,/scope_required/);
});
test('concurrent approval resolves once; second action cannot rewrite decision',async()=>{
 seed();assign();
 const jobs=await Promise.all([true,false].map(approve=>asyncSql(auth(REVIEWER,`select public.review_coach_proposal('${OP}',${approve},'Concurrent synthetic');`))));
 assert.equal(jobs.filter(r=>r.ok).length,1);assert.match(jobs.find(r=>!r.ok).error,/not_pending/);
 assert.equal(query(`select to_jsonb(count(*)) from public.coach_operations where id='${OP}' and review_decision is not null;`),1);
});
test('revocation committed before waiting review acquires scope denies the review',async()=>{
 seed();assign();
 const revoke=asyncSql(`set application_name='revoke_holder';begin;select pg_advisory_xact_lock(hashtextextended('coach:${OWNER}',0));update coach_private.review_assignments set revoked_at=clock_timestamp();select pg_sleep(1.2);commit;`);
 await waitForDatabaseWait('revoke_holder','Timeout');
 const review=asyncSql(auth(REVIEWER,`set application_name='revoke_action';select public.review_coach_proposal('${OP}',true,'late');`));
 await waitForDatabaseWait('revoke_action','Lock');
 const [a,b]=await Promise.all([revoke,review]);assert.equal(a.ok,true);assert.equal(b.ok,false);assert.match(b.error,/scope_required/);
 assert.equal(query(`select to_jsonb(state) from public.coach_operations where id='${OP}';`),'pending_review');
});
test('retry requires its explicit scope and never generates or accepts a routine',()=>{
 seed();assign(['view']);sql(`update public.coach_operations set state='failed' where id='${OP}';`);
 reject(REVIEWER,`public.authorize_coach_retry('${OP}','retry')`,/scope_required/);
 sql(`update coach_private.review_assignments set actions=array['view','retry'];`);assert.equal(call(REVIEWER,`public.authorize_coach_retry('${OP}','Synthetic retry')`),true);
 const row=query(`select to_jsonb(o) from public.coach_operations o where id='${OP}';`);assert.equal(row.state,'failed');assert.equal(row.generation_started_at,null);
});
test('assignment owner/self constraints and all write grants fail closed',()=>{
 seed();assert.equal(sql(`insert into coach_private.review_assignments values('${OP}','${OWNER}','${OWNER}',array['view'],now(),now()+interval '1 hour',null);`,{allowError:true}).ok,false);
 assert.equal(sql(`insert into coach_private.review_assignments values('${OP}','${REVIEWER}','${OTHER}',array['view'],now(),now()+interval '1 hour',null);`,{allowError:true}).ok,false);
 for(const role of ['anon','authenticated','service_role'])assert.equal(query(`select to_jsonb(has_table_privilege('${role}','coach_private.review_assignments','insert'));`),false);
 reject(REVIEWER,`coach_private.lock_review_scope('${OP}','review')`,/permission denied/);
});
test('review permission expiring while waiting for athlete lock is rechecked with wall clock',async()=>{
 seed();assign();
 const a=asyncSql(`set application_name='athlete_expiry_holder';begin;select pg_advisory_xact_lock(hashtextextended('coach:${OWNER}',0));select pg_sleep(2.2);commit;`);
 await waitForDatabaseWait('athlete_expiry_holder','Timeout');
 sql("update coach_private.review_assignments set expires_at=clock_timestamp()+interval '1 second';");
 const b=asyncSql(auth(REVIEWER,`set application_name='athlete_expiry_action';select public.review_coach_proposal('${OP}',true,'late');`));
 await waitForDatabaseWait('athlete_expiry_action','Lock');
 const results=await Promise.all([a,b]);assert.equal(results[0].ok,true);assert.equal(results[1].ok,false);assert.match(results[1].error,/scope_required/);
});
async function waitForDatabaseWait(application,waitType){
 const until=Date.now()+1500;
 while(Date.now()<until){
  if(query(`select to_jsonb(exists(select 1 from pg_stat_activity where application_name='${application}' and wait_event_type='${waitType}'));`))return;
  await new Promise(r=>setTimeout(r,20));
 }
 throw Error('Expected controlled local database wait: '+application+'/'+waitType);
}
for(const action of ['review','retry'])for(const expiry of ['assignment','reviewer'])test(`${action} rechecks ${expiry} expiry after operation row lock`,async()=>{
 seed();assign();
 if(action==='retry')sql(`update public.coach_operations set state='failed' where id='${OP}';`);
 const holder=asyncSql(`set application_name='scope_expiry_holder';begin;select 1 from public.coach_operations where id='${OP}' for update;select pg_sleep(2.2);commit;`);
 await waitForDatabaseWait('scope_expiry_holder','Timeout');
 if(expiry==='assignment')sql("update coach_private.review_assignments set expires_at=clock_timestamp()+interval '1 second';");
 else sql(`update coach_private.local_config set reviewers=jsonb_set(reviewers,array['${REVIEWER}','expires_at'],to_jsonb(clock_timestamp()+interval '1 second'));`);
 const expression=action==='review'?`public.review_coach_proposal('${OP}',true,'expired while waiting')`:`public.authorize_coach_retry('${OP}','expired while waiting')`;
 const pending=asyncSql(auth(REVIEWER,`set application_name='scope_expiry_action';select ${expression};`));
 await waitForDatabaseWait('scope_expiry_action','Lock');
 const [a,b]=await Promise.all([holder,pending]);assert.equal(a.ok,true);
 assert.equal(b.ok,false,'a scope that expires during the row lock wait must deny mutation');assert.match(b.error,/scope_required/);
 const row=query(`select to_jsonb(o) from public.coach_operations o where id='${OP}';`);
 assert.equal(row.state,action==='review'?'pending_review':'failed');assert.equal(row.review_decision,null);assert.equal(row.retry_authorized_at,null);
});

test('commercial gate is closed by default even after verified Basic payment; does not grant Premium',async()=>{
 seed(false);await paid();const cap=call(OWNER,'public.billing_test_capabilities()');assert.equal(cap.basicActive,true);assert.equal(cap.basicGenerationEnabled,false);assert.equal(cap.premiumEnabled,false);
 reject(OWNER,`public.reserve_basic_generation('${INTAKE}',gen_random_uuid())`,/generation_unavailable/);assert.equal(call(OWNER,'public.get_my_coach_access()').can_generate,false);
});
test('free and other user cannot generate when synthetic commercial switch is enabled',()=>{
 seed(false);sql('update billing_test.commercial_policy set basic_generation_enabled=true;');for(const u of [OWNER,OTHER])reject(u,`public.reserve_basic_generation('${u===OWNER?INTAKE:INTAKEB}',gen_random_uuid())`,/generation_unavailable/);
});
test('paid Basic passes original consent/quota/idempotency/review logic only; no auto acceptance',async()=>{
 seed(false);await paid();sql('update billing_test.commercial_policy set basic_generation_enabled=true;');const key='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const first=call(OWNER,`to_jsonb(public.reserve_basic_generation('${INTAKE}','${key}'))`),second=call(OWNER,`to_jsonb(public.reserve_basic_generation('${INTAKE}','${key}'))`);
 assert.equal(first.id,second.id);assert.equal(first.state,'reserved');assert.equal(first.review_required,true);assert.equal(first.routine_id,null);assert.equal(first.proposal,null);
 sql(`update public.coach_operations set state='accepted',routine_id='${ROUTINE}' where id='${first.id}';insert into public.training_intakes(user_id,revision) values('${OWNER}',2);`);
 const intake=query(`select to_jsonb(id) from public.training_intakes where user_id='${OWNER}' and revision=2;`);reject(OWNER,`public.reserve_basic_generation('${intake}',gen_random_uuid())`,/generation_limit/);
 assert.equal(call(OWNER,'public.billing_test_capabilities()').premiumEnabled,false);
});
for(const reason of ['consent','admission','intake','foreign intake','refund','expired period'])test('paid Basic gate preserves denial: '+reason,async()=>{
 seed(false);await paid();sql('update billing_test.commercial_policy set basic_generation_enabled=true;');
 if(reason==='consent')sql(`update public.context_grants set revoked_at=now() where user_id='${OWNER}';`);
 if(reason==='admission')sql("update coach_private.local_config set pilot='{}';");
 if(reason==='intake')sql(`update public.training_intakes set training='{"invalid":true}' where id='${INTAKE}';`);
 if(reason==='refund')sql('update billing_test.invoices set refunded=amount;');
 if(reason==='expired period')sql('update billing_test.invoices set period_start=extract(epoch from now())::bigint-2592100,period_end=extract(epoch from now())::bigint-100;');
 reject(OWNER,`public.reserve_basic_generation('${reason==='foreign intake'?INTAKEB:INTAKE}',gen_random_uuid())`,/context_required|pilot_required|invalid_intake|current_intake_required|generation_unavailable/);
 assert.equal(query('select to_jsonb(count(*)) from public.coach_operations;'),0);
});
test('cancel-at-period-end keeps paid Basic until expiry; expired access denies new reservations',async()=>{
 seed(false);await paid();sql("update billing_test.commercial_policy set basic_generation_enabled=true;update billing_test.subscriptions set cancel_at_period_end=true;");assert.equal(access(OWNER).plan,'basic');assert.equal(call(OWNER,'public.billing_test_capabilities()').basicGenerationEnabled,true);
 sql('update billing_test.invoices set period_start=extract(epoch from now())::bigint-2592100,period_end=extract(epoch from now())::bigint-100;');assert.equal(call(OWNER,'public.billing_test_capabilities()').basicGenerationEnabled,false);
});
test('commercial generation refuses a pilot configuration without human review',async()=>{
 seed(false);await paid();sql('update billing_test.commercial_policy set basic_generation_enabled=true;create or replace function coach_private.review_required() returns boolean language sql as $$select false$$;');
 try{reject(OWNER,`public.reserve_basic_generation('${INTAKE}',gen_random_uuid())`,/generation_unavailable/);}finally{sql('create or replace function coach_private.review_required() returns boolean language sql as $$select true$$;');}
});
test('paid period expiring while waiting for Customer lock cannot authorize a new generation',async()=>{
 seed(false);await paid();sql('update billing_test.commercial_policy set basic_generation_enabled=true;');
 const holder=asyncSql(`set application_name='paid_expiry_holder';begin;select 1 from billing_test.customers where user_id='${OWNER}' for update;select pg_sleep(2.5);commit;`);
 await waitForDatabaseWait('paid_expiry_holder','Timeout');
 sql("update billing_test.invoices set period_start=extract(epoch from clock_timestamp())::bigint+1-2592000,period_end=extract(epoch from clock_timestamp())::bigint+1;");
 const action=asyncSql(auth(OWNER,`set application_name='paid_expiry_action';select public.reserve_basic_generation('${INTAKE}',gen_random_uuid());`));
 await waitForDatabaseWait('paid_expiry_action','Lock');
 assert.equal(query("select to_jsonb(exists(select 1 from pg_stat_activity a join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid)) where a.application_name='paid_expiry_action' and b.application_name='paid_expiry_holder'));"),true);
 const result=await Promise.all([holder,action]);assert.equal(result[0].ok,true);assert.equal(result[1].ok,false);assert.match(result[1].error,/generation_unavailable/);
 assert.equal(query('select to_jsonb(count(*)) from public.coach_operations;'),0);
});
reviewerEnumerationCases({seed,assign,call,auth,waitForDatabaseWait,REVIEWER,FOREIGN,OP,OPB,INTAKE,INTAKEB,ROUTINEB});

test('fail-closed reviewer rollback compiles, retains history and owner reads, denies global access',async()=>{
 seed();assign();sql(await read('../../supabase/rollback-coach-reviewer-scope.sql'));
 assert.equal(call(REVIEWER,'public.get_coach_reviewer_access()'),false);reject(REVIEWER,`public.review_coach_proposal('${OP}',true,'blocked')`,/reviewer_required/);
 assert.equal(call(REVIEWER,'to_jsonb((select count(*) from public.coach_pilot_feedback))'),0);assert.equal(query('select to_jsonb(count(*)) from coach_private.review_assignments;'),1);
});
test('Coach rollback restores exact original function body and authenticated ACL',async()=>{
 const before=query("select to_jsonb(prosrc) from pg_proc where oid='coach_private.commercial_prior_reserve_basic_generation(uuid,uuid)'::regprocedure;");
 sql(await read('../../supabase/rollback-billing-test-coach-gate.sql'));
 assert.equal(query("select to_jsonb(prosrc) from pg_proc where oid='public.reserve_basic_generation(uuid,uuid)'::regprocedure;"),before);
 assert.equal(query("select to_jsonb(has_function_privilege('anon','public.reserve_basic_generation(uuid,uuid)','execute'));"),false);
});
