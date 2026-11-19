'use strict';
// Preparation only. No SDK import, Auth, filesystem credentials, fetch or SQL.
// The eventual operator collects these READS with the authorized SDK/JWT and
// supplies the results in memory. This CLI has no connected execution switch.
const assert=require('node:assert/strict');
const PROJECT='dmqjexigdnfzobarhnib';
const ORIGIN='https://simple-staging-raulchulbi.pages.dev';
const PLAN=Object.freeze({
 project:PROJECT,origin:ORIGIN,returnPath:'/billing-test.html',returnPaths:['/billing-test.html','/billing-test'],
 identities:['mock','real'],sessionsMaximum:2,providerCalls:0,purchases:0,portalSessions:0,
 // Optional separate reader reuses the existing browser session's access token
 // in memory. These options do NOT describe the persistent product UI SDK.
 readerAuthOptions:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 browserSession:{contexts:'ephemeral-isolated',loginsPerIdentity:1,storageStateExport:false,refreshAllowed:false},
 reads:[
  {transport:'edge',name:'billing-test',body:{action:'status'}},
  {transport:'edge',name:'billing-test',body:{action:'access'}},
  ...['billing_test_my_access','billing_test_capabilities','get_my_coach_access','premium_my_access']
   .map(name=>({transport:'rpc',name,body:{}}))
 ],
 forbidden:['checkout','portal','reconcile','reserve_basic_generation','simple-coach-mock','simple-coach-chat'],
});
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).every(k=>allowed.includes(k));
function assertRead(operation){
 assert.ok(keys(operation,['transport','name','body']),'unexpected_read_fields');
 assert.ok(PLAN.reads.some(x=>x.transport===operation.transport&&x.name===operation.name
  &&JSON.stringify(x.body)===JSON.stringify(operation.body)),'read_not_allowed');
 return true;
}
function data(result){assert.equal(result?.error,null,'read_failed');assert.ok(result.data&&typeof result.data==='object','missing_read_data');return result.data;}
function validateAccount(snapshot,{active,now=Date.now()}){
 assert.equal(snapshot.project,PROJECT,'wrong_project');
 const s=data(snapshot.status),a=data(snapshot.access),direct=data(snapshot.directAccess),c=data(snapshot.capabilities),coach=data(snapshot.coach),premium=data(snapshot.premium);
 assert.equal(s.environment,'STRIPE_TEST');assert.equal(a.environment,'STRIPE_TEST');
 assert.deepEqual(a,direct,'edge_rpc_disagree');
 assert.equal(s.accessActive,active);assert.equal(c.basicActive,active);
 assert.equal(s.aiQuotaChanged,false);assert.equal(a.aiQuotaChanged,false);
 assert.equal(c.basicGenerationEnabled,false);assert.equal(c.premiumEnabled,false);
 assert.equal(c.quotasChanged,false);assert.equal(c.humanReviewRequired,true);
 assert.equal(coach.can_generate,false);assert.equal(coach.paidBasic,active);
 assert.equal(premium.enabled,false);
 if(active){assert.equal(s.plan,'basic');assert.equal(s.monthlyCents,499);assert.equal(s.currency,'eur');
  assert.equal(a.plan,'basic');assert.equal(a.state,'active');
  assert.ok(Date.parse(a.paidUntil)>now,'paid_period_expired');
  assert.equal(s.paidUntil,a.paidUntil);
 }else{assert.equal(s.plan,null);assert.equal(a.plan,null);assert.notEqual(a.state,'active');}
 // Neither public billing projection may expose a Customer/session/invoice ID.
 for(const value of [s,a,direct])for(const key of Object.keys(value))assert.ok(!/(customer|session|invoice|email|user_id|token|secret)/i.test(key),'private_projection_field');
 return {basicActive:active,premiumDenied:true,generationClosedByRead:true,priceVerified:active};
}
function validateIsolation({http,rows,errorCode}){
 // A failed request is not automatically a security PASS. Accept only explicit
 // permission/schema-not-exposed errors or HTTP200 with zero rows.
 const permissionDenied=http===403&&errorCode==='42501';
 const unexposed=(http===406||http===400)&&errorCode==='PGRST106';
 assert.ok(permissionDenied||unexposed||http===200&&Array.isArray(rows)&&rows.length===0,'isolation_not_demonstrated');
 return true;
}
function validateReturn(url){const u=new URL(url);assert.equal(u.origin,ORIGIN);assert.ok(PLAN.returnPaths.includes(u.pathname),'return_path_not_allowed');assert.equal(u.username,'');assert.equal(u.password,'');assert.equal(u.search,'');assert.equal(u.hash,'');return true;}
module.exports={PLAN,assertRead,validateAccount,validateIsolation,validateReturn};
if(require.main===module){
 if(process.argv.slice(2).some(x=>x!=='--dry-run')){process.stderr.write('Preparation only: connected execution is not implemented or authorized.\n');process.exitCode=2;}
 else process.stdout.write(JSON.stringify({mode:'DRY_RUN_NO_NETWORK',...PLAN},null,2)+'\n');
}
