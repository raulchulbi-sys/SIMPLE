// UI-only cases use the explicitly offline preview; these are not model quality tests.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const results=[],check=(name,b)=>{assert(b,name);results.push({name,pass:true});};
(async()=>{for(const engine of ['chromium','webkit']){
 const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto('http://127.0.0.1:4193/demo');await p.waitForFunction(()=>window.previewReady);
 await p.getByRole('button',{name:'Entrenar con SIMPLE Coach',exact:true}).click();await p.locator('#coachBegin').click();await p.locator('#coachGoal').fill('Ganar fuerza general');
 for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:900});await p.evaluate(t=>simpleTheme.set(t),theme);
  check(engine+' '+width+' '+theme+' readable without overflow',await p.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1&&parseFloat(getComputedStyle(d.querySelector('input')).fontSize)>=16));
 }
 await p.locator('#coachGrantTraining').check();await p.locator('#coachGrantHealth').check();
 await p.evaluate(()=>{window.calls=0;const original=db.functions.invoke;db.functions.invoke=async(...args)=>{calls++;await new Promise(r=>setTimeout(r,250));return original(...args);};});
 const generate=p.getByRole('button',{name:'Generar propuesta',exact:true});await generate.dblclick();await p.locator('#coachAccept').waitFor();
 check(engine+' duplicate activation one request',await p.evaluate(()=>calls===1));
 check(engine+' review before acceptance',await p.evaluate(()=>mock.tables.routines.length===0));
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>simpleTheme.set('light'));
 await p.screenshot({path:path.join(__dirname,'results',engine+'-proposal-light.png'),fullPage:true});
 // Close while generation is in flight; its response must not repopulate the closed dialog.
 await p.waitForTimeout(1000);await p.locator('#coachGoal').fill('Otro objetivo de prueba');await generate.click();await p.getByRole('button',{name:'Cerrar SIMPLE Coach',exact:true}).click();await p.waitForTimeout(400);
 check(engine+' late result does not reopen dialog',!await p.locator('#coachDialog').isVisible());
 await p.getByRole('button',{name:'Entrenar con SIMPLE Coach',exact:true}).click();await p.locator('#coachBegin').click();
 await p.evaluate(()=>{db.functions.invoke=async()=>({data:{operation:{id:'synthetic-review',state:'failed',error_code:'safety_review_required'}},error:null});});
 await p.locator('#coachGrantTraining').check();await p.locator('#coachGrantHealth').check();await generate.click();
 await p.getByRole('alert').filter({hasText:'aclarar esta situación'}).waitFor();
 check(engine+' needs review persistent with no accept',await p.locator('#coachAccept').count()===0);
 await p.waitForTimeout(1000);await p.locator('#coachGoal').fill('Formulario conservado');await p.evaluate(()=>{db.functions.invoke=async()=>({data:{operation:{id:'synthetic-error',state:'failed',error_code:'provider_rate_limit'}},error:null});});await generate.click();await p.getByRole('alert').filter({hasText:'No se pudo completar'}).waitFor();
 await p.waitForFunction(()=>!simpleCoach.busy);check(engine+' error retains form and allows manual retry',await generate.isEnabled()&&await p.locator('#coachGoal').inputValue()==='Formulario conservado');
 await p.evaluate(()=>simpleTheme.set('dark'));await p.screenshot({path:path.join(__dirname,'results',engine+'-error-dark.png'),fullPage:true});
 check(engine+' no technical model name in UI',!/gpt-|openai/i.test(await p.locator('#coachDialog').innerText()));
 check(engine+' no page errors',errors.length===0);
 }finally{await b.close();}
}fs.writeFileSync(path.join(__dirname,'results/browser.json'),JSON.stringify(results,null,2));console.log(results.length+'/'+results.length+' browser checks (offline)');})().catch(e=>{console.error(e.message);process.exitCode=1});
