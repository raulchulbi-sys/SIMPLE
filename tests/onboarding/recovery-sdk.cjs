// Real supabase-js 2.115.0 with local HTTP fixtures. No request reaches Supabase.
// This verifies SDK callback/event integration, not email delivery or real JWTs.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sdk=fs.readFileSync(path.join(__dirname,'private/supabase-2.115.0.js'));
assert.equal(crypto.createHash('sha256').update(sdk).digest('hex'),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7');
const uid='00000000-0000-4000-8000-000000000123';
const account={id:uid,aud:'authenticated',role:'authenticated',email:'local-only@example.invalid',app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const exp=Math.floor(Date.now()/1000)+3600;
const jwt=[{alg:'HS256',typ:'JWT'},{sub:uid,exp,iat:exp-3600,role:'authenticated',aud:'authenticated'},'local-test-signature'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
const session={access_token:jwt,refresh_token:'local-only-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user:account};
const hash='#'+new URLSearchParams({access_token:jwt,refresh_token:session.refresh_token,expires_in:'3600',token_type:'bearer',type:'recovery'});
const results=[];fs.mkdirSync(out,{recursive:true});
(async()=>{for(const engine of (process.env.AUTH_ENGINES||'chromium,webkit').split(',')){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of (process.env.AUTH_WIDTHS||'320,1280').split(',').map(Number)){
  async function run(name,scenario){
   if(process.env.AUTH_CASE&&!name.includes(process.env.AUTH_CASE))return;
   const context=await browser.newContext({viewport:{width,height:844}}),p=await context.newPage(),calls=[],errors=[];
   const control={getUserDelay:0,invalidUser:false,resetError:false};p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',async r=>{
    const u=new URL(r.request().url()),method=r.request().method();
    if(u.origin==='http://simple.test'){
     const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
     if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404});
     return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.webp')?'image/webp':'text/html'});
    }
    if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({body:sdk,contentType:'application/javascript'});
    if(u.hostname==='yvguatdqncadkwewlepe.supabase.co'){
     calls.push({path:u.pathname,query:u.search,method,body:r.request().postDataJSON()});
     const reply=(body,status=200)=>r.fulfill({status,body:JSON.stringify(body),contentType:'application/json'});
     if(u.pathname==='/auth/v1/user'){
      if(method==='PUT'){await new Promise(res=>setTimeout(res,150));return reply(account)}
      if(control.getUserDelay)await new Promise(res=>setTimeout(res,control.getUserDelay));
      return control.invalidUser?reply({code:'bad_jwt',msg:'invalid local fixture'},401):reply(account);
     }
     if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204});
     if(u.pathname==='/auth/v1/recover')return control.resetError?reply({code:'unexpected_failure',msg:'local delivery error'},500):reply({});
     if(u.pathname==='/auth/v1/token')return reply({code:'invalid_credentials',msg:'Invalid login credentials'},400);
     return reply({code:'unexpected_fixture_request'},400);
    }
    return r.abort();
   });
   try{await scenario({p,calls,control});assert.deepEqual(errors,[]);results.push({engine,width,name,pass:true})}
   catch(e){results.push({engine,width,name,pass:false,error:e.message});await p.screenshot({path:path.join(out,`${engine}-${width}-recovery-failure.png`),fullPage:true})}
   finally{await context.close()}
  }
  await run('Valid SDK recovery callback, validation, single update and stable signed-out success',async({p,calls})=>{
   await p.goto('http://simple.test/?reset=1'+hash);await p.locator('#resetModal.show').waitFor();
   assert.equal(await p.locator('#app').isVisible(),false);assert.equal(new URL(p.url()).search,'');assert.equal(new URL(p.url()).hash,'');
   assert(calls.some(c=>c.path==='/auth/v1/user'&&c.method==='GET'));
   assert(!calls.some(c=>c.path.includes('/rest/')));
   await p.screenshot({path:path.join(out,`${engine}-${width}-recovery.png`),fullPage:true});
   await p.locator('#newPassword').fill('short');await p.locator('#newPassword2').fill('short');await p.locator('#resetPasswordBtn').click();
   assert.match(await p.locator('#resetMsg').innerText(),/6 caracteres/);
   await p.locator('#newPassword').fill('New-Local-Example-976!');await p.locator('#newPassword2').fill('different');await p.evaluate(()=>updatePassword());
   assert.match(await p.locator('#resetMsg').innerText(),/no coinciden/);assert.equal(calls.filter(c=>c.method==='PUT').length,0);
   await p.locator('#newPassword2').fill('New-Local-Example-976!');
   await p.evaluate(()=>Promise.all([updatePassword(),updatePassword()]));await p.waitForTimeout(150);
   assert.equal(calls.filter(c=>c.method==='PUT').length,1);assert.equal(calls.find(c=>c.method==='PUT').body.password,'New-Local-Example-976!');
   assert.equal(await p.locator('#auth').getAttribute('data-screen'),'login');assert.match(await p.locator('#authMsg').innerText(),/Contraseña actualizada/);
   assert.equal(await p.locator('#resetModal').isVisible(),false);assert.equal(await p.locator('#newPassword').inputValue(),'');
  });
  await run('SDK consumes hash-only recovery without losing reset intent',async({p})=>{
   await p.goto('http://simple.test/'+hash);await p.locator('#resetModal.show').waitFor();assert.equal(await p.locator('#app').isVisible(),false);
   await p.getByRole('button',{name:'Cerrar',exact:true}).click();await p.waitForFunction(()=>!simpleAuth.busy);assert.equal(await p.locator('#resetModal').isVisible(),false);assert.equal(await p.locator('#auth').getAttribute('data-screen'),'welcome');
  });
  await run('Expired callback cannot reuse a pre-existing session to open reset',async({p,calls})=>{
   await p.addInitScript(s=>localStorage.setItem('sb-yvguatdqncadkwewlepe-auth-token',JSON.stringify(s)),session);
   await p.goto('http://simple.test/?reset=1#error=access_denied&error_code=otp_expired&error_description=Expired&sb=');
   await p.waitForFunction(()=>!simpleAuth.busy);assert.equal(await p.locator('#resetModal').isVisible(),false);assert.match(await p.locator('#authMsg').innerText(),/caducado/);assert(!calls.some(c=>c.method==='PUT'||c.path.includes('/rest/')));
  });
  await run('Reset query without a session offers no password update',async({p,calls})=>{
   await p.goto('http://simple.test/?reset=1');await p.waitForFunction(()=>!simpleAuth.busy);assert.equal(await p.locator('#resetModal').isVisible(),false);assert.equal(await p.locator('#auth').getAttribute('data-screen'),'login');assert(!calls.some(c=>c.method==='PUT'));
  });
  await run('Rejected callback JWT never opens a reset form',async({p,control,calls})=>{
   control.invalidUser=true;await p.goto('http://simple.test/?reset=1'+hash);await p.waitForFunction(()=>!simpleAuth.busy);assert.equal(await p.locator('#resetModal').isVisible(),false);assert(!calls.some(c=>c.method==='PUT'||c.path.includes('/rest/')));
  });
  await run('Late getUser response after sign-out cannot reopen reset',async({p,control})=>{
   control.getUserDelay=1100;await p.goto('http://simple.test/?reset=1'+hash);await p.waitForTimeout(850);
   const diagnostic=await p.evaluate(async()=>{const before={epoch:simpleAuth.epoch,screen:simpleAuth.screen,busy:simpleAuth.busy};const events=[];db.auth.onAuthStateChange(e=>events.push(e));const result=await db.auth.signOut();return {before,result,events,after:{epoch:simpleAuth.epoch,screen:simpleAuth.screen,busy:simpleAuth.busy}}});await p.waitForTimeout(1400);
   assert.equal(await p.locator('#resetModal').isVisible(),false);assert.equal(await p.locator('#app').isVisible(),false);assert.equal(await p.locator('#auth').getAttribute('data-screen'),'welcome',JSON.stringify(diagnostic));
  });
  await run('Real SDK recovery request preserves exact redirect and handles delivery error',async({p,calls,control})=>{
   await p.goto('http://simple.test/');await p.waitForFunction(()=>!simpleAuth.busy);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
   await p.locator('#email').fill('local-only@example.invalid');await p.locator('#password').fill('Wrong-Local-Only');await p.locator('#authBtn').click();await p.waitForFunction(()=>!simpleAuth.busy);
   await p.locator('#forgotBtn').click();await p.waitForFunction(()=>!simpleAuth.busy);
   const req=calls.find(c=>c.path==='/auth/v1/recover');assert.equal(req.body.email,'local-only@example.invalid');assert.equal(new URLSearchParams(req.query).get('redirect_to'),'https://raulchulbi-sys.github.io/SIMPLE/?reset=1');assert.match(await p.locator('#authMsg').innerText(),/Si existe una cuenta/);
   control.resetError=true;await p.locator('#forgotBtn').click();await p.waitForFunction(()=>!simpleAuth.busy);assert.match(await p.locator('#authMsg').innerText(),/No se pudo enviar/);
  });
  console.log(engine,width,results.filter(r=>r.engine===engine&&r.width===width&&r.pass).length,'passed');
 }}finally{await browser.close()}
}
const report={kind:'real SDK + local HTTP fixtures; no real account/mail',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results};
fs.writeFileSync(path.join(out,'recovery-sdk.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.failed.length?report.failed:{passed:report.passed,failed:0}));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
