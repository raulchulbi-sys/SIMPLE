// Presentation + interaction checks. All Auth requests are intercepted; no live login.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sdk=fs.readFileSync(path.join(root,'tests/onboarding/private/supabase-2.115.0.js'));
const publicMode=process.env.GOOGLE_BUTTON_PUBLIC==='1';
const base=publicMode?'https://raulchulbi-sys.github.io/SIMPLE/':'http://simple.test/';
const results=[],out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(8000);const errors=[];let unexpected=0;
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(t=>localStorage.setItem('simple_theme_v1',t),theme);
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===new URL(base).origin){
     assert.equal(route.request().method(),'GET');if(publicMode)return route.continue();
     const file=path.resolve(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
     if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
     const types={'.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
     return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'text/html'});
    }
    if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({body:sdk,contentType:'application/javascript'});
    if(u.hostname==='yvguatdqncadkwewlepe.supabase.co'&&u.pathname==='/auth/v1/settings')return route.fulfill({json:{external:{google:true,apple:false,facebook:false}}});
    unexpected++;return route.abort();
   });
   await page.goto(base);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
   for(const entry of ['login','signup']){
    if(entry==='signup'){await page.getByRole('button',{name:'Crea tu cuenta',exact:true}).click();await page.getByRole('button',{name:/^Atleta/}).click();}
    const google=page.getByRole('button',{name:'Continuar con Google',exact:true});await google.waitFor();
    await page.waitForFunction(()=>{const i=document.querySelector('.auth-oauth-logo');return i?.complete&&i.naturalWidth>0;});
    assert(await google.isEnabled());assert.equal(await page.getByRole('button',{name:/Continuar con (Apple|Facebook)/}).count(),0);
    assert(await page.getByLabel('Correo electrónico',{exact:true}).isVisible());assert(await page.getByLabel('Contraseña',{exact:true}).isVisible());
    const box=await google.boundingBox(),form=await page.locator('#authForm').boundingBox();assert(box.height>=44);assert(Math.abs(box.width-form.width)<1);
    assert(box.y+box.height<form.y,'Google precedes the email form');
    assert.equal(await page.locator('.auth-oauth-separator').innerText(),'o');
    const labelBox=await google.locator('.auth-oauth-label').boundingBox();assert(Math.abs(labelBox.x+labelBox.width/2-box.x-box.width/2)<1,'Text is visually centered');
    const logoBox=await google.locator('img').boundingBox();assert(logoBox.x<labelBox.x,'Official logo stays left of text');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await google.locator('img').getAttribute('alt'),'');
    assert.deepEqual(await google.locator('img').evaluate(i=>({width:i.width,height:i.height})),{width:20,height:20});
    await page.keyboard.press('Tab');await google.focus();assert(await google.evaluate(e=>e===document.activeElement));
    assert(await google.evaluate(e=>parseFloat(getComputedStyle(e).outlineWidth)>=2));
    if(engine==='chromium'&&[390,1280].includes(width))await page.screenshot({path:path.join(out,`google-button-${publicMode?'public':'local'}-${entry}-${width}-${theme}.png`),fullPage:true});
    // Keep the request pending to exercise the busy guard and double activation.
    await page.evaluate(()=>{window.__googleCalls=0;db.auth.signInWithOAuth=()=>{window.__googleCalls++;return new Promise(resolve=>window.__finishGoogle=resolve);};});
    await google.evaluate(b=>{b.click();b.click();});
    assert.equal(await page.evaluate(()=>window.__googleCalls),1);assert(await google.isDisabled());assert.equal(await page.locator('#auth').getAttribute('aria-busy'),'true');
    assert.equal(await google.getAttribute('aria-busy'),'true');assert.equal(await google.locator('.auth-oauth-label').innerText(),'Conectando…');
    await page.evaluate(()=>window.__finishGoogle({error:{message:'test failure'}}));await page.waitForFunction(()=>!simpleAuth.busy);
    assert(await google.isEnabled());assert.match(await page.locator('#authMsg').innerText(),/No se pudo abrir Google/);
    await google.click();assert.equal(await page.evaluate(()=>window.__googleCalls),2);
    await page.evaluate(()=>window.__finishGoogle({error:{message:'retry failure'}}));await page.waitForFunction(()=>!simpleAuth.busy);
   }
   assert.equal(unexpected,0);assert.deepEqual(errors,[]);results.push({engine,width,theme,entries:['login','signup'],pass:true});
  }catch(e){results.push({engine,width,theme,pass:false,error:e.message});}
  await page.close();
 }}finally{await browser.close();}
}
const report={kind:publicMode?'Public assets; Auth intercepted':'Local candidate; Auth intercepted',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results};
fs.writeFileSync(path.join(out,`google-button-${publicMode?'public':'local'}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
