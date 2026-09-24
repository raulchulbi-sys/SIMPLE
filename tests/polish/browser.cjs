const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});const results=[],shots=[];
const literalToasts=[...fs.readFileSync('index.html','utf8').matchAll(/toast\('([^']+)'/g)].map(m=>m[1]);
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of (process.env.POLISH_WIDTHS||'320,360,390,430,768,1280').split(',').map(Number)){
 const p=await browser.newPage({viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',hasTouch:width<700}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());
 const test=async(name,fn)=>{try{await fn();results.push({engine,width,name,pass:true})}catch(e){results.push({engine,width,name,pass:false,error:e.message});console.error(engine,width,name,e.message)}};
 const go=async(role,state='normal')=>{await p.goto((process.env.SIMPLE_PREVIEW_URL||'http://127.0.0.1:4182/')+'?role='+role+'&state='+state);await p.waitForFunction(()=>window.previewReady);};
 const theme=async value=>{await p.evaluate(v=>simpleTheme.set(v),value);await p.waitForTimeout(30)};
 const shot=async name=>{const file=engine+'-'+width+'-'+name+'.png';await p.screenshot({path:path.join(out,file),fullPage:!(await p.locator('.modal.show,dialog[open]').count())});shots.push(file)};
 const fit=async selector=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const box=await p.locator(selector).first().boundingBox();assert(box&&box.x>=-1&&box.x+box.width<=width+1,'Bounds '+JSON.stringify(box));};
 const contrast=async selector=>{const bad=await p.locator(selector).evaluateAll(es=>{
  const rgba=s=>{const x=s.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [x[0],x[1],x[2],x[3]??1]};
  const blend=(a,b)=>a.slice(0,3).map((x,i)=>x*a[3]+b[i]*(1-a[3])).concat(1);
  function bg(e){if(!e)return [255,255,255,1];const c=rgba(getComputedStyle(e).backgroundColor);return c[3]===1?c:blend(c,bg(e.parentElement))}
  const luminance=c=>c.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
  return es.filter(e=>e.getClientRects().length&&!e.disabled).map(e=>{const s=getComputedStyle(e),b=bg(e),f=blend(rgba(s.color),b),lo=luminance(b),hi=luminance(f),ratio=(Math.max(lo,hi)+.05)/(Math.min(lo,hi)+.05);return {tag:e.tagName,id:e.id,text:e.textContent.slice(0,45),ratio,fg:s.color,bg:b}}).filter(x=>x.ratio<4.5);
 });assert.deepEqual(bad,[]);};
 for(const role of ['client','trainer']){
 await test(role+' settings, Light default independent of OS and explicit theme persistence',async()=>{
  await go(role);await theme('light');await p.locator('#app .settings-trigger').click();assert.equal(await p.locator('#settingsRole').innerText(),role==='client'?'Atleta':'Entrenador');assert.equal(await p.locator('#settingsDialog select').count(),0);assert.equal(await p.locator('#settingsDialog a').count(),0);assert.equal(await p.locator('#settingsDialog input:checked').inputValue(),'light');
  await p.emulateMedia({colorScheme:'dark'});await p.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await p.locator('html').getAttribute('data-theme'),'light');
  await p.locator('#settingsDialog label').filter({hasText:'Claro'}).click();await p.emulateMedia({colorScheme:'light'});await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(60);assert.equal(await p.locator('html').getAttribute('data-theme'),'light');
  await p.locator('#settingsDialog label').filter({hasText:'Oscuro'}).click();await p.waitForTimeout(100);await fit('#settingsDialog');await contrast('#settingsDialog button,#settingsDialog label,#settingsDialog dt,#settingsDialog dd,#settingsDialog .muted');await shot(role+'-settings-dark');
  await p.keyboard.press('Escape');await p.waitForTimeout(50);assert.equal(await p.locator('dialog[open]').count(),0);assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Ajustes');await p.reload();await p.waitForFunction(()=>window.previewReady);assert.equal(await p.evaluate(()=>simpleTheme.choice),'dark');assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');await p.emulateMedia({colorScheme:'light'});assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');await theme('light');
 });
 for(const tone of ['light','dark'])await test(role+' '+tone+' home, focus, toast inventory and destructive control',async()=>{
  await go(role);await theme(tone);await fit('#app .wrap');await contrast('#app h2,#app h3,#app .muted,#app .btn,#app .client-overview-name,#app .client-overview-routine');
  assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('app')).colorScheme),tone);
  await p.locator('#app .settings-trigger').focus();assert.notEqual(await p.locator('#app .settings-trigger').evaluate(e=>getComputedStyle(e).outlineStyle),'none');const svg=await p.locator('#app .settings-trigger svg').boundingBox();assert(svg.width>=19);await p.locator('#app .settings-trigger').blur();await shot(role+'-home-'+tone);
  await p.locator('#app .settings-trigger').click();await shot(role+'-settings-'+tone);await p.locator('[data-settings-close]').click();
  const expected=tone==='light'?'rgb(247, 245, 241)':'rgb(32, 36, 35)';
  for(const text of [...new Set(literalToasts)]){
   await p.evaluate(text=>toast(text,9000),text);
   assert.equal(await p.locator('#toast').textContent(),text);
   assert.equal(await p.locator('#toast').evaluate(e=>getComputedStyle(e).backgroundColor),expected);
   assert.equal(await p.locator('#toast').getAttribute('aria-atomic'),'true');
  }
  for(const [message,type]of [['Orden guardado','success'],['Rutina guardada','success'],['Cambios guardados','success'],['Rutina restaurada','success'],['Rutina eliminada definitivamente','success'],['No se pudo guardar el orden','error']]){
   await p.evaluate(text=>toast(text),message);assert.equal(await p.locator('#toast').getAttribute('data-tone'),type);await contrast('#toast');
  }
  await shot(role+'-toast-error-'+tone);await p.evaluate(()=>toast('Orden guardado'));await shot(role+'-toast-success-'+tone);await p.evaluate(()=>{clearTimeout(window._t);document.getElementById('toast').style.display='none'});
  if(role==='trainer'){await p.locator('#tMine').click();const button=p.locator('#mine .routine .danger').first();const c=await button.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {h:r.height,w:r.width,b:s.borderTopWidth,color:s.borderTopColor,bg:s.backgroundColor}});assert(c.h>=44&&c.w>=44);assert.notEqual(c.b,'0px');assert(!c.color.includes('0, 0, 0, 0'));await shot('delete-routine-'+tone);const before=await p.evaluate(()=>mock.calls.filter(x=>x.write||x.rpc&&!x.rpc.startsWith('get_')).length);await button.click();assert.equal(await p.evaluate(()=>mock.calls.filter(x=>x.write||x.rpc&&!x.rpc.startsWith('get_')).length),before);}
 });
 }
 await test('Hot theme preserves routine creation, editor fields, UUID and scroll',async()=>{
  await go('trainer','long');await p.locator('#tNew').click();await p.locator('#rn').fill('Conservar nombre 492');await p.locator('#rd').fill('Descripción sin perder');await p.getByRole('button',{name:'Añadir día',exact:true}).click();await p.getByRole('button',{name:'Añadir ejercicio',exact:true}).click();await p.locator('#newDays .exercise input').first().fill('Ejercicio 731');await p.locator('#newDays .exercise input').first().blur();
  const old=await p.evaluate(()=>JSON.stringify({newDays,rn:$('rn').value,rd:$('rd').value}));await p.locator('#app .settings-trigger').click();await p.locator('#settingsDialog label').filter({hasText:'Oscuro'}).click();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>JSON.stringify({newDays,rn:$('rn').value,rd:$('rd').value})),old);await shot('create-dark');
  await p.locator('#tMine').click();await p.locator('[data-open-routine]').first().click();await p.locator('#clientSessionList').getByRole('button',{name:'Editar sesión',exact:true}).first().click();const input=p.locator('#editor input').first();await input.fill('Sesión editada 924');await input.blur();const snap=await p.evaluate(()=>{window.keptEdit=editDays;return JSON.stringify({editDays,inputs:[...$('editor').querySelectorAll('input,textarea')].map(e=>e.value)})});await p.locator('#editModal .settings-trigger').click();await p.locator('#settingsDialog label').filter({hasText:'Claro'}).click();await p.keyboard.press('Escape');assert(await p.evaluate(()=>window.keptEdit===editDays));assert.equal(await p.evaluate(()=>JSON.stringify({editDays,inputs:[...$('editor').querySelectorAll('input,textarea')].map(e=>e.value)})),snap);await shot('editor-light');await theme('dark');await shot('editor-dark');await contrast('#editor input,#editor label,#editor .btn');
 });
 await test('Hot theme preserves active workout, timer node, checked values and draft',async()=>{
  await go('client','history');await p.locator('#shared .routine .primary').click();await p.locator('.interior-session-list button').first().click();await p.locator('.tick').first().waitFor();await p.locator('.setrow input').first().fill('42.5');await p.locator('.setrow input').nth(1).fill('9');await p.locator('.tick').first().click();await p.locator('.rest-buttons button').first().click();await p.evaluate(()=>{window.keptWorkout=activeWorkout;window.keptClose=document.querySelector('[data-action="rest-close"]')});const old=await p.evaluate(()=>JSON.stringify(activeWorkout));await p.locator('#trainModal .settings-trigger').click();await p.locator('#settingsDialog label').filter({hasText:'Claro'}).click();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>JSON.stringify(activeWorkout)),old);assert(await p.evaluate(()=>window.keptWorkout===activeWorkout&&window.keptClose===document.querySelector('[data-action="rest-close"]')));await shot('training-light');await theme('dark');await shot('training-dark');await contrast('#trainModal .exname,#trainModal input,#trainModal label,#trainModal .muted,#restBox .rest-time');assert.equal(await p.locator('#saveWorkoutBtn').count(),1);assert.equal(await p.locator('#saveWorkoutBtn').evaluate(e=>getComputedStyle(e).position),'static');
 });
 await test('Both themes: history, charts, homonyms, tooltips, empty/error and trash',async()=>{
  for(const tone of ['light','dark']){
   await go('trainer','history');await theme(tone);await p.locator('.client-overview-card').first().click();await p.locator('#clientModal').getByRole('button',{name:'Ver progreso',exact:true}).click();await p.locator('.progress-point').first().waitFor();assert.equal(await p.locator('#clientProgressExercise option').count(),2);await p.locator('.progress-point').last().focus();await p.keyboard.press('Enter');await fit('#clientProgressModal .sheet');await contrast('#clientProgressModal label,#clientProgressModal select,#progressPointTooltip,#clientProgressModal .muted');await shot('chart-'+tone);
   await go('client','history');await theme(tone);await p.locator('#shared .routine .primary').click();await p.locator('.interior-session-list button').first().click();await p.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await p.locator('.history-summary').first().click();assert.equal(await p.locator('.history-session').count(),14);await shot('history-'+tone);await p.locator('.history-session').first().getByRole('button',{name:/Editar/}).click();await shot('history-editor-'+tone);await contrast('#trainModal label,#trainModal input,#trainModal .muted');
   for(const role of ['client','trainer']){await go(role,'trash');await theme(tone);await fit('#trash');await contrast('#trash .btn,#trash h3,#trash .muted');await shot(role+'-trash-'+tone)}
   await go('trainer','empty');await theme(tone);await p.locator('#tMine').click();await contrast('#mine .empty b,#mine .muted');await shot('empty-'+tone);
   await go('trainer','error');await theme(tone);await p.locator('#clients .error').waitFor();await contrast('#clients .error');await shot('error-'+tone);
   await go('trainer','loading');await theme(tone);await shot('loading-clients-'+tone);
  }
 });
 await test('Settings logout invokes existing immediate invalidation and preserves preference',async()=>{
  await go('client');await theme('dark');await p.evaluate(()=>{window.beforeEpoch=window.__workoutContextVersion||0;db.auth.signOut=()=>new Promise(r=>window.releaseLogout=r)});await p.locator('#app .settings-trigger').click();await p.locator('[data-settings-logout]').click();assert(await p.evaluate(()=>(window.__workoutContextVersion||0)>window.beforeEpoch));assert.equal(await p.locator('dialog[open]').count(),0);await p.evaluate(()=>releaseLogout({error:null}));await p.waitForFunction(()=>!simpleAuth.busy);assert.equal(await p.locator('#auth').getAttribute('data-screen'),'welcome');assert.equal(await p.evaluate(()=>simpleTheme.choice),'dark');assert.equal(await p.evaluate(()=>user),null);
 });
 await test('No JavaScript errors or fixture writes from theme/settings',()=>assert.deepEqual(errors,[]));
 await p.close();
 }}finally{await browser.close();}
}
const report={passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),literalToastMessages:new Set(literalToasts).size,results,shots};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
