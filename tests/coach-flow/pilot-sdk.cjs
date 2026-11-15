// Prepared real-SDK staging journey. Default: offline preflight only, no login or request.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),assert=require('assert/strict');
const P=require('./pilot-plan.cjs'),root=path.resolve(__dirname,'../..'),SDK_HASH='0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function htmlForStaging(source,key){
 assert(source.includes('persistSession:true,')&&source.includes('autoRefreshToken:true')&&source.includes('detectSessionInUrl:true'),'Recheck SDK initialization after source changes');
 return source.replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/sdk.js')
 .replace(/const SUPABASE_URL\s*=.*?;/,"const SUPABASE_URL='https://"+P.PROJECT+".supabase.co';")
 .replace(/const SUPABASE_KEY\s*=.*?;/,'const SUPABASE_KEY='+JSON.stringify(key)+';')
 .replace('persistSession:true,','persistSession:true, storage:window.__qaAuthMemory,')
 .replace('autoRefreshToken:true','autoRefreshToken:false').replace('detectSessionInUrl:true','detectSessionInUrl:false');
}
function allowWrite(plan,actor,url,body,counts){
 if(url.origin!=='https://'+P.PROJECT+'.supabase.co')return false;
 if(url.pathname==='/auth/v1/token')return url.searchParams.get('grant_type')==='password'&&++counts.logins<=1;
 if(url.pathname==='/auth/v1/logout')return url.searchParams.get('scope')==='local';
 if(url.pathname==='/rest/v1/rpc/review_coach_proposal')return actor==='reviewer'&&body?.p_operation===plan.operation&&body.p_approve===true&&body.p_reason==='SYNTHETIC SDK authorization fixture; no model quality approval.'&&++counts.reviews<=1;
 if(url.pathname==='/rest/v1/rpc/accept_basic_plan')return actor==='mock'&&body?.p_operation===plan.operation&&++counts.accepts<=3;
 if(url.pathname==='/rest/v1/workouts')return actor==='mock'&&counts.routine&&body?.user_id===plan.actors.mock&&body.data?.routine_id===counts.routine&&++counts.workouts<=1;
 if(url.pathname==='/rest/v1/routine_user_notes'){
  const rows=Array.isArray(body)?body:[body];if(actor!=='mock'||!counts.routine||rows.some(r=>r?.user_id!==plan.actors.mock||r.routine_id!==counts.routine))return false;
  const keys=new Set(counts.noteKeys||[]);for(const r of rows)keys.add(r.exercise_key);counts.noteWrites=(counts.noteWrites||0)+1;
  if(keys.has(undefined)||keys.size>4||counts.noteWrites>8)return false;counts.noteKeys=[...keys];counts.notes=keys.size;return true;
 }
 return false;
}
async function openFixtureDay(page,dayId,saved=false){
 // click() waits for the click, not for openCoachRoutine's asynchronous reads.
 // Use the rendered day control; never call startWorkoutDay before its routine exists.
 const day=page.locator('#trainBody button[onclick="startWorkoutDay(\''+dayId+'\')"]');
 await day.waitFor();await day.click();if(saved)await page.waitForFunction(id=>activeWorkout?.day?.id===id&&activeWorkout.locked,dayId);else await page.locator('#saveWorkoutBtn').waitFor();
}
async function run(planPath,credentialsPath,approvalPath,resumePath){
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));P.guard(plan);
 if(!process.argv.includes('--run-approved')){console.log('OFFLINE PREFLIGHT: plan valid; real SDK journey NOT EXECUTED. Activation and live writes require separate approval.');return;}
 const approval=JSON.parse(fs.readFileSync(approvalPath,'utf8'));assert(approval.approved===true&&approval.project===P.PROJECT&&approval.run===plan.run&&approval.planSha256===hash(fs.readFileSync(planPath))&&approval.maxProviderCalls===0,'Explicit matching activation approval required');
 for(const [file,expected]of Object.entries(plan.sourceHashes||{}))assert.equal(hash(fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n')),expected,'Reviewed source changed; prepare/approve the current plan again');assert.equal(Object.keys(plan.sourceHashes||{}).length,6);
 assert(Date.now()>=Date.parse(approval.activatedAt)&&Date.parse(approval.expiresAt)>Date.now()+15*60000&&Date.parse(approval.expiresAt)-Date.parse(approval.activatedAt)<=60*60000,'Fresh approved window required');
 const historyOnly=process.argv.includes('--resume-history');
 const resume=process.argv.includes('--resume-training')||historyOnly?JSON.parse(fs.readFileSync(resumePath,'utf8')):null;
 if(resume){P.validateReceipt(plan,resume);assert(resume.liveSDK===true&&!resume.completed&&resume.routine_id&&resume.day_ids.length===3&&resume.exercise_ids.length===12&&resume.revision_ids.length===1&&(historyOnly?resume.workout_ids.length===1&&resume.note_ids.length<=4&&resume.checks.length===18:resume.workout_ids.length===0&&resume.note_ids.length===0&&resume.checks.length===16)&&resume.checks.every(x=>x.pass),'Resume only the recorded bounded fixture at its exact checkpoint');}
 const credentials=JSON.parse(fs.readFileSync(credentialsPath,'utf8'));assert.equal(credentials.ref,P.PROJECT);
 for(const actor of Object.keys(plan.actors)){const u=credentials.users[actor];assert(u?.id===plan.actors[actor]&&/@example\.invalid$/.test(u.email),'Only the existing authorized synthetic cohort');}
 const sdkPath=path.resolve(root,'../google-auth/tests/onboarding/private/supabase-2.115.0.js'),sdk=fs.readFileSync(sdkPath);assert.equal(hash(sdk),SDK_HASH,'Pinned official SDK bytes only');
 require('./recovery.cjs');const {chromium}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const memory=new Map(),contexts=[],pages={},counters={},checks=resume?[...resume.checks]:[],receipt=resume?{...resume,priorCounters:resume.priorCounters||resume.counters,trainingCounters:historyOnly?resume.counters:undefined}:{run:plan.run,project:P.PROJECT,liveSDK:true,completed:false,routine_id:null,workout_ids:[],note_ids:[],day_ids:[],exercise_ids:[],revision_ids:[]};let browser;
 const check=(name,pass)=>{const i=checks.findIndex(x=>x.name===name),entry={name,pass:!!pass};if(i<0)checks.push(entry);else checks[i]=entry;assert(pass,name);};
 const html=htmlForStaging(fs.readFileSync(path.join(root,'index.html'),'utf8'),credentials.key);
 const server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');const u=new URL(req.url,'http://127.0.0.1');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}if(u.pathname==='/sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(sdk);}if(!/^\/assets\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);return res.end();}const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(path.join(root,'assets')+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'application/javascript':/\.svg$/.test(f)?'image/svg+xml':/\.png$/.test(f)?'image/png':'image/webp');res.end(fs.readFileSync(f));});
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4195,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,channel:'msedge'});
  for(const actor of resume?['mock']:Object.keys(plan.actors)){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(context);const state=new Map();memory.set(actor,state);const count=counters[actor]={logins:0,reviews:0,accepts:0,workouts:0,notes:0,blockedEdges:0};
   await context.exposeFunction('qaMemoryGet',k=>state.get(k)||null);await context.exposeFunction('qaMemorySet',(k,v)=>{assert(k.startsWith('sb-'+P.PROJECT+'-'));state.set(k,v);});await context.exposeFunction('qaMemoryRemove',k=>state.delete(k));
   await context.addInitScript(()=>{window.__qaAuthMemory={getItem:k=>qaMemoryGet(k),setItem:(k,v)=>qaMemorySet(k,v),removeItem:k=>qaMemoryRemove(k)};});
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin==='http://127.0.0.1:4195')return route.continue();
    if(url.origin!=='https://'+P.PROJECT+'.supabase.co')return route.abort();
    if(url.pathname.startsWith('/functions/')){count.blockedEdges++;return route.abort();}
    if(req.method()==='OPTIONS'||req.method()==='GET')return route.continue();
    let body;try{body=req.postDataJSON();}catch{return route.abort();}
    if(url.pathname.startsWith('/rest/v1/rpc/')&&plan.snapshot.read_rpcs.includes(url.pathname.split('/').pop()))return route.continue();
    if(historyOnly&&url.pathname.startsWith('/rest/'))return route.abort(); // Read-only continuation: no further business write.
    if(!allowWrite(plan,actor,url,body,count))return route.abort();return route.continue();
   });
   const page=await context.newPage();pages[actor]=page;page.setDefaultTimeout(12000);page.on('dialog',d=>d.dismiss());await page.goto('http://127.0.0.1:4195/');
   const ok=await page.evaluate(async u=>{const r=await db.auth.signInWithPassword({email:u.email,password:u.password});if(r.error)return false;const v=await db.auth.getUser();return !v.error&&v.data.user.id===u.id;},credentials.users[actor]);
   check(actor+' real SDK identity verified by Auth',ok);await page.waitForFunction(id=>user?.id===id&&profile?.id===id,plan.actors[actor]);
  }
  const owner=pages.mock,reviewer=pages.reviewer;
  if(!resume){
  const cap=await owner.evaluate(async()=>{const r=await db.rpc('get_my_coach_access');return r.error?null:r.data;});
  check('registered fixture consumes the only generation; no new generation',cap?.authorized===true&&cap.can_generate===false&&cap.consumed_generations===1&&cap.latest_operation_id===plan.operation&&cap.latest_operation_state==='pending_review');
  const op=await owner.evaluate(async id=>{const r=await db.from('coach_operations').select('*').eq('id',id).single();return r.error?null:r.data;},plan.operation);
  check('fixture has zero model usage and exact owner/intake',op?.user_id===plan.actors.mock&&op.intake_id===plan.intake&&op.model_provider==='mock'&&op.generation_started_at===null&&op.estimated_cost===0&&op.input_tokens===0&&op.output_tokens===0&&op.retry_authorized_at===null);
  for(const actor of ['real','trainer','reviewer']){
   const projection=await pages[actor].evaluate(async id=>{const r=await db.from('coach_operations').select('id').eq('id',id);return{denied:!!r.error||r.data.length===0};},plan.operation);check(actor+' cannot read private owner operation',projection.denied);
  }
  for(const actor of ['real','trainer'])check(actor+' cannot use reviewer projection',await pages[actor].evaluate(async()=>!!(await db.rpc('get_coach_review_queue')).error));
  const premature=await owner.evaluate(async id=>!!(await db.rpc('accept_basic_plan',{p_operation:id})).error,plan.operation);check('pending proposal cannot be accepted',premature);
  // Real SDK read reconciliation, deliberately seeded uncertainty; no simulated HTTP/SDK reply and no invocation.
  await owner.evaluate(({intake,id})=>{coachShell('<p>Recovering registered synthetic fixture</p>');return coachRecoverGeneration(intake,simpleCoach.epoch,id);},{intake:plan.intake,id:plan.actors.mock});await owner.locator('#coachRefresh').waitFor();
  await owner.reload();await owner.waitForFunction(id=>user?.id===id&&profile?.id===id,plan.actors.mock);await owner.evaluate(()=>openSimpleCoach());await owner.locator('#coachBegin').click();await owner.locator('#coachRefresh').waitFor();check('full reload recovers the real registered pending operation',await owner.evaluate(id=>simpleCoach.operation.id===id,plan.operation));
  const queue=await reviewer.evaluate(async()=>{const r=await db.rpc('get_coach_review_queue');return r.error?null:r.data;});check('reviewer sees only the consented synthetic projection',queue?.length===1&&queue[0].operation.id===plan.operation&&!queue[0].health);
  await reviewer.evaluate(()=>openCoachReviewer());
  await reviewer.locator('#coachQueue > section textarea').fill('SYNTHETIC SDK authorization fixture; no model quality approval.');
  await reviewer.getByRole('button',{name:'Aprobar propuesta',exact:true}).click();await reviewer.getByRole('heading',{name:'Aprobada',exact:true}).waitFor();
  await owner.locator('#coachRefresh').click();await owner.locator('#coachAccept').waitFor();await owner.locator('#coachAccept').click();await owner.getByRole('heading',{name:'Rutina creada',exact:true}).waitFor();
  const accepted=await owner.evaluate(async id=>{const r=await db.from('coach_operations').select('routine_id,state').eq('id',id).single();return r.data;},plan.operation);assert(accepted?.routine_id);receipt.routine_id=accepted.routine_id;counters.mock.routine=receipt.routine_id;
  const same=await owner.evaluate(async id=>{const r=await db.rpc('accept_basic_plan',{p_operation:id});return r.error?null:r.data;},plan.operation);check('repeat acceptance is idempotent',same===receipt.routine_id);
  }else{
   counters.mock.routine=receipt.routine_id;counters.mock.accepts=3; // Reject any further acceptance call in this continuation.
   const before=await owner.evaluate(async p=>{const o=await db.from('coach_operations').select('id,user_id,intake_id,state,routine_id').eq('id',p.operation).single();const w=await db.from('workouts').select('id').eq('user_id',p.owner).contains('data',{routine_id:p.routine});const n=await db.from('routine_user_notes').select('id').eq('routine_id',p.routine);return{operation:o.data,workouts:w.data,notes:n.data,error:!!(o.error||w.error||n.error)};},{operation:plan.operation,owner:plan.actors.mock,routine:receipt.routine_id});
   assert(!before.error&&before.operation?.state==='accepted'&&before.operation.user_id===plan.actors.mock&&before.operation.intake_id===plan.intake&&before.operation.routine_id===receipt.routine_id,'Exact accepted fixture required');
   assert.deepEqual(before.workouts.map(x=>x.id).sort(),[...receipt.workout_ids].sort());assert.deepEqual(before.notes.map(x=>x.id).sort(),[...receipt.note_ids].sort());
  }
  const children=await owner.evaluate(async({rid,op})=>{const d=await db.from('routine_days').select('id,day_order').eq('routine_id',rid).order('day_order');const e=await db.from('routine_exercises').select('*').in('day_id',d.data.map(x=>x.id));const r=await db.from('routine_revisions').select('id').eq('operation_id',op);return{days:d.data,exercises:e.data,revisions:r.data};},{rid:receipt.routine_id,op:plan.operation});
  if(resume){for(const [key,rows]of [['day_ids',children.days],['exercise_ids',children.exercises],['revision_ids',children.revisions]])assert.deepEqual(rows.map(x=>x.id).sort(),[...receipt[key]].sort(),'Receipt IDs must remain exact');}
  receipt.day_ids=children.days.map(x=>x.id);receipt.exercise_ids=children.exercises.map(x=>x.id);receipt.revision_ids=children.revisions.map(x=>x.id);check('one routine/revision with all fixture days/exercises',receipt.day_ids.length===3&&receipt.exercise_ids.length===12&&receipt.revision_ids.length===1);
  if(!historyOnly){
  if(resume)await owner.evaluate(id=>openCoachRoutine(id),receipt.routine_id);else await owner.locator('#coachOpen').click();
  await openFixtureDay(owner,receipt.day_ids[0]);check('structured targets loaded from the accepted revision',await owner.locator('.coach-set-target').count()===8);await owner.getByRole('textbox',{name:/^KG/}).first().fill('20');await owner.getByRole('textbox',{name:/^Repeticiones/}).first().fill('9');await owner.locator('#trainBody textarea').first().fill('SYNTHETIC '+plan.run);await owner.locator('#saveWorkoutBtn').click();await owner.waitForFunction(()=>!window.__savingWorkout);
  }
  const history=await owner.evaluate(async rid=>{const w=await db.from('workouts').select('id,data').eq('user_id',user.id).contains('data',{routine_id:rid});const n=await db.from('routine_user_notes').select('id,note').eq('user_id',user.id).eq('routine_id',rid);return{workouts:w.data,notes:n.data};},receipt.routine_id);
  receipt.workout_ids=history.workouts.map(x=>x.id);receipt.note_ids=history.notes.map(x=>x.id);check('one saved workout and fixture note persisted',receipt.workout_ids.length===1&&receipt.note_ids.length<=4&&history.notes.some(n=>n.note==='SYNTHETIC '+plan.run));
  // Saving intentionally closes the modal and returns home. Reopen the saved day before history.
  await owner.evaluate(id=>openCoachRoutine(id),receipt.routine_id);await openFixtureDay(owner,receipt.day_ids[0],true);
  await owner.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await owner.locator('.history-session').waitFor();check('normal history UI shows the single fixture workout',await owner.locator('.history-session').count()===1&&String(history.workouts[0].data.exercises[0].sets[0].kg)==='20'&&String(history.workouts[0].data.exercises[0].sets[0].reps)==='9');
  const preserved=await owner.evaluate(async({rid,ids})=>{const e=await db.from('routine_exercises').select('*').in('day_id',ids);const r=await db.from('routine_revisions').select('id').eq('routine_id',rid);return{exercises:e.data,revisions:r.data};},{rid:receipt.routine_id,ids:receipt.day_ids});
  const canonical=a=>JSON.stringify([...a].sort((a,b)=>a.id.localeCompare(b.id)));check('training did not rewrite prescribed structure or revision',canonical(preserved.exercises)===canonical(children.exercises)&&canonical(preserved.revisions)===canonical(children.revisions));
  check('all Edge/provider calls blocked and no unexpected mutation count',Object.values(counters).every(x=>x.blockedEdges===0)&&(historyOnly?counters.mock.workouts===0&&receipt.trainingCounters.mock.workouts===1:counters.mock.workouts===1)&&(counters.reviewer||receipt.priorCounters?.reviewer).reviews===1);
  receipt.completed=true;delete receipt.failure;
 }catch(e){
  // No raw error/request bodies: only allowlisted stage and error class are recorded.
  receipt.failure={kind:e?.name==='TimeoutError'?'TimeoutError':e?.name==='AssertionError'?'AssertionError':'RuntimeError',lastPassed:checks.filter(x=>x.pass).at(-1)?.name||null};throw e;
 }finally{
  // A partial receipt must survive a test failure so cleanup never guesses IDs.
  receipt.checks=checks;receipt.counters=counters;fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/basic-sdk-pilot.json'),JSON.stringify(receipt,null,2));
  for(const context of contexts){try{await context.pages()[0]?.evaluate(()=>db.auth.signOut({scope:'local'}));}catch{}await context.close();}if(browser)await browser.close();for(const m of memory.values())m.clear();memory.clear();for(const u of Object.values(credentials.users))delete u.password;await new Promise(resolve=>server.close(resolve));
 }
 console.log('Real SDK journey completed. Render receipt-bounded validation/cleanup and restore scope; no automatic SQL cleanup.');
}
module.exports={htmlForStaging,allowWrite,SDK_HASH,openFixtureDay};
if(require.main===module){const args=process.argv.slice(2).filter(a=>!['--run-approved','--resume-training','--resume-history'].includes(a));run(...args).catch(()=>{console.error('SDK pilot stopped safely. Inspect sanitized receipt; no automatic retry or cleanup.');process.exitCode=1;});}
