import test from 'node:test';import assert from 'node:assert/strict';
import {subscriptionStatus} from '../../supabase/functions/_shared/billing-test-status.mjs';
import {harness,load} from '../billing-test/harness.mjs';import {fixture,OWNER,OTHER,list,NOW} from '../billing-test/fixtures.mjs';
function statusHarness(plan='basic'){
 const h=harness(fixture(plan)),rpc=h.rpc;h.mapping={customer_id:'cus_Synthetic',hold:false,checkout:{status:'complete'}};
 h.rpc=async(n,a)=>{if(n==='billing_test_read_customer'){h.calls.push({name:n,args:a});return a.p_user===OWNER?h.mapping:null;}return rpc(n,a);};
 h.accessValue={environment:'STRIPE_TEST',state:'inactive',plan:null,paidUntil:'2027-02-14T08:00:00Z',aiQuotaChanged:false};return h;
}
const read=h=>subscriptionStatus(h.stripe,h.rpc,OWNER,h.f.prices,h.accessValue,NOW/1000);
for(const [state,change]of Object.entries({
 none:h=>{h.mapping=null;},open:h=>{h.noSubscriptions=true;h.f.session.status='open';h.f.session.payment_status='unpaid';},
 pending:h=>h.f.s.status='incomplete',payment_failed:h=>h.f.s.status='past_due',reconciling:()=>{},
 active:h=>h.accessValue={...h.accessValue,state:'active',plan:'basic'},
 scheduled_cancel:h=>{h.accessValue={...h.accessValue,state:'active',plan:'basic'};h.f.s.cancel_at_period_end=true;},
 expired:h=>{h.accessValue.state='expired_or_revoked';h.f.s.status='canceled';},review_required:h=>h.mapping.hold=true
}))test('subscription status: '+state+' without writes or resource creation',async()=>{
 const h=statusHarness();change(h);assert.equal((await read(h)).state,state);assert.equal(h.snapshots,0);
 assert.ok(h.calls.every(c=>c.name==='billing_test_read_customer'||/\.retrieve$|\.list$/.test(c.name)));
});
test('paid Stripe alone grants no plan; Premium fixture preserves exact price without Basic access',async()=>{
 let h=statusHarness();let r=await read(h);assert.equal(r.plan,null);assert.equal(r.accessActive,false);assert.equal(r.canCheckout,false);
 h=statusHarness('premium');h.accessValue={...h.accessValue,state:'active',plan:'premium'};r=await read(h);assert.equal(r.monthlyCents,1299);assert.equal(r.plan,'premium');assert.equal(r.aiQuotaChanged,false);
});
test('failed renewal retains verified paid period; canceled period loses access only when SQL says expired',async()=>{
 const h=statusHarness();h.accessValue={...h.accessValue,state:'active',plan:'basic'};h.f.s.status='past_due';let r=await read(h);assert.equal(r.accessActive,true);assert.equal(r.state,'payment_failed');
 h.f.s.status='canceled';h.accessValue.state='expired_or_revoked';r=await read(h);assert.equal(r.accessActive,false);assert.equal(r.state,'expired');
});
for(const [label,change,code] of [
 ['foreign Customer',h=>h.stripe.customers.retrieve=async()=>({id:'cus_Other',object:'customer',livemode:false}),'billing_customer_mismatch'],
 ['foreign subscription',h=>h.f.s.customer='cus_Other','billing_subscription_mismatch'],
 ['foreign Checkout',h=>h.f.session.customer='cus_Other','billing_checkout_binding'],
 ['LIVE object',h=>h.f.session.livemode=true,'billing_test_object_required'],
 ['incomplete list',h=>h.sessionList={object:'list',data:[],has_more:true},'billing_incomplete_list'],
 ['duplicate subscriptions',h=>h.stripe.subscriptions.list=async()=>list([h.f.s,{...h.f.s,id:'sub_Other'}]),'billing_multiple_subscriptions']
])test('status rejects '+label,async()=>{const h=statusHarness();change(h);await assert.rejects(read(h),new RegExp(code));});
test('missing Customer and uncertain reservation disable repeat purchase',async()=>{
 const h=statusHarness();h.mapping={customer_id:null,checkout:{status:'reserved'}};assert.equal((await read(h)).canCheckout,false);
 h.mapping={customer_id:'cus_Synthetic',checkout:{status:'open'}};h.noSubscriptions=true;h.sessionList=list([]);assert.equal((await read(h)).canCheckout,false);
});
test('incomplete active projection cannot advertise paid access',async()=>{
 for(const patch of [{paidUntil:null},{paidUntil:'invalid'},{paidUntil:'2020-01-01T00:00:00Z'},{aiQuotaChanged:true},{plan:'admin'}]){
 const h=statusHarness();h.accessValue={...h.accessValue,state:'active',plan:'basic',...patch};await assert.rejects(read(h),/projection_failed/);}
});
test('actual Edge status rejects user/customer selectors and expired JWT double; other owner has no data',async()=>{
 const h=statusHarness();await load(h,'billing-test');
 for(const [body,token,expected]of [[{action:'status'},'expired.token.signature',401],[{action:'status',customer:'cus_Synthetic'},'other.token.signature',409],[{action:'status',user:OWNER},'other.token.signature',409],[{action:'status'},'other.token.signature',200]]){
  const r=await h.handler(new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(body)}));assert.equal(r.status,expected);if(expected===200){const data=await r.json();assert.equal(data.plan,null);assert.equal(data.state,'none');assert.equal(data.portalAvailable,false);}
 }
 assert.equal(h.calls.filter(c=>c.name==='billing_test_begin').length,0);
});
function portal(h){h.calls=[];h.created=[];h.stripe.billingPortal={configurations:{retrieve:async()=>({id:'bpc_Synthetic',object:'billing_portal.configuration',livemode:false,active:true,features:{subscription_update:{enabled:false},subscription_cancel:{enabled:true,mode:'at_period_end'},payment_method_update:{enabled:true},invoice_history:{enabled:true}}})},sessions:{create:async args=>{h.created.push(args);return {id:'bps_Synthetic',object:'billing_portal.session',livemode:false,customer:args.customer,url:'https://billing.stripe.com/p/session/SYNTHETIC'};}}};return h;}
// Environment injection remains local-only; no real Stripe SDK or secret is used here.
test('Portal uses verified owner Customer, approved configuration, and a new response URL',async()=>{
 const h=portal(statusHarness()),api=await load(h); // configuration missing is fail-closed
 await assert.rejects(api.createPortal(h.stripe,h.rpc,OWNER,h.f.prices),/billing_portal_not_configured/);assert.equal(h.created.length,0);
});
test('configured Portal creates only for the authenticated mapped Customer and always releases lease',async()=>{
 const h=portal(statusHarness());h.env={STRIPE_TEST_PORTAL_CONFIGURATION:'bpc_Synthetic'};const api=await load(h);
 const r=await api.createPortal(h.stripe,h.rpc,OWNER,h.f.prices);assert.equal(r.url,'https://billing.stripe.com/p/session/SYNTHETIC');
 assert.equal(h.created.length,1);assert.deepEqual(JSON.parse(JSON.stringify(h.created[0])),{customer:'cus_Synthetic',configuration:'bpc_Synthetic',return_url:'https://simple-staging-raulchulbi.pages.dev/billing-test.html'});
 assert.equal(h.state.customers[0].lease,null);
});
for(const label of ['other owner','LIVE Customer','wrong configuration','missing subscription','unsafe URL','foreign Portal'])test('Portal rejects '+label+' with no rights changes',async()=>{
 const h=portal(statusHarness());h.env={STRIPE_TEST_PORTAL_CONFIGURATION:'bpc_Synthetic'};const before=JSON.stringify(h.state.invoices);
 if(label==='LIVE Customer')h.stripe.customers.retrieve=async id=>({id,object:'customer',livemode:true});
 if(label==='wrong configuration')h.stripe.billingPortal.configurations.retrieve=async()=>({id:'bpc_Synthetic',object:'billing_portal.configuration',livemode:false,active:false});
 if(label==='missing subscription')h.noSubscriptions=true;
 if(['unsafe URL','foreign Portal'].includes(label))h.stripe.billingPortal.sessions.create=async args=>({id:'bps_Synthetic',object:'billing_portal.session',livemode:false,customer:label==='foreign Portal'?'cus_Other':args.customer,url:'https://evil.invalid/portal'});
 const api=await load(h);await assert.rejects(api.createPortal(h.stripe,h.rpc,label==='other owner'?OTHER:OWNER,h.f.prices));assert.equal(JSON.stringify(h.state.invoices),before);
 assert.equal(h.created.length,0);
});
