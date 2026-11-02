'use strict';
// Real SDK and real staging Auth/PostgREST. Synthetic identities arrive from caller RAM.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:4280/',stage='https://dmqjexigdnfzobarhnib.supabase.co';
process.env.PLAYWRIGHT_BROWSERS_PATH||='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
let playwright;try{playwright=require('playwright');}catch{playwright=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const READ_RPCS=new Set(['get_my_coach_access','get_coach_reviewer_access','premium_my_access','premium_initial_my_state','premium_initial_review_queue','get_client_routine_structure','get_client_routine_statistics_stage','get_client_routine_cycle_progress','get_client_custom_routine_cycle_progress','get_client_routine_history','get_client_routine_notes']);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function run({fixture,account,readback}){
 assert.equal(account.id,fixture.client);assert(account.password&&account.email,'RAM_credentials_required');
 const artifact=path.join(root,'dist'),sdk=fs.readFileSync(path.join(__dirname,'private/supabase-2.115.0.js'));
 assert.equal(hash(sdk),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7','pinned_real_SDK_required');
 const runtime=require('../../scripts/hosting-runtime.cjs').createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:base}});
 assert.equal(fs.readFileSync(path.join(artifact,'assets/runtime-config.js'),'utf8'),runtime.javascript,'actual_staging_dist_required');
 const server=require('./browser-support.cjs').serverFor(artifact);
 let ownServer=false;
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4280,'127.0.0.1',resolve);});ownServer=true;}
 catch(error){if(error.code!=='EADDRINUSE')throw error;const existing=await fetch(base);assert.equal(hash(Buffer.from(await existing.arrayBuffer())),hash(fs.readFileSync(path.join(artifact,'index.html'))),'occupied_port_must_serve_exact_dist');}
 const checks=[],requests=[],blocked=[],errors=[];let savedHash=null,phase='starting';
 const check=(name,condition)=>{assert.equal(condition,true,'controlled_browser_check_failed');checks.push({name,pass:true});};
 const report=()=>({kind:'Real SDK password login and staging database with two task-only synthetic identities; no provider',project:'dmqjexigdnfzobarhnib',phase,checks,passed:checks.length,requests,blocked,script_errors:errors,workout_data_sha256:savedHash,provider_calls:0,credentials_persisted:false,tokens_persisted:false});
 const save=result=>{fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/staging-browser.json'),JSON.stringify(result,null,2)+'\n');};
 try{
  for(const engine of ['chromium','webkit']){
   const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(25000);
   page.on('pageerror',e=>errors.push({engine,message:/^[a-z0-9_ .:-]{1,160}$/i.test(e.message)?e.message:'script_error'}));
   page.on('response',r=>{const u=new URL(r.url());if(u.origin===stage)requests.push({engine,path:u.pathname,method:r.request().method(),status:r.status()});});
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===new URL(base).origin)return route.continue();
    if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0')return route.fulfill({status:200,contentType:'application/javascript',body:sdk});
    if(url.origin===stage){
     let allowed=false;
     if(url.pathname.startsWith('/auth/v1/'))allowed=['/auth/v1/token','/auth/v1/user','/auth/v1/logout','/auth/v1/settings'].includes(url.pathname);
     if(url.pathname.startsWith('/rest/v1/')){
      const name=url.pathname.slice('/rest/v1/'.length);
      if(name.startsWith('rpc/'))allowed=READ_RPCS.has(name.slice(4));
      else if(['GET','HEAD'].includes(req.method()))allowed=['profiles','routines','routine_assignments','routine_days','routine_exercises','workouts','routine_user_notes','routine_management','routine_revisions'].includes(name);
      else if(req.method()==='POST'&&['workouts','routine_user_notes'].includes(name)){
       let body;try{body=req.postDataJSON();}catch{body=null;}
       const rows=Array.isArray(body)?body:[body];
       allowed=rows.length>0&&rows.every(row=>row&&row.user_id===fixture.client&&(name==='workouts'?row.data?.routine_id===fixture.routine&&row.data?.routine_day_id===fixture.day:row.routine_id===fixture.routine&&row.exercise_key==='exercise:'+fixture.exercise));
      }
     }
     if(allowed)return route.continue();
    }
    if(url.origin==='https://media.tenor.com')return route.fulfill({status:204,body:''});
    blocked.push({engine,origin:url.origin,path:url.pathname,method:req.method()});return route.abort('blockedbyclient');
   });
   try{
    phase=engine+'_login';
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
    await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);await page.locator('#authBtn').click();
    await page.waitForFunction(id=>typeof user!=='undefined'&&user?.id===id&&typeof profile!=='undefined'&&profile?.role==='client',fixture.client);
    check(engine+'_real_password_login',requests.some(r=>r.engine===engine&&r.path==='/auth/v1/token'&&r.status===200));
    const initial=await page.evaluate(async()=>{const r=await db.rpc('premium_initial_my_state',{});return{failed:!!r.error,enabled:r.data?.enabled};});
    check(engine+'_initial_Premium_stays_closed',!initial.failed&&initial.enabled===false);
    const open=async()=>{
     if(await page.locator('#tShared').isVisible())await page.locator('#tShared').click();
     await page.locator('#shared .routine').filter({hasText:'SYNTHETIC Cloudflare hosting routine'}).getByRole('button',{name:'Abrir',exact:true}).click();
     await page.locator('#trainBody button').filter({hasText:'SYNTHETIC Cloudflare day'}).click();
     await page.locator('#trainBody .workout-exercise').waitFor();
    };
    phase=engine+'_open';await open();check(engine+'_assigned_routine_visible',(await page.locator('#trainBody').innerText()).includes('SYNTHETIC Goblet squat'));
    if(engine==='chromium'){
     phase='chromium_enter_values';
     for(let set=1;set<=2;set++){
      await page.getByLabel('KG · SYNTHETIC Goblet squat · serie '+set,{exact:true}).fill(String(set===1?10:12));
      await page.getByLabel('Repeticiones · SYNTHETIC Goblet squat · serie '+set,{exact:true}).fill(String(set===1?8:9));
      await page.getByLabel('RIR · SYNTHETIC Goblet squat · serie '+set,{exact:true}).fill(String(set===1?3:2));
      await page.getByRole('button',{name:'Completar serie '+set+' de SYNTHETIC Goblet squat',exact:true}).click();
     }
     await page.getByLabel('Notas de SYNTHETIC Goblet squat',{exact:true}).fill('SYNTHETIC Cloudflare note');
     phase='chromium_save';await page.locator('#saveWorkoutBtn').click();await page.waitForFunction(()=>!window.__savingWorkout&&!document.querySelector('#trainModal').classList.contains('show'));
     const persisted=await readback();assert.equal(persisted.workouts.length,1);assert.equal(persisted.notes.length,1);
     const workout=persisted.workouts[0];assert.equal(workout.user_id,fixture.client);assert.equal(workout.data.routine_id,fixture.routine);assert.equal(workout.data.routine_day_id,fixture.day);
     assert.equal(workout.data.exercises[0].exercise_id,fixture.exercise);
     assert.deepEqual(workout.data.exercises[0].sets.map(s=>({kg:s.kg,reps:s.reps,rir:s.rir,done:s.done})),[{kg:'10',reps:'8',rir:'3',done:true},{kg:'12',reps:'9',rir:'2',done:true}]);
     assert.equal(persisted.notes[0].note,'SYNTHETIC Cloudflare note');savedHash=hash(Buffer.from(JSON.stringify(workout.data)));fixture.workout=workout.id;fixture.note=persisted.notes[0].id;
     check('chromium_UI_values_equal_database',true);
     phase='chromium_reload';await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>typeof user!=='undefined'&&user?.id===id,fixture.client);await open();
     check('chromium_session_survives_reload',true);
    }
    check(engine+'_last_session_values_survive_reread',
     await page.getByLabel('KG · SYNTHETIC Goblet squat · serie 1',{exact:true}).inputValue()==='10'&&
     await page.getByLabel('Repeticiones · SYNTHETIC Goblet squat · serie 1',{exact:true}).inputValue()==='8'&&
     await page.getByLabel('RIR · SYNTHETIC Goblet squat · serie 1',{exact:true}).inputValue()==='3');
    const cycle=await page.evaluate(async args=>{const r=await db.rpc('get_client_custom_routine_cycle_progress',args);return{failed:!!r.error,data:r.data};},{p_client_id:fixture.client,p_routine_id:fixture.routine});
    const progress=Array.isArray(cycle.data)?cycle.data[0]:cycle.data;check(engine+'_current_cycle_tracks_saved_day',!cycle.failed&&Number(progress?.total_days)===1&&Number(progress?.completed_days)===1);
    phase=engine+'_history';await page.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await page.locator('.history-session').waitFor();
    const summary=page.locator('.history-session summary');if(await summary.count())await summary.first().click();
    const text=await page.locator('.history-session').innerText();check(engine+'_saved_history_visible',text.includes('SYNTHETIC Goblet squat')&&text.includes('SYNTHETIC Cloudflare note'));
    const reread=await readback();check(engine+'_reread_preserves_saved_snapshot',reread.workouts.length===1&&hash(Buffer.from(JSON.stringify(reread.workouts[0].data)))===savedHash);
    phase=engine+'_logout';await page.evaluate(async()=>{await logout();});await page.waitForFunction(()=>typeof user!=='undefined'&&user===null);
    check(engine+'_real_logout',requests.some(r=>r.engine===engine&&r.path==='/auth/v1/logout'&&[200,204].includes(r.status)));
   }finally{await context.close();await browser.close();}
  }
  check('no_unapproved_remote_requests',blocked.length===0);check('no_script_exceptions',errors.length===0);
  phase='complete';const result=report();save(result);return result;
 }catch{save({...report(),fatal:'stage_browser_failed'});throw Error('stage_browser_failed');}
 finally{if(ownServer)await new Promise(resolve=>server.close(resolve));}
}
module.exports={run};
