// Real SDK with intercepted Auth HTTP responses. Never sends mail or changes users.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');
const base=process.env.RECOVERY_PUBLIC==='1'?'https://raulchulbi-sys.github.io/SIMPLE/':'http://simple.test/';
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sdk=fs.readFileSync(path.join(__dirname,'private/supabase-2.115.0.js'));
assert.equal(crypto.createHash('sha256').update(sdk).digest('hex'),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7');
const copy='Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer la contraseña. Revisa también la carpeta de spam.';
const results=[];fs.mkdirSync(out,{recursive:true});
(async()=>{
for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const theme of ['light','dark'])for(const width of (process.env.AUTH_WIDTHS||'320,1280').split(',').map(Number)){
  async function run(name,test){
   if(process.env.RECOVERY_CASE&&!name.includes(process.env.RECOVERY_CASE))return;
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const p=await context.newPage(),calls=[],errors=[],control={status:200,network:false,hold:false,holdLogin:false};
   let release,releaseLogin;
   await p.addInitScript(theme=>localStorage.setItem('simple_theme_v1',theme),theme);
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({body:sdk,contentType:'application/javascript'});
    if(u.hostname.endsWith('.supabase.co')){
     calls.push({path:u.pathname,method:req.method(),query:u.search,body:req.postDataJSON()});
     const reply=(body,status=200)=>route.fulfill({status,body:JSON.stringify(body),contentType:'application/json'});
     if(u.pathname==='/auth/v1/settings')return reply({external:{google:false,apple:false,facebook:false}});
     if(u.pathname==='/auth/v1/token'){
      if(control.holdLogin)await new Promise(r=>releaseLogin=r);
      return reply({code:'invalid_credentials',msg:'Invalid login credentials'},400);
     }
     if(u.pathname==='/auth/v1/recover'){
      const status=control.status,network=control.network;
      if(control.hold)await new Promise(r=>release=r);
      if(network)return route.abort('failed');
      return reply(status===200?{}:{code:status===429?'over_email_send_rate_limit':'request_failed',msg:'Private server detail: account not found'},status);
     }
     throw new Error('Unexpected Auth/data request: '+req.method()+' '+u.pathname);
    }
    if(u.origin===new URL(base).origin){
     assert.equal(req.method(),'GET');
     if(process.env.RECOVERY_PUBLIC==='1')return route.continue();
     const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
     if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
     return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.webp')?'image/webp':'text/html'});
    }
    return route.abort();
   });
   const recoveryCalls=()=>calls.filter(c=>c.path==='/auth/v1/recover');
   const settled=()=>p.waitForFunction(()=>simpleAuth.resetEpoch===null&&!simpleAuth.busy);
   async function failedLogin(){
    await p.locator('#password').fill('Wrong-Local-Only');
    await p.locator('#authBtn').click();await p.waitForFunction(()=>!simpleAuth.busy);
   }
   try{
    await p.goto(base);await p.waitForFunction(()=>simpleAuth.screen==='welcome'&&!simpleAuth.busy);
    await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
    assert.equal(await p.locator('#forgotBtn').isVisible(),false);
    await p.locator('#email').fill('local-only@example.invalid');await failedLogin();
    await test({p,control,recoveryCalls,settled,failedLogin,release:()=>release(),releaseLogin:()=>releaseLogin()});
    assert.deepEqual(errors,[]);
    results.push({engine,theme,width,name,pass:true});
   }catch(e){results.push({engine,theme,width,name,pass:false,error:e.stack});await p.screenshot({path:path.join(out,`feedback-${engine}-${theme}-${width}-failure.png`),fullPage:true})}
   finally{release?.();releaseLogin?.();await context.close()}
  }
  await run('Empty and invalid email never send requests',async({p,recoveryCalls})=>{
   for(const email of ['', 'not-an-email']){
    await p.locator('#email').fill(email);await p.locator('#forgotBtn').click();
    assert.equal(recoveryCalls().length,0);assert.equal(await p.locator('#authRecoverySent').isVisible(),false);
    assert.match(await p.locator('#authMsg').innerText(),/correo electrónico válido/);
    assert.equal(await p.locator('#email').inputValue(),email);
   }
  });
  await run('Accepted request: exact generic copy, persistence, accessible return',async({p,control,recoveryCalls,settled,release})=>{
   control.hold=true;await p.locator('#forgotBtn').focus();await p.keyboard.press('Enter');
   await p.waitForFunction(()=>document.getElementById('forgotBtn').textContent==='Solicitando enlace…');
   assert.equal(await p.locator('#authRecoverySent').isVisible(),false);
   assert.equal(await p.locator('#forgotBtn').isDisabled(),true);
   await p.waitForTimeout(100);release();await settled();
   assert.equal(recoveryCalls().length,1);
   assert.equal(recoveryCalls()[0].body.email,'local-only@example.invalid');
   assert.equal(new URLSearchParams(recoveryCalls()[0].query).get('redirect_to'),'https://raulchulbi-sys.github.io/SIMPLE/?reset=1');
   assert.equal(await p.locator('#authRecoverySentTitle').innerText(),'Revisa tu correo');
   assert.equal(await p.locator('#authRecoverySentCopy').innerText(),copy);
   assert.equal(await p.locator('#authMsg').innerText(),'');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'authRecoverySentTitle');
   assert.equal(await p.locator('#authRecoverySentTitle').getAttribute('aria-describedby'),'authRecoverySentCopy');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),theme);
   await p.waitForTimeout(250);assert.equal(await p.locator('#authRecoverySent').isVisible(),true);
   await p.screenshot({path:path.join(out,`feedback-${engine}-${theme}-${width}-accepted.png`),fullPage:true});
   await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Volver a iniciar sesión');
   const button=p.getByRole('button',{name:'Volver a iniciar sesión',exact:true});
   assert((await button.boundingBox()).height>=44);
   await p.keyboard.press('Enter');
   assert.equal(await p.locator('#auth').getAttribute('data-screen'),'login');
   assert.equal(await p.locator('#email').inputValue(),'local-only@example.invalid');
   assert.equal(await p.locator('#forgotBtn').isVisible(),false);
   assert.equal(recoveryCalls().length,1);
  });
  for(const kind of ['network','400','429','500'])await run('Request error '+kind+' stays inline and retry is explicit',async({p,control,recoveryCalls,settled})=>{
   control.network=kind==='network';control.status=kind==='network'?200:Number(kind);
   await p.locator('#forgotBtn').click();await settled();
   assert.equal(await p.locator('#authRecoverySent').isVisible(),false);
   assert.match(await p.locator('#authMsg').innerText(),kind==='429'?/límite de solicitudes/:/No se pudo solicitar/);
   assert(!/account|not found|registrad|no existe/.test(await p.locator('#authMsg').innerText()));
   assert.equal(await p.locator('#authMsg').getAttribute('role'),'status');
   assert.equal(await p.locator('#email').inputValue(),'local-only@example.invalid');
   assert.equal(await p.locator('#password').inputValue(),'Wrong-Local-Only');
   assert.equal(await p.locator('#forgotBtn').isEnabled(),true);
   await p.waitForTimeout(200);assert.equal(recoveryCalls().length,1);
   control.network=false;control.status=200;await p.locator('#forgotBtn').click();await settled();
   assert.equal(recoveryCalls().length,2);assert.equal(await p.locator('#authRecoverySentCopy').innerText(),copy);
  });
  await run('Double activation sends one request',async({p,control,recoveryCalls,settled,release})=>{
   control.hold=true;
   await p.evaluate(()=>{document.getElementById('forgotBtn').click();document.getElementById('forgotBtn').click();requestPasswordReset()});
   await p.waitForTimeout(150);assert.equal(recoveryCalls().length,1);
   release();await settled();assert.equal(recoveryCalls().length,1);
  });
  for(const status of [200,429])await run('Late '+status+' response cannot replace navigation or unlock a newer login',async({p,control,recoveryCalls,release,releaseLogin})=>{
   control.hold=true;control.status=status;await p.locator('#forgotBtn').click();await p.waitForTimeout(150);
   await p.locator('#authCredentials .auth-back').click();
   assert.equal(await p.locator('#auth').getAttribute('data-screen'),'welcome');
   await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
   control.holdLogin=true;await p.locator('#password').fill('Another-attempt');await p.locator('#authBtn').click();
   await p.waitForTimeout(150);release();await p.waitForFunction(()=>simpleAuth.resetEpoch===null);
   assert.equal(await p.locator('#auth').getAttribute('data-screen'),'login');
   assert.equal(await p.locator('#authMsg').innerText(),'');
   assert.equal(await p.locator('#authBtn').isDisabled(),true);
   assert.equal(await p.locator('#authRecoverySent').isVisible(),false);
   releaseLogin();await p.waitForFunction(()=>!simpleAuth.busy);
   assert.match(await p.locator('#authMsg').innerText(),/No se ha podido iniciar sesión/);
   assert.equal(recoveryCalls().length,1);
  });
  console.log(engine,theme,width,results.filter(r=>r.engine===engine&&r.theme===theme&&r.width===width&&r.pass).length,'passed');
 }}finally{await browser.close()}
}
const report={mode:process.env.RECOVERY_PUBLIC==='1'?'public frontend + intercepted Auth':'local frontend + intercepted Auth',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results};
fs.writeFileSync(path.join(out,process.env.RECOVERY_PUBLIC==='1'?'feedback-public.json':'feedback.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.failed.length?report.failed:{passed:report.passed,failed:0}));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
