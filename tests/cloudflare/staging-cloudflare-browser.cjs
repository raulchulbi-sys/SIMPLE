'use strict';
// Native Pages/CDN/Auth requests only. The coordinator supplies synthetic credentials in RAM.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {verifiedOrigins,PROJECT,PAGES_PROJECT}=require('./cloudflare-cors.cjs');
const STAGE='https://'+PROJECT+'.supabase.co',SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0';
const SDK_SHA='0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_RPCS=new Set(['get_my_coach_access','get_coach_reviewer_access','premium_my_access','premium_initial_my_state','premium_initial_review_queue','get_client_routine_structure','get_client_routine_statistics_stage','get_client_routine_cycle_progress','get_client_custom_routine_cycle_progress','get_client_routine_history','get_client_routine_notes']);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const PRIOR_CHECKS=Object.freeze(['chromium_client_verified_staging_runtime','chromium_client_native_pinned_SDK','chromium_client_native_password_login','chromium_initial_Premium_stays_closed','fresh_client_native_history_empty','chromium_assigned_routine_visible','native_SDK_saved_values_equal_coordinator_reread','chromium_session_survives_reload','chromium_last_session_values_survive_reread','chromium_current_cycle_tracks_saved_day','chromium_saved_history_and_note_visible','chromium_native_reread_preserves_saved_snapshot','chromium_client_native_logout','webkit_client_verified_staging_runtime','webkit_client_native_pinned_SDK','webkit_client_native_password_login','webkit_initial_Premium_stays_closed','webkit_assigned_routine_visible','webkit_last_session_values_survive_reread','webkit_current_cycle_tracks_saved_day','webkit_saved_history_and_note_visible','webkit_native_reread_preserves_saved_snapshot','webkit_client_native_logout','chromium_trainer_verified_staging_runtime','chromium_trainer_native_pinned_SDK','chromium_trainer_native_password_login','trainer_sees_only_own_synthetic_client','trainer_own_client_cycle_and_last_session','trainer_own_client_assigned_routine_visible']);

