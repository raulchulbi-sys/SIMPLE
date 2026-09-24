const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),results=[];
(async()=>{for(const engine of ['chromium','webkit']){const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{for(const width of [320,1280]){
 const context=await b.newContext({viewport:{width,height:900},colorScheme:'light'}),p=await context.newPage();p.setDefaultTimeout(5000);await p.goto((process.env.SIMPLE_PREVIEW_URL||'http://127.0.0.1:4182/')+'?role=client');await p.waitForFunction(()=>window.previewReady);
 const test=async(name,fn)=>{try{await fn();results.push({engine,width,name,pass:true})}catch(e){results.push({engine,width,name,pass:false,error:e.message})}};
 await test('Native keyboard radios, focus trap, Escape, real storage event and reopen preserve preference',async()=>{
  await p.evaluate(()=>simpleTheme.set('light'));await p.locator('#app .settings-trigger').click();await p.locator('input[value=light]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>simpleTheme.choice),'dark');assert.equal(await p.locator('input[value=dark]').evaluate(e=>getComputedStyle(e.parentElement).outlineStyle),'solid');
  for(let n=0;n<10;n++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.getElementById('settingsDialog').contains(document.activeElement)));}
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Ajustes');
  const q=await p.context().newPage();await q.goto((process.env.SIMPLE_PREVIEW_URL||'http://127.0.0.1:4182/')+'?role=client');await q.waitForFunction(()=>window.previewReady);assert.equal(await q.evaluate(()=>simpleTheme.choice),'dark');await q.evaluate(()=>simpleTheme.set('light'));await p.waitForFunction(()=>simpleTheme.choice==='light');await q.close();
  const reopened=await p.context().newPage();await reopened.goto((process.env.SIMPLE_PREVIEW_URL||'http://127.0.0.1:4182/')+'?role=trainer');await reopened.waitForFunction(()=>window.previewReady);assert.equal(await reopened.evaluate(()=>simpleTheme.choice),'light');await reopened.close();
 });
 await test('Toast keeps exact text and caller duration; accessible error then success',async()=>{
  await p.evaluate(()=>toast('No se pudo guardar',9000));await p.waitForFunction(()=>$('toast').dataset.tone==='error');assert.equal(await p.locator('#toast').getAttribute('aria-live'),'assertive');assert.equal(await p.locator('#toast').textContent(),'No se pudo guardar');
  await p.evaluate(()=>{toast('Rutina guardada',80);window.toastShownAt=performance.now();new MutationObserver(()=>{if($('toast').style.display==='none')window.toastHiddenAt=performance.now()}).observe($('toast'),{attributes:true,attributeFilter:['style']})});
  await p.waitForFunction(()=>window.toastHiddenAt);const duration=await p.evaluate(()=>toastHiddenAt-toastShownAt);assert(duration>=60&&duration<500);assert.equal(await p.locator('#toast').getAttribute('aria-live'),'polite');assert.equal(await p.locator('#toast').textContent(),'Rutina guardada');
 });
 await context.close();
}}finally{await b.close()}}
const report={passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results};fs.writeFileSync(path.join(__dirname,'results/accessibility.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
