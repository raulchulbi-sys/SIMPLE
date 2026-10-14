// Route/theme/navigation regression matrix on actual dist bytes. All backend data is synthetic.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const H=require('./browser-support.cjs'),dist=path.resolve(process.env.SIMPLE_CF_DIST||path.join(H.root,'dist')),out=path.join(__dirname,'results');
fs.mkdirSync(out,{recursive:true});
const rows=[],shots=[],widths=(process.env.SIMPLE_CF_WIDTHS||'320,360,390,430,768,1280').split(',').map(Number),engines=(process.env.SIMPLE_CF_ENGINES||'chromium,webkit').split(','),bases=(process.env.SIMPLE_CF_BASES||'/,/SIMPLE/').split(',');
function write(){const result={scope:'Actual dist frontend bytes with local mock SDK/data; no real Auth, OAuth, API, OpenAI or remote writes',dist,htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,'index.html'))).digest('hex'),runtimeSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,'assets/runtime-config.js'))).digest('hex'),passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass),results:rows,shots};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));return result;}
async function fit(p,selector){const g=await H.geometry(p,selector);assert(!g.overflow,'Document horizontal overflow');assert(g.boxes.every(b=>b.x>=-1&&b.right<=g.viewport+1),'Visible panel exceeds viewport');}
async function training(p,role){
 if(role==='client'){await p.locator('#shared .routine .primary').first().click();await p.locator('.interior-session-list button').first().click();}
 else{await p.locator('#tMine').click();await p.locator('[data-open-routine]').first().click();await p.locator('.routine-day-train').first().click();}
 await p.locator('.setrow').first().waitFor();
}
async function runCase(browser,engine,width,theme,base,origin){
 const label={engine,width,theme,path:new URL(base).pathname},context=await browser.newContext({viewport:{width,height:width===1280?900:844},reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(7000);
 const capture=await H.isolate(p,origin,theme);
 try{
  await H.go(p,base,'client');
  assert.equal(await p.evaluate(()=>simpleTheme.choice),theme);assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
  const config=await p.evaluate(()=>({url:cfSdkConfig.url,key:cfSdkConfig.key,runtime:globalThis.SimpleAppRuntime,frozen:Object.isFrozen(globalThis.SimpleAppRuntime)&&Object.isFrozen(globalThis.SimpleAppRuntime.allowedOrigins)}));
  assert(config.url&&config.key,'Runtime project config reaches SDK');assert(config.frozen);assert.deepEqual(config.runtime.allowedOrigins,[origin]);assert.equal(config.runtime.target,'local');assert.equal(config.runtime.environment,'staging');assert.equal(config.runtime.appUrl,base);assert.equal(config.url,'https://dmqjexigdnfzobarhnib.supabase.co');
  assert.match(await p.locator('#shared').innerText(),/2\/5 del ciclo actual/);assert.equal(await p.locator('#coachHome').count(),0,'Coach OFF remains absent');await fit(p,'#shared .card');
  await training(p,'client');assert.equal(await p.evaluate(()=>activeWorkout.day.id),'00000000-0000-4000-8000-000000000030');
  assert.equal(await p.locator('#saveWorkoutBtn').count(),1);assert.equal(await p.locator('#trainModal .workout-edit-name').count(),0,'Training remains separate from editor');
  await p.evaluate(()=>{updateSet(activeWorkout.exercises[0].id,0,'kg','31');updateSet(activeWorkout.exercises[0].id,0,'reps','9');saveWorkoutDraft();startRestTimer(120);});
  const preserved=await p.evaluate(()=>({id:activeWorkout.day.id,draft:localStorage.getItem(workoutDraftKey()),end:restEndAt,sets:JSON.stringify(activeWorkout.sets)}));
  assert(preserved.draft&&preserved.draft.includes('31'));assert(preserved.end>Date.now());
  await p.locator('#trainModal .settings-trigger').click();await p.locator('#settingsDialog label').filter({hasText:theme==='light'?'Oscuro':'Claro'}).click();await p.keyboard.press('Escape');
  assert.deepEqual(await p.evaluate(()=>({id:activeWorkout.day.id,draft:localStorage.getItem(workoutDraftKey()),end:restEndAt,sets:JSON.stringify(activeWorkout.sets)})),preserved,'Theme retains workout, draft and running timer');
  await fit(p,'#trainModal .sheet');
  await p.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await p.locator('.history-session').first().waitFor();assert.equal(await p.locator('.history-session').count(),14);
  await p.locator('#trainModalActions').getByRole('button',{name:'Cerrar',exact:true}).click();
  await p.evaluate(async()=>{const old=db.rpc;db.rpc=(name,args)=>name==='premium_my_access'?Promise.resolve({data:{enabled:true},error:null}):name==='premium_initial_my_state'?Promise.resolve({data:{enabled:false},error:null}):old(name,args);await renderShared();});
  await p.getByRole('button',{name:'Abrir seguimiento Premium',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Preparar mi entrenamiento',exact:true}).count(),0,'Initial OFF does not grant entry');
  await p.evaluate(()=>{db.auth.getSession=async()=>({data:{session:{user:{id:user.id}}},error:null});});await p.getByRole('button',{name:'Abrir seguimiento Premium',exact:true}).click();await p.locator('#premiumCoachDialog').getByRole('heading',{name:'Seguimiento Premium',exact:true}).waitFor();assert.match(await p.locator('#premiumCoachDialog').innerText(),/No hay una rutina propia disponible/);assert(await p.evaluate(()=>!!window.PremiumWeekly&&!window.PremiumWeeklyUI),'Weekly demo endpoint remains dormant');await p.evaluate(()=>premiumCoachDialog().close());
  await H.go(p,base,'trainer');await p.evaluate(()=>{for(const w of mock.tables.workouts)w.user_id=user.id;});assert.equal(await p.locator('.client-overview-card').count(),3);assert.match(await p.locator('.client-overview-card').first().innerText(),/2\/5 del ciclo actual/);await fit(p,'.client-overview-card');
  await p.locator('.client-overview-card').first().click();await p.locator('#clientModal.show').waitFor();assert.match(await p.locator('#clientModalTitle').innerText(),/Alejandra/);await p.locator('#clientModal').getByRole('button',{name:'Cerrar',exact:true}).click();
  await p.locator('#tMine').click();await p.locator('[data-open-routine]').first().click();await p.locator('#clientSessionList').waitFor();assert.equal(await p.locator('.routine-editor-day').count(),5);
  await p.locator('#clientSessionList').getByRole('button',{name:'Editar sesión',exact:true}).first().click();await p.locator('#daysEditor').waitFor();assert.equal(await p.evaluate(()=>editDays[0].id),'00000000-0000-4000-8000-000000000030');
  await p.getByRole('button',{name:'← Sesiones',exact:true}).click();await p.locator('.routine-day-train').first().click();await p.locator('.setrow').first().waitFor();assert.equal(await p.locator('#trainModal .workout-edit-name').count(),0);
  await p.locator('#trainModalActions').getByRole('button',{name:'← Sesiones',exact:true}).click();await p.locator('#clientSessionList').waitFor();
  await p.locator('#clientSessionList').getByRole('button',{name:'Historial',exact:true}).first().click();await p.locator('.history-session').first().waitFor();assert.equal(await p.evaluate(()=>window.__routineHistoryContext.dayId),'00000000-0000-4000-8000-000000000030');
  await p.locator('#trainModalActions').getByRole('button',{name:'← Sesiones',exact:true}).click();await p.getByRole('button',{name:'← Mis rutinas',exact:true}).click();await p.locator('#mine').getByRole('button',{name:'Progreso',exact:true}).first().click();await p.locator('#clientProgressModal.show').waitFor();
  assert.deepEqual(await p.locator('#clientProgressExercise option').evaluateAll(es=>es.map(e=>e.value)),['id:00000000-0000-4000-8000-000000000160','id:00000000-0000-4000-8000-000000000161'],'Current day exercise UUID selector remains exact');assert.equal(await p.locator('.progress-point').count(),14);await fit(p,'#clientProgressModal .sheet');
  if(engine==='chromium'&&[320,390,768,1280].includes(width)&&new URL(base).pathname==='/'){const file=`${engine}-${width}-${theme}-progress.png`;await p.screenshot({path:path.join(out,file),fullPage:true});shots.push(file);}
  assert.deepEqual(capture.errors,[],'No JavaScript errors');assert.deepEqual(capture.external,[],'No unexpected network/API dispatch');assert.deepEqual(capture.badResponses,[],'No missing built static routes');
  rows.push({...label,pass:true,coverage:['runtime config and base-relative resources','client/trainer routing','current cycle','UUID session editor isolation','local draft','rest timer across theme change','day history','current exercise progress','Coach OFF and legacy Premium entry']});
 }catch(e){rows.push({...label,pass:false,error:e.message,errors:capture.errors,badResponses:capture.badResponses,external:capture.external});console.error(JSON.stringify(rows.at(-1)));}
 finally{await context.close();write();}
}
(async()=>{const runtime=require('../../scripts/hosting-runtime.cjs'),port=Number(process.env.SIMPLE_CF_PORT||4280),origin='http://127.0.0.1:'+port;
 const server=H.serverFor(dist,{runtime:u=>u.pathname.startsWith('/SIMPLE/')?runtime.createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:origin+'/SIMPLE/'}}).javascript:fs.readFileSync(path.join(dist,'assets/runtime-config.js'))});await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{for(const engine of engines){const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{for(const route of bases)for(const width of widths)for(const theme of ['light','dark'])await runCase(browser,engine,width,theme,origin+route,origin);}finally{await browser.close();}}}finally{await new Promise(r=>server.close(r));}const report=write();console.log(JSON.stringify({passed:report.passed,failed:report.failed.length,report:path.join(out,'browser.json')}));if(report.failed.length)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1;});