function validateHosting(hosting){
 assert(hosting&&typeof hosting==='object','verified_hosting_required');
 assert.equal(hosting.projectId,PROJECT,'staging_project_required');
 if(Object.hasOwn(hosting,'resumeTrainer'))assert.equal(typeof hosting.resumeTrainer,'boolean','explicit_resume_flag_required');
 const verified=verifiedOrigins(hosting);
 return {...verified,projectId:PROJECT,pagesProject:PAGES_PROJECT,stableUrl:hosting.stableUrl,deploymentUrl:hosting.deploymentUrl,...(hosting.resumeTrainer?{resumeTrainer:true}:{})};
}
function validateInput({fixture,accounts,readback,hosting}){
 const verified=validateHosting(hosting);
 assert(fixture&&accounts&&typeof readback==='function','RAM_fixture_required');
 for(const field of ['trainer','client','routine','day','exercise','assignment'])assert.match(fixture[field],UUID,'task_fixture_UUID_required');
 assert.notEqual(fixture.trainer,fixture.client,'distinct_synthetic_owners_required');
 if(verified.resumeTrainer){assert.match(fixture.workout,UUID,'existing_task_workout_required');assert.match(fixture.note,UUID,'existing_task_note_required');}
 else assert(!fixture.workout&&!fixture.note,'fresh_fixture_required');
 for(const slot of ['trainer','client']){
  const account=accounts[slot];assert.equal(account?.id,fixture[slot],'synthetic_identity_mismatch');
  assert.equal(account?.slot,slot,'synthetic_slot_required');
  assert.equal(account?.email,'simple-qa-cloudflare_hosting_20261014-'+slot+'@example.com','reserved_task_email_required');
  assert(typeof account.password==='string'&&account.password.length>0,'RAM_credentials_required');
 }
 return verified;
}
function networkEntry(url,method,status){const u=new URL(url);return {origin:u.origin,path:u.pathname,method,...(status===undefined?{}:{status})};}
function failureCode(raw){return /^(?:net::ERR_[A-Z_]+|Load failed|cancelled|canceled)$/.test(raw||'')?raw:'unclassified_native_failure';}
function expectedQueueRejection(entry){return entry.origin===STAGE&&entry.path==='/rest/v1/rpc/premium_initial_review_queue'&&entry.method==='POST'&&entry.status===403&&entry.error_code==='42501'&&entry.domain_error==='premium_initial_reviewer_required';}
function confirmedCancellation(entry,responses){
 if(!['net::ERR_ABORTED','cancelled','canceled'].includes(entry.code)||entry.origin!==STAGE)return false;
 const read=entry.method==='HEAD'&&['/rest/v1/routine_assignments','/rest/v1/routines'].includes(entry.path),logout=entry.method==='POST'&&entry.path==='/auth/v1/logout';
 return (read||logout)&&responses.some(r=>r.engine===entry.engine&&r.actor===entry.actor&&r.origin===entry.origin&&r.path===entry.path&&r.method===entry.method&&[200,204].includes(r.status));
}
function savedSnapshot(persisted,fixture){
 assert.equal(persisted.workouts.length,1,'one_task_workout_required');assert.equal(persisted.notes.length,1,'one_task_note_required');
 const workout=persisted.workouts[0],note=persisted.notes[0];
 assert.equal(workout.user_id,fixture.client);assert.equal(workout.data.routine_id,fixture.routine);assert.equal(workout.data.routine_day_id,fixture.day);
 assert.equal(workout.data.exercises.length,1);assert.equal(workout.data.exercises[0].exercise_id,fixture.exercise);
 assert.deepEqual(workout.data.exercises[0].sets.map(s=>({kg:s.kg,reps:s.reps,rir:s.rir,done:s.done})),[{kg:'10',reps:'8',rir:'3',done:true},{kg:'12',reps:'9',rir:'2',done:true}]);
 assert.equal(note.user_id,fixture.client);assert.equal(note.routine_id,fixture.routine);assert.equal(note.exercise_key,'exercise:'+fixture.exercise);assert.equal(note.note,'SYNTHETIC Cloudflare note');
 return {hash:hash(Buffer.from(JSON.stringify(workout.data))),workout:workout.id,note:note.id};
}
function validateResume({prior,fixture,persisted,hosting}){
 assert.equal(prior.project,PROJECT,'prior_stage_evidence_required');assert.equal(prior.phase,'chromium_trainer_own_client_progress:failed','exact_trainer_resume_phase_required');
 assert.equal(prior.request_interception,false);assert.equal(prior.local_server,false);assert.equal(prior.passed,29);
 assert(Array.isArray(prior.checks)&&prior.checks.length===29&&prior.checks.every(c=>c.pass===true),'prior_successes_required');
 assert.deepEqual(prior.checks.map(c=>c.name).sort(),[...PRIOR_CHECKS].sort(),'prior_unique_cases_required');
 assert.equal(prior.hosting.stableUrl,hosting.stableUrl);assert.equal(prior.hosting.deploymentUrl,hosting.deploymentUrl);assert.equal(prior.hosting.projectId,PROJECT);
 assert.equal(prior.workout_id,fixture.workout);assert.equal(prior.note_id,fixture.note);assert.match(prior.workout_data_sha256,/^[a-f0-9]{64}$/);
 assert.equal(prior.prohibited_requests.length,0);assert.equal(prior.script_errors.length,0);
 const saved=savedSnapshot(persisted,fixture);assert.equal(saved.workout,fixture.workout);assert.equal(saved.note,fixture.note);assert.equal(saved.hash,prior.workout_data_sha256,'existing_snapshot_changed');return saved;
}
function sanitizedText(value){return String(value??'').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted-token]').replace(/(?:sb_secret_|sb_publishable_|sk-proj-)[A-Za-z0-9_-]+/g,'[redacted-key]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-email]').slice(0,12000);}
async function waitForTrainerProgress(page){
 await page.waitForFunction(()=>document.querySelector('#clientProgressSubtitle')?.textContent==='1 sesión registrada');
 // The caption precedes the awaited day read. Wait for the body and chart themselves.
 await page.locator('#clientProgressBody .history-session').waitFor({state:'visible'});
 for(const selector of ['#clientProgressPeriod','#clientProgressExercise','#clientProgressMetric','#statisticsStageControls button','#clientProgressChart svg'])await page.locator(selector).waitFor({state:'visible'});
}

