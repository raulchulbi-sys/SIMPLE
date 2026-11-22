import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadRuntime,checkoutHarness,BASE_NOW} from './runtime-harness.mjs';
import {projection} from '../../supabase/functions/_shared/billing-test-contract.mjs';
const run=async(h,plan='basic')=>(await loadRuntime(h.now)).api.createCheckout(h.stripe,h.rpc,'owner',plan,h.prices);
for(const [plan,cents,price]of [['basic',499,'price_1UWx9n6soMMQB8IRZp5nTwsE'],['premium',1299,'price_1UWx9v6soMMQB8IRLixagQc6']])test('standard TEST Checkout and exact authorized price '+plan,async()=>{
 const h=checkoutHarness();h.state.job.plan=plan;await run(h,plan);
 const p=h.state.createDispatches[0].params;
 assert.equal(p.managed_payments.enabled,false);assert.equal(p.automatic_tax.enabled,false);
 assert.equal(p.mode,'subscription');assert.equal(p.line_items[0].price,price);assert.equal(h.prices[price].unit_amount,cents);assert.equal(p.line_items[0].quantity,1);
 assert.equal(p.customer,'cus_ExistingOffline');assert.equal(p.client_reference_id,h.state.job.id);
 assert.equal(p.expires_at,1793542974);assert.equal(p.allow_promotion_codes,false);
 assert.equal(p.payment_method_types,undefined);assert.equal(p.discounts,undefined);assert.equal(p.subscription_data.default_tax_rates,undefined);
 assert.equal(h.state.createDispatches[0].key,'simple-test-checkout-'+h.state.job.id);assert.equal(h.state.customerCreates,0);assert.equal(h.state.createdObjects.length,1);
 assert.equal(h.state.busy,false);
});
test('duplicate call reuses stored session without a second POST or Customer',async()=>{
 const h=checkoutHarness();await run(h);await run(h);assert.equal(h.state.createDispatches.length,1);assert.equal(h.state.createdObjects.length,1);assert.equal(h.state.customerCreates,0);assert.equal(h.state.retrieves.length,1);
});
test('Customer and Checkout reservation or session never constitute paid entitlement',async()=>{
 const h=checkoutHarness();assert.equal(projection([],{now:h.now/1000}).plan,null);await run(h);
 assert.equal(projection([],{now:h.now/1000}).state,'inactive');assert(!h.state.changes.some(x=>x.p_action==='snapshot'));
});
test('separately authorized fresh attempt after terminal closure retains Customer and uses distinct key',async()=>{
 const old={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',status:'expired',session_id:null,expires_at:1793542974};const before=structuredClone(old);
 const h=checkoutHarness();h.state.customer.customer_id='cus_SyntheticOld';h.state.job.id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await run(h);assert.equal(h.state.createDispatches[0].params.customer,'cus_SyntheticOld');assert.equal(h.state.customerCreates,0);
 assert.notEqual(h.state.createDispatches[0].key,'simple-test-checkout-'+old.id);assert.deepEqual(old,before);
});
test('lost provider response preserves parameters and key; simulated replay returns one object',async()=>{
 const h=checkoutHarness({lostProviderResponse:true});await assert.rejects(run(h),/network response lost/);assert.equal(h.state.job.session_id,null);assert.equal(h.state.busy,false);
 await run(h);assert.equal(h.state.createDispatches.length,2);assert.deepEqual(h.state.createDispatches[0],h.state.createDispatches[1]);assert.equal(h.state.createdObjects.length,1);assert.equal(h.state.customerCreates,0);
});
test('lost database reply before recording session uses same Stripe key',async()=>{
 const h=checkoutHarness({databaseFailureBefore:true});await assert.rejects(run(h),/before commit/);await run(h);assert.equal(h.state.createdObjects.length,1);assert.deepEqual(h.state.createDispatches[0],h.state.createDispatches[1]);
});
test('lost database reply after recording session retrieves that session',async()=>{
 const h=checkoutHarness({databaseFailureAfter:true});await assert.rejects(run(h),/after commit/);await run(h);assert.equal(h.state.createDispatches.length,1);assert.equal(h.state.retrieves.length,1);
});
for(const [name,error]of [['Stripe 400',Object.assign(Error('invalid_request_error'),{statusCode:400})],['Stripe 500',Object.assign(Error('api_error'),{statusCode:500})],['connection timeout',Error('timeout')]])test(name+' never auto-retries, grants rights or resets the reservation',async()=>{
 const h=checkoutHarness({providerError:error});const before=structuredClone(h.state.job);await assert.rejects(run(h));
 assert.equal(h.state.createDispatches.length,1);assert.equal(h.state.createdObjects.length,0);assert.deepEqual(h.state.job,before);assert.equal(h.state.customerCreates,0);assert.equal(h.state.busy,false);assert(!h.state.changes.some(c=>c.p_action==='snapshot'));
});
test('legacy key with different parameters is not silently replaced',async()=>{
 const h=checkoutHarness();h.state.cache.set('simple-test-checkout-'+h.state.job.id,{params:'legacy-v3-request-without-managed-payments-field',session:{id:'cs_test_Unknown'}});
 await assert.rejects(run(h),/StripeIdempotencyError/);assert.equal(h.state.createDispatches.length,1);assert.equal(h.state.createdObjects.length,0);assert.equal(h.state.job.status,'reserved');
});
for(const seconds of [0,1800,-1])test('unrecorded session blocked at or outside creation margin '+seconds,async()=>{
 const h=checkoutHarness();h.state.job.expires_at=h.now/1000+seconds;await assert.rejects(run(h),/billing_checkout_reconciliation_required/);assert.equal(h.state.createDispatches.length,0);assert.equal(h.state.job.status,'reserved');
});
test('synthetic old reservation at recorded review time is blocked, not reset',async()=>{
 const h=checkoutHarness({now:Date.parse('2026-11-01T14:09:50Z')});h.state.job.id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';h.state.customer.customer_id='cus_SyntheticOld';
 const before=structuredClone(h.state.job);await assert.rejects(run(h),/billing_checkout_reconciliation_required/);assert.deepEqual(h.state.job,before);assert.equal(h.state.customerCreates,0);assert.equal(h.state.createDispatches.length,0);
});
test('reservation older than 23 hours is never replayed',async()=>{
 const h=checkoutHarness();h.state.job.created_at=new Date(h.now-23*3600000).toISOString();await assert.rejects(run(h),/billing_checkout_reconciliation_required/);assert.equal(h.state.createDispatches.length,0);
});
for(const status of ['expired','complete'])test('stored '+status+' session is reconciled without replacement',async()=>{
 const h=checkoutHarness({retrieved:{id:'cs_test_Stored',object:'checkout.session',livemode:false,customer:'cus_ExistingOffline',mode:'subscription',client_reference_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status}});h.state.job.session_id='cs_test_Stored';
 await assert.rejects(run(h),status==='expired'?/billing_checkout_expired/:/billing_checkout_completed_reconcile/);assert.equal(h.state.createDispatches.length,0);assert.equal(h.state.job.status,status==='complete'?'reserved':status);assert(!h.state.changes.some(c=>c.p_action==='snapshot'));
});
for(const [name,session]of [['live',{livemode:true}],['foreign Customer',{customer:'cus_Other'}],['foreign attempt',{client_reference_id:'foreign'}],['wrong mode',{mode:'payment'}]])test('reject unexpected session '+name,async()=>{
 const h=checkoutHarness({session});await assert.rejects(run(h));assert.equal(h.state.job.session_id,null);assert.equal(h.state.busy,false);
});
test('existing active subscription blocks POST',async()=>{
 const h=checkoutHarness({subscriptions:[{status:'active'}]});await assert.rejects(run(h),/billing_existing_subscription/);assert.equal(h.state.createDispatches.length,0);
});
test('existing paid period blocks POST',async()=>{
 const h=checkoutHarness({invoices:[{lines:{object:'list',has_more:false,data:[{period:{end:BASE_NOW/1000+1000}}]}}]});await assert.rejects(run(h),/billing_paid_period_exists/);assert.equal(h.state.createDispatches.length,0);
});
test('incomplete provider lists block POST',async()=>{
 const h=checkoutHarness({hasMore:true});await assert.rejects(run(h),/billing_incomplete_list/);assert.equal(h.state.createDispatches.length,0);
});
test('concurrent owner lease rejects before provider creation',async()=>{
 const h=checkoutHarness();h.state.busy=true;await assert.rejects(run(h),/billing_busy/);assert.equal(h.state.createDispatches.length,0);
});
test('account and catalog checks remain enforced',async()=>{
 const {api}=await loadRuntime();let h=checkoutHarness({account:'acct_WRONG'});await assert.rejects(api.verifyProvider(h.stripe),/billing_account_mismatch/);
 h=checkoutHarness();h.prices.price_1UWx9n6soMMQB8IRZp5nTwsE.unit_amount=500;await assert.rejects(api.verifyProvider(h.stripe),/billing_catalog_mismatch/);
});
for(const [name,env,error]of [['production URL',{SUPABASE_URL:'https://production.invalid'},'billing_staging_only'],['live key',{STRIPE_TEST_SECRET_KEY:'rk_live_OFFLINE_ONLY'},'billing_test_key_missing']])test('runtime blocks '+name,async()=>{
 const {api,constructors}=await loadRuntime(BASE_NOW,env);assert.throws(()=>api.runtime(),new RegExp(error));assert.equal(constructors.length,0);
});
test('SDK version, no automatic retry and timeout remain pinned',async()=>{
 const {api,constructors}=await loadRuntime();api.runtime();assert.equal(constructors[0].options.apiVersion,'2026-09-30.endive');assert.equal(constructors[0].options.maxNetworkRetries,0);assert.equal(constructors[0].options.timeout,20000);
});
for(const [name,user,role,expected]of [['allowed',{id:'owner',is_anonymous:false},'client',null],['other identity',{id:'unlisted',is_anonymous:false},'client','billing_test_user_not_enabled'],['anonymous',{id:'owner',is_anonymous:true},'client','billing_auth_required'],['trainer',{id:'owner',is_anonymous:false},'trainer','billing_client_required']])test('verified identity gate '+name,async()=>{
 const {api}=await loadRuntime();const db={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role},error:null})})})})};
 const req=new Request('https://offline.invalid',{headers:{authorization:'Bearer offline.jwt'}});
 if(expected)await assert.rejects(api.authenticate(req,db),new RegExp(expected));else assert.equal(await api.authenticate(req,db),'owner');
});
test('missing webhook configuration prevents any reservation or POST',async()=>{
 const h=checkoutHarness(),{api}=await loadRuntime(BASE_NOW,{STRIPE_TEST_WEBHOOK_SECRET:''});await assert.rejects(api.createCheckout(h.stripe,h.rpc,'owner','basic',h.prices),/billing_webhook_not_configured/);assert.equal(h.state.lease,0);
});
test('receipt contract and webhook entrypoint preserved byte for byte',async()=>{
 for(const [original,candidate] of [
 ['webhook-v3/supabase/functions/billing-test-webhook/index.ts','supabase/functions/billing-test-webhook/index.ts'],
 ['billing-v4/supabase/functions/_shared/billing-test-contract.mjs','supabase/functions/_shared/billing-test-contract.mjs']]){
  assert.equal(await fs.readFile(new URL('./original/'+original,import.meta.url),'utf8'),await fs.readFile(new URL('../../'+candidate,import.meta.url),'utf8'));
 }
});
