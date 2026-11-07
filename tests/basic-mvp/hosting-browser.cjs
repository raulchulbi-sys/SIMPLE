'use strict';
// Actual immutable validation artifact, all HTTPS resources served from disk by
// Playwright routing. Auth/SDK are synthetic. Never contacts staging or Stripe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),origin='https://simple-staging-raulchulbi.pages.dev';
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'results/hosting-reproducibility.json'))),artifact=manifest.artifacts.find(x=>x.profile==='basic-validation');
const output=path.resolve(root,artifact.outputA),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const f of manifest.sources)assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.sha256,'Source changed since artifact build: '+f.path);
for(const f of artifact.files)assert.equal(sha(fs.readFileSync(path.join(output,f.path))),f.sha256);
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(require('node:os').homedir(),'Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const owner='00000000-0000-4000-8000-000000001a01',seed={profiles:[{id:owner,name:'Atleta sintético',role:'client'}],routines:[],routine_assignments:[],routine_management:[],routine_revisions:[],workouts:[],routine_user_notes:[]};
const status={environment:'STRIPE_TEST',state:'active',plan:'basic',accessActive:true,monthlyCents:499,currency:'eur',paidUntil:'2070-12-01T16:41:13Z',nextBillingAt:'2070-12-01T16:41:13Z',cancelAtPeriodEnd:false,portalAvailable:true,canCheckout:false,aiQuotaChanged:false};
const caps={basicActive:true,basicGenerationEnabled:false,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true};
const sdk=fs.readFileSync(path.join(root,'tests/interior/mock-sdk.js'),'utf8')+`\n(()=>{
 const original=supabase.createClient;
 supabase.createClient=(url,key,opts)=>{window.hostingAuthOptions=opts?.auth;const c=original(),rpc=c.rpc;window.hostingCalls=[];
 c.auth.getUser=async()=>({data:{user:localStorage.getItem('basic-hosting-synthetic-session')==='active'?{id:${JSON.stringify(owner)}}:null}});
 c.auth.signOut=async()=>{localStorage.removeItem('basic-hosting-synthetic-session');return{error:null};};
 c.rpc=async(n,p)=>{hostingCalls.push({kind:'rpc',name:n});if(n==='billing_test_capabilities')return{data:${JSON.stringify(caps)},error:null};if(n==='premium_my_access')return{data:{authorized:false,enabled:false},error:null};return rpc(n,p);};
 c.functions={invoke:async(n,{body})=>{hostingCalls.push({kind:'edge',name:n,action:body.action});if(n!=='billing-test'||body.action!=='status')throw Error('Mutating action forbidden by test');return{data:${JSON.stringify(status)},error:null};}};return c;};
})();`;
const rules=[];let current;for(const line of fs.readFileSync(path.join(output,'_headers'),'utf8').split(/\r?\n/)){if(!line.trim()||line.startsWith('#'))continue;if(!/^\s/.test(line)){current={route:line,headers:{}};rules.push(current);}else if(line.includes(':')){const i=line.indexOf(':');current.headers[line.slice(0,i).trim()]=line.slice(i+1).trim();}}
const headersFor=p=>Object.assign({},...rules.filter(r=>r.route==='/*'||r.route===p||r.route==='/assets/*'&&p.startsWith('/assets/')).map(r=>r.headers));
const results=[];let browser;
async function main(){try{for(const[engine,launcher]of[['chromium',chromium],['webkit',webkit]]){browser=await launcher.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});for(const width of[320,1280])for(const theme of['light','dark']){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(route.request().method()!=='GET'){blocked.push(url.origin);return route.abort();}
  if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0')return route.fulfill({contentType:'application/javascript',body:sdk});
  if(url.href==='https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/settings')return route.fulfill({json:{external:{google:false,apple:false}}});
  if(url.origin===origin){const name=url.pathname==='/'?'index.html':url.pathname==='/billing-test'?'billing-test.html':url.pathname.slice(1);if(artifact.files.some(f=>f.path===name)){return route.fulfill({headers:headersFor(url.pathname),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':name.endsWith('.webp')?'image/webp':'application/octet-stream',body:fs.readFileSync(path.join(output,name))});}}
  blocked.push(url.origin);return route.abort();});
 await page.goto(origin+'/?billingTest=false&plan=premium');await page.waitForFunction(()=>typeof start==='function'&&typeof simpleAuth!=='undefined'&&!simpleAuth.busy);
 await page.evaluate(async({seed,theme})=>{localStorage.setItem('basic-hosting-synthetic-session','active');simpleTheme.set(theme);mock.tables=structuredClone(seed);user={id:seed.profiles[0].id,email:'synthetic@example.invalid'};await start();},{seed,theme});
 await page.locator('#app header .settings-trigger').click();await page.locator('[data-subscription-open]').click();await page.getByRole('heading',{name:'Tu plan está activo'}).waitFor();
 assert.match(await page.locator('.subscription-details').innerText(),/Basic/);assert.match(await page.locator('.subscription-details').innerText(),/4,99/);
 assert.equal(await page.getByRole('button',{name:/Gestionar suscripción|Probar Basic|Comprobar pago|Abrir SIMPLE Coach/}).count(),0);
 assert(await page.evaluate(()=>Object.isFrozen(SimpleAppRuntime)&&SimpleAppRuntime.billingValidationReadOnly===true&&SimpleAppRuntime.billingTest===true));
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 calls.push(...await page.evaluate(()=>hostingCalls));
 await page.goto(origin+'/billing-test.html?plan=premium#ignored');await page.getByRole('heading',{name:'Tu plan está activo'}).waitFor();
 assert.equal(new URL(page.url()).search,'');assert.equal(new URL(page.url()).hash,'');assert(await page.locator('#subscriptionLogin').isHidden());
 const options=await page.evaluate(()=>hostingAuthOptions);assert.equal(options.persistSession,true);assert.equal(options.detectSessionInUrl,false);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.equal(await page.getByRole('button',{name:/Gestionar suscripción|Probar Basic|Comprobar pago|Abrir SIMPLE Coach/}).count(),0);
 calls.push(...await page.evaluate(()=>hostingCalls));assert(calls.filter(x=>x.kind==='edge').every(x=>x.action==='status'&&x.name==='billing-test'));
 assert.equal(calls.filter(x=>x.name==='premium_initial_my_state'||x.name==='premium_chat_load').length,0,'Read-only artifact must not even invoke a mutating Premium state RPC');
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.locator('#subscriptionLogin').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>localStorage.getItem('basic-hosting-synthetic-session')),null);assert.equal(await page.getByRole('heading',{name:'Tu plan está activo'}).count(),0);
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
 results.push({name:engine+' '+width+' '+theme,pass:true,version:browser.version(),readOnly:true,sameOriginSyntheticSession:true,externalDispatches:0});
 await context.close();}await browser.close();browser=null;}
 const report={kind:'Actual staging validation artifact with intercepted HTTPS origin and synthetic SDK, no connected auth or Portal',artifact:artifact.treeSha256,passed:results.length,failed:0,results};fs.writeFileSync(path.join(__dirname,'results/hosting-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
