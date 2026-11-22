'use strict';

// Real STAGING requests, without a user session. No account, email, provider,
// configuration, budget or fixture is created by this runner. Reports omit data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {validateBackend} = require('../../scripts/hosting-runtime.cjs');
const backend = require('../../config/public-backends.json').staging;
const root = path.resolve(__dirname, '../..');
const PROJECT = 'dmqjexigdnfzobarhnib';
const BASE = 'https://' + PROJECT + '.supabase.co';
const ABSENT = '00000000-0000-4000-8000-000000000016';
const reorderOnly=process.argv.includes('--reorder-only');
const output = path.join(__dirname, reorderOnly?'results/public-anonymous-reorder.json':'results/public-anonymous-security.json');
const tables = [
  'profiles','routines','routine_days','routine_exercises','routine_assignments',
  'workouts','routine_user_notes','routine_share_codes','routine_share_code_uses',
  'client_routine_customizations','client_routine_statistics_stages',
  'training_intakes','intake_health','context_grants','coach_operations',
  'coach_pilot_feedback','coach_mesocycles','coach_mesocycle_weeks',
  'routine_management','routine_revisions','coach_weekly_checkins',
  'coach_recommendations','coach_conversations','coach_messages',
  'premium_initial_intakes','premium_initial_operations'
];
const scope = {p_client_id:ABSENT,p_routine_id:ABSENT};
// Signatures and lack of anon EXECUTE were checked against the staging catalog.
// Every modifying probe has a nonexistent target and an empty payload; none can
// start a provider request or alter a quota even if a role guard regresses.
const rpc = {
  get_my_coach_access:{}, premium_my_access:{}, premium_initial_my_state:{},
  premium_initial_review_queue:{},
  get_client_routine_history:scope, get_client_routine_notes:scope,
  get_client_routine_structure:scope, get_client_routine_cycle_progress:scope,
  premium_assign_reviewer:{p_mesocycle:ABSENT,p_reviewer:ABSENT},
  save_routine_atomic:{p_routine_id:ABSENT,p_name:'SYNTHETIC absent target',p_description:'',p_days:[]},
  save_workout_day_exercises_atomic:{p_day_id:ABSENT,p_exercises:[]},
  update_client_workout_data:{p_workout_id:ABSENT,p_data:{}},
  reorder_my_routines_atomic:{p_routine_ids:[]},
  reorder_my_routine_days_atomic:{p_routine_id:ABSENT,p_day_ids:[]},
  reorder_my_routine_exercises_atomic:{p_day_id:ABSENT,p_exercise_ids:[]}
};
const edges=['simple-coach-mock','simple-coach-premium','simple-coach-chat','simple-coach-initial-premium'];
const report={capturedAt:new Date().toISOString(),project:PROJECT,
  kind:'Real anonymous staging HTTP, no mocked responses and no user JWT',
  limits:'Does not prove authenticated cross-user isolation or production OAuth',
  requests:[],results:[]};

function safeError(error) {
  return error?.name==='AssertionError'?'contract_assertion_failed':
    error?.name==='TimeoutError'?'network_timeout':'request_failed';
}
async function request(route,{method='GET',body,headers={}}={}) {
  assert(route.startsWith('/rest/v1/')||route.startsWith('/auth/v1/')||edges.some(e=>route==='/functions/v1/'+e),'route_not_reviewed');
  const url=new URL(route,BASE);assert.equal(url.origin,BASE);
  const response=await fetch(url,{method,redirect:'error',headers:{apikey:backend.publicKey,
    'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch{data=null;}
  // Never retain a record, Auth token, identity, error description or response body.
  const observation={route:route.split('?')[0],method,status:response.status,
    code:typeof data?.code==='string'?data.code:null,
    rowCount:Array.isArray(data)?data.length:null,
    adminUserCount:Array.isArray(data?.users)?data.users.length:null};
  report.requests.push(observation);
  return {observation,empty:Array.isArray(data)&&data.length===0,
    errorCode:data?.error_code||data?.code};
}
function tableDenied(r){
  assert((r.observation.status===200&&r.empty)||
    ([401,403].includes(r.observation.status)&&r.observation.code==='42501'));
}
async function check(name,fn){
  if(reorderOnly&&!name.startsWith('anonymous RPC denied: reorder_my_'))return;
  try{await fn();report.results.push({name,pass:true});}
  catch(error){report.results.push({name,pass:false,error:safeError(error)});}
}
async function main(){
  validateBackend('staging',backend);assert.equal(backend.projectId,PROJECT);assert.equal(backend.url,BASE);
  assert(execFileSync('git',['check-ignore','--',path.relative(root,output)],{cwd:root}).length,'report_must_be_ignored');
  for(const table of tables)await check('anonymous private table: '+table,async()=>{
    tableDenied(await request('/rest/v1/'+table+'?select=*&limit=1'));
  });
  for(const table of ['profiles','workouts','routine_user_notes','coach_recommendations'])
    await check('public anon key is not a user session: '+table,async()=>{
      tableDenied(await request('/rest/v1/'+table+'?select=*&limit=1',{
        headers:{Authorization:'Bearer '+backend.publicKey}}));
    });
  for(const [name,body]of Object.entries(rpc))await check('anonymous RPC denied: '+name,async()=>{
    const r=await request('/rest/v1/rpc/'+name,{method:'POST',body});
    if(name.startsWith('reorder_my_')){
      // Invoker RPCs deliberately retain PUBLIC EXECUTE and reject a null
      // auth.uid() before any lock/update. Their contract is an SQL exception.
      assert.equal(r.observation.status,400);assert.equal(r.observation.code,'P0001');
    }else{assert([401,403].includes(r.observation.status));assert.equal(r.observation.code,'42501');}
  });
  for(const name of edges)await check('anonymous Edge denied before handler: '+name,async()=>{
    const r=await request('/functions/v1/'+name,{method:'POST',body:{}});
    assert.equal(r.observation.status,401);
  });
  await check('Auth user requires a real session',async()=>{
    const r=await request('/auth/v1/user');assert.equal(r.observation.status,401);
  });
  await check('Auth admin is unavailable to the public key',async()=>{
    const r=await request('/auth/v1/admin/users',{headers:{Authorization:'Bearer '+backend.publicKey}});
    assert([401,403].includes(r.observation.status));assert.equal(r.observation.adminUserCount,null);
  });
  for(const table of ['premium_analysis_budget','premium_financial_events'])
    await check('private financial schema is not an exposed API: '+table,async()=>{
      const r=await request('/rest/v1/'+table+'?select=*&limit=1',{headers:{'Accept-Profile':'coach_private'}});
      assert.equal(r.observation.status,406);assert.equal(r.observation.code,'PGRST106');
    });
  report.counts={passed:report.results.filter(r=>r.pass).length,failed:report.results.filter(r=>!r.pass).length,
    uniqueCases:report.results.length,httpRequests:report.requests.length};
  report.completedAt=new Date().toISOString();
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({project:PROJECT,counts:report.counts,
    failures:report.results.filter(r=>!r.pass),output:path.relative(root,output)},null,2));
  if(report.counts.failed)process.exitCode=1;
}
module.exports={tables,rpc,edges,tableDenied};
if(require.main===module)main().catch(error=>{console.error(safeError(error));process.exitCode=1;});
