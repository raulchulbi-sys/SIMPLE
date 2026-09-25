const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.SIMPLE_PUBLIC_URL||'http://127.0.0.1:4184/',publicMode=!!process.env.SIMPLE_PUBLIC_URL,out=path.join(__dirname,'results'),results=[],shots=[];fs.mkdirSync(out,{recursive:true});
const real=JSON.parse(fs.readFileSync(path.join(__dirname,'private/real-history.json')));
const write=()=>fs.writeFileSync(path.join(out,(publicMode?'public-':'')+'browser.json'),JSON.stringify({kind:publicMode?'Public assets with local isolated SDK, no remote data writes':'Local synthetic browser data',results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),shots},null,2));
async function go(p,role='trainer'){await p.goto(base+'?role='+role+'&state=history');if(publicMode)await p.addScriptTag({content:fs.readFileSync('tests/interior/preview-seed.js','utf8')});await p.waitForFunction(()=>window.previewReady);}
async function shot(p,name){const file=(publicMode?'public-':'')+name+'.png';await p.screenshot({path:path.join(out,file)});shots.push(file);}
async function setup(p){if(!publicMode)return;await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('supabase-js'))return r.fulfill({body:fs.readFileSync('tests/interior/mock-sdk.js'),contentType:'application/javascript'});if(u.origin===new URL(base).origin&&r.request().method()==='GET')return r.continue();return r.abort()});}
async function openTraining(p,role){if(role==='trainer'){await p.locator('#tMine').click();await p.locator('[data-open-routine]').first().click();await p.locator('.routine-day-train').first().click();}else{await p.locator('#shared .routine .primary').click();await p.locator('.interior-session-list button').first().click();}await p.locator('.rest-buttons').first().waitFor();}
async function installOrderFixture(p){
 await p.evaluate(()=>{const old=db.rpc.bind(db);window.orderWrites=[];window.orderFailure=false;
  db.rpc=(name,args)=>{if(!['reorder_my_routines_atomic','reorder_my_routine_days_atomic'].includes(name))return old(name,args);
   orderWrites.push({name,args});if(orderFailure)return Promise.resolve({data:null,error:{message:'Simulated order rejection'}});
   const routine=name==='reorder_my_routines_atomic',ids=routine?args.p_routine_ids:args.p_day_ids,rows=mock.tables[routine?'routines':'routine_days'],key=routine?'routine_order':'day_order';
   ids.forEach((id,i)=>rows.find(r=>r.id===id)[key]=i);localStorage.setItem('synthetic-order-db',JSON.stringify(mock.tables));return Promise.resolve({data:null,error:null});};
 });
}
async function drag(p,selector,from,to){const rows=p.locator(selector),handle=rows.nth(from).locator('.drag-handle').first();await handle.scrollIntoViewIfNeeded();const a=await handle.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();const target=await rows.nth(to).boundingBox();await p.mouse.move(a.x+a.width/2,target.y+(to>from?target.height-3:3),{steps:8});await p.mouse.up();await p.waitForTimeout(150);}
(async()=>{for(const engine of (process.env.CYCLE_ENGINES||'chromium,webkit').split(',')){
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
try{
for(const width of (process.env.CYCLE_WIDTHS||'320,360,390,430,1280').split(',').map(Number)){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce'}),p=await context.newPage(),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));await setup(p);
 const test=async(name,fn)=>{try{await fn();results.push({engine,width,name,pass:true})}catch(e){results.push({engine,width,name,pass:false,error:e.stack});console.error(engine,width,name,e.message)}write();};
 for(const role of ['client','trainer'])await test(role+' rest five columns, stable timer and dark document at top/scroll/modal/resume',async()=>{
  await go(p,role);await openTraining(p,role);const snapshot=await p.evaluate(()=>JSON.stringify(activeWorkout));
  for(const tone of ['light','dark']){
   await p.locator('#trainModal .settings-trigger').click();await p.locator('#settingsDialog label').filter({hasText:tone==='dark'?'Oscuro':'Claro'}).click();await p.keyboard.press('Escape');
   const color=tone==='dark'?'rgb(32, 36, 35)':'rgb(247, 245, 241)',hex=tone==='dark'?'#202423':'#f7f5f1';
   for(const scroll of [0,250]){await p.locator('#trainModal .sheet').evaluate((e,n)=>e.scrollTop=n,scroll);await p.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await p.waitForFunction(color=>getComputedStyle(document.documentElement).backgroundColor===color,color);const actual=await p.evaluate(()=>({html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,meta:document.querySelector('meta[name=theme-color]').content,scheme:getComputedStyle(document.documentElement).colorScheme}));assert.deepEqual(actual,{html:color,body:color,meta:hex,scheme:tone});}
   const rest=p.locator('.rest-buttons').first();await rest.scrollIntoViewIfNeeded();const b=await rest.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,rects:[...e.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}),page:document.documentElement.scrollWidth,inner:innerWidth}));
   assert.equal(b.rects.length,5);assert(b.scroll<=b.width+1,'rest row clips');assert(b.page<=b.inner,'page overflow');assert(b.rects.every(r=>r.w>=43.9&&r.h>=44));assert(Math.max(...b.rects.map(r=>r.w))-Math.min(...b.rects.map(r=>r.w))<1);assert(Math.max(...b.rects.map(r=>r.y))-Math.min(...b.rects.map(r=>r.y))<1);
   assert.equal(await p.evaluate(()=>JSON.stringify(activeWorkout)),snapshot);assert.equal(await p.locator('#saveWorkoutBtn').count(),1);assert.equal(await p.locator('#saveWorkoutBtn').evaluate(e=>getComputedStyle(e).position),'static');
   if([320,390,1280].includes(width))await shot(p,engine+'-'+width+'-'+role+'-rest-'+tone);
  }
  await p.locator('.rest-buttons').first().locator('button').nth(1).click();const timer=await p.evaluate(()=>{window.timerButton=document.querySelector('#restBox button');return document.getElementById('restBox').innerText});assert.match(timer,/1:5[89]|2:00/);await p.waitForTimeout(1100);assert(await p.evaluate(()=>timerButton===document.querySelector('#restBox button')));await p.locator('#restBox button').first().click();
  await go(p,role);assert.equal(await p.evaluate(()=>simpleTheme.choice),'dark');assert.equal(await p.locator('meta[name=theme-color]').getAttribute('content'),'#202423');assert.deepEqual(errors,[]);
 });
 await test('Graphs real read-only capture: five logical days, six exact aliases, periods and empty day',async()=>{
  await go(p);await p.evaluate(f=>{mock.tables.routine_days=f.days;mock.tables.routine_exercises=f.exercises;mock.tables.workouts=f.sessions;},real);
  await p.evaluate(()=>openClientRoutineProgress('b7ee910d-bc34-402c-b1a3-5cacceb29519','ba2d0a25-1844-45c1-9777-f0e1aa7aa392','PPL-UL'));
  assert.equal(await p.locator('#clientProgressPeriod').inputValue(),'all');assert.equal(await p.locator('#clientProgressDay option').count(),5);assert.equal(await p.locator('#clientProgressExercise option').count(),6);
  assert.equal(await p.locator('.progress-point').count(),4);for(const metric of ['reps','1rm','weight']){await p.locator('#clientProgressMetric').selectOption(metric);assert.equal(await p.locator('.progress-point').count(),4);}
  const selected=await p.locator('#clientProgressExercise').inputValue();await p.locator('#clientProgressPeriod').selectOption('month');assert.equal(await p.locator('#clientProgressExercise').inputValue(),selected);assert.equal(await p.locator('.progress-point').count(),4);await p.locator('#clientProgressPeriod').selectOption('all');
  if([390,1280].includes(width))await shot(p,engine+'-'+width+'-graph-confirmed');
  await p.locator('#clientProgressDay').selectOption(real.days[4].id);assert.equal(await p.locator('.progress-point').count(),0);assert.match(await p.locator('#clientProgressChart').innerText(),/No hay|Sin registros|sin registros|sin datos/i);
  assert.equal(await p.evaluate(()=>JSON.stringify(mock.tables.workouts)),JSON.stringify(real.sessions));assert.deepEqual(errors,[]);
 });
 if([320,390,1280].includes(width))await test('Compact routine/day modes, threshold, stable ghost, cancellation, arrows, order-only persistence and rollback',async()=>{
  await go(p);await installOrderFixture(p);await p.locator('#tMine').click();const before=await p.evaluate(()=>structuredClone(mock.tables));await p.locator('#routineReorderToggle').click();
  await p.waitForFunction(()=>document.getElementById('mine').classList.contains('routine-compact-mode'));
  assert.equal(await p.locator('#mine .routine-actions:visible').count(),0);assert.equal(await p.locator('#mine .weekly-routine-progress:visible').count(),0);
  const row=p.locator('.routine-sortable').first(),h=row.locator('.drag-handle');await h.scrollIntoViewIfNeeded();const a=await h.boundingBox(),height=(await row.boundingBox()).height;
  assert(height<=85);await p.mouse.move(a.x+20,a.y+20);await p.mouse.down();await p.mouse.move(a.x+22,a.y+22);assert.equal(await p.locator('.compact-reorder-placeholder').count(),0);const scroll=await p.evaluate(()=>document.scrollingElement.scrollTop);await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>document.scrollingElement.scrollTop),scroll);await p.mouse.move(a.x+20,a.y+35);
  assert.equal(await p.locator('.compact-reorder-placeholder').count(),1);assert(Math.abs((await p.locator('.compact-reorder-ghost').boundingBox()).height-height)<1);assert(Math.abs((await p.locator('.compact-reorder-placeholder').boundingBox()).height-height)<1);
  await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await p.locator('.compact-reorder-placeholder').count(),0);assert.equal(await p.evaluate(()=>orderWrites.length),0);
  await row.click();await p.locator('#mine .reorder-tools [data-move="1"]').click();await p.waitForFunction(()=>!window.__routineReordering);assert.equal(await p.evaluate(()=>routines[0].id),before.routines[1].id);
  await p.locator('#routineReorderToggle').click();await p.waitForFunction(()=>!document.getElementById('mine').classList.contains('routine-compact-mode'));assert.equal(await p.locator('#mine .routine-actions:visible').count(),2);await p.locator('#routineReorderToggle').click();
  await p.evaluate(()=>orderFailure=true);await p.locator('.routine-sortable').first().click();await p.locator('#mine .reorder-tools [data-move="1"]').click();await p.waitForFunction(()=>!window.__routineReordering);assert.equal(await p.evaluate(()=>routines[0].id),before.routines[1].id);await p.evaluate(()=>orderFailure=false);
  if(width===390)await shot(p,engine+'-'+width+'-routine-reorder');await p.locator('#routineReorderToggle').click();
  await p.locator('[data-open-routine="'+before.routines[0].id+'"]').click();await p.locator('button').filter({hasText:'Reordenar sesiones'}).click();await p.waitForFunction(()=>document.getElementById('clientSessionList').classList.contains('day-compact-mode'));
  assert.equal(await p.locator('#clientSessionList .routine-day-train:visible').count(),0);
  const first=await p.evaluate(()=>editDays[0].id);await p.locator('#clientSessionList .routine-editor-day').first().click();await p.locator('#clientSessionList .reorder-tools [data-move="1"]').click();await p.waitForFunction(()=>!__editorOrderSaving);assert.equal(await p.evaluate(()=>editDays[1].id),first);
  await p.locator('#clientSessionList .routine-editor-day').nth(1).click();await p.locator('#clientSessionList .reorder-tools [data-move="-1"]').click();await p.waitForFunction(()=>!__editorOrderSaving);assert.equal(await p.evaluate(()=>editDays[0].id),first);
  if(width===390)await shot(p,engine+'-'+width+'-days-reorder');
  const writes=await p.evaluate(()=>orderWrites);assert(writes.every(w=>Object.keys(w.args).every(k=>['p_routine_ids','p_routine_id','p_day_ids'].includes(k))));assert.equal(await p.evaluate(()=>JSON.stringify(mock.tables.routine_exercises)),JSON.stringify(before.routine_exercises));
  const persisted=await p.evaluate(()=>localStorage.getItem('synthetic-order-db'));await go(p);await p.evaluate(async data=>{mock.tables=JSON.parse(data);await reload();await renderMine();},persisted);assert.equal(await p.evaluate(()=>routines[0].id),before.routines[1].id);
  assert.deepEqual(errors,[]);
 });
 await context.close();
}
}finally{await browser.close();}}
write();console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),shots:shots.length}));if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{write();console.error(e);process.exitCode=1});
