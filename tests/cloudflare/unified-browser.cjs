'use strict';
// Cross-component exercise of the actual dist bytes. Only the SDK and an explicit
// TEST runtime flag are doubles; external requests are fulfilled locally or blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {once}=require('node:events');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(require('node:os').homedir(),'Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {buildCommercial}=require('../../scripts/hosting-commercial-build.cjs'),{serverFor}=require('../../scripts/hosting-preview.cjs');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:4381',returnOrigin='https://simple-staging-raulchulbi.pages.dev';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const rows=[],evidence=[];let browser,server;
const check=(name,ok)=>{assert(ok,name);rows.push({name,pass:true});};
const owner='00000000-0000-4000-8000-000000001a01',id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const protectedTables=['routines','routine_days','routine_exercises','workouts','routine_user_notes','routine_assignments','routine_management','routine_revisions'];
const seed={profiles:[{id:owner,name:'Atleta sintético local',role:'client'}],routine_assignments:[],routine_management:[],routine_revisions:[],intake_health:[],coach_operations:[],coach_pilot_feedback:[],
 training_intakes:[{id:id(201),user_id:owner,revision:1,row_version:1,state:'submitted',training:{},created_at:'2026-10-01T12:00:00Z'}],
 context_grants:[{id:id(202),user_id:owner,scope:'training_intake',notice_version:'pilot-supervised-v2',revoked_at:null}],
 routines:[{id:id(101),owner_id:owner,name:'Rutina sintética preexistente',description:'Datos locales sin relación con usuarios reales.',deleted_at:null,routine_order:0}],
 routine_days:[{id:id(102),routine_id:id(101),name:'Lunes / PUSH',day_order:0}],
 routine_exercises:[{id:id(103),day_id:id(102),name:'Press con mancuernas',sets:3,target:'8–12',rir:'2',rest_seconds:120,exercise_order:0}],
 routine_user_notes:[{id:id(104),user_id:owner,routine_id:id(101),exercise_key:'exercise:'+id(103),note:'Nota sintética conservada',updated_at:'2026-10-01T12:00:00Z'}],
 workouts:[{id:id(105),user_id:owner,workout_date:'2026-10-01',created_at:'2026-10-01T12:00:00Z',data:{routine_id:id(101),routine_day_id:id(102),day_id:id(102),day_name:'Lunes / PUSH',duration_seconds:1800,exercises:[{exercise_id:id(103),name:'Press con mancuernas',sets:[{kg:20,reps:10,rir:2,done:true},{kg:20,reps:9,rir:2,done:true},{kg:20,reps:8,rir:2,done:true}],notes:'Nota histórica sintética'}]}}]};
