'use strict';
// Local production artifact at the planned HTTPS origin. Every request is fulfilled or aborted.
// Existing synthetic SDK/seed; no real Auth, JWT, OAuth, API, mail, provider or persistence proof.
// Usage: node tests/cloudflare/public-browser-simulation.cjs --artifactdir tests/cloudflare/results/public-release-.../dist
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const H=require('./browser-support.cjs');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= 'C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const playwright=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const args=process.argv.slice(2);
assert(args.length===2&&args[0]==='--artifactdir','Explicit --artifactdir required; this harness never builds');
const artifact=fs.realpathSync(path.resolve(args[1])),bounded=fs.realpathSync(path.join(__dirname,'results'));
assert(artifact.startsWith(bounded+path.sep),'Only an isolated ignored results artifact is accepted');
const origin='https://simple-raulchulbi.pages.dev',base=origin+'/',backend='https://yvguatdqncadkwewlepe.supabase.co';
const out=path.join(__dirname,'results'),rows=[],screenshots=[];let artifactStable=false;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const sdk=fs.readFileSync(path.join(H.root,'tests/interior/mock-sdk.js'),'utf8')
 .replace('createClient:()=>({','createClient:(url,key,options)=>{window.cfSdkConfig={url,key,options};return ({')
 // The legacy generic get_* fallback is an array; this RPC's SQL contract is boolean.
 .replace('mock.calls.push({rpc:name,args});let rows=[];',"mock.calls.push({rpc:name,args});if(name==='get_coach_reviewer_access')return Promise.resolve({data:false,error:null});let rows=[];")
 .replace(/\n\}\)\};\s*\n\}\)\(\);\s*$/,'\n})}};\n})();');
