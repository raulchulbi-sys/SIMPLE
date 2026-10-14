'use strict';
// Offline transport contract: the fixture follows the app's share/redeem RPCs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const REF='dmqjexigdnfzobarhnib',REVIEWER='6b47ae02-6574-46db-acdb-f00925efdd74';
const IDs={trainer:'11111111-1111-4111-8111-111111111111',client:'22222222-2222-4222-8222-222222222222',routine:'33333333-3333-4333-8333-333333333333',day:'44444444-4444-4444-8444-444444444444',exercise:'55555555-5555-4555-8555-555555555555',assignment:'66666666-6666-4666-8666-666666666666'};
function setup({redeemFails=false,wrongMaxUses=false,wrongForbiddenContract=false,logoutStatus=204,logoutCode=null}={}){
 const file=path.join(__dirname,'staging-runtime.cjs'),localRequire=createRequire(file),calls=[];let expiry,decode;
 const module={exports:{}},unitReviewer={ref:REF,users:{reviewer:{id:REVIEWER,email:'reviewer-unit@example.invalid',password:'unit-memory-only'}}};
 const accountEmail=slot=>'simple-qa-cloudflare_hosting_20261014-'+slot+'@example.com';
 const readFileSync=(name,...args)=>name==='RAM_REVIEWER'?JSON.stringify(unitReviewer):fs.readFileSync(name,...args);
 async function fetch(url,options){const route=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
  const token=options.headers.Authorization?.slice('Bearer '.length),actor=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub:null;
  calls.push({route,method:options.method,actor,...(route==='/rest/v1/rpc/create_routine_share_code'?{maxUses:body.p_max_uses,expiresAt:body.p_expires_at,routine:body.p_routine_id}:{})});
  let data,status=200;
  if(route==='/auth/v1/token'){
   const id=body.email===unitReviewer.users.reviewer.email?REVIEWER:body.email===accountEmail('trainer')?IDs.trainer:IDs.client;
   const exp=Math.floor(Date.now()/1000)+3600,payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',iss:'https://'+REF+'.supabase.co/auth/v1',exp})).toString('base64url');
   data={user:{id},access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.unit',refresh_token:'unit-memory-only',expires_at:exp};
  }else if(route==='/auth/v1/logout'){status=logoutStatus;data=logoutCode?{error_code:logoutCode}:null;}
  else if(route==='/functions/v1/simple-cloudflare-hosting-qa')data=body.action==='cleanup'?{deleted:body.ids}:{id:IDs[body.slot],slot:body.slot,email:accountEmail(body.slot),password:'unit-memory-only'};
  else if(route==='/rest/v1/rpc/create_routine_atomic')data=IDs.routine;
  else if(route==='/rest/v1/routine_days')data=[{id:IDs.day,routine_id:IDs.routine}];
  else if(route==='/rest/v1/routine_exercises')data=[{id:IDs.exercise,day_id:IDs.day}];
  else if(route==='/rest/v1/rpc/create_routine_share_code'){expiry=body.p_expires_at;data=[{code:'SMP-A1B2C3',max_uses:wrongMaxUses?2:1,expires_at:expiry}];}
  else if(route==='/rest/v1/rpc/redeem_routine_share_code'){data=redeemFails?{code:'P0001'}:IDs.assignment;status=redeemFails?400:200;}
  else if(route==='/rest/v1/routine_assignments'&&options.method==='GET')data=[{id:IDs.assignment,trainer_id:IDs.trainer,client_id:IDs.client,trainer_routine_id:IDs.routine,client_routine_id:null}];
  else if(route==='/rest/v1/routines')data=[{id:IDs.routine,owner_id:IDs.trainer}];
  else if(route==='/rest/v1/rpc/get_client_routine_structure')data={days:[{id:IDs.day,exercises:[{id:IDs.exercise}]}]};
  else if(route==='/rest/v1/workouts'&&options.method==='GET')data=[];
  else if(route==='/rest/v1/workouts'&&options.method==='POST'){
   assert.equal(actor,IDs.client);assert.equal(body.user_id,IDs.trainer);status=wrongForbiddenContract?403:400;
   data=wrongForbiddenContract?{code:'42501',message:'RLS-only'}:{code:'P0001',message:'workout_context_not_authorized'};
  }
  else{status=403;data={code:'42501'};}
  return{ok:status>=200&&status<300,status,json:async()=>decode(JSON.stringify(data))};
 }
 const context=vm.createContext({require:name=>name==='node:fs'?{...fs,readFileSync}:localRequire(name),module,exports:module.exports,__dirname,Buffer,process,fetch,AbortSignal,Date,console:{log:()=>{},error:()=>{}}});
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});decode=vm.runInContext('JSON.parse',context);
 const runtime=module.exports;runtime.init('RAM_REVIEWER');return{runtime,calls};
}
test('seed uses trainer share creation, one-use short expiry, client redemption and assignment read only',async()=>{
 const {runtime,calls}=setup();await runtime.execute({op:'create'});const result=await runtime.execute({op:'seed'});
 assert.equal(result.fixture.assignment,IDs.assignment);
 const share=calls.find(c=>c.route==='/rest/v1/rpc/create_routine_share_code');assert.equal(share.actor,IDs.trainer);assert.equal(share.maxUses,1);assert.equal(share.routine,IDs.routine);
 const remaining=Date.parse(share.expiresAt)-Date.now();assert(remaining>29*60*1000&&remaining<=30*60*1000);
 assert.equal(calls.find(c=>c.route==='/rest/v1/rpc/redeem_routine_share_code').actor,IDs.client);
 const assignmentCalls=calls.filter(c=>c.route==='/rest/v1/routine_assignments');assert.equal(assignmentCalls.length,1);assert.equal(assignmentCalls[0].method,'GET');
 assert.equal(JSON.stringify(result).includes('SMP-A1B2C3'),false,'Share credential must stay in RAM');
});
test('redemption error preserves partial fixture inventory without direct-insert fallback',async()=>{
 const {runtime,calls}=setup({redeemFails:true});await runtime.execute({op:'create'});await assert.rejects(runtime.execute({op:'seed'}),/controlled_api_failed_400/);
 const result=await runtime.execute({op:'inventory'});assert.equal(result.fixture.routine,IDs.routine);assert.equal(result.fixture.assignment,undefined);
 assert.equal(calls.some(c=>c.route==='/rest/v1/routine_assignments'&&c.method==='POST'),false);
});
test('unexpected multi-use response is rejected before client can redeem',async()=>{
 const {runtime,calls}=setup({wrongMaxUses:true});await runtime.execute({op:'create'});await assert.rejects(runtime.execute({op:'seed'}));
 assert.equal(calls.some(c=>c.route==='/rest/v1/rpc/redeem_routine_share_code'),false);
});
test('cross-owner save requires the installed domain guard and preserves own history on reread',async()=>{
 const {runtime,calls}=setup();await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const result=await runtime.execute({op:'api'});
 assert(result.checks.some(c=>c.name==='client_cannot_save_for_trainer'&&c.pass));assert(result.checks.some(c=>c.name==='rejected_cross_owner_attempt_preserves_own_history'&&c.pass));
 assert.equal(calls.filter(c=>c.route==='/rest/v1/workouts'&&c.method==='POST').length,1);assert.equal(calls.filter(c=>c.route==='/rest/v1/workouts'&&c.method==='GET').length,2);
});
test('generic RLS rejection does not silently replace the exact installed domain-guard contract',async()=>{
 const {runtime}=setup({wrongForbiddenContract:true});await runtime.execute({op:'create'});await runtime.execute({op:'seed'});await assert.rejects(runtime.execute({op:'api'}),/controlled_check_failed/);
});
test('cleanup tolerates only exact missing-session 403 after UI global logout',async()=>{
 for(const code of ['session_not_found','session_missing']){const {runtime}=setup({logoutStatus:403,logoutCode:code});await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const result=await runtime.execute({op:'cleanup'});assert.equal(result.deleted.length,2);}
});
test('other logout 403 cannot silently proceed to privileged cleanup',async()=>{
 const {runtime,calls}=setup({logoutStatus:403,logoutCode:'not_admin'});await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const before=calls.filter(c=>c.route==='/functions/v1/simple-cloudflare-hosting-qa').length;
 await assert.rejects(runtime.execute({op:'cleanup'}),/logout_failed/);assert.equal(calls.filter(c=>c.route==='/functions/v1/simple-cloudflare-hosting-qa').length,before);
});
