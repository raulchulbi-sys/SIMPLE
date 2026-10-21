'use strict';
// Minimal lifecycle regressions. Every browser request is fulfilled/aborted.
// In-memory identity-shaped stubs only: no SDK session, JWT, server or live API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const ORIGIN='https://reviewer-regression.invalid';
const SCRIPTS=['coach-intake.js','coach-programming-v4.js','coach-programming-v5.js','coach.js','coach-premium-prescription.js','coach-premium-weekly.js','coach-premium-chat.js','coach-premium-adapter.js','coach-premium-app.js','coach-reviewer.js'];
const CHANGED=new Set(['coach.js','coach-premium-adapter.js','coach-reviewer.js']);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ids={reviewer:id(1),nextUser:id(2),meso:id(3),revision:id(4),nextRevision:id(5),rec:id(6),week:id(7)};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function sdk(){
 const callbacks=new Set();globalThis.__authId='00000000-0000-4000-8000-000000000001';
 globalThis.__emitIdentity=(event,next)=>{globalThis.__authId=next;globalThis.user=next?{id:next}:null;for(const fn of [...callbacks])fn(event,next?{user:{id:next}}:null);};
 const call=spec=>globalThis.__security19Request(spec);
 globalThis.db={auth:{async getSession(){return{data:{session:globalThis.__authId?{user:{id:globalThis.__authId}}:null},error:null};},onAuthStateChange(fn){callbacks.add(fn);return{data:{subscription:{unsubscribe(){callbacks.delete(fn);}}}};}},rpc:(name,args={})=>call({op:'rpc',name,args}),from(table){const spec={op:'table',table,filters:{}};let single=false;return{select(columns){spec.columns=columns;return this;},eq(k,v){spec.filters[k]=v;return this;},is(k,v){spec.filters[k]=v;return this;},in(k,v){spec.filters[k]=v;return this;},order(){return this;},maybeSingle(){single=true;return this;},then(resolve,reject){return call(spec).then(result=>single&&!result.error?{...result,data:result.data[0]||null}:result).then(resolve,reject);}};},functions:{async invoke(){throw Error('provider_forbidden');}}};
 globalThis.user={id:globalThis.__authId};globalThis.profile={role:'trainer'};globalThis.SUPABASE_URL='https://dmqjexigdnfzobarhnib.supabase.co';
 globalThis.$=key=>document.getElementById(key);globalThis.esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function projected(revision){return{actor:'reviewer',mesocycle:{id:ids.meso,number:1,planned_weeks:4,state:'active',current_revision_id:revision,tracking_week:1},weeks:[{id:ids.week,week_number:1,state:'active',revision_id:revision}],recommendations:[{id:ids.rec,mesocycle_id:ids.meso,base_revision_id:revision,kind:'MODIFY',state:'ready',facts:[{exercise_name:'SYNTHETIC exercise',claim:'insufficient_data'}],quality_warnings:['SYNTHETIC PUBLIC WARNING'],interpretation:'SYNTHETIC PUBLIC '+revision,patches:[{field:'rest_seconds',exercise_name:'SYNTHETIC exercise',from:180,to:210}]}]};}
const clone=v=>structuredClone(v);
function server(){
 const calls=[];let mode='allowed',revision=ids.revision,hold=null;
 return{calls,setMode:v=>{mode=v;},setRevision:v=>{revision=v;},arm(){assert.equal(hold,null);let heldResolve,release;const held=new Promise(r=>heldResolve=r),delivery=new Promise(r=>release=r);hold={heldResolve,delivery};return{held,release};},async dispatch(spec){
  calls.push(clone(spec));let result;
  if(spec.op==='table'){if(spec.table==='profiles')result={data:[{id:spec.filters.id,role:'trainer'}],error:null};else if(spec.table==='coach_mesocycles'||spec.table==='coach_recommendations')result={data:[],error:null};else throw Error('unexpected_private_table');}
  else{assert.equal(spec.op,'rpc');assert.equal(spec.name,'premium_reviewer_state');result=mode==='missing'?{data:null,error:{code:'PGRST202'}}:mode==='denied'?{data:null,error:{code:'42501',message:'premium_not_authorized'}}:{data:spec.args.p_mesocycle===null?{actor:'reviewer',scopes:[{id:ids.meso,number:1,state:'active'}]}:projected(revision),error:null};}
  const frozen=clone(result);if(hold&&spec.op==='rpc'&&spec.args.p_mesocycle===ids.meso){const h=hold;hold=null;h.heldResolve();await h.delivery;}return frozen;
 }};
}
async function run({sourceRoot,legacyRepoRoot=sourceRoot,legacyCommit,output,resume=false}){
 assert(/^[a-f0-9]{40}$/.test(legacyCommit),'Explicit legacy commit required; never fetch it');
 const files=new Map(SCRIPTS.map(name=>['/assets/'+name,fs.readFileSync(path.join(sourceRoot,'assets',name))]));
 const legacy=new Map(files);for(const name of CHANGED)legacy.set('/assets/'+name,execFileSync('git',['-C',legacyRepoRoot,'show',legacyCommit+':assets/'+name],{stdio:['ignore','pipe','pipe'],maxBuffer:2*1024*1024}));
 const html=Buffer.from('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><main id="app"><div id="shared"></div></main>'+SCRIPTS.map(n=>'<script src="/assets/'+n+'"></script>').join('')+'<script>globalThis.testReady=true;</script></body></html>');
 const modulePath=process.env.SIMPLE_TEST_PLAYWRIGHT_MODULE||'C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
 if(!process.env.PLAYWRIGHT_BROWSERS_PATH)process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
 const browser=await require(modulePath).chromium.launch({channel:'msedge',headless:true});
 const previous=resume?JSON.parse(fs.readFileSync(output,'utf8')):null;
 if(previous){assert.equal(previous.legacyCommit,legacyCommit);assert(previous.rows.some(r=>!r.pass));for(const [name,b] of files)if(CHANGED.has(path.basename(name)))assert.equal(previous.sourceHashes[name],sha(b));fs.writeFileSync(path.join(path.dirname(output),'first-browser-diagnostic.json'),JSON.stringify(previous,null,2)+'\n');}
 const rows=previous?previous.rows.filter(r=>r.pass):[],blocked=[],errors=[];
 async function open(context,version,state){
  const page=await context.newPage();await page.exposeBinding('__security19Request',(_source,spec)=>state.dispatch({...spec,testVersion:version}));await page.addInitScript(sdk);
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==ORIGIN){blocked.push(sha(u.href));await route.abort();return;}const b=u.pathname==='/'?html:(version==='old'?legacy:files).get(u.pathname);if(!b){if(u.pathname==='/favicon.ico'){await route.fulfill({status:204,body:''});return;}blocked.push(sha(u.href));await route.abort();return;}await route.fulfill({status:200,contentType:u.pathname.endsWith('.js')?'text/javascript':'text/html',body:b});});
  page.on('pageerror',e=>errors.push(sha(e.message)));await page.goto(ORIGIN+'/');await page.waitForFunction(()=>globalThis.testReady===true);return page;
 }
 async function check(name,fn){if(rows.some(r=>r.name===name&&r.pass))return;const context=await browser.newContext({viewport:{width:1280,height:844},serviceWorkers:'block'});try{await fn(context);rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e.name==='AssertionError'?'assertion_failed':e.message.replace(/[^a-z0-9_ -]/gi,'').slice(0,100)});}finally{await context.close();}}
 async function attach(page){await page.evaluate(m=>openPremiumCoach({mesocycleId:m}),ids.meso);await page.waitForFunction(()=>simpleCoachPremium.controller?.enabled===true);}
 async function held(value){let timer;try{await Promise.race([value,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('held_response_timeout')),10000);})]);}finally{clearTimeout(timer);}}
 try{
  await check('two tabs with old/new consumers: legacy private REST is empty while new server-projection UI remains useful',async context=>{
   const state=server(),old=await open(context,'old',state),fresh=await open(context,'new',state);
   await old.evaluate(()=>renderPremiumCoachReviewerEntry(user.id));await fresh.evaluate(()=>renderPremiumCoachReviewerEntry(user.id));
   assert.equal(await old.locator('#premiumCoachReviewerEntry').count(),0);assert.equal(await fresh.locator('#premiumCoachReviewerEntry').count(),1);
   await old.evaluate(m=>openPremiumCoach({mesocycleId:m}),ids.meso);assert.equal(await old.locator('#premiumCoachHost [role=alert]').count(),1);
   await attach(fresh);await fresh.evaluate(()=>simpleCoachPremium.controller.navigate('analysis'));await fresh.locator('#premiumCoachHost [data-action=proposal]').click();
   assert((await fresh.locator('#premiumCoachHost').innerText()).includes('SYNTHETIC PUBLIC'));assert((await fresh.locator('#premiumCoachHost').innerText()).includes('Antes'));
   assert.equal(state.calls.filter(c=>c.testVersion==='old'&&c.table==='coach_mesocycles').length,2);assert(state.calls.filter(c=>c.testVersion==='new'&&c.op==='table').every(c=>c.table==='profiles'));const freshState=await fresh.evaluate(()=>simpleCoachPremium.controller.snapshot().view);assert.equal(freshState.actor,'reviewer');assert.equal(freshState.recommendations[0].changes[0].before,180);assert.equal(freshState.recommendations[0].changes[0].after,210);
  });
  await check('actual direct host denies missing/forbidden reviewer RPC without mounting or private REST fallback',async context=>{
   for(const mode of ['missing','denied']){const state=server();state.setMode(mode);const page=await open(context,'new',state);await page.evaluate(m=>openPremiumCoach({mesocycleId:m}),ids.meso);assert.equal(await page.locator('#premiumCoachHost [role=alert]').count(),1);assert.equal(await page.evaluate(()=>simpleCoachPremium.controller),null);assert(state.calls.every(c=>c.op==='rpc'&&c.name==='premium_reviewer_state'));await page.close();}
  });
  await check('a delayed host precheck cannot mount the previous user after a local identity switch',async context=>{
   const state=server(),page=await open(context,'new',state),gate=state.arm();try{
    await page.evaluate(m=>{globalThis.pendingOpen=openPremiumCoach({mesocycleId:m});},ids.meso);await held(gate.held);
    await page.evaluate(next=>__emitIdentity('SIGNED_IN',next),ids.nextUser);gate.release();await page.evaluate(()=>globalThis.pendingOpen);
    assert.equal(await page.evaluate(()=>simpleCoachPremium.controller),null);assert(!(await page.locator('#premiumCoachHost').innerText()).includes('SYNTHETIC PUBLIC'));assert.equal(state.calls.length,1);
   }finally{gate.release();}
  });
  await check('held component replies stay discarded after logout/login for same or different identity and cannot replace the new view',async context=>{
   for(const nextUser of [ids.reviewer,ids.nextUser]){const state=server(),page=await open(context,'new',state);await attach(page);const gate=state.arm();try{
    await page.evaluate(()=>{globalThis.oldController=simpleCoachPremium.controller;globalThis.pendingLoad=oldController.load();});await held(gate.held);
    await page.evaluate(()=>__emitIdentity('SIGNED_OUT',null));await page.waitForFunction(()=>!premiumCoachDialog().open&&premiumCoachDialog().childElementCount===0);
    state.setRevision(ids.nextRevision);await page.evaluate(next=>__emitIdentity('SIGNED_IN',next),nextUser);await attach(page);
    const before=await page.locator('#premiumCoachHost').innerHTML();gate.release();assert.equal(await page.evaluate(()=>globalThis.pendingLoad),false);
    assert.equal(await page.locator('#premiumCoachHost').innerHTML(),before);assert.equal(await page.evaluate(()=>simpleCoachPremium.controller===oldController),false);const view=await page.evaluate(()=>simpleCoachPremium.controller.snapshot().view);assert.equal(view.user_id,nextUser);assert.equal(view.mesocycle.revision_id,ids.nextRevision);
   }finally{gate.release();await page.close();}}
  });
 }finally{await browser.close();}
 const report={kind:'new deterministic offline lifecycle regressions; fake server/identity only, not JWT/RLS/Auth evidence',legacyCommit,sourceRoot,sourceHashes:Object.fromEntries([...files].filter(([name])=>CHANGED.has(path.basename(name))).map(([name,b])=>[name,sha(b)])),legacyHashes:Object.fromEntries([...legacy].filter(([name])=>CHANGED.has(path.basename(name))).map(([name,b])=>[name,sha(b)])),rows,passed:rows.filter(r=>r.pass).length,total:rows.length,blockedAttempts:blocked.length,pageErrors:errors.length,realNetworkRequests:0,sessionsCreated:0,backendWrites:0,priorDiagnostics:previous?['Initial two-tab test used navigate(proposal) without selecting a proposal; changed to real analysis/proposal click. Legacy SDK stub also gained its missing maybeSingle so old-UI denial comes from empty REST, not a stub TypeError. Only failed two-tab case retried; other source hashes unchanged.']:[],limitations:['Chromium semantic lifecycle only, no new responsive/visual matrix','Closed backend behavior is an explicit mock; real historical four coverages are reused separately','Old/new files are real committed/local sources; browser requests are all fulfilled or aborted','No token copied or stored between tabs/origins; test identities are invented'],};
 assert.equal(blocked.length,0);assert.equal(errors.length,0);
 if(output){const target=path.resolve(output);assert(/[\\/]tests[\\/].*[\\/](?:private|results)[\\/].+\.json$/.test(target));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');}
 return report;
}
module.exports={run};
if(require.main===module){const args=process.argv.slice(2),v={};for(let i=0;i<args.length;i+=2){assert(['--source-root','--legacy-repo-root','--legacy-commit','--output','--resume'].includes(args[i])&&args[i+1]&&!v[args[i]]);v[args[i]]=args[i+1];}assert(v['--source-root']&&v['--legacy-commit']&&v['--output']);assert(v['--resume']===undefined||v['--resume']==='true');run({sourceRoot:path.resolve(v['--source-root']),legacyRepoRoot:v['--legacy-repo-root']?path.resolve(v['--legacy-repo-root']):path.resolve(v['--source-root']),legacyCommit:v['--legacy-commit'],output:v['--output'],resume:v['--resume']==='true'}).then(r=>{console.log(JSON.stringify({passed:r.passed,total:r.total,rows:r.rows,realNetworkRequests:r.realNetworkRequests,sessionsCreated:r.sessionsCreated}));if(r.passed!==r.total)process.exitCode=1;}).catch(()=>{console.error('offline_lifecycle_regression_failed');process.exitCode=1;});}
