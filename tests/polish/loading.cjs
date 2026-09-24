const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const legacy=fs.readFileSync('C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/test-ux-browser.cjs','utf8');
const basic=vm.runInNewContext(legacy.slice(legacy.indexOf('const stub='),legacy.indexOf('const results=[]'))+'stub');
const source=fs.readFileSync('tests/onboarding/browser.cjs','utf8');
const stub=vm.runInNewContext(source.slice(source.indexOf('\nconst stub='),source.lastIndexOf('\nconst results=[]'))+'stub',{basic}).replace('await sleep(a.sessionDelay);','if(window.__seed.hold)await new Promise(resolve=>window.releaseBoot=resolve);await sleep(a.sessionDelay);').replace('return {data:{session:a.user?{user:a.user}:null}}','a.sessionResolvedAt=performance.now();return {data:{session:a.user?{user:a.user}:null}}');
const results=[],shots=[];
(async()=>{for(const engine of ['chromium','webkit']){
 const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [320,360,390,430,768,1280])for(const theme of ['light','dark']){
 const p=await b.newPage({viewport:{width,height:900},colorScheme:theme==='dark'?'light':'dark',reducedMotion:'reduce'});p.setDefaultTimeout(6000);
 const test=async(name,fn)=>{try{await fn();results.push({engine,width,theme,name,pass:true})}catch(e){results.push({engine,width,theme,name,pass:false,error:e.message})}};
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(theme=>{localStorage.setItem('simple_theme_v1',theme);window.__seed={hold:!location.search.includes('fast=1'),user:{id:'U',email:'loading@example.invalid',app_metadata:{provider:'email'}},profile:{id:'U',name:'Atleta',role:'client'}};window.firstPaintThemes=[];new MutationObserver(()=>{if(!window.fastAuthReadyAt&&document.getElementById('app')?.style.display==='block')window.fastAuthReadyAt=performance.now();}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});let frames=0;function record(){if(document.documentElement&&document.body){firstPaintThemes.push({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.documentElement).backgroundColor});}if(++frames<30)requestAnimationFrame(record)}requestAnimationFrame(record)},theme);
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({body:stub,contentType:'application/javascript'});if(u.origin!=='http://simple.test')return r.abort();const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html'})});
 await p.goto('http://simple.test/');await p.waitForFunction(()=>typeof releaseBoot==='function');
 await test('Real pending auth shows only centered SIMPLE and existing subtle Atlas in correct first-paint theme',async()=>{
  assert.equal(await p.locator('#auth').getAttribute('data-screen'),'boot');assert.equal(await p.locator('#auth button:visible').count(),0);assert.equal(await p.locator('#app').isVisible(),false);const a=await p.locator('.auth-art').evaluate(e=>({bg:getComputedStyle(e).backgroundImage,o:+getComputedStyle(e).opacity}));assert.match(a.bg,/atlas\.webp/);assert(a.o>0&&a.o<=.15);
  const brand=await p.locator('.auth-brand').boundingBox();assert(Math.abs(brand.x+brand.width/2-width/2)<4);assert.equal(await p.locator('#authLoading').innerText(),'');assert.equal(await p.locator('#authLoading').evaluate(e=>getComputedStyle(e).animationName),'none');
  await p.waitForTimeout(100);const frames=await p.evaluate(()=>firstPaintThemes);assert(frames.length>0);assert(frames.every(f=>f.theme===theme));assert(frames.every(f=>f.bg===(theme==='light'?'rgb(247, 245, 241)':'rgb(32, 36, 35)')));
  const file=engine+'-'+width+'-auth-loading-'+theme+'.png';await p.screenshot({path:path.join(out,file)});shots.push(file);
 });
 await test('Resolved session immediately proceeds; profile identity, no artificial minimum or wrong login frame',async()=>{
  const start=await p.evaluate(()=>{window.authScreens=[];new MutationObserver(()=>authScreens.push(document.getElementById('auth').dataset.screen)).observe(document.getElementById('auth'),{attributes:true,attributeFilter:['data-screen']});const t=performance.now();releaseBoot();return t;});await p.waitForFunction(()=>window.__simpleStarted);const r=await p.evaluate(()=>({elapsed:performance.now(),screens:authScreens,role:profile.role,id:user.id,theme:simpleTheme.choice}));assert(!r.screens.some(s=>['login','welcome','signup'].includes(s)));assert.equal(r.role,'client');assert.equal(r.id,'U');assert.equal(r.theme,theme);assert(r.elapsed-start<1500,'Excessive local completion delay');
 });
 await test('Fast persisted session has no minimum splash duration',async()=>{await p.goto('http://simple.test/?fast=1');await p.waitForFunction(()=>window.__simpleStarted&&window.fastAuthReadyAt);const duration=await p.evaluate(()=>fastAuthReadyAt-authTest.sessionResolvedAt);assert(duration>=0&&duration<500,'Time from resolved session to app: '+duration);assert.equal(await p.locator('html').getAttribute('data-theme'),theme);});
 await test('No loading/callback JavaScript errors',()=>assert.deepEqual(errors,[]));
 await p.close();
 }}finally{await b.close();}
}
const report={passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results,shots};fs.writeFileSync(path.join(out,'loading.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
