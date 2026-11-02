'use strict';
// Authorized, existing synthetic STAGING identities only. Password login is the
// only Auth mutation. Tokens stay in RAM; no refresh, logout, admin or provider.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {validateBackend}=require('../../scripts/hosting-runtime.cjs');
const ROOT=path.resolve(__dirname,'../..'),PROJECT='dmqjexigdnfzobarhnib',BASE='https://'+PROJECT+'.supabase.co';
const EXPECTED=Object.freeze({mock:{id:'c7bbe50b-d349-4f7e-8fdc-476f17c22674',role:'client'},real:{id:'c14a2a6d-9853-431d-856c-4d742002187e',role:'client'},retry:{id:'495fa022-d51b-4bdd-a2f8-e031409b69f5',role:'client'},reviewer:{id:'6b47ae02-6574-46db-acdb-f00925efdd74',role:'trainer'},trainer:{id:'0b6fb9c1-3a62-4fbb-93d9-b3993a8fffb8',role:'trainer'}});
const CLIENTS=['mock','real','retry'];
const DEFAULT_CREDENTIALS=path.resolve(ROOT,'../coach-premium-phase2/tests/premium-phase2/private/fixture.json');
const OUTPUT=path.join(__dirname,'results/public-jwt-security.json');
const safeCode=value=>typeof value==='string'&&/^[a-z_0-9]{1,80}$/i.test(value)?value:'unspecified';
function denialEvidence(result,{businessGuards}={}){
 const code=result.data?.code;
 if(businessGuards){
  assert.equal(result.status,400,'unexpected_business_rejection_status');assert.equal(code,'P0001','unexpected_business_rejection_code');
  assert(businessGuards.includes(result.data?.message),'unrecognized_business_guard');
  return{status:400,code,classification:'business_guard_only_not_cross_user_write_proof',guardMatched:true};
 }
 assert.equal(result.status,403,'expected_authorization_denial_status');assert.equal(code,'42501','expected_authorization_denial_code');
 return{status:403,code,classification:'authorization_denial'};
}

