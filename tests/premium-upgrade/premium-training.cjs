// Current index.html + offline SDK only. No Supabase, Auth or provider requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4252',out=path.join(__dirname,'results');
async function seedFixture(){
 const uid=user.id,rid=crypto.randomUUID(),operation=crypto.randomUUID(),oldRevision=crypto.randomUUID(),revision=crypto.randomUUID(),meso=crypto.randomUUID();
 const catalogue=SimpleCoachProgrammingV5.catalogue.slice(0,12),bindings={};
 const days=Array.from({length:3},(_,j)=>{const did=crypto.randomUUID();return {id:did,routine_id:rid,name:'Sesión local '+(j+1),day_order:j,exercises:Array.from({length:4},(_,k)=>{
  const c=catalogue[j*4+k],id=crypto.randomUUID();bindings[id]=c.id;
  const sets=[{set_number:1,reps_min:5,reps_max:7,rir:2,rest_seconds:180},{set_number:2,reps_min:8,reps_max:10,rir:0,rest_seconds:240}];
  return {id,day_id:did,name:c.name,exercise_order:k,sets:2,target:'5-7',rir:'2',rest_seconds:180,planned_sets:sets,scheme:'variable'};
 })};});
 const snapshot={id:rid,owner_id:uid,name:'Rutina local Premium N+1',days};
 const old=structuredClone(snapshot);old.days.forEach(d=>d.exercises.forEach(e=>{e.planned_sets[1].reps_max=9;}));
 mock.tables.routines=[{id:rid,owner_id:uid,name:snapshot.name,description:'Fixture offline',deleted_at:null}];
 mock.tables.routine_days=days.map(({exercises,...d})=>d);
 mock.tables.routine_exercises=days.flatMap(d=>d.exercises.map(({planned_sets,scheme,...e})=>e));
 mock.tables.coach_operations=[{id:operation,user_id:uid,routine_id:rid,prompt_version:'basic-initial-v5',state:'accepted'}];
 mock.tables.routine_management=[{routine_id:rid,user_id:uid,operation_id:operation,current_revision_id:revision,plan_kind:'premium'}];
 mock.tables.routine_revisions=[{id:oldRevision,routine_id:rid,user_id:uid,revision_no:1,operation_id:operation,origin:'basic',snapshot:old},{id:revision,routine_id:rid,user_id:uid,revision_no:2,operation_id:null,origin:'premium_recommendation',snapshot}];
 mock.tables.coach_mesocycles=[{id:meso,routine_id:rid,user_id:uid,number:1,state:'active',current_revision_id:revision,initial_revision_id:oldRevision,planned_weeks:6,tracking_week:2,row_version:1,catalogue_bindings:bindings,intake:{schema_version:'premium-intake-v1'},intake_submitted_at:new Date().toISOString(),created_at:new Date().toISOString()}];
 mock.tables.coach_mesocycle_weeks=[{id:crypto.randomUUID(),mesocycle_id:meso,week_number:2,state:'active',revision_id:revision}];
 mock.tables.coach_recommendations=[];mock.tables.coach_weekly_checkins=[];
 mock.tables.context_grants=[{user_id:uid,scope:'premium_training_history',notice_version:'premium-tracking-v1',revoked_at:null}];
 const previous=new Date();previous.setDate(previous.getDate()-7);const date=simpleLocalDateKey(previous);
 mock.tables.workouts=days.map(d=>({id:crypto.randomUUID(),user_id:uid,day:d.name,variant:d.name,workout_date:date,data:{routine_id:rid,routine_day_id:d.id,routine_name:snapshot.name,day_name:d.name,workout_date:date,exercises:d.exercises.map(e=>({exercise_id:e.id,name:e.name,notes:'Nota histórica '+e.id,sets:[{set:1,kg:null,reps:null,rir:null,done:false},{set:2,kg:0,reps:0,rir:0,done:true}]}))}}));
 mock.tables.routine_user_notes=days.flatMap(d=>d.exercises.map(e=>({id:crypto.randomUUID(),user_id:uid,routine_id:rid,exercise_key:'exercise:'+e.id,note:'Nota UUID '+e.id,updated_at:new Date().toISOString()})));
 window.premiumTrainingFixture={uid,rid,operation,oldRevision,revision,meso,days,snapshot,historical:JSON.stringify(mock.tables.workouts),routine:JSON.stringify(mock.tables.routine_exercises),revisions:JSON.stringify(mock.tables.routine_revisions)};
 db.auth.getSession=async()=>({data:{session:{user:{id:user.id}}},error:null});
 await start();return {rid,revision,oldRevision,days:days.map(d=>({id:d.id,ids:d.exercises.map(e=>e.id)}))};
}
async function run(){
 fs.mkdirSync(out,{recursive:true});const rows=[],check=(name,value)=>{rows.push({name,pass:!!value});assert(value,name);};
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch(engine==='chromium'?{channel:'msedge'}:{});
  try{
   const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await p.goto(base+'/demo');await p.waitForFunction(()=>window.qualityReady);await p.evaluate(()=>coachDialog().close());const f=await p.evaluate(seedFixture);
   check(engine+' Premium bridge loaded in actual index',await p.evaluate(()=>!!PremiumPrescription));
   check(engine+' retained Basic operation, N+1 operation null',await p.evaluate(()=>mock.tables.routine_management[0].operation_id===premiumTrainingFixture.operation&&mock.tables.routine_revisions[1].operation_id===null));
   for(const [index,d]of f.days.entries()){
    await p.evaluate(async({rid,did})=>{await openCoachRoutine(rid);await startWorkoutDay(did);},{rid:f.rid,did:d.id});
    check(engine+' day '+index+' exact four UUIDs',await p.evaluate(ids=>JSON.stringify(activeWorkout.exercises.map(e=>e.id))===JSON.stringify(ids),d.ids));
    check(engine+' day '+index+' individual targets',await p.locator('.coach-set-target').count()===8);
    check(engine+' day '+index+' heterogeneous reps RIR rest',(await p.locator('.coach-set-target').allTextContents()).every((t,i)=>i%2===0?/5–7 reps(?: por lado)? · RIR 2 · 3 min/.test(t):/8–10 reps(?: por lado)? · RIR 0 · 4 min/.test(t)));
    check(engine+' day '+index+' notes by UUID',JSON.stringify(await p.getByRole('textbox',{name:/^Notas de/}).evaluateAll(xs=>xs.map(x=>x.value)))===JSON.stringify(d.ids.map(id=>'Nota UUID '+id)));
    check(engine+' day '+index+' last session preserves null and zero',(await p.locator('.previous-session-sets').allTextContents()).every(t=>t.includes('— kg × — · RIR —')&&t.includes('0 kg × 0 · RIR 0')));
   }
   check(engine+' all twelve exact identities loaded',await p.evaluate(()=>simpleCoach.routineHints.byId.size===12&&simpleCoach.routineHints.byId.revisionId===premiumTrainingFixture.revision));
   for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
    await p.setViewportSize({width,height:844});await p.evaluate(t=>simpleTheme.set(t),theme);
    check(engine+' '+width+' '+theme+' training fits',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    check(engine+' '+width+' '+theme+' single final save',await p.locator('#saveWorkoutBtn').count()===1&&await p.locator('#saveWorkoutBtn').evaluate(e=>!['fixed','sticky'].includes(getComputedStyle(e).position)));
   }
   await p.setViewportSize({width:390,height:844});await p.evaluate(()=>simpleTheme.set('light'));
   await p.getByRole('textbox',{name:/^KG/}).first().fill('0');await p.getByRole('textbox',{name:/^Repeticiones/}).first().fill('0');await p.getByRole('textbox',{name:/^RIR/}).first().fill('0');
   await p.getByRole('textbox',{name:/^KG/}).nth(1).fill('81.5');await p.getByRole('textbox',{name:/^Repeticiones/}).nth(1).fill('9');await p.getByRole('textbox',{name:/^RIR/}).nth(1).fill('1');
   if(engine==='chromium')await p.screenshot({path:path.join(out,'premium-training-390-light.png'),fullPage:true});
   await p.locator('#saveWorkoutBtn').click();await p.waitForFunction(()=>mock.tables.workouts.length===4&&!window.__savingWorkout);
   const saved=await p.evaluate(()=>{const f=premiumTrainingFixture,last=mock.tables.workouts.at(-1);return {revision:last.data.routine_revision_id,day:last.data.routine_day_id,ids:last.data.exercises.map(e=>e.exercise_id),sets:last.data.exercises[0].sets,note:last.data.exercises[0].notes,historical:JSON.stringify(mock.tables.workouts.slice(0,3))===f.historical,routine:JSON.stringify(mock.tables.routine_exercises)===f.routine,revisions:JSON.stringify(mock.tables.routine_revisions)===f.revisions,invokes:coachDemo.invokeCalls.length};});
   check(engine+' new workout exact N+1 marker',saved.revision===f.revision&&saved.revision!==f.oldRevision);
   check(engine+' new workout exact day/UUIDs',saved.day===f.days[2].id&&JSON.stringify(saved.ids)===JSON.stringify(f.days[2].ids));
   check(engine+' new zeros preserved',saved.sets[0].kg==='0'&&saved.sets[0].reps==='0'&&saved.sets[0].rir==='0');
   check(engine+' actual execution differs from planned',saved.sets[1].kg==='81.5'&&saved.sets[1].reps==='9'&&saved.sets[1].rir==='1');
   check(engine+' note exact UUID',saved.note==='Nota UUID '+f.days[2].ids[0]);
   check(engine+' old workouts null/zero unchanged',saved.historical);check(engine+' structure untouched',saved.routine);check(engine+' revisions untouched',saved.revisions);check(engine+' no provider dispatch',saved.invokes===0);check(engine+' no browser errors',errors.length===0);
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'premium-training.json'),JSON.stringify({passed:rows.length,total:rows.length,scope:'actual index with offline SDK; no remote training writes',rows},null,2));console.log(rows.length+'/'+rows.length+' Premium N+1 training actual index, offline Chromium/WebKit');
}
module.exports={seedFixture,base};if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
