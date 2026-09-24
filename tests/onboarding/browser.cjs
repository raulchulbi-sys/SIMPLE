// Browser contracts with an explicit local SDK double; never sent to Supabase.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
process.env.PLAYWRIGHT_BROWSERS_PATH=legacy+'/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const old=fs.readFileSync(legacy+'/work/test-ux-browser.cjs','utf8');
const basic=vm.runInNewContext(old.slice(old.indexOf('const stub='),old.indexOf('const results=[]'))+'stub');
const stub=basic+`;
const baseClient=window.supabase.createClient;
window.supabase.createClient=()=>{
 const client=baseClient(),seed=window.__seed||{};
 const a=window.authTest={calls:[],user:seed.user||null,loginRole:'client',failLogin:false,sessionDelay:seed.delay||0,confirmEmail:true,callback:null,profiles:seed.profile?[seed.profile]:[],profileError:false};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 client.auth={
  getSession:async()=>{await sleep(a.sessionDelay);return {data:{session:a.user?{user:a.user}:null}}},
  getUser:async()=>({data:{user:a.user},error:a.user?null:{message:'no session'}}),
  onAuthStateChange:cb=>{a.callback=cb;return {data:{subscription:{unsubscribe(){}}}}},
  signInWithPassword:async args=>{a.calls.push({name:'login',args});if(a.holdLogin)await new Promise(r=>a.releaseLogin=r);if(a.failLogin)return {error:{message:'Invalid login credentials'}};a.user={id:'U',email:args.email,app_metadata:{provider:'email'},user_metadata:{simple_role:'trainer'}};a.profiles=[{id:'U',name:'Test',role:a.loginRole}];a.callback?.('SIGNED_IN',{user:a.user});return {data:{user:a.user,session:{user:a.user}}}},
  signUp:async args=>{a.calls.push({name:'signup',args});const u={id:'NEW',email:args.email,app_metadata:{provider:'email'},user_metadata:args.options.data};if(a.confirmEmail)return {data:{user:u,session:null}};a.user=u;return {data:{user:u,session:{user:u}}}},
  resetPasswordForEmail:async(email,args)=>{a.calls.push({name:'reset',email,args});return {data:{}}},
  updateUser:async args=>{a.calls.push({name:'updateUser',args});return {data:{user:a.user}}},
  signOut:async()=>{a.calls.push({name:'logout'});a.user=null;return {error:null}}
 };
 const from=client.from;client.from=table=>{
  if(table!=='profiles')return from(table);
  let id=null,insert=null;const q={select(){return q},eq(k,v){if(k==='id')id=v;return q},insert(value){insert=value;return q},single(){return q},maybeSingle(){return q},then(resolve){
   if(a.profileError)return Promise.resolve({error:{code:'offline'}}).then(resolve);
   if(insert){a.calls.push({name:'insertProfile',args:insert});if(a.raceProfile){a.profiles=[a.raceProfile];a.raceProfile=null;return Promise.resolve({error:{code:'23505'}}).then(resolve)}a.profiles.push(insert);return Promise.resolve({data:insert}).then(resolve)}
   return Promise.resolve({data:structuredClone(a.profiles.find(p=>p.id===id)||null),error:null}).then(resolve);
  }};return q;
 };return client;
};`;
const results=[];
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of (process.env.AUTH_WIDTHS||'320,360,390,430,768,1280').split(',').map(Number)){
  const p=await browser.newPage({viewport:{width,height:844}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin==='http://simple.test'){
   const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!file.startsWith(root)||!fs.existsSync(file))return r.fulfill({status:404});
   return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.webp')?'image/webp':'text/html'});
  }if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({body:stub,contentType:'application/javascript'});return r.abort()});
  async function test(name,fn){try{await fn();results.push({engine,width,name,pass:true})}catch(e){results.push({engine,width,name,pass:false,error:e.message})}}
  async function reset(seed={}){await p.addInitScript(s=>{window.__seed=s},seed);await p.goto('http://simple.test/');}
  async function screenshot(name){await p.waitForFunction(()=>!document.getElementById('auth').getAnimations({subtree:true}).some(a=>a.playState==='running'));await p.screenshot({path:path.join(out,`${engine}-${width}-${name}.png`),fullPage:true})}
  await reset();
  await test('Initial neutral splash has no form or buttons',async()=>{assert.equal(await p.locator('#auth').getAttribute('data-screen'),'boot');assert.equal(await p.locator('#auth button:visible').count(),0)});
  await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='welcome');
  await test('Welcome has only two actions, no credentials or roles',async()=>{assert.equal(await p.locator('#auth button:visible').count(),2);assert.equal(await p.locator('#email').isVisible(),false);assert.equal(await p.locator('#authRoles').isVisible(),false)});
  await screenshot('welcome');
  await p.getByRole('button',{name:'Crear una cuenta',exact:true}).click();
  await test('Two role options map to registration only',async()=>{assert.equal(await p.locator('#authRoles .auth-role:visible').count(),2);assert.equal(await p.locator('#email').isVisible(),false)});
  await screenshot('roles');
  await p.locator('#authRoles .auth-role').first().click();
  await test('Atleta preserves internal client role',async()=>{assert.equal(await p.evaluate(()=>simpleAuth.role),'client');assert.equal(await p.locator('#password').getAttribute('autocomplete'),'new-password')});
  await p.locator('#email').fill('athlete@example.invalid');await p.locator('#password').fill('Example-Password-987!');
  await p.locator('#authBtn').click();await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='confirmation');
  await test('Email client signup sends selected role and waits for confirmation',async()=>{const calls=await p.evaluate(()=>authTest.calls);assert.equal(calls.find(x=>x.name==='signup').args.options.data.simple_role,'client');assert(!calls.some(x=>x.name==='insertProfile'))});
  await p.evaluate(()=>authNavigate('role'));await p.locator('#authRoles .auth-role').nth(1).click();
  await p.locator('#email').fill('trainer@example.invalid');await p.locator('#password').fill('Example-Password-987!');
  await screenshot('signup');
  await p.locator('#authBtn').click();await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='confirmation');
  await test('Trainer signup sends trainer, no implicit profile creation',async()=>{const a=await p.evaluate(()=>authTest.calls.filter(x=>x.name==='signup'));assert.equal(a[1].args.options.data.simple_role,'trainer')});
  await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await test('Login never asks role or shows reset before failure',async()=>{assert.equal(await p.locator('#authRoles').isVisible(),false);assert.equal(await p.locator('#authSelectedRole').isVisible(),false);assert.equal(await p.locator('#forgotBtn').isVisible(),false);assert.equal(await p.locator('#password').getAttribute('autocomplete'),'current-password')});
  await p.locator('#email').fill('');
  await screenshot('login');
  await p.locator('#email').fill('existing@example.invalid');await p.locator('#password').fill('wrong-password');
  await p.locator('#passwordToggle').click();
  await test('Password visibility is accessible and reversible',async()=>{assert.equal(await p.locator('#password').getAttribute('type'),'text');assert.equal(await p.locator('#passwordToggle').getAttribute('aria-pressed'),'true');await p.locator('#passwordToggle').click();assert.equal(await p.locator('#password').getAttribute('type'),'password')});
  await p.evaluate(()=>authTest.failLogin=true);await p.locator('#authBtn').click();await p.waitForFunction(()=>!simpleAuth.busy);
  await test('Invalid credentials give generic error and reveal reset',async()=>{assert.equal(await p.locator('#forgotBtn').isVisible(),true);assert.match(await p.locator('#authMsg').innerText(),/Revisa el correo y la contraseña/);assert(!/registrado|no existe/i.test(await p.locator('#authMsg').innerText()))});
  await p.locator('#forgotBtn').click();await p.waitForFunction(()=>!simpleAuth.busy);
  await test('Reset uses existing recovery endpoint and generic response',async()=>{const r=await p.evaluate(()=>authTest.calls.find(x=>x.name==='reset'));assert(r.args.redirectTo.endsWith('?reset=1'));assert.match(await p.locator('#authMsg').innerText(),/Si existe una cuenta/)});
  await test('Responsive width, input font and focus targets',async()=>{const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,font:parseFloat(getComputedStyle(document.getElementById('email')).fontSize),target:document.getElementById('passwordToggle').getBoundingClientRect().height}));assert.equal(m.overflow,false);assert(m.font>=16);assert(m.target>=44)});
  await test('Labels and input weight do not inherit uppercase or bold',async()=>{const s=await p.evaluate(()=>({label:getComputedStyle(document.querySelector('.auth-field-label')).textTransform,input:getComputedStyle(document.getElementById('email')).fontWeight}));assert.equal(s.label,'none');assert.equal(s.input,'400')});
  await p.evaluate(()=>{authTest.failLogin=false;authTest.loginRole='client';authTest.holdLogin=true});
  await p.locator('#password').fill('correct-password');await p.locator('#authBtn').dblclick();
  await test('Double submit remains one in-flight login',async()=>{assert.equal(await p.evaluate(()=>authTest.calls.filter(x=>x.name==='login').length),2)});
  await p.evaluate(()=>authTest.releaseLogin());await p.waitForFunction(()=>window.__simpleStarted===true);
  await test('Existing client keeps client despite trainer metadata/previous selection',async()=>{assert.equal(await p.evaluate(()=>profile.role),'client');assert.equal(await p.locator('#auth').isVisible(),false);assert.equal(await p.locator('#shared').isVisible(),true);assert.equal(await p.evaluate(()=>authTest.calls.filter(x=>x.name==='insertProfile').length),0)});
  await test('Slow logout invalidates pending workout context immediately and keeps UUID draft',async()=>{
   const state=await p.evaluate(()=>{
    workoutRoutine={id:'R-LOGOUT'};activeWorkout={day:{id:'D-LOGOUT'},locked:false,sets:{'E-LOGOUT':[{kg:'37.5',reps:'9',rir:'0',done:true}]}};
    const key=workoutDraftKey(),version=window.__workoutContextVersion||0,signOut=db.auth.signOut;window.logoutCalls=0;
    db.auth.signOut=async()=>{logoutCalls++;await new Promise(resolve=>window.releaseLogout=resolve);return signOut()};
    window.pendingLogout=authLogout();authLogout();
    return {versionBefore:version,versionAfter:window.__workoutContextVersion,calls:logoutCalls,busy:simpleAuth.busy,draft:JSON.parse(localStorage.getItem(key))};
   });
   assert.equal(state.versionAfter,state.versionBefore+1);assert.equal(state.calls,1);assert.equal(state.busy,true);
   assert.equal(state.draft.dayId,'D-LOGOUT');assert.deepEqual(state.draft.sets['E-LOGOUT'].rows,[{kg:'37.5',reps:'9',rir:'0',done:true}]);
   await p.evaluate(async()=>{releaseLogout();await pendingLogout;});
  });
  await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='welcome');
  await test('Logout clears visible account and returns welcome',async()=>{assert.equal(await p.evaluate(()=>user),null);assert.equal(await p.locator('#app').isVisible(),false);assert.equal(await p.locator('#password').inputValue(),'')});
  const existing={id:'T',email:'trainer@example.invalid',app_metadata:{provider:'google'},user_metadata:{simple_role:'client'}};
  await reset({user:existing,profile:{id:'T',name:'Trainer',role:'trainer'},delay:1200});
  await test('Slow persistent session never flashes login',async()=>{await p.waitForTimeout(850);assert.equal(await p.locator('#email').isVisible(),false);assert.equal(await p.locator('#authWelcome').isVisible(),false)});
  await p.waitForFunction(()=>window.__simpleStarted===true);
  await test('Existing trainer enters trainer dashboard without role selection',async()=>{assert.equal(await p.evaluate(()=>profile.role),'trainer');assert.equal(await p.locator('#clients').isVisible(),true)});
  await reset({user:{id:'NEW-OAUTH',email:'new@example.invalid',app_metadata:{provider:'google'},user_metadata:{simple_role:'trainer'}}});
  await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='complete');
  await test('Unknown OAuth account must choose role, metadata never guesses it',async()=>{assert.equal(await p.evaluate(()=>authTest.calls.filter(x=>x.name==='insertProfile').length),0);assert.equal(await p.locator('#authRoleTitle').innerText(),'Completar registro')});
  await p.evaluate(()=>authTest.raceProfile={id:'NEW-OAUTH',name:'Created elsewhere',role:'client'});await p.locator('#authRoles .auth-role').nth(1).click();await p.waitForFunction(()=>window.__simpleStarted===true);
  await test('Concurrent existing profile wins over selected trainer role',async()=>assert.equal(await p.evaluate(()=>profile.role),'client'));
  await test('No unavailable OAuth buttons or slogans',async()=>{assert.equal(await p.locator('#auth').getByRole('button',{name:/Google|Facebook|Apple/}).count(),0)});
  await p.emulateMedia({reducedMotion:'reduce'});await reset();await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='welcome');
  await test('Reduced motion has no animated art',async()=>assert.equal(await p.locator('.auth-art').evaluate(e=>getComputedStyle(e).transitionDuration),'0s'));
  await test('No uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
  console.log(engine,width,results.filter(x=>x.engine===engine&&x.width===width&&x.pass).length,'passed');await p.close();
 }}finally{await browser.close()}
}
const report={kind:'local SDK contract tests',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results,htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex')};
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
