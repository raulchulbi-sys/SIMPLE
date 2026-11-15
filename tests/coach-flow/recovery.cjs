// Offline integration: actual UI + contract/provider with an injected, non-network transport.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const training=require('../coach-quality-v5/cases.cjs').A.training;
const I=globalThis.SimpleCoachIntakeV5,Q=globalThis.SimpleCoachProgrammingV5;
const base=process.env.COACH_FLOW_URL||'http://127.0.0.1:4266';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Loopback only');
const out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const checks=[],check=(name,value)=>{assert(value,name);checks.push({name,pass:true});};
async function seed(p,mode,proposal){
 await p.goto(base+'/demo');await p.waitForFunction(()=>window.previewReady);
 await p.evaluate(({training,mode,proposal})=>{
  window.flow={mode,calls:0,saves:0,reads:0,release:null,operation:null};
  const original=db.rpc;
  db.rpc=async(n,a)=>{if(n==='save_my_training_intake')flow.saves++;return original(n,a);};
  const from=db.from;
  db.from=name=>{const query=from(name);if(name!=='coach_operations')return query;
   const then=query.then;query.then=(yes,no)=>{flow.reads++;
    if(flow.mode==='read-error')return Promise.resolve(yes({data:null,error:{message:'offline'}}));
    if(flow.mode==='foreign')return Promise.resolve(yes({data:{...flow.operation,user_id:crypto.randomUUID()},error:null}));
    if(flow.mode==='wrong-intake')return Promise.resolve(yes({data:{...flow.operation,intake_id:crypto.randomUUID()},error:null}));
    return then(yes,no);
   };return query;
  };
  db.functions.invoke=async(name,{body})=>{
   flow.calls++;flow.request=structuredClone(body);
   flow.operation={id:crypto.randomUUID(),user_id:user.id,intake_id:body.intake_id,state:mode==='reserved'?'reserved':mode==='failed'?'failed':mode==='ready'?'ready':'pending_review',error_code:mode==='failed'?'provider_network_or_timeout':null,prompt_version:'basic-initial-v5',proposal:structuredClone(proposal),created_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};
   if(!['not-found','delayed'].includes(mode))mock.tables.coach_operations.push(flow.operation);
   if(mode==='late')await new Promise(resolve=>flow.release=resolve);
   if(mode==='throw')throw Error('transport lost');
   return {data:null,error:{message:'transport lost'}};
  };
  simpleCoach.granted=true;simpleCoach.accepted=false;simpleCoach.newGeneration=false;
  mock.tables.context_grants=[{id:crypto.randomUUID(),user_id:user.id,scope:'training_intake',notice_version:'pilot-supervised-v2',revoked_at:null}];
  coachStartQuestionnaire(training);simpleCoach.wizard.data=structuredClone(training);simpleCoach.wizard.step=coachWizardSteps().length-1;coachRenderQuestionnaire();coachWizardReview();
 },{training,mode,proposal});
}
async function run(){
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 const P=await import('../../supabase/functions/simple-coach-mock/provider.mjs');
 const wire={days:training.weekdays.map(day=>({day,exercises:['goblet','db_rdl','floor_press','band_row'].map(id=>({id,k:0,b:[{s:2,lo:8,hi:10,r:3,rest:120}]}))}))};
 let transportCalls=0;
 const generated=await P.generate({training},{key:'LOCAL_TEST',model:C.DEFAULT_MODEL,fetcher:async()=>{transportCalls++;return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(wire)}]}],usage:{input_tokens:100,output_tokens:200}}));}});
 check('V5 real provider code, injected transport only',transportCalls===1&&!generated.error_code&&C.reviewProposal(generated.proposal,{training}).ok);
 const proposal=generated.proposal;
 for(const engine of process.env.COACH_FLOW_SMOKE?['chromium']:['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  let p;try{p=await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(8000);
   const errors=[],external=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname))return r.continue();external.push(u.origin);return r.abort();});
   const modes=process.env.COACH_FLOW_SMOKE?['pending']:['pending','ready','reserved','failed','not-found','delayed','read-error','foreign','wrong-intake','throw'];
   for(const mode of modes){
    await seed(p,mode,proposal);await p.locator('#coachConfirmSend').dblclick({force:true});
    if(['pending','throw'].includes(mode))await p.locator('#coachRefresh').waitFor();
    else if(mode==='ready')await p.locator('#coachAccept').waitFor();
    else if(mode==='failed')await p.getByRole('heading',{name:'Propuesta no disponible',exact:true}).waitFor();
    else await p.locator('#coachRecoverRefresh').waitFor();
    check(engine+' '+mode+' single save and dispatch',await p.evaluate(()=>flow.calls===1&&flow.saves===1));
    check(engine+' '+mode+' answers preserved',await p.evaluate(t=>JSON.stringify(simpleCoach.wizard.data)===JSON.stringify(t),training));
    if(mode!=='ready')check(engine+' '+mode+' no premature acceptance',await p.locator('#coachAccept').count()===0);
    if(mode==='reserved'){
     await p.evaluate(()=>flow.operation.state='pending_review');await p.locator('#coachRecoverRefresh').click();await p.locator('#coachRefresh').waitFor();
     check(engine+' reserved resolves with read only',await p.evaluate(()=>flow.calls===1&&flow.operation.state==='pending_review'));
    }
    if(['not-found','delayed','read-error','foreign','wrong-intake'].includes(mode)){
     if(mode==='delayed')await p.evaluate(()=>mock.tables.coach_operations.push(flow.operation));
     if(mode==='read-error')await p.evaluate(()=>flow.mode='pending');
     // Activate the same control twice; a forced physical double click can hit a
     // different control after the first read has replaced the screen.
     await p.locator('#coachRecoverRefresh').evaluate(b=>{b.click();b.click();});
     if(['delayed','read-error'].includes(mode))await p.locator('#coachRefresh').waitFor();
     else await p.locator('#coachRecoverRefresh').waitFor();
     check(engine+' '+mode+' refresh cannot dispatch or resubmit',await p.evaluate(()=>flow.calls===1&&flow.saves===1));
    }
   }
   if(process.env.COACH_FLOW_SMOKE)continue;
   for(const width of [360,390,430,1280])for(const theme of ['light','dark']){
    await seed(p,'not-found',proposal);await p.evaluate(t=>simpleTheme.set(t),theme);await p.setViewportSize({width,height:844});await p.locator('#coachConfirmSend').click();await p.locator('#coachRecoverRefresh').waitFor();
    check(engine+' recovery layout '+width+' '+theme,await p.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('button')].filter(b=>b.getClientRects().length).every(b=>b.getBoundingClientRect().height>=44)));
    check(engine+' recovery focus '+width+' '+theme,await p.locator('#coachRecoveryHeading').evaluate(e=>document.activeElement===e));
    if(width===390)await p.screenshot({path:path.join(out,engine+'-recovery-'+theme+'.png')});
   }
   await seed(p,'late',proposal);await p.locator('#coachConfirmSend').click();await p.waitForFunction(()=>flow.calls===1&&!!flow.release);
   await p.locator('#coachDialog').evaluate(d=>d.close());await p.evaluate(()=>openSimpleCoach());await p.locator('#coachRefresh').waitFor();
   await p.evaluate(()=>flow.release());await p.waitForTimeout(80);
   check(engine+' close/reopen reconciles old dispatch without second call',await p.evaluate(()=>flow.calls===1&&simpleCoach.operation.id===flow.operation.id));
   await seed(p,'late',proposal);await p.locator('#coachConfirmSend').click();await p.waitForFunction(()=>!!flow.release);
   const reads=await p.evaluate(()=>flow.reads);await p.evaluate(()=>{user={id:crypto.randomUUID()};coachDialog().close();flow.release();});await p.waitForTimeout(80);
   check(engine+' changed user ignores late failure',await p.evaluate(n=>flow.reads===n&&!coachDialog().open,reads));
   check(engine+' no unexpected browser errors',errors.length===0);check(engine+' no external HTTP',external.length===0);
  }catch(e){if(p){fs.writeFileSync(path.join(out,engine+'-failure-state.json'),JSON.stringify(await p.evaluate(()=>({calls:window.flow?.calls,saves:window.flow?.saves,operations:window.mock?.tables.coach_operations?.length,dialog:document.getElementById('coachDialog')?.innerText})),null,2));}throw e;}finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'recovery.json'),JSON.stringify({simulated:true,providerCalls:0,passed:checks.length,total:checks.length,checks},null,2));console.log(checks.length+'/'+checks.length+' offline recovery assertions');
}
module.exports={seed,training};
if(require.main===module)run().catch(e=>{fs.writeFileSync(path.join(out,'recovery-failure.json'),JSON.stringify({error:e.message,checks},null,2));console.error(e);process.exitCode=1;});
