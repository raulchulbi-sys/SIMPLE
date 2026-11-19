'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PLAN,assertRead,validateAccount,validateIsolation,validateReturn}=require('./acceptance.cjs');
const now=Date.now(),until=new Date(now+3600000).toISOString();
function snapshot(active=true){const access={environment:'STRIPE_TEST',plan:active?'basic':null,state:active?'active':'inactive',paidUntil:active?until:null,cancelAtPeriodEnd:false,aiQuotaChanged:false};const out=x=>({data:x,error:null});return {project:PLAN.project,status:out({...access,accessActive:active,monthlyCents:active?499:null,currency:'eur'}),access:out(access),directAccess:out({...access}),capabilities:out({basicActive:active,basicGenerationEnabled:false,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true}),coach:out({can_generate:false,paidBasic:active}),premium:out({enabled:false})};}
test('six exact read contracts accepted',()=>{assert.equal(PLAN.reads.length,6);for(const read of PLAN.reads)assert.equal(assertRead(read),true);});
test('no mutating edge actions or generation RPC accepted',()=>{for(const action of PLAN.forbidden)assert.throws(()=>assertRead({transport:'edge',name:'billing-test',body:{action}}));assert.throws(()=>assertRead({transport:'rpc',name:'reserve_basic_generation',body:{}}));});
test('extra user and customer parameters rejected',()=>{for(const field of ['user','customer','plan'])assert.throws(()=>assertRead({transport:'edge',name:'billing-test',body:{action:'status',[field]:'synthetic'}}));});
test('paid Basic + closed gates validated',()=>assert.equal(validateAccount(snapshot(),{active:true,now}).basicActive,true));
test('unsubscribed identity has no invented plan',()=>assert.equal(validateAccount(snapshot(false),{active:false,now}).basicActive,false));
for(const [label,mutate]of [
 ['production',s=>s.project='production'],['LIVE',s=>s.status.data.environment='STRIPE_LIVE'],
 ['price drift',s=>s.status.data.monthlyCents=599],['expired paid period',s=>{s.access.data.paidUntil=s.directAccess.data.paidUntil=new Date(now-1000).toISOString();}],
 ['generation open',s=>s.capabilities.data.basicGenerationEnabled=true],['Premium open',s=>s.premium.data.enabled=true],
 ['no human review',s=>s.capabilities.data.humanReviewRequired=false],['private Customer',s=>s.status.data.customer_id='cus_Synthetic'],
 ['projection divergence',s=>s.directAccess.data.plan='premium'],['failed network',s=>s.status.error={message:'network'}]
])test('reject evidence '+label,()=>{const s=snapshot();mutate(s);assert.throws(()=>validateAccount(s,{active:true,now}));});
test('isolation accepts empty read or explicit schema/permission denial',()=>{for(const result of [{http:200,rows:[]},{http:403,errorCode:'42501'},{http:406,errorCode:'PGRST106'}])assert.equal(validateIsolation(result),true);});
test('isolation never treats stale JWT or network failure as privacy proof',()=>{for(const result of [{http:401,errorCode:'42501'},{http:0},{http:500},{http:200,rows:[{user_id:'synthetic'}]}])assert.throws(()=>validateIsolation(result));});
test('exact clean HTTPS return accepted',()=>assert.equal(validateReturn(PLAN.origin+PLAN.returnPath),true));
test('exact extensionless Pages return accepted',()=>assert.equal(validateReturn(PLAN.origin+'/billing-test'),true));
test('return rejects prefixes, suffixes, slash variants and subpaths',()=>{for(const path of ['/billing-test/','/billing-test.html/','/billing-test/extra','/billing-test.html/extra','/billing-test-other','/prefix/billing-test','/billing-test.htm','/billing%2Dtest'])assert.throws(()=>validateReturn(PLAN.origin+path));});
test('return rejects foreign origin, credential URL and payment hints',()=>{for(const url of ['http://simple-staging-raulchulbi.pages.dev/billing-test.html','https://example.invalid/billing-test.html',PLAN.origin+'/billing-test.html?paid=true',PLAN.origin+'/billing-test.html#token', 'https://user@simple-staging-raulchulbi.pages.dev/billing-test.html'])assert.throws(()=>validateReturn(url));});
