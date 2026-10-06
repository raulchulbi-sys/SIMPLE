// Actual application and adapter, offline SDK only. No provider/Auth/DB network.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {seedFixture}=require('../premium-upgrade/premium-training.cjs'),{hostFixture}=require('../premium-upgrade/host.cjs');
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4256',out=path.join(__dirname,'results'),rows=[],check=(name,ok)=>{assert(ok,name);rows.push({name,pass:true});};
(async()=>{
 const sample=JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8')).samples.find(s=>s.name==='top backoff two replacements');
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch(engine==='chromium'?{channel:'msedge',headless:true}:{headless:true});try{
   for(const [width,height]of [[390,844],[1440,1000]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await page.goto(base+'/demo');await page.waitForFunction(()=>qualityReady);await page.evaluate(seedFixture);await page.evaluate(hostFixture);
    await page.evaluate(patches=>{coachDialog().close();const f=premiumTrainingFixture;mock.tables.coach_recommendations=[{id:crypto.randomUUID(),mesocycle_id:f.meso,base_revision_id:f.revision,kind:'MODIFY',state:'pending_review',patches:patches.map((p,i)=>({...p,exercise_name:i?'Bird dog':'Dead bug'})),facts:[],interpretation:'Dos sustituciones compatibles; conservar todas las series.',analysis_trace:{quality_warnings:['Descanso heredado pendiente de revisión.']}}];user={...user,id:crypto.randomUUID()};profile={...profile,role:'trainer'};mock.tables.coach_mesocycles[0].reviewer_id=user.id;premiumHostMode='off';openPremiumCoach({mesocycleId:f.meso});},sample.patches);
    await page.waitForFunction(()=>simpleCoachPremium.controller?.snapshot().view.actor==='reviewer');await page.locator('#premiumCoachHost .premium-app-nav [data-action=analysis]').click();await page.getByRole('button',{name:'Ver propuesta',exact:true}).click();
    for(const theme of ['light','dark']){await page.evaluate(t=>simpleTheme.set(t),theme);const text=await page.locator('#premiumCoachHost').innerText(),label=engine+' '+width+' '+theme;
     check(label+' before/after names and all series',text.includes('Dead bug')&&text.includes('Bird dog')&&text.includes('Crunch en suelo')&&text.includes('Crunch inverso')&&text.includes('Serie 1: 8–10 reps, RIR 2, 2 min')&&text.includes('Serie 2: 10–12 reps, RIR 3, 2,5 min'));
     check(label+' preserves top back-off and warning',text.includes('Top set / back-off conservado')&&text.includes('Avisos de calidad'));
     check(label+' no JSON/UUID prescription',!text.includes('catalogue_id')&&!text.includes('source_catalogue_id')&&!/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text));
     check(label+' reviewer only not athlete acceptance',await page.getByRole('button',{name:'Aprobar propuesta',exact:true}).count()===1&&await page.getByRole('button',{name:'Aceptar propuesta',exact:true}).count()===0);
     await page.locator('#premium-review-reason').focus();check(label+' keyboard focus',await page.locator('#premium-review-reason').evaluate(e=>e===document.activeElement));
     await page.screenshot({path:path.join(out,'reviewer-'+engine+'-'+width+'-'+theme+'.png')});
    }
    check(engine+' '+width+' no browser errors',errors.length===0);check(engine+' '+width+' no provider calls',await page.evaluate(()=>coachDemo.invokeCalls.length===0));await page.close();
   }
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(rows,null,2));console.log(rows.length+'/'+rows.length+' actual UI checks Chromium/WebKit, mobile/desktop, light/dark; offline');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
