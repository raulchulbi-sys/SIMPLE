// Actual index, offline SDK and local assets. Focused reviewer visibility regression.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {seedFixture,base}=require('./premium-training.cjs'),{hostFixture}=require('./host.cjs');
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const rows=[];function check(name,ok){rows.push({name,pass:!!ok});assert(ok,name);}
async function run(){
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch(engine==='chromium'?{channel:'msedge'}:{});
  try{
   const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await p.goto(base+'/demo');await p.waitForFunction(()=>qualityReady);await p.evaluate(seedFixture);await p.evaluate(hostFixture);await p.evaluate(()=>{premiumHostMode='on';});await p.evaluate(()=>openPremiumCoach());await p.waitForFunction(()=>!!simpleCoachPremium.controller);
   check(engine+' owner still has check-in status',await p.locator('#premiumCoachHost dt').filter({hasText:/^Check-in$/}).count()===1);
   check(engine+' owner still has programming navigation',await p.locator('#premiumCoachHost .premium-app-nav [data-action=program]').count()===1);
   await p.locator('#premiumCoachHost [data-action=exit]').click();await p.waitForFunction(()=>!premiumCoachDialog().open);
   await p.evaluate(()=>{const f=premiumTrainingFixture,reviewer=crypto.randomUUID();mock.tables.coach_mesocycles[0].reviewer_id=reviewer;mock.tables.coach_recommendations=[{id:crypto.randomUUID(),mesocycle_id:f.meso,base_revision_id:f.revision,kind:'KEEP',state:'pending_review',patches:[],facts:[{exercise_name:'Sentadilla goblet',claim:'mixed_comparable'}],interpretation:'Conservar la programación con el contexto registrado.',analysis_week:2,analysis_trace:{quality_warnings:['Comparabilidad limitada']}}];user={...user,id:reviewer};profile={...profile,role:'trainer'};premiumHostMode='off';mock.tables.routine_revisions=[];});
   const readCount=await p.evaluate(()=>coachDemo.reads.length);await p.evaluate(()=>openPremiumCoach({mesocycleId:premiumTrainingFixture.meso}));await p.waitForFunction(()=>simpleCoachPremium.controller?.snapshot().view.actor==='reviewer');
   check(engine+' reviewer loads with private revisions absent',await p.evaluate(()=>simpleCoachPremium.controller.snapshot().view.days.length===0));
   check(engine+' reviewer home does not infer a check-in status',await p.locator('#premiumCoachHost dt').filter({hasText:/^Check-in$/}).count()===0&&!(await p.locator('#premiumCoachHost main').innerText()).includes('Check-in'));
   check(engine+' reviewer home explains proposal context',(await p.locator('#premiumCoachHost main').innerText()).includes('El contexto disponible para esta revisión se muestra en la propuesta'));
   check(engine+' reviewer has no programming/check-in/chat entries',await p.locator('#premiumCoachHost [data-action=program],#premiumCoachHost [data-action=checkin],#premiumCoachHost [data-action=chat]').count()===0);
   check(engine+' reviewer has no fabricated revision ordinal',(await p.locator('#premiumCoachHost main').innerText()).includes('Revisión actual'));
   await p.locator('#premiumCoachHost .premium-app-nav [data-action=analysis]').click();await p.getByRole('button',{name:'Ver propuesta',exact:true}).click();
   check(engine+' reviewer still gets named safe facts/warnings/actions',await p.getByRole('heading',{name:'Sentadilla goblet',exact:true}).count()===1&&await p.getByRole('heading',{name:'Avisos de calidad',exact:true}).count()===1&&await p.getByRole('button',{name:'Aprobar propuesta',exact:true}).count()===1);
   await p.evaluate(()=>simpleCoachPremium.controller.navigate('program'));const text=await p.locator('#premiumCoachHost main').innerText();
   check(engine+' direct program navigation describes access limit',text.includes('La programación completa no se muestra en este acceso.')&&!text.includes('No hay ejercicios disponibles'));
   check(engine+' direct program offers permitted analysis',await p.getByRole('button',{name:'Ver análisis',exact:true}).count()===1&&await p.locator('#premiumCoachHost [data-action=training]').count()===0);
   check(engine+' reviewer makes no private owner table reads',await p.evaluate(n=>coachDemo.reads.slice(n).every(t=>!['routine_revisions','context_grants','coach_weekly_checkins','coach_messages','coach_conversations','routine_user_notes'].includes(t)),readCount));
   check(engine+' no provider requests or browser errors',errors.length===0&&await p.evaluate(()=>coachDemo.invokeCalls.length===0));
  }finally{await browser.close();}
 }
}
run().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/reviewer-ui.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,scope:'Actual index offline SDK, Chromium/WebKit; reviewer projection labels/navigation and owner controls',provider_dispatches:0,auth_calls:0,data_mutations:0},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' focused reviewer UI checks');});
