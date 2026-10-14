'use strict';
// Explicit coordinator commands only. New credentials/sessions never leave RAM.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),readline=require('node:readline');
const REF='dmqjexigdnfzobarhnib',URL='https://'+REF+'.supabase.co',REVIEWER='6b47ae02-6574-46db-acdb-f00925efdd74';
const TASK='cloudflare_hosting_20261014',EDGE='/functions/v1/simple-cloudflare-hosting-qa';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=require('../../config/public-backends.json').staging.publicKey;
let reviewer=null,accounts=new Map(),actors=new Map(),fixture=null;
const checks=[];
function check(name,condition){assert.equal(condition,true,'controlled_check_failed');checks.push({name,pass:true});}
function init(file){
 assert.equal(accounts.size,0,'existing_runtime');
 let loaded=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(loaded.ref,REF);assert.equal(loaded.users?.reviewer?.id,REVIEWER);
 assert.equal(typeof loaded.users.reviewer.email,'string');assert.equal(typeof loaded.users.reviewer.password,'string');
 reviewer={id:REVIEWER,email:loaded.users.reviewer.email,password:loaded.users.reviewer.password};loaded=null;
 return {initialized:true,project:REF,credentials_persisted:false};
}
async function request(route,{method='GET',body,token}={}){
 assert(route.startsWith('/auth/v1/')||route.startsWith('/rest/v1/')||route===EDGE,'stage_route_denied');
 const response=await fetch(URL+route,{method,headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=representation',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 let data;try{data=await response.json();}catch{data=null;}
 return {ok:response.ok,status:response.status,data};
}
async function login(slot){
 const u=slot==='reviewer'?reviewer:accounts.get(slot);assert(u?.password,'actor_missing');
 if(actors.get(slot)?.expires>Date.now()+30000)return actors.get(slot);
 const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:u.email,password:u.password}});
 assert(result.ok&&result.data?.user?.id===u.id,'synthetic_login_failed');
 const claims=JSON.parse(Buffer.from(result.data.access_token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(claims.sub,u.id);assert.equal(claims.role,'authenticated');assert.equal(claims.iss,URL+'/auth/v1');
 const actor={id:u.id,accessToken:result.data.access_token,expires:(result.data.expires_at||claims.exp)*1000};
 actors.set(slot,actor);result.data.access_token=null;result.data.refresh_token=null;return actor;
}
async function api(slot,route,method='GET',body){const a=await login(slot);const r=await request(route,{method,body,token:a.accessToken});assert(r.ok,'controlled_api_failed_'+r.status);return r.data;}
async function qa(body){const a=await login('reviewer');const r=await request(EDGE,{method:'POST',body,token:a.accessToken});
 if(!r.ok){if(r.data?.created_id&&UUID.test(r.data.created_id)&&['trainer','client'].includes(r.data.slot))accounts.set(r.data.slot,{id:r.data.created_id,slot:r.data.slot});
  throw Error(/^[a-z_]+$/.test(r.data?.error||'')?r.data.error:'controlled_helper_failed');}return r.data;
}
function inventory(){return {project:REF,accounts:[...accounts.values()].map(u=>({id:u.id,slot:u.slot})),fixture,checks:[...checks],provider_calls:0,credentials_persisted:false,tokens_persisted:false};}
async function create(){assert.equal(accounts.size,0,'repeat_create_denied');for(const slot of ['trainer','client']){
 const u=await qa({action:'create',slot});assert.match(u.id,UUID);assert.equal(u.slot,slot);assert.equal(u.email,'simple-qa-'+TASK+'-'+slot+'@example.com');assert.equal(typeof u.password,'string');accounts.set(slot,u);
 }check('two_fresh_synthetic_identities',accounts.size===2);return inventory();}
async function seed(){assert.equal(accounts.size,2);assert.equal(fixture,null,'repeat_seed_denied');
 const trainer=accounts.get('trainer').id,client=accounts.get('client').id;
 const rid=await api('trainer','/rest/v1/rpc/create_routine_atomic','POST',{p_name:'SYNTHETIC Cloudflare hosting routine',p_description:TASK,p_days:[{name:'SYNTHETIC Cloudflare day',exercises:[{name:'SYNTHETIC Goblet squat',sets:2,target:'2x8-10',rir:3,rest_seconds:90,notes:null}]}]});assert.match(rid,UUID);
 fixture={routine:rid,trainer,client}; // Capture immediately so partial setup remains recoverable.
 const days=await api('trainer','/rest/v1/routine_days?select=id,routine_id,name&routine_id=eq.'+rid);assert.equal(days.length,1);fixture.day=days[0].id;
 const exercises=await api('trainer','/rest/v1/routine_exercises?select=id,day_id,name&day_id=eq.'+fixture.day);assert.equal(exercises.length,1);fixture.exercise=exercises[0].id;
 const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
 const generated=await api('trainer','/rest/v1/rpc/create_routine_share_code','POST',{p_routine_id:rid,p_max_uses:1,p_expires_at:expiresAt});
 const share=Array.isArray(generated)?generated[0]:generated;
 assert.match(share?.code,/^SMP-[A-F0-9]{6}$/);assert.equal(share.max_uses,1);assert.equal(Date.parse(share.expires_at),Date.parse(expiresAt));
 const assignmentId=await api('client','/rest/v1/rpc/redeem_routine_share_code','POST',{p_code:share.code});assert.match(assignmentId,UUID);
 const assignments=await api('client','/rest/v1/routine_assignments?select=id,trainer_id,client_id,trainer_routine_id,client_routine_id&client_id=eq.'+client+'&trainer_routine_id=eq.'+rid);
 assert.equal(assignments.length,1);assert.equal(assignments[0].id,assignmentId);assert.equal(assignments[0].trainer_id,trainer);assert.equal(assignments[0].client_id,client);assert.equal(assignments[0].client_routine_id,null);fixture.assignment=assignmentId;
 check('normal_single_use_share_and_client_redemption',true);return inventory();
}
async function apiChecks(){assert(fixture?.assignment,'fixture_not_seeded');
 const own=await api('client','/rest/v1/routines?select=id,owner_id&id=eq.'+fixture.routine);check('client_reads_assigned_routine',own.length===1&&own[0].id===fixture.routine);
 const structure=await api('client','/rest/v1/rpc/get_client_routine_structure','POST',{p_client_id:fixture.client,p_routine_id:fixture.routine});check('client_reads_real_structure',JSON.stringify(structure).includes(fixture.exercise));
 const rows=await api('client','/rest/v1/workouts?select=id&user_id=eq.'+fixture.client);check('fresh_client_has_no_workouts',rows.length===0);
 const actor=await login('client');
 const forbidden=await request('/rest/v1/workouts',{method:'POST',token:actor.accessToken,body:{user_id:fixture.trainer,variant:'SYNTHETIC',day:'SYNTHETIC',data:{routine_id:fixture.routine,routine_day_id:fixture.day}}});
 check('client_cannot_save_for_trainer',forbidden.status===400&&forbidden.data?.code==='P0001'&&forbidden.data?.message==='workout_context_not_authorized');
 const after=await api('client','/rest/v1/workouts?select=id&user_id=eq.'+fixture.client);check('rejected_cross_owner_attempt_preserves_own_history',JSON.stringify(after)===JSON.stringify(rows));return inventory();
}
async function readback(){assert(fixture,'fixture_not_seeded');const workouts=await api('client','/rest/v1/workouts?user_id=eq.'+fixture.client+'&data->>routine_id=eq.'+fixture.routine),notes=await api('client','/rest/v1/routine_user_notes?user_id=eq.'+fixture.client+'&routine_id=eq.'+fixture.routine);return {workouts,notes};}
async function logout(slot){const a=actors.get(slot);if(!a)return;const r=await request('/auth/v1/logout?scope='+(slot==='reviewer'?'local':'global'),{method:'POST',token:a.accessToken});
 const code=r.data?.error_code||r.data?.code;const alreadyGone=r.status===403&&['session_not_found','session_missing'].includes(code);
 assert(r.ok||r.status===401||alreadyGone,'logout_failed');actors.delete(slot);}
async function execute(command){
 if(command.op==='inventory')return inventory();
 if(command.op==='create')return create();
 if(command.op==='seed')return seed();
 if(command.op==='api')return apiChecks();
 if(command.op==='browser'){assert(fixture?.assignment);const result=await require('./staging-browser.cjs').run({fixture,account:accounts.get('client'),readback});return result;}
 if(command.op==='cleanup'){
  for(const slot of ['client','trainer'])await logout(slot);
  const ids=[...accounts.values()].map(u=>u.id);assert(ids.length>=1&&ids.length<=2);
  const result=await qa({action:'cleanup',ids});assert.deepEqual(result.deleted.sort(),ids.sort());accounts.clear();fixture=null;return {deleted:ids,credentials_erased:true};
 }
 if(command.op==='close'){assert.equal(accounts.size,0,'cleanup_before_close');await logout('reviewer');reviewer=null;actors.clear();return {closed:true,tokens_persisted:false};}
 throw Error('unknown_operation');
}
function helperSource(expiresAt){const end=Date.parse(expiresAt);assert(Number.isFinite(end)&&end>Date.now()&&end<Date.now()+2*60*60*1000,'short_future_expiry_required');return fs.readFileSync(path.join(__dirname,'staging-qa-edge.ts'),'utf8').replace('__EXPIRES_AT__',new Date(end).toISOString());}
module.exports={init,execute,helperSource,REF,REVIEWER};
if(require.main===module){
 try{init(process.env.SIMPLE_STAGE_REVIEWER_FILE);}catch{console.error('controlled_initialization_failed');process.exit(1);}
 (async()=>{for await(const line of readline.createInterface({input:process.stdin})){try{const command=JSON.parse(line);const result=await execute(command);console.log(JSON.stringify(result));if(command.op==='close')break;}catch(error){console.log(JSON.stringify({error:/^[a-z_0-9]+$/.test(error.message||'')?error.message:'controlled_operation_failed'}));}}})().catch(()=>{console.error('controlled_runtime_failed');process.exitCode=1;});
}