const status={environment:'STRIPE_TEST',state:'active',plan:'basic',accessActive:true,monthlyCents:499,currency:'eur',paidUntil:'2070-12-01T16:41:13Z',nextBillingAt:'2070-12-01T16:41:13Z',cancelAtPeriodEnd:false,portalAvailable:true,canCheckout:false,aiQuotaChanged:false};
const capabilities={basicActive:true,basicGenerationEnabled:false,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true};
const appSDK=fs.readFileSync(path.join(root,'tests/interior/mock-sdk.js'),'utf8')+`\n(()=>{
 const c=supabase.createClient(),prior=c.rpc;window.unifiedCalls=[];
 const record=async call=>{unifiedCalls.push(call);await window.recordUnifiedCall(call);};
 const from=c.from;c.from=table=>{const q=from(table);for(const name of ['insert','update','upsert','delete'])q[name]=()=>{record({kind:'write',table,name});throw Error('Synthetic table write forbidden');};return q;};
 c.rpc=async(n,p={})=>{await record({kind:'rpc',name:n});
 if(n==='billing_test_capabilities')return {data:${JSON.stringify(capabilities)},error:null};
 if(n==='get_my_coach_access')return {data:{authorized:true,can_generate:false,premium:false,commercial:true,paidBasic:true,routine_id:null},error:null};
 if(n==='premium_my_access')return {data:{authorized:false,enabled:false},error:null};
 if(n==='premium_initial_my_state')return {data:{authorized:false,enabled:false},error:null};
 return prior(n,p);};
 c.functions={invoke:async(n,{body})=>{await record({kind:'edge',name:n,action:body.action});
 if(n!=='billing-test')throw Error('Unexpected provider dispatch');
 if(body.action==='status')return {data:${JSON.stringify(status)},error:null};
 if(body.action==='portal')return {data:{url:'https://billing.stripe.com/p/session/SYNTHETIC_UNIFIED_LOCAL'},error:null};
 throw Error('Unexpected billing mutation');}};
 supabase.createClient=()=>c;
})();`;
const returnSDK=`(()=>{let who=null;window.returnCalls=[];window.supabase={createClient:(url,options,config)=>{window.returnAuthOptions=config.auth;return {auth:{getUser:async()=>({data:{user:who}}),signInWithPassword:async()=>{who={id:${JSON.stringify(owner)}};return {data:{user:who},error:null}},signOut:async()=>{who=null;return {error:null}}},functions:{invoke:async(n,{body})=>{returnCalls.push({name:n,action:body.action});if(n!=='billing-test'||body.action!=='access')throw Error('Unexpected return action');return {data:{environment:'STRIPE_TEST',aiQuotaChanged:false,state:'active',plan:'basic',paidUntil:'2070-12-01T16:41:13Z'},error:null}}}}}}})();`;
async function main(){
 const artifact=buildCommercial({target:'local',env:{SIMPLE_APP_URL:origin+'/'}}),runtimePath=path.join(artifact.output,'assets/runtime-config.js'),runtime=fs.readFileSync(runtimePath,'utf8'),runtimeHash=hash(runtime);
 const rules=[];let current;
 for(const line of fs.readFileSync(path.join(artifact.output,'_headers'),'utf8').split(/\r?\n/)){
  if(!line.trim()||line.startsWith('#'))continue;
  if(!/^\s/.test(line)){current={route:line.trim(),headers:{}};rules.push(current);}
  else if(current&&line.includes(':')){const at=line.indexOf(':');current.headers[line.slice(0,at).trim()]=line.slice(at+1).trim();}
 }
 const returnHeaders=pathname=>Object.assign({},...rules.filter(r=>r.route==='/*'||r.route===pathname||r.route==='/assets/*'&&pathname.startsWith('/assets/')).map(r=>r.headers));
 server=serverFor(artifact.output);server.listen(4381,'127.0.0.1');await once(server,'listening');
 try{for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[],requests=[],calls=[];
  await page.exposeFunction('recordUnifiedCall',call=>calls.push(call));
  let optIn=false;page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());requests.push({origin:url.origin,path:url.origin===origin?url.pathname:'intercepted',method:req.method()});
   if(url.origin===origin&&req.method()==='GET'){
    if(optIn&&url.pathname==='/assets/runtime-config.js')return route.fulfill({contentType:'application/javascript',body:runtime.replace('"target":"local"','"billingTest":true,"target":"local"')});
    return route.continue();
   }
   if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0')return route.fulfill({contentType:'application/javascript',body:req.frame().url().startsWith(returnOrigin)?returnSDK:appSDK});
   if(url.href==='https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/settings')return route.fulfill({json:{external:{google:false,apple:false}}});
   if(url.href==='https://billing.stripe.com/p/session/SYNTHETIC_UNIFIED_LOCAL')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Portal simulado offline</h1><a href="'+returnOrigin+'/billing-test.html?plan=premium">Volver a SIMPLE</a>'});
   if(url.origin===returnOrigin&&req.method()==='GET'&&['/billing-test.html','/assets/billing-return.css','/assets/billing-return.js','/assets/billing-return-model.mjs'].includes(url.pathname))return route.fulfill({headers:returnHeaders(url.pathname),contentType:url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(artifact.output,url.pathname.slice(1)))});
   blocked.push(url.origin);return route.abort();
  });
  const load=async()=>{await page.goto(origin+'/?billingTest=true&plan=premium');await page.waitForFunction(()=>typeof start==='function'&&typeof simpleAuth!=='undefined'&&!simpleAuth.busy);await page.evaluate(async seed=>{mock.tables=structuredClone(seed);user={id:seed.profiles[0].id,email:'synthetic@example.invalid'};await start();},seed);};
  const settings=()=>page.locator('#app header .settings-trigger').click();
  const subscribe=async()=>{await settings();await page.locator('[data-subscription-open]').click();await page.getByRole('heading',{name:'Tu plan está activo'}).waitFor();};
  const readProtected=()=>page.evaluate(names=>Object.fromEntries(names.map(n=>[n,mock.tables[n]])),protectedTables);
  const label=s=>engine+' '+s;
  await load();await settings();
  check(label('actual runtime stays immutable and query cannot enable billing'),await page.evaluate(()=>Object.isFrozen(SimpleAppRuntime)&&SimpleAppRuntime.billingTest!==true)&&await page.locator('[data-subscription-open]').count()===0);
  optIn=true;await load();const before=await readProtected();await subscribe();
  check(label('test-only runtime override retains real origin verification'),await page.evaluate(()=>SimpleAppRuntime.appOrigin===location.origin&&Object.isFrozen(SimpleAppRuntime)&&SimpleAppRuntime.billingTest===true));
  check(label('subscription reads Basic price and paid period'),await page.locator('.subscription-details').innerText().then(t=>t.includes('Basic')&&t.includes('4,99 €')&&t.includes('2070')));
  check(label('paid Basic does not open generation or Premium'),await page.locator('.subscription-dialog').innerText().then(t=>t.includes('todavía no está habilitada'))&&await page.getByRole('button',{name:'Abrir SIMPLE Coach',exact:true}).count()===0&&await page.getByRole('button',{name:'Probar Premium en TEST'}).count()===0);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.evaluate(()=>openSimpleCoach());await page.locator('#coachBegin').click();await page.locator('#coachRecoverRefresh').waitFor();
  check(label('uncertain submitted generation enters read-only recovery'),await page.evaluate(()=>unifiedCalls.every(x=>x.kind!=='edge'||x.name==='billing-test'&&x.action==='status')));
  await load();await page.evaluate(()=>openSimpleCoach());await page.locator('#coachBegin').click();await page.locator('#coachRecoverRefresh').waitFor();
  check(label('full reload recovers uncertainty without new provider invocation'),await page.locator('#coachRecoverRefresh').isVisible()&&await page.evaluate(()=>unifiedCalls.every(x=>x.kind!=='edge'||x.name==='billing-test'&&x.action==='status')));
  await page.evaluate(({op,owner,intake})=>mock.tables.coach_operations.push({id:op,user_id:owner,intake_id:intake,state:'pending_review',prompt_version:'basic-initial-v5',created_at:'2026-10-01T12:01:00Z'}),{op:id(203),owner,intake:id(201)});
  await page.locator('#coachRecoverRefresh').click();await page.locator('#coachRefresh').waitFor();
  check(label('pending review is recovered without approval or acceptance'),await page.locator('#coachOperationHeading').innerText().then(t=>t.includes('revisada'))&&await page.locator('#coachAccept').count()===0&&await page.evaluate(()=>mock.tables.coach_operations[0].state==='pending_review'));
  await page.evaluate(async rid=>{document.getElementById('coachDialog').close();await openSharedRoutine(rid);},id(101));await page.evaluate(day=>startWorkoutDay(day),id(102));await page.locator('#saveWorkoutBtn').waitFor();
  check(label('preexisting exercise UUID and prescriptions remain visible'),await page.locator('#trainBody').innerText().then(t=>t.includes('Press con mancuernas')&&t.includes('8–12'))&&await page.evaluate(e=>activeWorkout.exercises[0].id===e&&activeWorkout.exercises[0].sets===3&&activeWorkout.exercises[0].rir==='2'&&activeWorkout.exercises[0].rest_seconds===120,id(103)));
  check(label('preexisting personal note is recovered by exercise UUID'),await page.evaluate(e=>activeWorkout.sets[e].note==='Nota sintética conservada',id(103))&&await page.getByRole('textbox',{name:'Notas de Press con mancuernas',exact:true}).inputValue()==='Nota sintética conservada');
  await page.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await page.locator('.history-session').waitFor();
  check(label('preexisting workout is readable in actual history UI'),await page.locator('.history-session').innerText().then(t=>t.includes('Lunes / PUSH'))&&await page.evaluate(w=>workoutHistory.some(x=>x.id===w),id(105)));
  const after=await readProtected();check(label('routine history prescriptions notes retain exact before/after hash'),hash(JSON.stringify(before))===hash(JSON.stringify(after)));
  const counters={writes:calls.filter(c=>c.kind==='write').length,forbidden:calls.filter(c=>c.kind==='rpc'&&/^(?:accept|review|authorize|save|set|decline)/.test(c.name)).length,provider:calls.filter(c=>c.kind==='edge'&&c.name!=='billing-test').length};
  check(label('no writes accept review retry or provider invocation'),Object.values(counters).every(n=>n===0));
  await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());closeM('trainModal');});await subscribe();
  const portalCallsBefore=await page.evaluate(()=>unifiedCalls.filter(c=>c.action==='portal').length);await page.getByRole('button',{name:'Gestionar suscripción y facturas'}).click();await page.getByRole('heading',{name:'Portal simulado offline'}).waitFor();
  check(label('actual subscription navigation reaches intercepted official Portal origin'),new URL(page.url()).origin==='https://billing.stripe.com'&&portalCallsBefore===0&&calls.filter(c=>c.kind==='edge'&&c.action==='portal').length===1);
  await page.getByRole('link',{name:'Volver a SIMPLE'}).click();await page.locator('#login').waitFor();await page.waitForFunction(()=>window.returnAuthOptions);
  check(label('exact return artifact requires own memory-only auth after origin change'),await page.locator('#account').isHidden()&&await page.evaluate(()=>returnAuthOptions.persistSession===false&&returnAuthOptions.autoRefreshToken===false&&returnAuthOptions.detectSessionInUrl===false));
  await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#password').fill('SYNTHETIC_NOT_A_CREDENTIAL');await page.locator('#login button').click();await page.getByText('SIMPLE Basic activo',{exact:true}).waitFor();
  check(label('HTTPS return verifies Basic without trusting premium query'),new URL(page.url()).origin===returnOrigin&&new URL(page.url()).search===''&&await page.locator('#state').innerText()==='SIMPLE Basic activo'&&await page.evaluate(()=>returnCalls.every(c=>c.name==='billing-test'&&c.action==='access')));
  await page.locator('#logout').click();await page.locator('#login').waitFor();
  check(label('synthetic return session closes and no external request escaped'),await page.locator('#account').isHidden()&&blocked.length===0&&errors.length===0);
  evidence.push({engine,version:browser.version(),protectedBeforeSha256:hash(JSON.stringify(before)),protectedAfterSha256:hash(JSON.stringify(after)),counters,errors,blocked,requests:requests.length});
  await context.close();await browser.close();browser=null;
 }
 check('on-disk artifact runtime was never changed by test opt-in',hash(fs.readFileSync(runtimePath))===runtimeHash);
 const report={kind:'actual built artifact; synthetic SDK and explicit test-only runtime interception; HTTPS Portal and return fulfilled locally',realJWT:false,connectedServices:false,passed:rows.length,failed:0,artifact:artifact.treeSha256,runtimeSha256:runtimeHash,results:rows,evidence};
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/unified-browser-20261104.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
