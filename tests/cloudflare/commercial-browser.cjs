'use strict';
// Local artifact smoke only. All non-loopback traffic is fulfilled with a double
// or aborted before dispatch. No login, Stripe, provider or connected backend.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {once}=require('node:events');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(require('node:os').homedir(),'Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {buildCommercial}=require('../../scripts/hosting-commercial-build.cjs');
const {serverFor}=require('../../scripts/hosting-preview.cjs');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:4381';
const sdk=fs.readFileSync(path.join(root,'tests/interior/mock-sdk.js'),'utf8');
const rows=[];let server,browser;
async function main(){
 const artifact=buildCommercial({target:'local',env:{SIMPLE_APP_URL:origin+'/'}});
 server=serverFor(artifact.output);server.listen(4381,'127.0.0.1');await once(server,'listening');
 try{for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  for(const width of [320,1280])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
   const errors=[],missing=[],blocked=[],fulfilled=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)missing.push(response.status());});
   await page.addInitScript(theme=>localStorage.setItem('simple_theme_v1',theme),theme);
   await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin===origin && route.request().method()==='GET')return route.continue();
    if(u.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0'){
     fulfilled.push('sdk-double');return route.fulfill({contentType:'application/javascript',body:sdk});
    }
    if(u.href==='https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/settings'){
     fulfilled.push('settings-double');return route.fulfill({json:{external:{google:false,apple:false}}});
    }
    blocked.push(u.origin);return route.abort();
   });
   await page.goto(origin+'/?billingTest=true&plan=premium',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>typeof window.SimpleSubscription?.mount==='function');
   const actual=await page.evaluate(()=>({backend:window.SimpleAppRuntime.supabaseUrl,enabled:window.SimpleAppRuntime.billingTest===true,frozen:Object.isFrozen(window.SimpleAppRuntime),theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+1,button:!!document.querySelector('[data-subscription-open]'),recover:typeof requestPasswordReset==='function',login:document.getElementById('auth')?.textContent.includes('Iniciar sesión')}));
   assert.equal(actual.backend,'https://dmqjexigdnfzobarhnib.supabase.co');assert.equal(actual.enabled,false);assert.equal(actual.frozen,true);
   assert.equal(actual.theme,theme);assert.equal(actual.overflow,false);assert.equal(actual.button,false);assert.equal(actual.recover,true);assert.equal(actual.login,true);
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.deepEqual(blocked,[]);assert(fulfilled.includes('sdk-double'));
   rows.push({name:engine+' '+width+' '+theme,pass:true});await context.close();
  }
  await browser.close();browser=null;
 }
 const out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
 const report={kind:'local artifact browser smoke with synthetic SDK; all external requests intercepted; no real authentication',passed:rows.length,failed:0,artifact:artifact.treeSha256,results:rows};
 fs.writeFileSync(path.join(out,'commercial-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
