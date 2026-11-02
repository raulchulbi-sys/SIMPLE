import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {harness,load} from './harness.mjs';
import {setup,reset,rpc,sql,query,asyncSql,literal,readState,access,OWNER,OTHER,ATTEMPT} from './postgres-local.mjs';
await setup();
function liveHarness(){const h=harness();h.rpc=rpc;const now=Math.floor(Date.now()/1000);h.f.inv.lines.data[0].period={start:now-100,end:now+2591900};h.f.inv.status_transitions.paid_at=now-90;return h;}
const run=async(h,eventId)=>(await load(h)).reconcile(h.stripe,h.rpc,OWNER,h.f.prices,eventId);
test('PostgreSQL compiles candidate with invoker/service-only privileges',()=>{
  const p=query("select json_build_object('invoker',not prosecdef,'search_path',proconfig,'anon',has_function_privilege('anon',oid,'execute'),'authenticated',has_function_privilege('authenticated',oid,'execute'),'service',has_function_privilege('service_role',oid,'execute')) from pg_proc where oid='public.billing_test_change(uuid,uuid,text,jsonb)'::regprocedure;");
  assert.equal(p.invoker,true);assert.equal(p.anon,false);assert.equal(p.authenticated,false);assert.equal(p.service,true);
});
test('real SQL + actual runtime: historical paid reservation completes and preserves all other reservation fields',async()=>{
  reset();const before=readState();const h=liveHarness();await run(h);const after=readState();
  assert.equal(after.checkouts[0].status,'complete');assert.deepEqual({...after.checkouts[0],status:'open'},before.checkouts[0]);assert.deepEqual(after.checkouts[1],before.checkouts[1]);
  assert.equal(access(OWNER).plan,'basic');assert.equal(access(OTHER).plan,null);
});
for(const [name,mutate]of Object.entries({open:h=>{h.f.session.status='open';h.f.session.payment_status='unpaid';h.f.inv.status='open';},pending:h=>{h.f.session.payment_status='unpaid';h.f.inv.status='open';},rejected:h=>{h.f.session.payment_status='unpaid';h.f.inv.status='void';},expired:h=>{h.f.session.status='expired';h.f.session.payment_status='unpaid';h.f.inv.status='void';}}))
test('real SQL: '+name+' never grants paid access',async()=>{reset();const h=liveHarness();mutate(h);await run(h);assert.equal(readState().checkouts[0].status,'open');assert.equal(access(OWNER).plan,null);});
for(const [name,mutate]of Object.entries({
  'missing invoice':h=>h.noInvoices=true,
  'wrong Customer':h=>h.f.session.customer='cus_Other',
  'wrong owner':()=>sql(`update billing_test.checkouts set user_id='${OTHER}' where id='${ATTEMPT}';`),
  'foreign subscription':()=>sql(`insert into billing_test.subscriptions values('sub_Synthetic','${OTHER}','basic','active',false,now());`),
  'already expired reservation':()=>sql(`update billing_test.checkouts set status='expired' where id='${ATTEMPT}';`),
  'failed payment':h=>h.f.pi.status='requires_payment_method',
  'inconsistent invoice':h=>h.f.inv.amount_paid=1,
  'wrong event':h=>h.event='evt_Unknown'
}))test('real SQL rolls back '+name,async()=>{reset();const h=liveHarness();mutate(h);const before=readState();await assert.rejects(run(h,h.event));assert.deepEqual(readState(),before);assert.equal(access(OWNER).plan,null);});
test('duplicate invoice snapshot and repeated reconciliation preserve one payment/period',async()=>{
  reset();const h=liveHarness();await run(h);const before=readState();await run(h);await run(h);assert.deepEqual(readState(),before);assert.equal(readState().invoices.length,1);
});
test('duplicated and unordered webhook receipts converge using real SQL',async()=>{
  reset();const h=liveHarness();
  for(const [index,type]of ['invoice.paid','customer.subscription.created','checkout.session.completed'].entries()){
    const id='evt_Synthetic'+index,a={p_id:id,p_digest:String(index).repeat(64),p_type:type,p_customer:'cus_Synthetic'};
    await rpc('billing_test_event',a);await run(h,id);assert.equal((await rpc('billing_test_event',a)).processed,true);
  }
  assert.equal(readState().events.length,3);assert.equal(readState().invoices.length,1);assert.equal(readState().checkouts[0].status,'complete');
});
test('failure inside PostgreSQL transaction rolls back invoices AND status; later reconciliation recovers',async()=>{
  reset();sql(`create function public.fail_checkout_test() returns trigger language plpgsql as $$begin raise exception 'synthetic_partial_failure';end$$;
    create trigger synthetic_fail before update on billing_test.checkouts for each row execute function public.fail_checkout_test();`);
  const h=liveHarness();await assert.rejects(run(h),/synthetic_partial_failure/);assert.equal(readState().invoices.length,0);assert.equal(readState().checkouts[0].status,'open');
  sql('drop trigger synthetic_fail on billing_test.checkouts;drop function public.fail_checkout_test();');await run(h);assert.equal(access(OWNER).plan,'basic');
});
test('two simultaneous real DB sessions: same Customer serializes and rejects second lease',async()=>{
  reset();const a=asyncSql(`begin;set role service_role;select public.billing_test_begin('${OWNER}');select pg_sleep(0.4);commit;`);
  await new Promise(r=>setTimeout(r,100));const b=asyncSql(`set role service_role;select public.billing_test_begin('${OWNER}');`);
  const results=await Promise.all([a,b]);assert.equal(results[0].ok,true);assert.equal(results[1].ok,false);assert.match(results[1].error,/billing_busy/);
});
test('stale worker cannot modify new lease or release it',async()=>{
  reset();const old=await rpc('billing_test_begin',{p_user:OWNER});sql(`update billing_test.customers set lease_until=now()-interval '1 second' where user_id='${OWNER}';`);
  const fresh=await rpc('billing_test_begin',{p_user:OWNER});await assert.rejects(rpc('billing_test_change',{p_user:OWNER,p_lease:old.lease,p_action:'release'}),/stale_lease/);
  assert.equal(query(`select to_jsonb(lease) from billing_test.customers where user_id='${OWNER}';`),fresh.lease);
});
test('RLS and grants deny other invoices/reservations and mutation RPCs',async()=>{
  reset();await run(liveHarness());
  assert.equal(query(`set role authenticated;set request.jwt.claim.sub='${OTHER}';select to_jsonb(count(*)) from billing_test.invoices;`),0);
  assert.equal(query(`set role authenticated;set request.jwt.claim.sub='${OWNER}';select to_jsonb(count(*)) from billing_test.invoices;`),1);
  for(const role of ['anon','authenticated'])assert.equal(sql(`set role ${role};select public.billing_test_begin('${OWNER}');`,{allowError:true}).ok,false);
  assert.equal(sql(`set role authenticated;update billing_test.checkouts set status='complete';`,{allowError:true}).ok,false);
});
test('programmed cancellation preserves paid time; expiry removes entitlement without deleting history',async()=>{
  reset();const h=liveHarness();h.f.s.cancel_at_period_end=true;await run(h);assert.equal(access(OWNER).plan,'basic');assert.equal(access(OWNER).cancelAtPeriodEnd,true);
  sql("update billing_test.invoices set period_start=period_start-3000000,period_end=period_end-3000000;");assert.equal(access(OWNER).plan,null);assert.equal(readState().invoices.length,1);
});
test('rollback function compiles, retains ACL, then candidate reapplies',async()=>{
  const original=await fs.readFile(new URL('../../supabase/rollback-billing-test-change.sql',import.meta.url),'utf8');sql(original+';');
  assert.equal(query("select to_jsonb(has_function_privilege('authenticated','public.billing_test_change(uuid,uuid,text,jsonb)','execute'));"),false);
  sql((await fs.readFile(new URL('../../supabase/billing-test-change.sql',import.meta.url),'utf8'))+';');reset();await run(liveHarness());assert.equal(readState().checkouts[0].status,'complete');
});
