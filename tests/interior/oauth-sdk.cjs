// Real SDK, intercepted HTTP. This does NOT validate any live provider or linking.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),sdk=fs.readFileSync(path.join(root,'tests/onboarding/private/supabase-2.115.0.js'));
assert.equal(crypto.createHash('sha256').update(sdk).digest('hex'),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const results=[],uid='00000000-0000-4000-8000-000000000456';
const googleOnly=process.env.OAUTH_PROVIDER==='google';
if(googleOnly)assert.match(fs.readFileSync(path.join(root,'assets/oauth.js'),'utf8'),/Object\.freeze\(\{google:true,apple:false,facebook:false\}\)/,'Only the verified Google provider is released');
const scenarios=['disabled','unconfigured','existing-client','existing-trainer','new-client','new-trainer','cancel','invalid-callback'];
if(googleOnly)scenarios.push('existing-linked-client','existing-linked-trainer','settings-error','profile-race');
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [320,1280])for(const entry of (googleOnly?['login','signup']:['signup']))for(const scenario of scenarios.filter(s=>!process.env.OAUTH_CASES||process.env.OAUTH_CASES.split(',').includes(s))){
  const p=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));
  const provider=googleOnly?'google':scenario==='existing-trainer'?'apple':scenario==='new-trainer'?'facebook':'google';
  const account={id:uid,aud:'authenticated',role:'authenticated',email:'oauth-local@example.invalid',app_metadata:{provider,providers:[provider]},user_metadata:{simple_role:'trainer'},identities:[]};
  if(scenario.includes('linked'))account.app_metadata={provider:'email',providers:['email','google']};
  let profile=scenario.startsWith('existing')?{id:uid,name:'Existing',role:scenario.endsWith('trainer')?'trainer':'client'}:null;
  const exp=Math.floor(Date.now()/1000)+3600,jwt=[{alg:'HS256',typ:'JWT'},{sub:uid,exp,iat:exp-3600,role:'authenticated',aud:'authenticated'},'local-test'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
  const hash='#'+new URLSearchParams({access_token:jwt,refresh_token:'local-refresh',expires_in:'3600',token_type:'bearer'});
  await p.route('**/*',async r=>{const u=new URL(r.request().url()),method=r.request().method();
   if(u.origin==='http://simple.test'){
    const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404});let body=fs.readFileSync(file);
    // Exercise both release-gate states without weakening the source assertion.
    if(u.pathname==='/assets/oauth.js')body=body.toString().replace(/\{google:(?:true|false),apple:false,facebook:false\}/,scenario==='disabled'?'{google:false,apple:false,facebook:false}':googleOnly?'{google:true,apple:false,facebook:false}':'{google:true,apple:true,facebook:true}');
    return r.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html'});
   }
   if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({body:sdk,contentType:'application/javascript'});
   if(u.hostname!=='yvguatdqncadkwewlepe.supabase.co')return r.abort();
   calls.push({path:u.pathname,method,query:u.search,body:r.request().postDataJSON()});const reply=(body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(u.pathname==='/auth/v1/settings')return scenario==='settings-error'?reply({error:'local unavailable'},503):reply({external:{google:scenario!=='unconfigured',apple:!googleOnly&&scenario!=='unconfigured',facebook:!googleOnly&&scenario!=='unconfigured'}});
   if(u.pathname==='/auth/v1/authorize'){assert.equal(u.searchParams.get('provider'),provider);assert.equal(u.searchParams.get('redirect_to'),'https://raulchulbi-sys.github.io/SIMPLE/');return r.fulfill({contentType:'text/html',body:'<script>location.replace('+JSON.stringify('http://simple.test/'+(scenario==='cancel'?'#error=access_denied&error_description=Cancelled':hash))+')</script>'});}
   if(u.pathname==='/auth/v1/user')return scenario==='invalid-callback'?reply({code:'bad_jwt',msg:'invalid test token'},401):reply(account);
   if(u.pathname==='/rest/v1/profiles'){
    if(method==='POST'){
     assert.equal(profile,null);
     if(scenario==='profile-race'){profile={id:uid,name:'Concurrent existing profile',role:'trainer'};return reply({code:'23505',message:'local duplicate profile'},409);}
     profile=r.request().postDataJSON();return reply(profile,201);
    }
    assert.equal(method,'GET');assert.equal(u.searchParams.get('id'),'eq.'+uid);return reply(profile);
   }
   if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204});
   if(u.pathname.startsWith('/rest/'))return reply([]);
   return reply({code:'unexpected_local_route'},400);
  });
  try{
   await p.goto('http://simple.test/');await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);
   if(entry==='signup'){await p.getByRole('button',{name:'Crear una cuenta',exact:true}).click();await p.getByRole('button',{name:scenario.endsWith('trainer')?/^Atleta/:/^Entrenador/}).click();}
   else await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
   if(googleOnly){assert.equal(await p.getByRole('button',{name:'Continuar con Apple',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Continuar con Facebook',exact:true}).count(),0);}
   if(['disabled','unconfigured','settings-error'].includes(scenario)){
    await p.waitForFunction(()=>!simpleOAuth.loading||simpleOAuth.available.size===0);assert.equal(await p.locator('#authOAuth button:visible').count(),0);for(const provider of ['google','apple','facebook'])await p.evaluate(provider=>beginOAuth(provider),provider);assert.equal(calls.filter(c=>c.path==='/auth/v1/authorize').length,0);
   }else{
    await p.getByRole('button',{name:'Continuar con '+({google:'Google',apple:'Apple',facebook:'Facebook'}[provider]),exact:true}).click();
    if(['cancel','invalid-callback'].includes(scenario)){
     // The pre-redirect login page can also be idle. Await the actual callback
     // document before checking its error; otherwise this races navigation.
     await p.waitForFunction(()=>typeof SIMPLE_AUTH_CALLBACK!=='undefined'&&(SIMPLE_AUTH_CALLBACK.error||SIMPLE_AUTH_CALLBACK.access));
     await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy&&['login','error'].includes(simpleAuth.screen));assert.equal(await p.locator('#app').isVisible(),false);assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='POST').length,0);assert((await p.locator('#authMsg').innerText()).length>10);
    }
    else if(scenario.startsWith('existing')){await p.waitForFunction(()=>window.__simpleStarted);assert.equal(await p.evaluate(()=>profile.role),scenario.endsWith('trainer')?'trainer':'client');assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method!=='GET').length,0);await p.reload();await p.waitForFunction(()=>window.__simpleStarted);}
    else{await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&simpleAuth.screen==='complete'&&!simpleAuth.busy);assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='POST').length,0);await p.getByRole('button',{name:scenario.endsWith('trainer')?/^Entrenador/:/^Atleta/}).click();await p.waitForFunction(()=>window.__simpleStarted);assert.equal(profile.role,scenario==='profile-race'||scenario.endsWith('trainer')?'trainer':'client');assert.equal(profile.id,uid);assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='POST').length,1);}
    if(scenario.startsWith('existing')||scenario.startsWith('new')||scenario==='profile-race'){
     assert.deepEqual(await p.evaluate(()=>({userId:user.id,profileId:profile.id})),{userId:uid,profileId:uid});
     assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&['PATCH','DELETE'].includes(c.method)).length,0);
     if(googleOnly){await p.reload();await p.waitForFunction(()=>window.__simpleStarted);assert.equal(await p.evaluate(()=>user.id),uid);await p.evaluate(()=>authLogout());await p.waitForFunction(()=>simpleAuth.screen==='welcome'&&!simpleAuth.busy);assert.equal(await p.evaluate(()=>user),null);}
    }
   }
   assert.deepEqual(errors,[]);results.push({engine,width,entry,scenario,pass:true});
  }catch(e){results.push({engine,width,entry,scenario,pass:false,error:e.message});}
  await p.close();
 }}finally{await browser.close()}
}
const report={kind:'Real Supabase SDK with HTTP doubles; live OAuth NOT verified',provider:googleOnly?'google':'mixed',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results};fs.writeFileSync(path.join(__dirname,googleOnly?'results/google-sdk.json':'results/oauth-sdk.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
