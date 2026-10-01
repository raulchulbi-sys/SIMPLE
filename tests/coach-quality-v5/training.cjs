const fs=require('fs'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const rows=[],check=(s,v)=>{assert(v,s);rows.push(s);};
(async()=>{for(const engine of ['chromium','webkit']){const b=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4200/demo',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.qualityReady);await p.evaluate(()=>coachDialog().close());
 const pure=await p.evaluate(async()=>{
  const rid=crypto.randomUUID(),did=crypto.randomUUID(),eid=crypto.randomUUID(),other=crypto.randomUUID(),opid=crypto.randomUUID(),revid=crypto.randomUUID();
  const ss=[{set_number:1,reps_min:5,reps_max:7,rir:1,rest_seconds:180},{set_number:2,reps_min:7,reps_max:9,rir:0,rest_seconds:300}];
  const ex={id:eid,day_id:did,name:'Sentadilla hack',sets:2,target:'5-7',rir:'1',rest_seconds:180,exercise_order:0};
  const sx={...ex,...ss[0],planned_sets:ss,scheme:'top_backoff'};delete sx.set_number;
  const op={id:opid,user_id:user.id,routine_id:rid,prompt_version:'basic-initial-v5',state:'accepted'};
  const rev={id:revid,routine_id:rid,user_id:user.id,operation_id:opid,snapshot:{id:rid,owner_id:user.id,days:[{id:did,exercises:[sx]}]}};
  const h=coachRevisionHints(rev,op,rid,user.id),out={exact:h?.get(eid)?.sets[1].rir===0};simpleCoach.routineHints={owner:user.id,routine:rid,byId:h};
  out.rename=coachV5Prescription({...ex,name:'Renombrado'},rid)?.[1].reps_max===9;
  out.reorder=coachV5Prescription({...ex,exercise_order:4},rid)?.[0].reps_max===7;
  out.homonym=coachV5Prescription({...ex,id:other},rid)===null;out.otherRoutine=coachV5Prescription(ex,other)===null;out.locked=coachV5Prescription(ex,rid,true)===null;
  out.mismatchNoFallback=coachV5Prescription({...ex,target:'10-12'},rid)===null;try{coachAssertTargets([{...ex,target:'10-12'}],rid);out.mismatchBlocked=false;}catch{out.mismatchBlocked=true;}
  const owner=user.id;user={...user,id:other};out.otherUser=coachV5Prescription(ex,rid)===null;user={...user,id:owner};
  out.foreign=coachRevisionHints({...rev,user_id:other},op,rid,user.id)===null;out.pending=coachRevisionHints(rev,{...op,state:'pending_review'},rid,user.id)===null;
  const dup=structuredClone(rev);dup.snapshot.days[0].exercises.push(sx);out.duplicate=coachRevisionHints(dup,op,rid,user.id)===null;
  const bad=structuredClone(rev);delete bad.snapshot.days[0].exercises[0].planned_sets;out.missingTargets=coachRevisionHints(bad,op,rid,user.id)===null;
  const moved=structuredClone(rev);moved.snapshot.days[0].exercises[0].day_id=other;out.wrongDay=coachRevisionHints(moved,op,rid,user.id)===null;
  mock.tables.routine_management=[{routine_id:rid,operation_id:opid,current_revision_id:revid,user_id:user.id}];mock.tables.coach_operations=[op];mock.tables.routine_revisions=[rev];
  mock.tables.routines=[{id:rid,owner_id:user.id,name:'Local v5 por serie',description:'Synthetic',deleted_at:null}];mock.tables.routine_days=[{id:did,routine_id:rid,name:'Día sintético',day_order:0}];mock.tables.routine_exercises=[ex];
  window.labelFixture={rid,did,eid,original:JSON.stringify(ex),rev:structuredClone(rev)};out.databaseRead=(await coachReadRoutineHints(rid,user.id))?.get(eid)?.version===2;
  await openCoachRoutine(rid);await startWorkoutDay(did);return out;
 });
 for(const [k,v]of Object.entries(pure))check(engine+' UUID '+k,v);
 check(engine+' two exact targets',await p.locator('.coach-set-target').count()===2);
 check(engine+' first range',/5–7 reps · RIR 1 · 3 min/.test(await p.locator('.coach-set-target').first().textContent()));
 check(engine+' second range',/7–9 reps · RIR 0 · 5 min/.test(await p.locator('.coach-set-target').nth(1).textContent()));
 check(engine+' not merged range',!(await p.locator('.history-objective').first().textContent()).includes('5-9'));
 check(engine+' accessible target groups',await p.getByRole('group',{name:/Serie 1 · 5–7/}).count()===1);
 await p.getByRole('textbox',{name:/^KG/}).first().fill('21');await p.getByRole('textbox',{name:/^Repeticiones/}).first().fill('6');
 check(engine+' actual data separate',await p.evaluate(()=>activeWorkout.sets[labelFixture.eid][0].kg==='21'&&activeWorkout.sets[labelFixture.eid][0].reps==='6'&&JSON.stringify(mock.tables.routine_exercises[0])===labelFixture.original));
 for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:844});await p.evaluate(t=>simpleTheme.set(t),theme);await p.waitForTimeout(350);
  check(engine+' responsive '+width+' '+theme,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await p.getByRole('textbox',{name:/^Repeticiones/}).first().inputValue()==='6');
  check(engine+' single static save '+width+' '+theme,await p.evaluate(()=>{const b=[...document.querySelectorAll('#trainBody button')].filter(e=>e.textContent.includes('Guardar sesión'));return b.length===1&&!['fixed','sticky'].includes(getComputedStyle(b[0]).position);}));
  if(engine==='chromium'&&[320,390,1280].includes(width))await p.screenshot({path:__dirname+'/results/training-'+width+'-'+theme+'.png',fullPage:true});
 }
 const reopen=await p.evaluate(async()=>{const {did,eid}=labelFixture;await startWorkoutDay(did);return activeWorkout.sets[eid][0].reps==='6'&&coachV5Prescription(activeWorkout.exercises[0],workoutRoutine.id)?.[1].rir===0;});check(engine+' reopen draft exact targets',reopen);
 const blocked=await p.evaluate(async()=>{const original=mock.tables.routine_revisions;mock.tables.routine_revisions=[];try{await coachPrepareTargets(labelFixture.rid,user.id);return false;}catch{return true;}finally{mock.tables.routine_revisions=original;}});check(engine+' incomplete revision blocks ambiguous fallback',blocked);
 await p.evaluate(()=>{activeWorkout.locked=true;renderWorkoutDay();});check(engine+' historical actual view unchanged',await p.locator('.coach-set-target').count()===0);
 const normal=await p.evaluate(async()=>{profile.role='trainer';mock.tables.routine_management=[];mock.tables.routine_revisions=[];activeWorkout=null;await startWorkoutDay(labelFixture.did);return !coachV5Prescription(activeWorkout.exercises[0],workoutRoutine.id)&&activeWorkout.exercises[0].target==='5-7';});check(engine+' normal trainer prescription unchanged',normal);check(engine+' no browser errors',errors.length===0);
 }finally{await b.close();}}
 fs.writeFileSync(__dirname+'/results/training.json',JSON.stringify({passed:rows.length,total:rows.length,rows},null,2));console.log(rows.length+'/'+rows.length+' v5 training Chromium/WebKit LOCAL mocks');
})().catch(e=>{console.error(e);process.exitCode=1;});