async function run(input){
 const hosting=validateInput(input),{fixture,accounts,readback}=input;
 let prior=null,priorSha256=null,resumedSnapshot=null;
 if(hosting.resumeTrainer){const priorFile=path.join(__dirname,'results/staging-cloudflare-browser.json');assert(!fs.lstatSync(priorFile).isSymbolicLink(),'prior_evidence_symlink_denied');const bytes=fs.readFileSync(priorFile);prior=JSON.parse(bytes);priorSha256=hash(bytes);resumedSnapshot=validateResume({prior,fixture,hosting,persisted:await readback()});}
 process.env.PLAYWRIGHT_BROWSERS_PATH||='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
 let playwright;try{playwright=require('playwright');}catch{playwright=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
 const checks=prior?prior.checks.map(c=>({...c})):[],requests=[],requestFailures=[],scriptErrors=[],prohibitedRequests=[],assetHashes=[],diagnostics=[],consoleErrors=[];
 const pending=new Set();let phase='starting',savedHash=resumedSnapshot?.hash||null,savedWorkoutId=resumedSnapshot?.workout||null,savedNoteId=resumedSnapshot?.note||null,failedCheck=null,failureKind=null;
 const check=(name,condition)=>{if(condition!==true)failedCheck='native_check_'+name;assert.equal(condition,true,'native_check_'+name);if(!checks.some(c=>c.name===name))checks.push({name,pass:true});};
 const report=()=>({kind:'Native Cloudflare Pages, native pinned CDN SDK, real staging Auth and PostgREST',project:PROJECT,hosting,phase,checks,passed:checks.length,
  requests,request_failures:requestFailures,script_errors:scriptErrors,console_errors:consoleErrors,prohibited_requests:prohibitedRequests,asset_sha256:assetHashes,diagnostics,failed_check:failedCheck,failure_kind:failureKind,
  ...(prior?{resume:{trainer_only:true,prior_report:'staging-cloudflare-browser.json',prior_sha256:priorSha256,preserved_unique_checks:29,prior_uncaptured_HTTP_errors:prior.requests.filter(r=>r.status>=400),prior_uncaptured_request_failures:prior.request_failures}}:{}),
  workout_data_sha256:savedHash,workout_id:savedWorkoutId,note_id:savedNoteId,observed_generation_dispatch_requests:prohibitedRequests.filter(r=>r.origin===STAGE&&r.path.startsWith('/functions/v1/')).length,
  request_interception:false,local_server:false,credentials_persisted:false,tokens_persisted:false});
 const save=()=>{const directory=path.join(__dirname,'results');fs.mkdirSync(directory,{recursive:true});assert(!fs.lstatSync(directory).isSymbolicLink(),'results_symlink_denied');fs.writeFileSync(path.join(directory,prior?'staging-cloudflare-trainer-resume.json':'staging-cloudflare-browser.json'),JSON.stringify(report(),null,2)+'\n');};
 const drain=async()=>{await Promise.all([...pending]);};
 function observe(page,engine,actor){
  page.on('pageerror',()=>scriptErrors.push({engine,actor,code:'page_script_exception'}));
  page.on('requestfailed',request=>requestFailures.push({engine,actor,...networkEntry(request.url(),request.method()),code:failureCode(request.failure()?.errorText)}));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push({engine,actor,text:sanitizedText(message.text())});});
  page.on('request',request=>{
   const entry=networkEntry(request.url(),request.method()),u=new URL(request.url());
   let prohibited=u.hostname==='yvguatdqncadkwewlepe.supabase.co'||u.hostname==='api.openai.com';
   if(u.origin===STAGE){
    if(u.pathname.startsWith('/functions/v1/'))prohibited=true;
    if(u.pathname.startsWith('/rest/v1/')&&!['GET','HEAD','OPTIONS'].includes(request.method())){
     const resource=u.pathname.slice('/rest/v1/'.length);
     const readRpc=resource.startsWith('rpc/')&&request.method()==='POST'&&READ_RPCS.has(resource.slice(4));
     const clientSave=!hosting.resumeTrainer&&actor==='client'&&engine==='chromium'&&request.method()==='POST'&&['workouts','routine_user_notes'].includes(resource);
     if(!readRpc&&!clientSave)prohibited=true;
    }
   }
   if(prohibited)prohibitedRequests.push({engine,actor,...entry});
  });
  page.on('response',response=>{
   const entry={engine,actor,...networkEntry(response.url(),response.request().method(),response.status())};requests.push(entry);
   if(entry.origin===STAGE&&entry.status>=400&&entry.path==='/rest/v1/rpc/premium_initial_review_queue'){
    const work=response.json().then(value=>{entry.error_code=/^[a-zA-Z0-9_]{1,60}$/.test(value?.code||'')?value.code:'unclassified';entry.domain_error=value?.message==='premium_initial_reviewer_required'?value.message:'unclassified';}).catch(()=>{entry.error_code='body_unavailable';});pending.add(work);work.finally(()=>pending.delete(work));
   }
   if(actor==='trainer'&&entry.origin===STAGE&&entry.status===200&&['/rest/v1/rpc/get_client_routine_history','/rest/v1/rpc/get_client_routine_statistics_stage','/rest/v1/rpc/get_client_routine_notes'].includes(entry.path)){
    const work=response.json().then(value=>{
     const shape={engine,actor,...networkEntry(response.url(),response.request().method(),response.status()),kind:'trainer_RPC_shape',isArray:Array.isArray(value),explicit_projection:new URL(response.url()).searchParams.has('select')};
     if(Array.isArray(value)){shape.rows=value.length;if(entry.path.endsWith('/get_client_routine_history'))shape.history=value.map(row=>({has_user_id:Object.hasOwn(row,'user_id'),has_data:Object.hasOwn(row,'data'),own_client:row.user_id===fixture.client,own_routine:row.data?.routine_id===fixture.routine,saved_workout:row.id===fixture.workout}));}
     else if(entry.path.endsWith('/get_client_routine_statistics_stage')){shape.id_null=value?.id===null;shape.started_at_null=value?.started_at===null;shape.training_reset_present=!!value?.training_reset_id;}
     diagnostics.push(shape);
    }).catch(()=>diagnostics.push({engine,actor,kind:'trainer_RPC_shape',code:'public_shape_unavailable'}));pending.add(work);work.finally(()=>pending.delete(work));
   }
   const u=new URL(response.url()),isPublicAsset=hosting.origins.includes(u.origin)&&['/','/assets/runtime-config.js'].includes(u.pathname);
   if(response.status()===200&&(response.url()===SDK||isPublicAsset)){
    const work=response.body().then(bytes=>assetHashes.push({...entry,sha256:hash(bytes),bytes:bytes.length})).catch(()=>assetHashes.push({...entry,error:'public_asset_body_unavailable'}));
    pending.add(work);work.finally(()=>pending.delete(work));
   }
  });
 }
 async function captureProgress(page,label){
  try{const value=await page.evaluate(()=>{
   const modal=document.querySelector('#clientProgressModal');return {visible:!!modal?.classList.contains('show'),caption:document.querySelector('#clientProgressSubtitle')?.textContent||'',title:document.querySelector('#clientProgressTitle')?.textContent||'',body:document.querySelector('#clientProgressBody')?.innerText||'',historyCount:document.querySelectorAll('#clientProgressBody .history-session').length,role:typeof profile==='undefined'?null:profile?.role,currentProbe:window.__nativeProgressProbe||[]};
  });diagnostics.push({kind:'trainer_progress_DOM',label,...value,caption:sanitizedText(value.caption),title:sanitizedText(value.title),body:sanitizedText(value.body)});}catch{diagnostics.push({kind:'trainer_progress_DOM',label,code:'DOM_unavailable'});}
 }
 async function withPage(engine,actor,url,work){
  const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(30000);observe(page,engine,actor);
   try{
    phase=engine+'_'+actor+'_hosting';await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.SimpleAppRuntime&&typeof db!=='undefined'&&!!db);
    const runtime=await page.evaluate(()=>{const c=window.SimpleAppRuntime;return {target:c.target,environment:c.environment,appUrl:c.appUrl,appOrigin:c.appOrigin,basePath:c.basePath,supabaseUrl:c.supabaseUrl,allowedOrigins:c.allowedOrigins,frozen:Object.isFrozen(c)&&Object.isFrozen(c.allowedOrigins)};});
    check(engine+'_'+actor+'_verified_staging_runtime',runtime.target==='preview'&&runtime.environment==='staging'&&runtime.appUrl===hosting.stableUrl&&runtime.appOrigin===hosting.origins[0]&&runtime.basePath==='/'&&runtime.supabaseUrl===STAGE&&runtime.frozen&&JSON.stringify([...runtime.allowedOrigins].sort())===JSON.stringify([...hosting.origins].sort()));
    await drain();check(engine+'_'+actor+'_native_pinned_SDK',assetHashes.some(asset=>asset.engine===engine&&asset.actor===actor&&asset.origin==='https://cdn.jsdelivr.net'&&asset.sha256===SDK_SHA));
    phase=engine+'_'+actor+'_login';const account=accounts[actor];
    await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
    await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);await page.locator('#authBtn').click();
    await page.waitForFunction(({id,role})=>typeof user!=='undefined'&&user?.id===id&&typeof profile!=='undefined'&&profile?.role===role,{id:account.id,role:actor});
    check(engine+'_'+actor+'_native_password_login',requests.some(r=>r.engine===engine&&r.actor===actor&&r.origin===STAGE&&r.path==='/auth/v1/token'&&r.method==='POST'&&r.status===200));
    try{await work(page);}catch(error){if(actor==='trainer')await captureProgress(page,'failure_before_context_close');throw error;}
    phase=engine+'_'+actor+'_logout';await page.evaluate(async()=>{await logout();});await page.waitForFunction(()=>typeof user!=='undefined'&&user===null);
    check(engine+'_'+actor+'_native_logout',requests.some(r=>r.engine===engine&&r.actor===actor&&r.origin===STAGE&&r.path==='/auth/v1/logout'&&r.method==='POST'&&[200,204].includes(r.status)));
    await drain();
   }finally{await context.close();}
  }finally{await browser.close();}
 }
 async function sdkReadback(page){
  return page.evaluate(async fixture=>{
   const workouts=await db.from('workouts').select('*').eq('user_id',fixture.client).eq('data->>routine_id',fixture.routine);
   const notes=await db.from('routine_user_notes').select('*').eq('user_id',fixture.client).eq('routine_id',fixture.routine);
   if(workouts.error||notes.error)throw Error('scoped_native_readback_failed');
   return {workouts:workouts.data,notes:notes.data};
  },{client:fixture.client,routine:fixture.routine});
 }
 const verifySaved=persisted=>savedSnapshot(persisted,fixture);
 async function openClient(page){
  if(await page.locator('#tShared').isVisible())await page.locator('#tShared').click();
  await page.locator('#shared .routine').filter({hasText:'SYNTHETIC Cloudflare hosting routine'}).getByRole('button',{name:'Abrir',exact:true}).click();
  await page.locator('#trainBody button').filter({hasText:'SYNTHETIC Cloudflare day'}).click();await page.locator('#trainBody .workout-exercise').waitFor();
 }
 try{
  if(!hosting.resumeTrainer)for(const engine of ['chromium','webkit'])await withPage(engine,'client',engine==='chromium'?hosting.stableUrl:hosting.deploymentUrl,async page=>{
   const initial=await page.evaluate(async()=>{const r=await db.rpc('premium_initial_my_state',{});return {failed:!!r.error,enabled:r.data?.enabled};});
   check(engine+'_initial_Premium_stays_closed',!initial.failed&&initial.enabled===false);
   if(engine==='chromium'){const before=await sdkReadback(page);check('fresh_client_native_history_empty',before.workouts.length===0&&before.notes.length===0);}
   phase=engine+'_client_open';await openClient(page);check(engine+'_assigned_routine_visible',(await page.locator('#trainBody').innerText()).includes('SYNTHETIC Goblet squat'));
   if(engine==='chromium'){
    phase='chromium_client_enter_values';
    for(let set=1;set<=2;set++){
     await page.getByLabel('KG · SYNTHETIC Goblet squat · serie '+set,{exact:true}).fill(String(set===1?10:12));
     await page.getByLabel('Repeticiones · SYNTHETIC Goblet squat · serie '+set,{exact:true}).fill(String(set===1?8:9));
     await page.getByLabel('RIR · SYNTHETIC Goblet squat · serie '+set,{exact:true}).fill(String(set===1?3:2));
     await page.getByRole('button',{name:'Completar serie '+set+' de SYNTHETIC Goblet squat',exact:true}).click();
    }
    await page.getByLabel('Notas de SYNTHETIC Goblet squat',{exact:true}).fill('SYNTHETIC Cloudflare note');
    phase='chromium_client_save';await page.locator('#saveWorkoutBtn').click();await page.waitForFunction(()=>!window.__savingWorkout&&!document.querySelector('#trainModal').classList.contains('show'));
    const native=verifySaved(await sdkReadback(page)),coordinator=verifySaved(await readback());
    check('native_SDK_saved_values_equal_coordinator_reread',native.hash===coordinator.hash&&native.workout===coordinator.workout&&native.note===coordinator.note);
    savedHash=native.hash;savedWorkoutId=native.workout;savedNoteId=native.note;fixture.workout=native.workout;fixture.note=native.note;
    phase='chromium_client_reload';await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>typeof user!=='undefined'&&user?.id===id,fixture.client);await openClient(page);check('chromium_session_survives_reload',true);
   }
   check(engine+'_last_session_values_survive_reread',
    await page.getByLabel('KG · SYNTHETIC Goblet squat · serie 1',{exact:true}).inputValue()==='10'&&await page.getByLabel('Repeticiones · SYNTHETIC Goblet squat · serie 1',{exact:true}).inputValue()==='8'&&await page.getByLabel('RIR · SYNTHETIC Goblet squat · serie 1',{exact:true}).inputValue()==='3');
   const cycle=await page.evaluate(async args=>{const r=await db.rpc('get_client_custom_routine_cycle_progress',args);return {failed:!!r.error,data:r.data};},{p_client_id:fixture.client,p_routine_id:fixture.routine});
   const progress=Array.isArray(cycle.data)?cycle.data[0]:cycle.data;check(engine+'_current_cycle_tracks_saved_day',!cycle.failed&&Number(progress?.total_days)===1&&Number(progress?.completed_days)===1);
   phase=engine+'_client_history';await page.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await page.locator('.history-session').waitFor();
   const summary=page.locator('.history-session summary');if(await summary.count())await summary.first().click();
   const text=await page.locator('.history-session').innerText();check(engine+'_saved_history_and_note_visible',text.includes('SYNTHETIC Goblet squat')&&text.includes('SYNTHETIC Cloudflare note'));
   const reread=verifySaved(await sdkReadback(page));check(engine+'_native_reread_preserves_saved_snapshot',reread.hash===savedHash&&reread.workout===savedWorkoutId&&reread.note===savedNoteId);
  });
  await withPage('chromium','trainer',hosting.stableUrl,async page=>{
   phase='chromium_trainer_own_client';await page.locator('#tClients').click();
   const card=page.locator('.client-overview-card');await card.waitFor();
   check('trainer_sees_only_own_synthetic_client',await card.count()===1&&await card.getAttribute('data-client-id')===fixture.client&&(await card.innerText()).includes('SYNTHETIC Cloudflare hosting client'));
   check('trainer_own_client_cycle_and_last_session',(await card.innerText()).includes('1/1 del ciclo actual')&&(await card.innerText()).includes('Última sesión: hoy'));
   await card.click();await page.locator('#clientModalBody').getByRole('button',{name:'Ver progreso',exact:true}).waitFor();
   check('trainer_own_client_assigned_routine_visible',(await page.locator('#clientModalBody').innerText()).includes('SYNTHETIC Cloudflare hosting routine'));
   // Observe the existing modal guard without changing its returned result.
   await page.evaluate(()=>{
    const original=beginModalRequest;window.__nativeProgressProbe=[];
    beginModalRequest=function(id){const guard=original(id);if(id!=='clientProgressModal')return guard;
     const owner=user,ownerId=user?.id,version=window.__workoutContextVersion,modal=document.getElementById(id),token=modal.dataset.requestToken;
     return ()=>{const result=guard();if(window.__nativeProgressProbe.length<40)window.__nativeProgressProbe.push({returned:result,same_owner:user===owner,same_owner_id:user?.id===ownerId,same_version:window.__workoutContextVersion===version,visible:modal.classList.contains('show'),same_token:modal.dataset.requestToken===token});return result;};
    };
   });
   phase='chromium_trainer_own_client_progress';await page.locator('#clientModalBody').getByRole('button',{name:'Ver progreso',exact:true}).click();
   await captureProgress(page,'after_native_progress_click');
   await waitForTrainerProgress(page);
   await captureProgress(page,'native_progress_settled');
   const text=await page.locator('#clientProgressBody').innerText();check('trainer_own_client_saved_history_and_note_visible',text.includes('SYNTHETIC Goblet squat')&&text.includes('SYNTHETIC Cloudflare note'));
   check('trainer_progress_context_matches_own_routine',await page.locator('#clientProgressTitle').getAttribute('data-routine-id')===fixture.routine);
  });
  await drain();check('no_generation_or_unapproved_backend_writes_observed',prohibitedRequests.length===0);check('no_script_exceptions',scriptErrors.length===0);
  check('native_Auth_and_PostgREST_requests_completed',requestFailures.filter(r=>r.origin===STAGE&&!confirmedCancellation(r,requests)).length===0&&!requests.some(r=>r.origin===STAGE&&r.status>=400&&!expectedQueueRejection(r)));
  const publicAssets=[...(prior?.asset_sha256||[]),...assetHashes];check('stable_and_exact_deployment_frontend_bytes_match',['/','/assets/runtime-config.js'].every(publicPath=>{
   const stable=publicAssets.find(a=>a.origin===hosting.origins[0]&&a.path===publicPath&&a.sha256),deployment=publicAssets.find(a=>a.origin===hosting.origins[1]&&a.path===publicPath&&a.sha256);return !!stable&&!!deployment&&stable.sha256===deployment.sha256;
  }));
  if(hosting.resumeTrainer){const saved=verifySaved(await readback());check('trainer_resume_preserves_existing_snapshot',saved.hash===savedHash&&saved.workout===savedWorkoutId&&saved.note===savedNoteId);}
  phase='complete';save();return report();
 }catch(error){failedCheck=failedCheck||error.message?.match(/^native_check_[a-zA-Z_]+/)?.[0]||null;failureKind=/^[a-zA-Z_]{1,60}$/.test(error.name||'')?error.name:'controlled_error';phase+=':failed';save();throw Error('stage_cloudflare_browser_failed');}
}
module.exports={run,validateHosting,validateInput,validateResume,networkEntry,failureCode,expectedQueueRejection,confirmedCancellation,savedSnapshot,waitForTrainerProgress,PRIOR_CHECKS};
