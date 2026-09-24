// Real SDK, intercepted HTTP. This does NOT validate any live provider or linking.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),sdk=fs.readFileSync(path.join(root,'tests/onboarding/private/supabase-2.115.0.js'));
assert.equal(crypto.createHash('sha256').update(sdk).digest('hex'),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const results=[],uid='00000000-0000-4000-8000-000000000456';
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [320,1280])for(const scenario of ['disabled','unconfigured','existing-client','existing-trainer','new-client','new-trainer','cancel','invalid-callback']){
  const p=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));
  const provider=scenario==='existing-trainer'?'apple':scenario==='new-trainer'?'facebook':'google';
  const account={id:uid,aud:'authenticated',role:'authenticated',email:'oauth-local@example.invalid',app_metadata:{provider,providers:[provider]},user_metadata:{simple_role:'trainer'},identities:[]};
  let profile=scenario.startsWith('existing')?{id:uid,name:'Existing',role:scenario.endsWith('trainer')?'trainer':'client'}:null;
  const exp=Math.floor(Date.now()/1000)+3600,jwt=[{alg:'HS256',typ:'JWT'},{sub:uid,exp,iat:exp-3600,role:'authenticated',aud:'authenticated'},'local-test'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
  const hash='#'+new URLSearchParams({access_token:jwt,refresh_token:'local-refresh',expires_in:'3600',token_type:'bearer'});
  await p.route('**/*',async r=>{const u=new URL(r.request().url()),method=r.request().method();
   if(u.origin==='http://simple.test'){
    const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404});let body=fs.readFileSync(file);
    // Test-only release flags; production source remains all false.
    if(u.pathname==='/assets/oauth.js'&&scenario!=='disabled')body=body.toString().replace('{google:false,apple:false,facebook:false}','{google:true,apple:true,facebook:true}');
    return r.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html'});
   }
   if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({body:sdk,contentType:'application/javascript'});
   if(u.hostname!=='yvguatdqncadkwewlepe.supabase.co')return r.abort();
   calls.push({path:u.pathname,method,query:u.search,body:r.request().postDataJSON()});const reply=(body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(u.pathname==='/auth/v1/settings')return reply({external:{google:scenario!=='unconfigured',apple:scenario!=='unconfigured',facebook:scenario!=='unconfigured'}});
   if(u.pathname==='/auth/v1/authorize'){assert.equal(u.searchParams.get('provider'),provider);assert.equal(u.searchParams.get('redirect_to'),'https://raulchulbi-sys.github.io/SIMPLE/');return r.fulfill({contentType:'text/html',body:'<script>location.replace('+JSON.stringify('http://simple.test/'+(scenario==='cancel'?'#error=access_denied&error_description=Cancelled':hash))+')</script>'});}
   if(u.pathname==='/auth/v1/user')return scenario==='invalid-callback'?reply({code:'bad_jwt',msg:'invalid test token'},401):reply(account);
   if(u.pathname==='/rest/v1/profiles'){if(method==='POST'){assert.equal(profile,null);profile=r.request().postDataJSON();return reply(profile,201);}return reply(profile);}
   if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204});
   if(u.pathname.startsWith('/rest/'))return reply([]);
   return reply({code:'unexpected_local_route'},400);
  });
  try{
   await p.goto('http://simple.test/');await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);await p.getByRole('button',{name:'Crear una cuenta',exact:true}).click();await p.getByRole('button',{name:/^Entrenador/}).click();
   if(['disabled','unconfigured'].includes(scenario)){
    await p.waitForFunction(()=>!simpleOAuth.loading||simpleOAuth.available.size===0);assert.equal(await p.locator('#authOAuth button:visible').count(),0);for(const provider of ['google','apple','facebook'])await p.evaluate(provider=>beginOAuth(provider),provider);assert.equal(calls.filter(c=>c.path==='/auth/v1/authorize').length,0);
   }else{
    await p.getByRole('button',{name:'Continuar con '+({google:'Google',apple:'Apple',facebook:'Facebook'}[provider]),exact:true}).click();
    if(['cancel','invalid-callback'].includes(scenario)){await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy&&['login','error'].includes(simpleAuth.screen));assert.equal(await p.locator('#app').isVisible(),false);assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='POST').length,0);assert((await p.locator('#authMsg').innerText()).length>10);}
    else if(scenario.startsWith('existing')){await p.waitForFunction(()=>window.__simpleStarted);assert.equal(await p.evaluate(()=>profile.role),scenario.endsWith('trainer')?'trainer':'client');assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method!=='GET').length,0);await p.reload();await p.waitForFunction(()=>window.__simpleStarted);}
    else{await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&simpleAuth.screen==='complete'&&!simpleAuth.busy);assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='POST').length,0);await p.getByRole('button',{name:scenario.endsWith('trainer')?/^Entrenador/:/^Atleta/}).click();await p.waitForFunction(()=>window.__simpleStarted);assert.equal(profile.role,scenario.endsWith('trainer')?'trainer':'client');assert.equal(profile.id,uid);assert.equal(calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='POST').length,1);}
   }
   assert.deepEqual(errors,[]);results.push({engine,width,scenario,pass:true});
  }catch(e){results.push({engine,width,scenario,pass:false,error:e.message});}
  await p.close();
 }}finally{await browser.close()}
}
const report={kind:'Real Supabase SDK with HTTP doubles; live OAuth NOT verified',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results};fs.writeFileSync(path.join(__dirname,'results/oauth-sdk.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