async function run(){
 const input=JSON.parse(fs.readFileSync(process.env.SIMPLE_PUBLIC_SECURITY_CREDENTIALS_FILE||DEFAULT_CREDENTIALS,'utf8'));
 const backend=require('../../config/public-backends.json').staging;
 assert.equal(input.ref,PROJECT,'Wrong synthetic credential project');validateBackend('staging',backend);assert.equal(backend.projectId,PROJECT);assert.equal(backend.url,BASE);
 // Deliberately select password credentials; never use historical token fields.
 let credentials={};for(const [actor,pin]of Object.entries(EXPECTED)){
  const value=input.users?.[actor];assert(value&&value.id===pin.id&&value.role===pin.role,'Synthetic identity/role pin mismatch');
  assert(typeof value.email==='string'&&typeof value.password==='string'&&value.password.length>0,'Existing password credentials required');
  credentials[actor]={id:pin.id,email:value.email,password:value.password};
 }
 // Discard the parsed container, including any obsolete session material.
 for(const key of Object.keys(input))delete input[key];
 const sessions=new Map(),observed=new Map(),rows=[],blocked=new Set();let requests=0,successfulLogins=0;
 const report={kind:'Real JWT staging isolation; synthetic identities only; no mocked responses',capturedAt:new Date().toISOString(),project:PROJECT,
  limits:{providerCalls:0,adminCalls:0,refreshCalls:0,logoutCalls:0,existingBusinessWrites:0,tokensPersisted:false,credentialsPersisted:false},results:rows};
 function save(){report.completedAt=new Date().toISOString();report.requests=requests;report.counts={passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,blocked:blocked.size};report.blocked=[...blocked];report.authEffects={successfulPasswordLogins:successfulLogins,normalMutableFields:['auth.sessions','auth.users.last_sign_in_at','auth.users.updated_at'],accountOrProfileChanges:false};report.status=report.counts.failed||blocked.size?'BLOCKED':'PASS';fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');}
 async function request(actor,route,{method='GET',body}={}){
  assert(route.startsWith('/rest/v1/')||route==='/auth/v1/user'||route==='/auth/v1/token?grant_type=password','Only reviewed Auth/REST routes allowed');
  assert(!/functions|admin|refresh_token|logout/.test(route),'Provider/admin/session management routes forbidden');
  const token=actor?sessions.get(actor):null;if(actor)assert(token,'Verified synthetic JWT required');
  requests++;const response=await fetch(BASE+route,{method,headers:{apikey:backend.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const raw=await response.text();assert(raw.length<2000000,'Oversized response rejected');let data=null;try{data=raw?JSON.parse(raw):null;}catch{data={code:'non_json_response'};}
  return{status:response.status,ok:response.ok,data};
 }
 async function check(name,fn){try{const evidence=await fn();rows.push({name,pass:true,...evidence});}catch(error){rows.push({name,pass:false,error:safeCode(error.cause?.code||error.code||error.message)});}save();}
 const read=(actor,table,select,filter)=>request(actor,'/rest/v1/'+table+'?select='+select+'&'+filter);
 const rpc=(actor,name,args)=>request(actor,'/rest/v1/rpc/'+name,{method:'POST',body:args});
 const successful=result=>{assert.equal(result.status,200);assert(Array.isArray(result.data));return result.data;};
 const denied=denialEvidence;
 try{
  for(const actor of Object.keys(EXPECTED))await check(actor+': authenticated identity and server profile role',async()=>{
   const login=await request(null,'/auth/v1/token?grant_type=password',{method:'POST',body:{email:credentials[actor].email,password:credentials[actor].password}});
   if(login.status!==200)throw Object.assign(Error('synthetic_login_failed'),{code:safeCode(login.data?.error_code||login.data?.code)});
   assert.equal(login.data?.user?.id,EXPECTED[actor].id,'authenticated_identity_mismatch');assert(typeof login.data.access_token==='string','missing_access_token');
   sessions.set(actor,login.data.access_token);successfulLogins++;delete login.data.access_token;delete login.data.refresh_token;login.data=null;
   const identity=await request(actor,'/auth/v1/user');assert.equal(identity.status,200);assert.equal(identity.data?.id,EXPECTED[actor].id,'verified_identity_mismatch');identity.data=null;
   const profile=successful(await read(actor,'profiles','id,role','id=eq.'+EXPECTED[actor].id));assert.equal(profile.length,1);assert.equal(profile[0].role,EXPECTED[actor].role,'profile_role_mismatch');
   return{status:200,identityPinned:true,rolePinned:true};
  });
  credentials=null;
  if(sessions.size!==Object.keys(EXPECTED).length){blocked.add('One or more authorized synthetic logins failed; no fallback accounts or password changes attempted.');return report;}
  const owned=new Map();
  for(const actor of CLIENTS){
   const bag={};owned.set(actor,bag);
   for(const [table,owner]of [['routines','owner_id'],['workouts','user_id'],['routine_user_notes','user_id']])await check(actor+': owner read '+table,async()=>{
    const items=successful(await read(actor,table,'id,'+owner,owner+'=eq.'+EXPECTED[actor].id));assert(items.every(row=>row[owner]===EXPECTED[actor].id));bag[table]=items;
    if(!items.length)blocked.add('Positive owner fixture absent: '+actor+'/'+table);return{status:200,rows:items.length,ownerMatches:true};
   });
  }
  const crossTables=[['profiles','id'],['routines','owner_id'],['workouts','user_id'],['routine_user_notes','user_id'],['training_intakes','user_id'],['coach_conversations','user_id'],['coach_messages','user_id'],['coach_weekly_checkins','user_id'],['coach_recommendations','user_id'],['premium_initial_intakes','user_id'],['premium_initial_operations','user_id']];
  for(const [actor,target]of [['mock','real'],['real','mock']])for(const [table,owner]of crossTables)await check(actor+': cannot read '+target+'/'+table,async()=>{
   const result=await read(actor,table,'id',owner+'=eq.'+EXPECTED[target].id);
   if(result.status===200){assert.deepEqual(result.data,[],'foreign_rows_exposed');return{status:200,rows:0};}return denied(result);
  });
  for(const table of ['workouts','routine_user_notes','training_intakes','routine_revisions','coach_messages','coach_conversations'])await check('reviewer: no global '+table+' access',async()=>{
   const result=await read('reviewer',table,'id','user_id=in.('+CLIENTS.map(a=>EXPECTED[a].id).join(',')+')');
   if(result.status===200){assert.deepEqual(result.data,[],'reviewer_private_rows_exposed');return{status:200,rows:0};}return denied(result);
  });
  const assignments=successful(await read('trainer','routine_assignments','id,client_id,trainer_id,trainer_routine_id,client_routine_id,client_deleted_at','trainer_id=eq.'+EXPECTED.trainer.id+'&client_id=in.('+CLIENTS.map(a=>EXPECTED[a].id).join(',')+')&client_deleted_at=is.null'));
  if(!assignments.length)blocked.add('No active assignment between authorized synthetic trainer and clients; positive trainer assignment path not exercised.');
  for(const assignment of assignments){
   assert.equal(assignment.trainer_id,EXPECTED.trainer.id);assert(CLIENTS.some(actor=>EXPECTED[actor].id===assignment.client_id));
   for(const name of ['get_client_routine_history','get_client_routine_notes'])await check('trainer: valid assignment '+name,async()=>{
    const result=await rpc('trainer',name,{p_client_id:assignment.client_id,p_routine_id:assignment.client_routine_id||assignment.trainer_routine_id});
    const records=successful(result);if(name==='get_client_routine_history')assert(records.every(row=>row.user_id===assignment.client_id),'foreign_client_history_exposed');
    if(!records.length)blocked.add('Positive assigned trainer fixture has no records: '+name);return{status:200,rows:records.length,assignmentPinned:true};
   });
  }
  for(const target of CLIENTS){
   const candidate=owned.get(target)?.routines?.[0];if(!candidate)continue;
   if(assignments.some(a=>a.client_id===EXPECTED[target].id&&(a.trainer_routine_id===candidate.id||a.client_routine_id===candidate.id)))continue;
   for(const actor of ['trainer','reviewer'])for(const name of ['get_client_routine_history','get_client_routine_notes'])await check(actor+': unassigned '+target+'/'+name,async()=>{
    const result=await rpc(actor,name,{p_client_id:EXPECTED[target].id,p_routine_id:candidate.id});
    if(result.status===200){assert.deepEqual(result.data,[],'unassigned_client_data_exposed');return{status:200,rows:0};}return denied(result);
   });
  }
  const scopes=[],recommendations=[];
  for(const actor of CLIENTS){
   const ownScopes=successful(await read(actor,'coach_mesocycles','id,user_id,reviewer_id','user_id=eq.'+EXPECTED[actor].id));
   for(const scope of ownScopes){assert.equal(scope.user_id,EXPECTED[actor].id);if(scope.reviewer_id===EXPECTED.reviewer.id)scopes.push(scope.id);}
   const ownRecommendations=successful(await read(actor,'coach_recommendations','id,user_id,mesocycle_id','user_id=eq.'+EXPECTED[actor].id));
   for(const recommendation of ownRecommendations){assert.equal(recommendation.user_id,EXPECTED[actor].id);if(scopes.includes(recommendation.mesocycle_id))recommendations.push(recommendation.id);}
   await check(actor+': server Premium access observation',async()=>{const result=await rpc(actor,'premium_my_access',{});assert.equal(result.status,200);observed.set(actor,result.data?.enabled===true);return{status:200,enabled:result.data?.enabled===true};});
  }
  if(scopes.length)await check('reviewer: assigned REST private intake projection',async()=>{
   const result=await read('reviewer','coach_mesocycles','id,intake','id=in.('+scopes.join(',')+')');const records=successful(result);
   if(!records.length){blocked.add('Assigned reviewer positive access unavailable under current entitlements; intake column finding remains conditional.');return{status:200,rows:0,sensitiveValuesPrinted:false};}
   const exposed=records.some(row=>Object.hasOwn(row,'intake'));report.reviewerIntakeExposure={rows:records.length,sensitiveColumnReturned:exposed,nonNullSensitiveRows:records.filter(row=>row.intake!=null).length};
   assert(!exposed,'reviewer_private_intake_column_exposed');return{status:200,rows:records.length};
  });else blocked.add('No assigned reviewer scope among authorized synthetic owners.');
  if(recommendations.length)await check('reviewer: assigned REST context projection',async()=>{
   const result=await read('reviewer','coach_recommendations','id,context_snapshot,analysis_bundle,analysis_trace','id=in.('+recommendations.join(',')+')');const records=successful(result);
   if(!records.length){blocked.add('Assigned reviewer recommendation projection unavailable under current entitlements.');return{status:200,rows:0,sensitiveValuesPrinted:false};}
   const exposed=records.some(row=>['context_snapshot','analysis_bundle'].some(field=>Object.hasOwn(row,field)));report.reviewerContextExposure={rows:records.length,sensitiveColumnReturned:exposed};
   assert(!exposed,'reviewer_private_context_column_exposed');return{status:200,rows:records.length};
  });else blocked.add('No visible synthetic recommendation for assigned-reviewer context projection.');
  // Fresh nonexistent targets: no request may modify an existing business row.
  const absent=crypto.randomUUID();
  for(const actor of Object.keys(EXPECTED)){
   await check(actor+': cannot update profile role on absent target',async()=>denied(await request(actor,'/rest/v1/profiles?id=eq.'+absent,{method:'PATCH',body:{role:'trainer'}})));
   for(const [name,args]of [
    ['premium_set_entitlement',{p_user:absent,p_enabled:false,p_until:null,p_capabilities:[],p_generation_limit:0,p_analysis_limit:0,p_chat_limit:0}],
    ['premium_assign_reviewer',{p_mesocycle:absent,p_reviewer:absent}],
    ['premium_initial_set_allowance',{p_user:absent,p_reviewer:absent,p_limit:0}],
   ])await check(actor+': server-only '+name+' denied',async()=>denied(await rpc(actor,name,args)));
  }
  for(const actor of CLIENTS)for(const [name,args,businessGuards]of [
   ['delete_my_workout',{p_workout_id:absent},['La sesión no existe o no pertenece a tu cuenta.']],['delete_workout_exercise',{p_workout_id:absent,p_exercise_id:'absent'},['not_authorized']],
   ['update_client_workout_data',{p_workout_id:absent,p_data:{}},['not_authorized','invalid_workout_data']],
   ['save_client_routine_structure',{p_client_id:absent,p_routine_id:absent,p_expected_version:-1,p_name:'SYNTHETIC absent target',p_description:'',p_days:{}}],
   ['premium_save_weekly_checkin',{p_mesocycle:absent,p_week:-1,p_revision:absent,p_expected:-1,p_answers:{},p_submit:null}],
  ])await check(actor+': absent scope '+name+' denied',async()=>denied(await rpc(actor,name,args),businessGuards?{businessGuards}:{}));
  if([...observed.values()].every(value=>value===false))blocked.add('All observed Premium accesses are disabled: no positive or live revocation transition tested; no entitlements were changed.');
 }finally{sessions.clear();credentials=null;save();}
 return report;
}
module.exports={run,denialEvidence};
if(require.main===module){if(process.argv.length!==3||process.argv[2]!=='--run'){console.log('DRY RUN. Authorized synthetic staging logins require --run; no requests made.');}
 else run().then(report=>console.log(JSON.stringify({status:report?.status||'BLOCKED',counts:report?.counts,output:OUTPUT,providerCalls:0,tokensPersisted:false}))).catch(error=>{console.error('Synthetic staging security run stopped: '+safeCode(error.code||error.message));process.exitCode=1;});}
