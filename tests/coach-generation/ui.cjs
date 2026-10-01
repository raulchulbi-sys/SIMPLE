// Offline UI tests; JWT/DB permissions are tested separately by live.cjs.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});const rows=[];
const check=(name,v)=>{rows.push({name,pass:!!v});assert(v,name);};
const training=require('../coach-quality-v5/cases.cjs').A.training;
async function seed(p){await p.goto('http://127.0.0.1:4202/demo');await p.waitForFunction(()=>window.previewReady);
 await p.evaluate(()=>{
  const t=mock.tables,r={id:crypto.randomUUID(),owner_id:demoUser,name:'Rutina anterior con un nombre largo para comprobar la lectura',deleted_at:null};t.routines=[r];window.generationOld={id:crypto.randomUUID(),user_id:demoUser,state:'accepted',routine_id:r.id,intake_id:crypto.randomUUID(),created_at:'2026-09-01',prompt_version:'basic-initial-v2'};
  t.coach_operations=[generationOld];t.training_intakes=[{id:generationOld.intake_id,user_id:demoUser,revision:1,row_version:1,schema_version:1,state:'submitted',training:{goal:'Ganar masa muscular',experience:'beginner',days:3,minutes:60,equipment:['Mancuernas'],preferred:'',avoided:'',preferences:''}}];
  t.context_grants=[{id:crypto.randomUUID(),user_id:demoUser,scope:'training_intake',notice_version:'pilot-supervised-v2',revoked_at:null}];
  t.routine_management=[{routine_id:r.id,user_id:demoUser,operation_id:generationOld.id}];
  window.generationOldHash=JSON.stringify({op:t.coach_operations[0],intake:t.training_intakes[0],r});
  const original=demoClient.rpc;demoClient.rpc=async(n,args)=>{
   if(n==='get_my_coach_access'){const ops=t.coach_operations,latest=ops.at(-1),saved=ops.filter(o=>o.state==='accepted');return demoResult({authorized:true,can_generate:ops.length<2,remaining_generations:Math.max(2-ops.length,0),consumed_generations:ops.length,authorized_generations:2,routine_id:generationOld.routine_id,accepted_routines:saved.map(o=>({routine_id:o.routine_id,name:t.routines.find(r=>r.id===o.routine_id)?.name||'Basic'})),latest_operation_state:latest.state,latest_operation_id:latest.id});}
   return original(n,args);
  };
 });}
(async()=>{for(const engine of ['chromium','webkit']){
 const b=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width,height:844}}),tag=engine+' '+width+' '+theme;p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await seed(p);await p.evaluate(t=>simpleTheme.set(t),theme);await p.evaluate(()=>openSimpleCoach());
  check(tag+' new proposal action',await p.locator('#coachNewGeneration').count()===1);
  check(tag+' old routine accessible',await p.locator('#coachOpen').getAttribute('data-coach-routine')===await p.evaluate(()=>generationOld.routine_id));
  await p.locator('#coachNewGeneration').click();check(tag+' independent explanation',await p.locator('#coachDialog').textContent().then(t=>t.includes('independiente')&&t.includes('se conservan')));
  await p.locator('#coachBegin').click();await p.locator('#coachConsentForm button').click();
  check(tag+' fresh Basic v2 rather than editing legacy',await p.locator('#coachStep').textContent()==='1 de 8'&&await p.evaluate(()=>simpleCoach.wizard.data.schema_version==='basic-intake-v2'&&simpleCoach.wizard.data.experience===null));
  check(tag+' names new proposal',await p.locator('#coachTitle').textContent()==='Nueva propuesta');
  const fit=await p.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('button')].filter(x=>x.getClientRects().length).every(x=>x.getBoundingClientRect().height>=43.9));check(tag+' layout and touch targets',fit);
  if(engine==='chromium'&&width===390)await p.screenshot({path:path.join(out,'new-questionnaire-'+theme+'.png')});
  await p.evaluate(t=>{simpleCoach.wizard.data=structuredClone(t);simpleCoach.wizard.step=coachWizardSteps().length-1;coachRenderQuestionnaire();coachWizardReview();},training);
  await p.locator('#coachConfirmSend').dblclick({force:true});await p.locator('#coachRefresh').waitFor();
  check(tag+' one dispatch and new intake',await p.evaluate(()=>coachDemo.invokeCalls.length===1&&mock.tables.training_intakes.length===2&&mock.tables.coach_operations.length===2&&mock.tables.coach_operations[1].id!==generationOld.id));
  check(tag+' all old rows unchanged',await p.evaluate(()=>generationOldHash===JSON.stringify({op:mock.tables.coach_operations[0],intake:mock.tables.training_intakes[0],r:mock.tables.routines[0]})));
  check(tag+' cannot accept pending',await p.locator('#coachAccept').count()===0);
  await p.locator('#coachDialog').evaluate(d=>d.close());await p.evaluate(()=>openSimpleCoach());check(tag+' reopen resumes specific new proposal',await p.locator('#coachPending').count()===1&&await p.locator('#coachNewGeneration').count()===0);
  await p.locator('#coachPending').click();await p.locator('#coachRefresh').waitFor();check(tag+' still only one dispatch',await p.evaluate(()=>coachDemo.invokeCalls.length===1));
  check(tag+' no JS errors',errors.length===0);await p.close();
 }
 const p=await b.newPage();await seed(p);await p.evaluate(()=>openSimpleCoach());await p.locator('#coachNewGeneration').click();await p.locator('#coachBegin').click();await p.locator('#coachConsentForm button').click();await p.evaluate(t=>{simpleCoach.wizard.data=t;simpleCoach.wizard.step=coachWizardSteps().length-1;coachRenderQuestionnaire();coachWizardReview();coachDemo.delays.save_my_training_intake=200;},training);await p.locator('#coachConfirmSend').click();await p.locator('#coachDialog').evaluate(d=>d.close());await p.waitForTimeout(400);check(engine+' close during save never dispatches',await p.evaluate(()=>coachDemo.invokeCalls.length===0));
 await seed(p);await p.evaluate(()=>{const rid=crypto.randomUUID();mock.tables.routines.push({id:rid,owner_id:demoUser,name:'Segunda rutina'});mock.tables.coach_operations.push({id:crypto.randomUUID(),state:'accepted',routine_id:rid});});await p.evaluate(()=>openSimpleCoach());check(engine+' two accepted routines remain separate choices',await p.locator('[data-coach-routine]').count()===2&&await p.locator('#coachNewGeneration').count()===0);await p.close();await b.close();
 }fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({passed:rows.length,total:rows.length,checks:rows},null,2));console.log(rows.length+'/'+rows.length+' UI checks passed');})().catch(e=>{fs.writeFileSync(path.join(out,'ui-failure.json'),JSON.stringify({error:e.message,checks:rows},null,2));console.error(e.message);process.exitCode=1;});