assert(sdk.includes("if(name==='get_coach_reviewer_access')return Promise.resolve({data:false,error:null})"),'Typed reviewer mock adapter required');
const inventory=[];
function collect(directory,prefix='',target=inventory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  assert(!entry.isSymbolicLink(),'Artifact symlink rejected');
  const relative=prefix+entry.name,absolute=path.join(directory,entry.name);
  if(entry.isDirectory())collect(absolute,relative+'/',target);
  else {assert(entry.isFile(),'Regular artifact files required');const bytes=fs.readFileSync(absolute);target.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});}
 }
}
collect(artifact);inventory.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);assert.equal(inventory.length,36,'Reviewed 36-file application artifact required');
const artifactHash=hash(JSON.stringify(inventory));
function write(){
 const report={kind:'16 grouped local production-artifact journeys; all HTTP intercepted with existing mock SDK and synthetic fixtures',
  artifact,artifactTreeSha256:artifactHash,artifactStable,htmlSha256:hash(fs.readFileSync(path.join(artifact,'index.html'))),runtimeSha256:hash(fs.readFileSync(path.join(artifact,'assets/runtime-config.js'))),mockSdkSha256:hash(sdk),seedSha256:hash(fs.readFileSync(path.join(H.root,'tests/interior/preview-seed.js'))),
  limits:['No public application deployment or real TLS/hosting header proof','Seed bootstrap is not password login or JWT verification','No real backend, OAuth, recovery, email, provider, saved workout or authorization proof','320/1280 only; 360/390/430 retain prior unchanged-UI coverage'],
  passed:rows.filter(row=>row.pass).length,failed:rows.filter(row=>!row.pass).length,results:rows,screenshots};
 fs.writeFileSync(path.join(out,'public-browser-simulation.json'),JSON.stringify(report,null,2));return report;
}
async function fit(page,selector){const value=await H.geometry(page,selector);assert(!value.overflow,'Document horizontal overflow');assert(value.boxes.length&&value.boxes.every(box=>box.x>=-1&&box.right<=value.viewport+1),'Visible content exceeds viewport');}
async function isolate(page,theme){
 const capture={errors:[],external:[],missing:[],resources:new Set(),settingsReads:0};
 page.on('pageerror',error=>capture.errors.push(error.message));page.on('dialog',dialog=>dialog.dismiss());
 await page.addInitScript(value=>localStorage.setItem('simple_theme_v1',value),theme);
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===backend&&url.pathname==='/auth/v1/settings'&&request.method()==='GET'){
   capture.settingsReads++;return route.fulfill({json:{external:{google:true,apple:false,facebook:false}}});
  }
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase-js')&&request.method()==='GET')return route.fulfill({body:sdk,contentType:'application/javascript'});
  if(url.origin===origin&&['GET','HEAD'].includes(request.method())){
   const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
   const absolute=path.resolve(artifact,relative);
   if(!relative.includes('%')&&!relative.includes('\\')&&absolute.startsWith(artifact+path.sep)&&inventory.some(file=>file.path===relative)){
    capture.resources.add(relative);
    const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain'};
    return route.fulfill({body:request.method()==='HEAD'?'':fs.readFileSync(absolute),contentType:mime[path.extname(relative)]||'application/octet-stream'});
   }
   capture.missing.push({path:url.pathname,method:request.method()});return route.fulfill({status:404,body:'Local artifact route absent'});
  }
  capture.external.push({origin:url.origin,path:url.pathname,method:request.method()});return route.abort();
 });
 return capture;
}
async function timerDraft(page,theme){
 assert.equal(await page.locator('#saveWorkoutBtn').count(),1,'Exactly one final workout save action');
 assert.equal(await page.locator('#trainModal .workout-edit-name').count(),0,'Training is separate from structure editing');
 const finalSave=await page.locator('#saveWorkoutBtn').evaluate(button=>button.parentElement===document.querySelector('#trainBody').lastElementChild);
 assert(finalSave,'Save action remains at the end of training content');
 assert.equal(await page.locator('#trainModal textarea[aria-label^="Notas de"]').count(),2,'Existing exercise note controls remain available; no note edit/autosave is dispatched');
 await page.evaluate(()=>{updateSet(activeWorkout.exercises[0].id,0,'kg','31');updateSet(activeWorkout.exercises[0].id,0,'reps','9');saveWorkoutDraft();startRestTimer(120);});
 const snapshot=()=>page.evaluate(()=>({day:activeWorkout.day.id,draft:localStorage.getItem(workoutDraftKey()),timer:restEndAt,sets:JSON.stringify(activeWorkout.sets)}));
 const before=await snapshot();assert(before.draft.includes('31'));assert(before.timer>Date.now());
 for(const label of [theme==='light'?'Oscuro':'Claro',theme==='light'?'Claro':'Oscuro']){
  await page.locator('#trainModal .settings-trigger').click();await page.locator('#settingsDialog label').filter({hasText:label}).click();await page.keyboard.press('Escape');
  assert.deepEqual(await snapshot(),before,'Theme navigation preserves UUID, existing note state, draft values and timer');
 }
 await fit(page,'#trainModal .sheet');
}
async function client(page,theme){
 assert.match(await page.locator('#shared').innerText(),/2\/5 del ciclo actual/);await fit(page,'#shared .card');
 await page.locator('#shared .routine .primary').first().click();assert.equal(await page.locator('.interior-session-list button').count(),5);
 await page.locator('.interior-session-list button').first().click();await page.locator('.setrow').first().waitFor();
 assert.equal(await page.evaluate(()=>activeWorkout.day.id),'00000000-0000-4000-8000-000000000030');
 await timerDraft(page,theme);
 await page.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await page.locator('.history-session').first().waitFor();
 assert.equal(await page.locator('.history-session').count(),14);
 const history=page.locator('.history-session').first();await history.locator(':scope > summary').click();await history.locator('.history-content').waitFor();
 assert.match(await history.innerText(),/Nota de ejemplo/);await fit(page,'#trainModal .sheet');
}
async function trainer(page,theme){
 assert.equal(await page.locator('.client-overview-card').count(),3);await fit(page,'.client-overview-card');
 await page.locator('.client-overview-card').first().click();await page.locator('#clientModal.show').waitFor();assert.match(await page.locator('#clientModalTitle').innerText(),/Alejandra/);
 await page.locator('#clientModal').getByRole('button',{name:'Ver progreso',exact:true}).first().click();await page.locator('#clientProgressModal.show').waitFor();
 await page.locator('.progress-point').first().waitFor();assert.equal(await page.locator('.progress-point').count(),14);assert.equal(await page.locator('#clientProgressExercise option').count(),2);await fit(page,'#clientProgressModal .sheet');
 await page.locator('#clientProgressModal').getByRole('button',{name:'Cerrar',exact:true}).click();await page.evaluate(()=>closeM('clientModal'));
 await page.locator('#tMine').click();assert.equal(await page.locator('#mine .routine').count(),2);
 await page.locator('#routineReorderToggle').click();await page.locator('#mine .reorder-tools').waitFor();
 const selected=page.locator('#mine .routine-sortable').first();await selected.focus();await selected.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#mine .reorder-tools [data-move="1"]')?.disabled===false);
 assert(await page.locator('#mine .reorder-tools').getByRole('button',{name:'Subir',exact:true}).isDisabled());assert(await page.locator('#mine .reorder-tools').getByRole('button',{name:'Bajar',exact:true}).isEnabled());
 await page.locator('#routineReorderToggle').click();
 await page.locator('[data-open-routine]').first().click();await page.locator('#clientSessionList').waitFor();assert.equal(await page.locator('.routine-editor-day').count(),5);
 await page.locator('#clientSessionList').getByRole('button',{name:'Editar sesión',exact:true}).first().click();await page.locator('#daysEditor').waitFor();
 assert.equal(await page.evaluate(()=>editDays[0].id),'00000000-0000-4000-8000-000000000030');
 await page.getByRole('button',{name:'← Sesiones',exact:true}).click();await page.locator('.routine-day-train').first().click();await page.locator('.setrow').first().waitFor();await timerDraft(page,theme);
}
async function run(browser,engine,role,width,theme){
 const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);
 const capture=await isolate(page,theme),row={engine,role,width,theme,pass:false};
 try{
  await H.go(page,base,role,'history');
  const config=await page.evaluate(()=>({target:SimpleAppRuntime.target,environment:SimpleAppRuntime.environment,appUrl:SimpleAppRuntime.appUrl,origins:SimpleAppRuntime.allowedOrigins,backend:cfSdkConfig.url,publicKeyMatches:cfSdkConfig.key===SimpleAppRuntime.supabasePublicKey,frozen:Object.isFrozen(SimpleAppRuntime)&&Object.isFrozen(SimpleAppRuntime.allowedOrigins),role:profile.role,id:user.id}));
  assert.equal(config.target,'production');assert.equal(config.environment,'production');assert.equal(config.appUrl,base);assert.equal(config.backend,backend);assert(config.publicKeyMatches&&config.frozen);
  assert(config.origins.length>=1&&config.origins.length<=2&&config.origins.includes(origin));assert(config.origins.every(value=>value===origin||/^https:\/\/[a-z0-9-]+\.simple-raulchulbi\.pages\.dev$/.test(value)),'Only stable/current-build production project origins');
  assert.equal(config.role,role);assert.equal(config.id,'00000000-0000-4000-8000-'+(role==='client'?'000000000002':'000000000001'));assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  const before=await page.evaluate(()=>JSON.stringify(mock.tables));
  assert.equal(await page.locator('#coachHome,#coachReviewerEntry,#premiumCoachReviewerEntry,#premiumInitialReviewerEntry').count(),0,'Mock absent capabilities do not create Coach/reviewer entry');
  await (role==='client'?client(page,theme):trainer(page,theme));
  assert.equal(await page.evaluate(()=>JSON.stringify(mock.tables)),before,'Read navigation and drafts do not alter synthetic identity/history tables');
  assert.equal(await page.evaluate(()=>mock.calls.filter(call=>call.write).length),0,'No mock data writes or fake save proof');
  assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.external,[]);assert.deepEqual(capture.missing,[]);
  assert(capture.resources.has('index.html')&&capture.resources.has('assets/runtime-config.js')&&capture.resources.has('assets/auth.js')&&capture.resources.has('assets/reorder.js'));
  row.resourceCount=capture.resources.size;row.mockSettingsReads=capture.settingsReads;row.mockTablesSha256=hash(before);
  const screenshot='public-browser-'+engine+'-'+role+'-'+width+'-'+theme+'.png';await page.screenshot({path:path.join(out,screenshot),fullPage:true});screenshots.push({file:screenshot,sha256:hash(fs.readFileSync(path.join(out,screenshot)))});row.pass=true;
 }catch(error){row.failure=error.message;row.errors=capture.errors;row.external=capture.external;row.missing=capture.missing;}
 finally{rows.push(row);await context.close();write();}
 return row;
}
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{for(const role of ['client','trainer'])for(const width of [320,1280])for(const theme of ['light','dark']){
   const row=await run(browser,engine,role,width,theme);if(!row.pass)throw new Error('Stopped at first diagnostic; inspect ignored public-browser-simulation.json before retrying');
  }}
  finally{await browser.close();}
 }
 const after=[];collect(artifact,'',after);after.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);assert.deepEqual(after,inventory,'Artifact changed during simulation');artifactStable=true;
 const report=write();assert.equal(rows.length,16);console.log(JSON.stringify({passed:report.passed,failed:report.failed,artifactTreeSha256:artifactHash,artifactStable,failedCases:rows.filter(row=>!row.pass)}));if(report.failed)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
