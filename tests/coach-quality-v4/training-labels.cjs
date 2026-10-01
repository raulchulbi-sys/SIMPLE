const fs=require('fs'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const rows=[],check=(s,v)=>{assert(v,s);rows.push(s);};
(async()=>{for(const engine of ['chromium','webkit']){const b=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4198/demo',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.previewReady);
 const pure=await p.evaluate(async()=>{
  const rid=crypto.randomUUID(),did=crypto.randomUUID(),eid=crypto.randomUUID(),other=crypto.randomUUID(),opid=crypto.randomUUID(),revid=crypto.randomUUID();
  const ex={id:eid,day_id:did,name:'Remo con mancuerna',sets:2,target:'8-10',rir:'3',rest_seconds:90,exercise_order:0};
  const op={id:opid,user_id:user.id,routine_id:rid,prompt_version:'basic-initial-v4',state:'accepted'};
  const rev={id:revid,routine_id:rid,user_id:user.id,operation_id:opid,snapshot:{id:rid,owner_id:user.id,days:[{id:did,exercises:[ex]}]}};
  const h=coachRevisionHints(rev,op,rid,user.id),out={exact:h?.get(eid)===true};simpleCoach.routineHints={owner:user.id,routine:rid,byId:h};
  out.rename=coachRepetitionSuffix({...ex,name:'Nombre nuevo'},rid)===' por lado';out.homonym=coachRepetitionSuffix({...ex,id:other},rid)==='';out.otherRoutine=coachRepetitionSuffix(ex,other)==='';out.locked=coachRepetitionSuffix(ex,rid,true)==='';
  const owner=user.id;user={...user,id:other};out.otherUser=coachRepetitionSuffix(ex,rid)==='';user={...user,id:owner};
  out.v3=coachRevisionHints(rev,{...op,prompt_version:'basic-initial-v3'},rid,user.id).size===0;out.foreign=coachRevisionHints({...rev,user_id:other},op,rid,user.id)===null;out.pending=coachRevisionHints(rev,{...op,state:'pending_review'},rid,user.id)===null;
  const dup=structuredClone(rev);dup.snapshot.days[0].exercises.push(ex);out.duplicate=coachRevisionHints(dup,op,rid,user.id)===null;
  mock.tables.routine_management=[{routine_id:rid,operation_id:opid,current_revision_id:revid,user_id:user.id}];mock.tables.coach_operations=[op];mock.tables.routine_revisions=[rev];
  mock.tables.routines=[{id:rid,owner_id:user.id,name:'Local v4 UUID test',description:'Synthetic',deleted_at:null}];mock.tables.routine_days=[{id:did,routine_id:rid,name:'Dia sintetico',day_order:0}];mock.tables.routine_exercises=[ex];
  window.labelFixture={rid,did,eid,original:JSON.stringify(ex)};out.databaseRead=(await coachReadRoutineHints(rid,user.id))?.get(eid)===true;await openCoachRoutine(rid);await startWorkoutDay(did);return out;
 });
 for(const [k,v]of Object.entries(pure))check(engine+' identity '+k,v);
 check(engine+' target per side',(await p.locator('.workout-exercise .history-objective').first().textContent()).includes('8-10 por lado'));
 check(engine+' accessible inputs',await p.getByRole('textbox',{name:/Repeticiones por lado/}).count()===2);
 await p.getByRole('textbox',{name:/^KG/}).first().fill('21');await p.getByRole('textbox',{name:/Repeticiones por lado/}).first().fill('9');
 check(engine+' state and immutable prescription',await p.evaluate(()=>activeWorkout.sets[labelFixture.eid][0].kg==='21'&&activeWorkout.sets[labelFixture.eid][0].reps==='9'&&activeWorkout.exercises[0].target==='8-10'&&JSON.stringify(mock.tables.routine_exercises[0])===labelFixture.original));
 for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){await p.setViewportSize({width,height:844});await p.evaluate(t=>simpleTheme.set(t),theme);if(engine==='chromium'&&width===390)await p.screenshot({path:__dirname+'/results/training-side-'+theme+'.png'});check(engine+' training '+width+' '+theme,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await p.getByRole('textbox',{name:/Repeticiones por lado/}).first().inputValue()==='9');}
 await p.evaluate(()=>{activeWorkout.locked=true;renderWorkoutDay();});check(engine+' saved display untouched',!(await p.locator('.workout-exercise .history-objective').first().textContent()).includes('por lado'));check(engine+' no browser errors',errors.length===0);
 }finally{await b.close();}}
 fs.writeFileSync(__dirname+'/results/training-labels.json',JSON.stringify({passed:rows.length,total:rows.length,rows},null,2));console.log(rows.length+'/'+rows.length+' UUID training labels; local only, no acceptance RPC');
})().catch(e=>{console.error(e);process.exitCode=1;});
