'use strict';
// Full application, synthetic SDK. Count *entry* into rpc(), before any HTTP exists.
// All browser requests are fulfilled locally; no real Auth or connected backend.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),origin='https://readonly-basic.invalid';
const baseline=process.argv.includes('--baseline'),read=n=>baseline&&['assets/coach.js','assets/coach-premium-initial.js','assets/coach-premium-initial-adapter.js'].includes(n)?require('node:child_process').execFileSync('git',['show','8086008:'+n],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,n),'utf8');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(os.homedir(),'Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const people={mock:{id:id(701),email:'mock@example.invalid',role:'client'},real:{id:id(702),email:'real@example.invalid',role:'client'}};
const runtime={target:'mock',environment:'staging',appUrl:origin+'/',appOrigin:origin,basePath:'/',supabaseUrl:'https://dmqjexigdnfzobarhnib.supabase.co',supabasePublicKey:'SYNTHETIC_NOT_A_KEY',billingTest:true,billingValidationReadOnly:true};
const sdk=read('tests/interior/mock-sdk.js')+`
(()=>{const people=${JSON.stringify(people)},original=supabase.createClient;
supabase.createClient=()=>{const c=original(),baseRpc=c.rpc,listeners=[];
 const who=()=>people[localStorage.getItem('readonly-synthetic-actor')]||null;
 const note=(kind,name)=>{window.readonlySDKCalls??=[];const call={kind,name,owner:who()?.id||null};readonlySDKCalls.push(call);window.noteSDKCall(call);};
 window.expireSyntheticSession=()=>{window.expiredSynthetic=true;};
 window.restoreSyntheticSession=()=>{window.expiredSynthetic=false;};
 window.fireSyntheticSignout=()=>{localStorage.removeItem('readonly-synthetic-actor');listeners.forEach(fn=>fn('SIGNED_OUT',null));};
 c.auth={getSession:async()=>({data:{session:!window.expiredSynthetic&&who()?{user:who()}:null}}),getUser:async()=>({data:{user:!window.expiredSynthetic?who():null}}),onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}}}};},
 signInWithPassword:async({email})=>{const actor=Object.keys(people).find(k=>people[k].email===email);if(!actor)return{error:{message:'synthetic account missing'}};localStorage.setItem('readonly-synthetic-actor',actor);window.expiredSynthetic=false;return{data:{user:who(),session:{user:who()}},error:null};},
 signOut:async()=>{window.fireSyntheticSignout();return{error:null};}};
 mock.tables={profiles:Object.values(people),routines:[],routine_assignments:[],routine_management:[],workouts:[],routine_revisions:[],routine_user_notes:[]};
 c.rpc=async(name,args)=>{note('rpc',name);
  if(name==='get_my_coach_access')return{data:{authorized:who()?.id===people.mock.id,can_generate:false,routine_id:null},error:null};
  if(name==='premium_my_access'){if(window.holdPremiumAccess)await new Promise(r=>window.releasePremiumAccess=r);return{data:{enabled:window.syntheticPremiumEnabled===true},error:null};}
  if(name==='premium_initial_my_state')return{data:{enabled:false},error:null};
  if(name==='premium_initial_review_queue')return{data:[],error:null};
  if(name==='get_coach_reviewer_access')return{data:false,error:null};
  if(name==='billing_test_capabilities')return{data:{basicActive:who()?.id===people.mock.id,basicGenerationEnabled:false,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true},error:null};
  return baseRpc(name,args);};
 c.functions={invoke:async(name,{body})=>{note('edge',body.action);if(name!=='billing-test'||body.action!=='status')throw Error('unexpected synthetic action');if(!who()||window.expiredSynthetic)return{error:{message:'not_authenticated'}};const active=who().id===people.mock.id;return{data:{environment:'STRIPE_TEST',state:active?'active':'none',plan:active?'basic':null,accessActive:active,monthlyCents:active?499:null,currency:'eur',paidUntil:active?'2070-12-01T16:41:13Z':null,nextBillingAt:null,cancelAtPeriodEnd:false,portalAvailable:active,canCheckout:!active,aiQuotaChanged:false},error:null};}};
 return c;};})();`;
const checks=[],runs=[];
async function main(){fs.mkdirSync(out,{recursive:true});for(const [engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of[390,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await ctx.newPage(),calls=[],errors=[],external=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));await p.exposeFunction('noteSDKCall',call=>calls.push(call));
 await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'){external.push('nonGET');return r.abort();}
 if(u.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0')return r.fulfill({contentType:'application/javascript',body:sdk});
 if(u.href==='https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/settings')return r.fulfill({json:{external:{google:false,apple:false}}});
 if(u.origin!==origin){external.push(u.origin);return r.abort();}
 const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
 if(name==='assets/runtime-config.js')return r.fulfill({contentType:'application/javascript',body:'Object.defineProperty(window,"SimpleAppRuntime",{value:Object.freeze('+JSON.stringify(runtime)+'),writable:false,configurable:false});'});
 if(!/^assets\/[a-zA-Z0-9._-]+$/.test(name)&&name!=='index.html')return r.fulfill({status:404});
 if(!fs.existsSync(path.join(root,name)))return r.fulfill({status:404});
 return r.fulfill({contentType:name.endsWith('.html')?'text/html':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':name.endsWith('.webp')?'image/webp':'image/svg+xml',body:name.endsWith('.webp')?fs.readFileSync(path.join(root,name)):read(name)});});
 const check=(name,v)=>{assert(v,engine+' '+width+' '+name);checks.push({engine,width,name,pass:true});};
 const noInitial=()=>calls.every(x=>x.name!=='premium_initial_my_state');
 const settled=()=>p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);
 const login=async actor=>{await p.getByRole('button',{name:'Iniciar sesión',exact:true}).first().click();await p.locator('#email').fill(people[actor].email);await p.locator('#password').fill('LOCAL_TEST_ONLY');await p.locator('#authBtn').click();await p.waitForFunction(id=>typeof profile!=='undefined'&&profile?.id===id&&!simpleAuth.busy,people[actor].id);await p.evaluate(()=>renderShared());};
 await p.goto(origin);await settled();check('anonymous boot makes no initial RPC',noInitial());await login('mock');
 if(baseline){check('approved baseline reproduces attempted initial RPC at SDK entry',!noInitial());runs.push({engine,width,version:browser.version(),initialInvocations:calls.filter(x=>x.name==='premium_initial_my_state').length});await ctx.close();continue;}
 check('mock Basic login preserves necessary access read and skips initial',noInitial()&&calls.some(x=>x.name==='get_my_coach_access'));
 for(const actor of['mock','real']){
 if(actor==='real'){await p.evaluate(()=>logout());await settled();await login(actor);}
 await p.locator('#app header .settings-trigger').click();await p.locator('[data-subscription-open]').click();await p.waitForFunction(()=>!!document.querySelector('.subscription-details')||document.querySelector('.subscription-dialog')?.textContent.includes('Todavía no'));
 const text=await p.locator('.subscription-dialog').innerText();check(actor+' subscription is correctly scoped',actor==='mock'?text.includes('4,99')&&text.includes('Basic'):!text.includes('4,99'));
 check(actor+' no economic controls in readonly profile',await p.getByRole('button',{name:/Gestionar suscripción|Probar Basic|Comprobar pago/}).count()===0);
 await p.locator('.subscription-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();await p.evaluate(()=>openSimpleCoach());await p.locator('#coachDialog').waitFor({state:'visible'});
 check(actor+' Coach opens via Basic access RPC',await p.locator('#coachDialog').innerText().then(x=>actor==='mock'?x.includes('Basic'):x.includes('no está autorizada')));
 await p.locator('#coachDialog').getByRole('button',{name:'Cerrar SIMPLE Coach',exact:true}).click();await p.evaluate(()=>renderShared());
 check(actor+' home Coach navigation has zero initial invocations',noInitial());
 await p.reload();await settled();await p.waitForFunction(id=>profile?.id===id,people[actor].id);await p.evaluate(()=>renderShared());check(actor+' full reload retains scope and performs Basic reads',noInitial());
 await p.evaluate(async()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));await renderShared();});check(actor+' simulated persisted lifecycle preserves guard',noInitial());
 }
 await p.evaluate(()=>{window.holdPremiumAccess=true;window.delayedHome=renderCoachHome();});await p.waitForFunction(()=>typeof releasePremiumAccess==='function');
 await p.evaluate(()=>{window.fireSyntheticSignout();window.holdPremiumAccess=false;releasePremiumAccess();});await p.evaluate(()=>delayedHome);check('late response after signout cannot start initial flow',noInitial());
 await login('mock');await p.evaluate(()=>{window.holdPremiumAccess=true;window.delayedHome=renderCoachHome();});await p.waitForFunction(()=>typeof releasePremiumAccess==='function');
 await p.evaluate(()=>{localStorage.setItem('readonly-synthetic-actor','real');user=mock.tables.profiles[1];profile=mock.tables.profiles[1];window.holdPremiumAccess=false;releasePremiumAccess();});await p.evaluate(()=>delayedHome);await p.evaluate(()=>renderShared());check('late response after identity switch cannot start initial flow',noInitial());
 await p.evaluate(async()=>{window.syntheticPremiumEnabled=true;await renderShared();await PremiumInitial.open();await PremiumInitial.open({reviewer:true});PremiumInitial.mount({owner:user.id,adapter:()=>{throw Error('must not initialize');}});await openPremiumCoach();});
 check('loaded Premium components never mount even with unexpected positive followup response',noInitial()&&await p.locator('.premium-initial-dialog,.premium-coach-dialog').count()===0&&await p.getByRole('button',{name:'Abrir seguimiento Premium',exact:true}).count()===0);
 await p.evaluate(async()=>{expireSyntheticSession();const a=PremiumInitialAdapter.create(db,{projectUrl:SUPABASE_URL});try{await a.load();throw Error('unexpected_success');}catch(e){if(e.code!=='premium_initial_not_authorized')throw e;}await renderShared();});check('expired session cannot dispatch initial RPC',noInitial());
 await p.evaluate(()=>logout());await settled();check('final logout leaves no user and no initial attempts',await p.evaluate(()=>user===null)&&noInitial());
 check('only readonly SDK entry points and no browser errors',calls.filter(x=>x.kind==='edge').every(x=>x.name==='status')&&calls.filter(x=>x.kind==='rpc').every(x=>['get_my_coach_access','premium_my_access','get_coach_reviewer_access','premium_initial_review_queue','billing_test_capabilities'].includes(x.name))&&errors.length===0&&external.length===0);
 check('mobile or desktop has no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 runs.push({engine,width,version:browser.version(),initialInvocations:0,sdkCalls:calls.length,externalDispatches:0});await ctx.close();
 }}finally{await browser.close();}}
 const report={mode:'synthetic SDK, no real JWT',baseline,bfcache:'Persisted events simulated here; real history restoration tested separately',passed:checks.length,failed:0,checks,runs};fs.writeFileSync(path.join(out,baseline?'readonly-premium-baseline-browser.json':'readonly-premium-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseline,passed:checks.length,runs}));}
module.exports={sdk,runtime,people};
if(require.main===module)main().catch(e=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'readonly-premium-failure.json'),JSON.stringify({error:e.message,checks},null,2));console.error(e);process.exitCode=1;});
