import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {harness,load} from './harness.mjs';
import {fixture,OWNER,OTHER,ATTEMPT,copy,list} from './fixtures.mjs';
const run=async h=>(await load(h)).reconcile(h.stripe,h.rpc,OWNER,h.f.prices);
const snapshot=h=>h.calls.findLast(x=>x.args?.p_action==='snapshot')?.args.p_data;
const settled=h=>({checkouts:h.state.checkouts,subscriptions:h.state.subscriptions,invoices:h.state.invoices,events:h.state.events});

for(const plan of ['basic','premium'])test(`paid ${plan}: transaction binds session/invoice/owner; preserves history`,async()=>{
  const h=harness(fixture(plan)),before=copy(h.state.checkouts);
  assert.equal(h.access(OWNER).plan,null);
  const result=await run(h);assert.equal(result.verified,true);assert.equal(h.commits,1);
  assert.equal(h.state.checkouts[0].status,'complete');
  assert.deepEqual({...h.state.checkouts[0],status:'open'},before[0]);assert.deepEqual(h.state.checkouts[1],before[1]);
  assert.equal(h.access(OWNER).plan,plan);assert.equal(h.access(OTHER).plan,null);
  assert.equal(h.state.invoices.length,1);assert.equal(h.state.subscriptions.length,1);
  assert.equal(snapshot(h).checkouts[0].invoice_id,h.f.inv.id);
  assert.equal(h.calls.some(c=>/create/.test(c.name)),false);
});
for(const [status,payment,statusInvoice] of [['open','unpaid','open'],['complete','unpaid','open'],['complete','no_payment_required','open'],['expired','unpaid','void']])
test(`unpaid ${status}/${payment}: neither complete nor access`,async()=>{
  const h=harness();Object.assign(h.f.session,{status,payment_status:payment});h.f.inv.status=statusInvoice;
  h.f.s.status='incomplete';await run(h);
  assert.equal(h.state.checkouts[0].status,'open');assert.equal(h.state.invoices.length,0);assert.equal(h.access(OWNER).plan,null);
});
const faults={
  'foreign session Customer':h=>h.f.session.customer='cus_Other',
  'foreign subscription Customer':h=>h.f.s.customer='cus_Other',
  'foreign invoice Customer':h=>h.f.inv.customer='cus_Other',
  'other local owner':h=>h.state.checkouts[0].user_id=OTHER,
  'wrong local session':h=>h.state.checkouts[0].session_id='cs_test_Other',
  'another local plan':h=>h.state.checkouts[0].plan='premium',
  'expired reservation cannot revive':h=>h.state.checkouts[0].status='expired',
  'invoice absent':h=>h.noInvoices=true,
  'invoice not paid':h=>h.f.inv.status='open',
  'invoice wrong id':h=>h.f.session.invoice='in_Other',
  'invoice from another subscription':h=>h.f.inv.parent.subscription_details.subscription='sub_Other',
  'renewal substituted for initial invoice':h=>h.f.inv.billing_reason='subscription_cycle',
  'session wrong subscription':h=>h.f.session.subscription='sub_Other',
  'session missing subscription':h=>delete h.f.session.subscription,
  'subscription absent':h=>h.noSubscriptions=true,
  'session metadata mismatch':h=>h.f.session.metadata.simple_attempt='other',
  'session missing attempt':h=>h.f.session.client_reference_id=null,
  'session invalid attempt uuid':h=>h.f.session.client_reference_id='not-an-uuid',
  'session LIVE':h=>h.f.session.livemode=true,
  'session incorrect object':h=>h.f.session.object='payment_intent',
  'session incomplete status':h=>delete h.f.session.payment_status,
  'session non subscription':h=>h.f.session.mode='payment',
  'wrong currency':h=>h.f.session.currency='usd',
  'wrong total':h=>h.f.session.amount_total=1,
  'wrong quantity':h=>h.f.session.line_items.data[0].quantity=2,
  'wrong price':h=>h.f.session.line_items.data[0].price='price_Unknown',
  'discount':h=>h.f.session.total_details.amount_discount=1,
  'tax':h=>h.f.session.total_details.amount_tax=1,
  'managed payments':h=>h.f.session.managed_payments.enabled=true,
  'automatic tax':h=>h.f.session.automatic_tax.enabled=true,
  'missing line items':h=>delete h.f.session.line_items,
  'partial line items':h=>h.f.session.line_items.has_more=true,
  'partial session list':h=>h.sessionList={object:'list',has_more:true,data:[h.f.session]},
  'missing session list':h=>h.sessionList={object:'list',has_more:false},
  'duplicate sessions':h=>h.sessionList=list([h.f.session,h.f.session]),
  'failed PaymentIntent':h=>h.f.pi.status='requires_payment_method',
  'charge uncaptured':h=>h.f.ch.captured=false,
  '400 provider read failure':h=>h.fail='checkout.retrieve',
  'inconsistent paid invoice/unpaid Checkout':h=>h.f.session.payment_status='unpaid',
  'expired lease':h=>{const previous=h.stripe.checkout.sessions.retrieve;h.stripe.checkout.sessions.retrieve=async(...a)=>{h.now+=121000;return previous(...a);};},
};
for(const [label,mutate]of Object.entries(faults))test(`reject ${label} without partial completion/rights`,async()=>{
  const h=harness();mutate(h);const before=copy(settled(h));
  await assert.rejects(run(h));assert.deepEqual(settled(h),before);assert.equal(h.access(OWNER).plan,null);
});
test('lost initial binding recovered through authoritative graph, no new resource',async()=>{
  const h=harness();h.state.checkouts[0].status='reserved';h.state.checkouts[0].session_id=null;
  await run(h);assert.equal(h.state.checkouts[0].status,'complete');assert.equal(h.state.checkouts[0].session_id,h.f.session.id);assert.equal(h.commits,1);
});
test('repeated reconciliation is idempotent; completed record never reopened',async()=>{
  const h=harness();await run(h);const before=copy(settled(h));await run(h);await run(h);assert.deepEqual(settled(h),before);
});
test('partial transactional failure leaves no invoice, rights or completed status; later read reconciliation repairs',async()=>{
  const h=harness();h.fail='partial';await assert.rejects(run(h));assert.equal(h.commits,0);assert.equal(h.state.checkouts[0].status,'open');assert.equal(h.state.invoices.length,0);
  await run(h);assert.equal(h.commits,1);assert.equal(h.access(OWNER).plan,'basic');
});
test('lost response after atomic commit: fresh reconciliation retains single graph',async()=>{
  const h=harness();h.fail='lost';await assert.rejects(run(h));assert.equal(h.state.checkouts[0].status,'complete');const before=copy(settled(h));
  await run(h);assert.deepEqual(settled(h),before);assert.equal(h.access(OWNER).plan,'basic');
});
test('concurrent reconciliations: live lease rejects second, later retry converges',async()=>{
  const h=harness(),api=await load(h);let release;
  h.barrier=new Promise(r=>{release=r;});const first=api.reconcile(h.stripe,h.rpc,OWNER,h.f.prices);
  await new Promise(setImmediate);await assert.rejects(api.reconcile(h.stripe,h.rpc,OWNER,h.f.prices),/billing_busy/);
  release();await first;h.barrier=null;await api.reconcile(h.stripe,h.rpc,OWNER,h.f.prices);
  assert.equal(h.state.invoices.length,1);assert.equal(h.state.checkouts.filter(x=>x.status==='complete').length,1);
});
test('expired worker cannot release or hold a replacement lease',async()=>{
  const h=harness();const old=await h.rpc('billing_test_begin',{p_user:OWNER});h.now+=121000;
  const fresh=await h.rpc('billing_test_begin',{p_user:OWNER});
  await assert.rejects(h.rpc('billing_test_change',{p_user:OWNER,p_lease:old.lease,p_action:'hold'}),/stale/);
  assert.equal(h.state.customers[0].lease,fresh.lease);assert.equal(h.state.customers[0].hold,false);
});
test('legacy SQL acknowledgement is not accepted as confirmation',async()=>{
  const h=harness();h.legacyAck=true;await assert.rejects(run(h),/commit_unconfirmed/);
});
test('foreign existing subscription collision rolls back',async()=>{
  const h=harness();h.state.subscriptions.push({subscription_id:h.f.s.id,user_id:OTHER,plan:'basic',status:'active'});
  await assert.rejects(run(h),/subscription_conflict/);assert.equal(h.state.invoices.length,0);assert.equal(h.state.checkouts[0].status,'open');
});
test('refund/dispute semantics stay independent of historical Checkout completion',async()=>{
  const h=harness();await run(h);h.f.ch.disputed=true;await run(h);
  assert.equal(h.state.checkouts[0].status,'complete');assert.equal(h.access(OWNER).plan,null);
  h.f.ch.disputed=false;h.f.ch.amount_refunded=499;await run(h);assert.equal(h.access(OWNER).plan,null);
});
test('wrong event binding aborts the complete snapshot',async()=>{
  const h=harness();const api=await load(h);await assert.rejects(api.reconcile(h.stripe,h.rpc,OWNER,h.f.prices,'evt_Unknown'),/event_binding/);
  assert.equal(h.state.invoices.length,0);assert.equal(h.state.checkouts[0].status,'open');
});
const event=(type,id)=>({id,object:'event',type,livemode:false,api_version:'2026-09-30.endive',data:{object:{object:'checkout.session',customer:'cus_Synthetic'}}});
async function deliver(h,e,signature='synthetic-valid-signature'){
  return h.handler(new Request('https://test.invalid/webhook',{method:'POST',headers:{'stripe-signature':signature},body:JSON.stringify(e)}));
}
test('actual webhook entry with signature double: duplicate event uses processed fast path',async()=>{
  const h=harness();await load(h,'billing-test-webhook');const e=event('checkout.session.completed','evt_Synthetic');
  assert.equal((await deliver(h,e)).status,200);const before=copy(settled(h)),snapshots=h.snapshots;
  const repeated=await deliver(h,e);assert.equal((await repeated.json()).duplicate,true);assert.equal(h.snapshots,snapshots);assert.deepEqual(settled(h),before);
});
for(const types of [['invoice.paid','customer.subscription.created','checkout.session.completed'],['checkout.session.completed','invoice.paid','customer.subscription.created']])
test(`unordered signed routing uses fresh Stripe state: ${types.join(',')}`,async()=>{
  const h=harness();await load(h,'billing-test-webhook');
  for(let i=0;i<types.length;i++)assert.equal((await deliver(h,event(types[i],'evt_Synthetic'+i))).status,200);
  assert.equal(h.state.events.filter(x=>x.processed_at).length,3);assert.equal(h.state.invoices.length,1);assert.equal(h.state.checkouts[0].status,'complete');
});
test('pending event followed by async payment success completes only after paid evidence',async()=>{
  const h=harness();await load(h,'billing-test-webhook');h.f.session.payment_status='unpaid';h.f.inv.status='open';h.f.s.status='incomplete';
  assert.equal((await deliver(h,event('checkout.session.completed','evt_Pending'))).status,200);assert.equal(h.access(OWNER).plan,null);
  h.f.session.payment_status='paid';h.f.inv.status='paid';h.f.s.status='active';
  assert.equal((await deliver(h,event('checkout.session.async_payment_succeeded','evt_Paid'))).status,200);assert.equal(h.state.checkouts[0].status,'complete');assert.equal(h.access(OWNER).plan,'basic');
});
test('invalid signature double reaches no provider reads or storage',async()=>{
  const h=harness();await load(h,'billing-test-webhook');assert.equal((await deliver(h,event('invoice.paid','evt_Invalid'),'invalid')).status,400);assert.equal(h.calls.length,0);
});
test('real Edge entry rejects foreign user selector and requires JWT authentication double',async()=>{
  const h=harness();await load(h,'billing-test');
  const request=(body,authorization)=>new Request('https://test.invalid/billing',{method:'POST',headers:{origin:'https://simple-staging-raulchulbi.pages.dev',...(authorization?{authorization}: {})},body:JSON.stringify(body)});
  assert.equal((await h.handler(request({action:'reconcile'}))).status,401);
  assert.equal((await h.handler(request({action:'reconcile',user:OTHER},'Bearer owner.token.signature'))).status,409);
  assert.equal(h.snapshots,0);
});
test('Edge access reads authenticated owner only; Basic does not become Premium; CORS unchanged',async()=>{
  const h=harness();await run(h);await load(h,'billing-test');
  for(const [token,plan] of [['owner.token.signature','basic'],['other.token.signature',null]]){
    const response=await h.handler(new Request('https://test.invalid/billing',{method:'POST',headers:{authorization:'Bearer '+token,origin:'https://simple-staging-raulchulbi.pages.dev'},body:'{"action":"access"}'}));
    assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'https://simple-staging-raulchulbi.pages.dev');
    const data=await response.json();assert.equal(data.plan,plan);assert.notEqual(data.plan,'premium');assert.equal(data.aiQuotaChanged,false);
  }
  const denied=await h.handler(new Request('https://test.invalid/billing',{method:'POST',headers:{authorization:'Bearer owner.token.signature',origin:'https://attacker.invalid'},body:'{"action":"access"}'}));
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
});
test('SQL static invariants: same transaction, ownership, lease, no privilege widening or historical DELETE',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/billing-test-change.sql',import.meta.url),'utf8');
  assert.match(sql,/p_lease is null/);assert.match(sql,/c\.lease_until is null/);assert.match(sql,/checkouts where id=.*user_id=p_user for update/);
  assert.match(sql,/on conflict\(subscription_id\)[\s\S]*?subscriptions\.user_id=excluded\.user_id/);
  assert.match(sql,/persisted\.user_id=excluded\.user_id/);assert.match(sql,/billing_checkout_requires_snapshot/);
  assert.ok(sql.indexOf("set status='complete'")>sql.indexOf('insert into billing_test.invoices'));
  assert.ok(sql.indexOf("set status='complete'")<sql.indexOf('set processed_at='));
  assert.doesNotMatch(sql,/security definer|\bgrant\b|\brevoke\b|\bdelete from\b|\btruncate\b|\bcommit\b/i);
  assert.match(sql,/processed_at=coalesce\(processed_at,now\(\)\)/);
});
