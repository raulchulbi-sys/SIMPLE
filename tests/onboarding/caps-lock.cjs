// Focused presentation checks. Every request is fulfilled locally or blocked.
// The Auth double records operation names only; no real sessions or emails.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');
fs.mkdirSync(out,{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stub=`window.__authCalls=[];window.supabase={createClient:()=>({auth:{
 getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signInWithPassword:()=>{window.__authCalls.push('login');return new Promise(resolve=>window.__finishLogin=resolve)},
 signInWithOAuth:()=>{window.__authCalls.push('google');return new Promise(resolve=>window.__finishGoogle=resolve)},
 resetPasswordForEmail:async()=>{window.__authCalls.push('recovery');return {data:{},error:null}}
}})};`;
const results=[];
async function caps(page,type,on,extra={}){
 await page.locator('#password').dispatchEvent(type,{key:'a',code:'KeyA',modifierCapsLock:on,...extra});
}
async function hidden(page){
 assert.equal(await page.locator('#passwordCapsLock').isVisible(),false);
 assert.equal(await page.locator('#passwordCapsLockStatus').textContent(),'');
 assert.equal(await page.locator('#password').evaluate(e=>e.parentElement.classList.contains('auth-caps-on')),false);
}
async function visible(page){
 assert.equal(await page.locator('#passwordCapsLock').isVisible(),true);
 assert.equal(await page.locator('#passwordCapsLockStatus').textContent(),'Bloq Mayús activado');
 assert.equal(await page.getByLabel('Contraseña',{exact:true}).getAttribute('aria-describedby'),'passwordCapsLockStatus');
 assert.equal(await page.locator('#passwordCapsLockStatus').getAttribute('role'),'status');
 assert.equal(await page.locator('#passwordCapsLockStatus').getAttribute('aria-live'),'polite');
}
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{
   for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[1280,900]])for(const theme of ['light','dark']){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],unexpected=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.setDefaultTimeout(5000);
    try{
     await page.addInitScript(value=>localStorage.setItem('simple_theme_v1',value),theme);
     await page.route('**/*',async route=>{
      const request=route.request(),u=new URL(request.url());
      if(u.origin==='http://simple.test'&&request.method()==='GET'){
       const file=path.resolve(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
       if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
       const types={'.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
       return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'text/html'});
      }
      if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('@supabase/supabase-js@2.115.0'))return route.fulfill({body:stub,contentType:'application/javascript'});
      if(u.hostname==='yvguatdqncadkwewlepe.supabase.co'&&u.pathname==='/auth/v1/settings'&&request.method()==='GET')return route.fulfill({json:{external:{google:true,apple:false,facebook:false}}});
      unexpected.push({method:request.method(),host:u.hostname,path:u.pathname});return route.abort();
     });
     await page.goto('http://simple.test/');
     await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
     await hidden(page);
     const password=page.getByLabel('Contraseña',{exact:true});
     await password.fill('UPPERCASE-EXAMPLE');await hidden(page);
     // Uppercase and Shift alone must never imply Caps Lock.
     await caps(page,'keydown',false,{key:'A',shiftKey:true});await hidden(page);
     await caps(page,'keydown',true);await visible(page);
     const indicator=await page.locator('#passwordCapsLock').boundingBox(),eye=await page.locator('#passwordToggle').boundingBox(),input=await password.boundingBox();
     assert(indicator.x>=input.x&&indicator.x+indicator.width<=eye.x,'Caps Lock does not overlap the eye or the input edge');
     assert(eye.width>=44&&eye.height>=44,'Password toggle keeps its touch target');
     assert.equal(await password.getAttribute('type'),'password');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false);
     if(engine==='chromium'&&width===390)await page.screenshot({path:path.join(out,`caps-lock-login-${theme}.png`),fullPage:true});
     // Repeated key events keep the live-region content stable.
     await page.evaluate(()=>{window.__statusMutations=0;new MutationObserver(records=>window.__statusMutations+=records.length).observe(document.getElementById('passwordCapsLockStatus'),{childList:true});});
     await caps(page,'keyup',true);assert.equal(await page.evaluate(()=>window.__statusMutations),0);
     await caps(page,'keyup',false);await hidden(page);
     await caps(page,'keydown',true);await page.locator('#email').focus();await hidden(page);
     await password.focus();await caps(page,'keydown',true);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await hidden(page);
     await caps(page,'keydown',true);await page.locator('#passwordToggle').click();await hidden(page);
     assert.equal(await password.getAttribute('type'),'text');
     assert.equal(await page.locator('#passwordToggle').getAttribute('aria-pressed'),'true');
     await password.focus();await caps(page,'keydown',true);await visible(page);
     await page.locator('#passwordToggle').click();assert.equal(await password.getAttribute('type'),'password');
     await password.focus();await caps(page,'keydown',true);
     await page.getByRole('button',{name:'Crea tu cuenta',exact:true}).click();await hidden(page);
     await page.getByRole('button',{name:/^Atleta/}).click();await hidden(page);
     assert.equal(await password.inputValue(),'');
     assert.equal(await password.getAttribute('autocomplete'),'new-password');
     await password.focus();await caps(page,'keydown',true);await visible(page);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false);
     if(engine==='chromium'&&width===390)await page.screenshot({path:path.join(out,`caps-lock-signup-${theme}.png`),fullPage:true});
     await page.locator('#authCredentials .auth-back').click();await hidden(page);
     await page.locator('#authRoles .auth-back').click();
     await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
     await page.locator('#email').fill('test@example.invalid');await password.fill('Example-Only-123!');
     await caps(page,'keydown',true);await visible(page);
     await page.locator('#authBtn').evaluate(button=>{button.click();button.click();});
     await hidden(page);assert.equal(await page.evaluate(()=>__authCalls.filter(name=>name==='login').length),1);
     assert.equal(await password.isDisabled(),true);
     await page.evaluate(()=>__finishLogin({error:{message:'Invalid login credentials'}}));
     await page.waitForFunction(()=>!simpleAuth.busy);
     assert.equal(await page.locator('#forgotBtn').isVisible(),true);
     assert.match(await page.locator('#authMsg').innerText(),/Revisa el correo y la contraseña/);
     assert.equal(await password.inputValue(),'Example-Only-123!');
     await page.locator('#forgotBtn').click();
     await page.locator('#authRecoverySentTitle').waitFor();
     assert.equal(await page.evaluate(()=>__authCalls.filter(name=>name==='recovery').length),1);
     await page.getByRole('button',{name:'Volver a iniciar sesión',exact:true}).click();await hidden(page);
     const google=page.getByRole('button',{name:'Continuar con Google',exact:true});
     await google.evaluate(button=>{button.click();button.click();});
     assert.equal(await page.evaluate(()=>__authCalls.filter(name=>name==='google').length),1);
     await page.evaluate(()=>__finishGoogle({error:{message:'Controlled local cancellation'}}));await page.waitForFunction(()=>!simpleAuth.busy);
     assert.equal(await google.isEnabled(),true);
     assert.equal(await page.getByRole('button',{name:/Continuar con (Apple|Facebook)/}).count(),0);
     assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
     results.push({engine,width,height,theme,pass:true});
    }catch(error){results.push({engine,width,height,theme,pass:false,error:error.message});}
    finally{await page.close();}
   }
  }finally{await browser.close();}
 }
 const report={kind:'Local candidate, browser events and Auth double; zero remote requests',passed:results.filter(item=>item.pass).length,failed:results.filter(item=>!item.pass),results};
 fs.writeFileSync(path.join(out,'caps-lock.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
 if(report.failed.length)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
