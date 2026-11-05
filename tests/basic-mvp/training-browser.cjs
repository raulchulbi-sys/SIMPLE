'use strict';
// Actual application and assignment SDK double. All HTTP is fulfilled in-process.
// No credentials, server, real Auth, remote API, or provider. Synthetic writes only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(os.homedir(),'Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),origin='https://basic-mvp.invalid',checks=[];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const runtime={target:'mock',environment:'staging',appOrigin:origin,appUrl:origin+'/',basePath:'/',allowedOrigins:[origin],supabaseUrl:'https://dmqjexigdnfzobarhnib.supabase.co',supabasePublicKey:'SYNTHETIC_NOT_A_KEY',billingTest:false};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function route(context){
 await context.route('**/*',r=>{const u=new URL(r.request().url());
  if(u.origin==='https://cdn.jsdelivr.net')return r.fulfill({contentType:'application/javascript',body:read('tests/interior/mock-sdk.js')+'\n'+read('tests/client-routine/preview-sdk.js')});
  if(u.origin!==origin)return r.abort();
  if(u.pathname==='/assets/runtime-config.js')return r.fulfill({contentType:'application/javascript',body:'Object.defineProperty(window,"SimpleAppRuntime",{value:Object.freeze('+JSON.stringify(runtime)+')});'});
  if(u.pathname==='/seed.js')return r.fulfill({contentType:'application/javascript',body:read('tests/interior/preview-seed.js')});
  if(u.pathname==='/')return r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self';script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'none';form-action 'none';object-src 'none'"},body:read('index.html').replace('</body>','<script src="/seed.js"></script></body>')});
  if(!/^\/assets\/[a-zA-Z0-9._-]+$/.test(u.pathname))return r.fulfill({status:404});
  const f=path.join(root,u.pathname.slice(1));if(!fs.existsSync(f))return r.fulfill({status:404});
  return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.webp')?'image/webp':'application/octet-stream'});
 });
}
(async()=>{fs.mkdirSync(out,{recursive:true});for(const [engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
 for(const width of(process.env.BASIC_UI_SMOKE?[320]:[320,390,1280]))for(const theme of(process.env.BASIC_UI_SMOKE?['light']:['light','dark'])){
  const context=await browser.newContext({viewport:{width,height:900}});await route(context);const p=await context.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const check=(name,value)=>{assert(value,engine+' '+width+' '+theme+' '+name);checks.push({engine,width,theme,name,pass:true});};
  await p.goto(origin+'/?role=client');await p.waitForFunction(()=>window.previewReady);
  const before=await p.evaluate(()=>JSON.stringify(mock.tables));
  await p.evaluate(t=>simpleTheme.set(t),theme);await p.reload();await p.waitForFunction(()=>window.previewReady);
  check('theme preference survives reload',await p.evaluate(t=>document.documentElement.dataset.theme===t,theme));
  check('athlete home has shared routine and no horizontal overflow',await p.locator('#shared .routine').count()===1&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.evaluate(r=>openSharedRoutine(r),id(10));
  check('athlete sees five sessions without trainer view-session action',await p.locator('#trainBody button[onclick^="startWorkoutDay("]').count()===5&&await p.getByRole('button',{name:'Ver sesión',exact:true}).count()===0);
  await p.locator('#trainBody button[onclick^="startWorkoutDay("]').first().click();await p.locator('#saveWorkoutBtn').waitFor();
  check('training preserves UUID and one final save button',await p.evaluate(d=>activeWorkout.day.id===d,id(30))&&await p.locator('#saveWorkoutBtn').count()===1);
  await p.locator('#trainModalActions').getByRole('button',{name:'Historial',exact:true}).click();await p.locator('.history-session').waitFor();
  check('existing workout history readable',await p.locator('.history-session').count()===1);
  await p.evaluate(()=>closeM('trainModal'));
  await p.evaluate(()=>{window.syntheticPrincipal=user;db.auth.signOut=async()=>{syntheticPrincipal=null;return{error:null};};db.auth.getUser=async()=>({data:{user:syntheticPrincipal},error:null});db.auth.signInWithPassword=async({email})=>{syntheticPrincipal={id:email.startsWith('trainer')?mock.tables.profiles[0].id:mock.tables.profiles[1].id,email,user_metadata:{simple_role:email.startsWith('trainer')?'client':'trainer'},app_metadata:{provider:'email'}};return{data:{user:syntheticPrincipal,session:{user:syntheticPrincipal}},error:null};};return logout();});
  check('logout clears identity and private views',await p.evaluate(()=>user===null&&profile===null&&document.querySelector('#clients').textContent===''&&document.querySelector('#shared').textContent===''));
  const login=async email=>{await p.getByRole('button',{name:'Iniciar sesión',exact:true}).first().click();await p.locator('#email').fill(email);await p.locator('#password').fill('LOCAL_FAKE_PASSWORD');await p.locator('#authBtn').click();await p.waitForFunction(()=>!simpleAuth.busy&&profile);};
  await login('trainer@example.invalid');await p.locator('.client-overview-card').first().waitFor();
  check('trainer login honors existing profile over metadata',await p.evaluate(()=>profile.role==='trainer')&&await p.locator('.client-overview-card').count()===3);
  const closeClient=async()=>{const button=p.locator('#clientModal').getByRole('button',{name:'Cerrar',exact:true});await p.waitForFunction(()=>document.querySelector('#clientModal button[onclick]').dataset.robustClick!=='1');await button.click();await p.locator('#clientModal.show').waitFor({state:'hidden'});};
  await p.locator('.client-overview-card').first().click();await p.locator('#clientModal.show').waitFor();await p.waitForFunction(()=>document.querySelector('#clientModalTitle').textContent!=='Cliente');const firstTitle=await p.locator('#clientModalTitle').innerText();await closeClient();
  await p.locator('.client-overview-card').nth(1).click();await p.locator('#clientModal.show').waitFor();
  await p.waitForFunction(()=>document.querySelector('#clientModalTitle').textContent!=='Cliente');
  check('switch client replaces selected identity',firstTitle!==await p.locator('#clientModalTitle').innerText());await closeClient();
  await p.locator('#tMine').click();await p.locator('[data-open-routine]').first().click();await p.locator('#clientSessionList').waitFor();
  check('trainer library retains sessions and editing',await p.locator('#clientSessionList .routine-editor-day').count()===5&&await p.getByRole('button',{name:'Editar sesión',exact:true}).count()>0);
  await p.evaluate(()=>closeM('editModal'));await p.evaluate(()=>logout());await login('client@example.invalid');
  check('client login does not inherit trainer role or clients',await p.evaluate(()=>profile.role==='client'&&document.querySelector('#clients').textContent==='')&&await p.locator('#shared .routine').count()===1);
  check('navigation leaves training tables unchanged',await p.evaluate(()=>JSON.stringify(mock.tables))===before);
  check('visible controls remain within viewport and have accessible names',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#app button')].filter(e=>e.getClientRects().length).every(e=>(e.textContent.trim()||e.getAttribute('aria-label')))));
  check('no runtime errors',errors.length===0);
  if(width===390)await p.screenshot({path:path.join(out,engine+'-'+theme+'-athlete.png'),fullPage:true});
  await p.evaluate(()=>logout());await context.close();
 }
 }finally{await browser.close();}}
 fs.writeFileSync(path.join(out,'training-browser.json'),JSON.stringify({passed:checks.length,checks,mode:'actual Chromium/WebKit; intercepted SDK; no real JWT or backend'},null,2));console.log(checks.length+'/'+checks.length+' Basic training browser checks');
})().catch(e=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'training-browser-failure.json'),JSON.stringify({message:e.message,checks},null,2));console.error(e);process.exitCode=1;});
