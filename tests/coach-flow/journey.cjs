// Browser journey with a simulated backend. This is not a JWT, model or production test.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{seed,training}=require('./recovery.cjs');
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results'),checks=[];const check=(name,v)=>{assert(v,name);checks.push({name,pass:true});};
(async()=>{
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 const proposal=C.decodeOutput({days:training.weekdays.map(day=>({day,exercises:['goblet','db_rdl','floor_press','band_row'].map(id=>({id,k:0,b:[{s:2,lo:8,hi:10,r:3,rest:120}]}))}))},{training});
 assert(C.reviewProposal(proposal,{training}).ok);
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});let p;
  try{p=await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(12000);const errors=[],external=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>{if(['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname))return r.continue();external.push(r.request().url());return r.abort();});
   await seed(p,'pending',proposal);
   await p.evaluate(()=>{window.athleteId=user.id;simpleCoach.wizard.step=0;simpleCoach.wizard.data.experience=null;coachRenderQuestionnaire();});
   await p.locator('#coachNext').click();check(engine+' unanswered question blocks progression',await p.locator('#coachStep').textContent()==='1 de 8');
   await p.locator('[data-field=experience] [value=lt6]').check();await p.locator('#coachNext').click();await p.locator('#coachBack').click();check(engine+' back retains answer',await p.locator('[data-field=experience] [value=lt6]').isChecked());
   await p.evaluate(()=>{simpleCoach.wizard.step=coachWizardSteps().length-1;coachRenderQuestionnaire();coachWizardReview();});
   await p.locator('#coachConfirmSend').click();await p.locator('#coachRefresh').waitFor();check(engine+' generated proposal requires review',await p.locator('#coachAccept').count()===0&&await p.evaluate(()=>mock.tables.routines.length===0&&flow.calls===1));
   await p.evaluate(()=>{
    const rpc=db.rpc;db.rpc=async(n,a)=>{
     if(n==='get_coach_reviewer_status')return demoResult({authorized:pilotDemoReviewer,expires_at:new Date(Date.now()+86400000).toISOString()});
     const r=await rpc(n,a);
     if(n==='accept_basic_plan'&&!r.error){
      const t=mock.tables,op=t.coach_operations.find(o=>o.id===a.p_operation),rid=r.data,m=t.routine_management.find(x=>x.routine_id===rid);
      if(!m.current_revision_id){const id=crypto.randomUUID(),days=t.routine_days.filter(d=>d.routine_id===rid).sort((a,b)=>a.day_order-b.day_order).map((d,i)=>({...d,exercises:t.routine_exercises.filter(e=>e.day_id===d.id).sort((a,b)=>a.exercise_order-b.exercise_order).map((e,j)=>({...e,...op.proposal.days[i].exercises[j]}))}));
       t.routine_revisions.push({id,routine_id:rid,user_id:athleteId,operation_id:op.id,snapshot:{id:rid,owner_id:athleteId,days}});Object.assign(m,{operation_id:op.id,current_revision_id:id});}
     }return r;
    };
    pilotDemoReviewer=true;user={id:crypto.randomUUID()};profile={id:user.id,role:'trainer',name:'Synthetic reviewer'};return openCoachReviewer();
   });
   await p.locator('#coachQueue').waitFor();check(engine+' reviewer sees V5 sets',await p.locator('#coachQueue').innerText().then(t=>t.includes('RIR')&&t.includes('min')));
   await p.locator('#coachQueue textarea').first().fill('SYNTHETIC: fixture reviewed; no real user or model.');await p.getByRole('button',{name:'Aprobar propuesta',exact:true}).click();await p.getByRole('heading',{name:'Aprobada',exact:true}).waitFor();
   await p.evaluate(async()=>{pilotDemoReviewer=false;user={id:athleteId};profile={id:athleteId,role:'client',name:'Synthetic athlete'};await openSimpleCoach();});await p.locator('#coachBegin').click();await p.locator('#coachAccept').waitFor();check(engine+' only approved proposal exposes acceptance',true);
   await p.locator('#coachAccept').click();await p.getByRole('heading',{name:'Rutina creada',exact:true}).waitFor();
   check(engine+' exactly one accepted routine and revision',await p.evaluate(()=>mock.tables.routines.length===1&&mock.tables.routine_revisions.length===1&&mock.tables.routine_management.length===1&&mock.tables.coach_operations[0].state==='accepted'));
   const prescription=await p.evaluate(()=>JSON.stringify({ex:mock.tables.routine_exercises,rev:mock.tables.routine_revisions}));
   await p.locator('#coachOpen').click();await p.evaluate(()=>startWorkoutDay(mock.tables.routine_days[0].id));await p.locator('#saveWorkoutBtn').waitFor();
   check(engine+' V5 targets loaded from accepted UUID revision',await p.locator('.coach-set-target').count()===8);
   await p.getByRole('textbox',{name:/^KG/}).first().fill('20');await p.getByRole('textbox',{name:/^Repeticiones/}).first().fill('9');
   await p.locator('#trainBody textarea').first().fill('SYNTHETIC personal note');
   for(const width of [360,390,430,1280])for(const theme of ['light','dark']){await p.setViewportSize({width,height:844});await p.evaluate(t=>simpleTheme.set(t),theme);check(engine+' training '+width+' '+theme,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await p.locator('#saveWorkoutBtn').count()===1);}
   await p.locator('#saveWorkoutBtn').click();await p.waitForFunction(()=>!window.__savingWorkout&&mock.tables.workouts.length===1);
   check(engine+' workout and notes saved separately',await p.evaluate(()=>mock.tables.workouts[0].data.exercises[0].sets[0].kg==='20'&&mock.tables.routine_user_notes.some(n=>n.note==='SYNTHETIC personal note')));
   check(engine+' training does not rewrite prescription or revision',await p.evaluate(s=>s===JSON.stringify({ex:mock.tables.routine_exercises,rev:mock.tables.routine_revisions}),prescription));
   await p.evaluate(async()=>{closeM('trainModal');await openSimpleCoach();});await p.locator('#coachOpen').waitFor();check(engine+' accepted routine reopens without generation',await p.evaluate(()=>flow.calls===1));
   await p.locator('#coachOpen').click();await p.evaluate(()=>startWorkoutDay(mock.tables.routine_days[0].id));await p.locator('#saveWorkoutBtn').waitFor({state:'attached'}).catch(()=>{});
   await p.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await p.locator('.history-session').waitFor();check(engine+' saved workout in history',await p.locator('.history-session').count()===1);
   check(engine+' no external calls or runtime errors',external.length===0&&errors.length===0);
   await p.screenshot({path:path.join(out,engine+'-journey-history.png')});
  }catch(e){if(p)fs.writeFileSync(path.join(out,engine+'-journey-failure.txt'),await p.locator('body').innerText());throw e;}finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'journey.json'),JSON.stringify({simulated:true,realJWT:false,passed:checks.length,total:checks.length,checks},null,2));console.log(checks.length+'/'+checks.length+' simulated Basic journey assertions');
})().catch(e=>{fs.writeFileSync(path.join(out,'journey-failure.json'),JSON.stringify({error:e.message,checks},null,2));console.error(e);process.exitCode=1;});
