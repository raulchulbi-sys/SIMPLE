// Requires preview.cjs. Tests the actual frontend/SDK with all API access blocked.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results'),results=[];
const previewURL=`http://127.0.0.1:${Number(process.env.AUTH_PREVIEW_PORT||4180)}/`;
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [320,390,430,1280]){
  const p=await browser.newPage({viewport:{width,height:844}}),network=[],errors=[];p.on('request',r=>network.push(r.url()));p.on('pageerror',e=>errors.push(e.message));
  async function test(name,fn){try{await fn();results.push({engine,width,name,pass:true})}catch(e){results.push({engine,width,name,pass:false,error:e.message})}}
  const response=await p.goto(previewURL);assert.match(response.headers()['content-security-policy'],/connect-src 'none'/);
  await p.waitForFunction(()=>document.getElementById('auth').dataset.screen==='welcome');
  for(const screen of ['welcome','roles','signup','login']){
   if(screen==='roles')await p.getByRole('button',{name:'Crear una cuenta',exact:true}).click();
   if(screen==='signup')await p.locator('#authRoles .auth-role').first().click();
   if(screen==='login')await p.locator('#authSwitch').click();
   await p.waitForFunction(()=>!document.getElementById('auth').getAnimations({subtree:true}).some(a=>a.playState==='running'));
   await test(screen+' stays within viewport and keeps touch targets usable',async()=>{
    const state=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,boxes:[...document.querySelectorAll('#auth .auth-button,#auth .auth-role,#auth .password-eye')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}})}));
    assert.equal(state.overflow,false);assert(state.boxes.every(r=>r.left>=0&&r.right<=width+.5&&r.height>=44));
   });
   await p.screenshot({path:path.join(out,`final-${engine}-${width}-${screen}.png`),fullPage:true});
  }
  await test('Keyboard focus is visible; no OAuth buttons or remote traffic',async()=>{
   await p.locator('#password').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'passwordToggle');assert.equal(await p.locator('#passwordToggle').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
   assert.equal(await p.locator('#auth').getByRole('button',{name:/Google|Apple|Facebook/}).count(),0);assert(network.every(u=>u.startsWith(previewURL)));assert.deepEqual(errors,[]);
  });
  await test('Short viewport allows scroll to submit without horizontal overflow',async()=>{
   await p.setViewportSize({width,height:430});await p.locator('#password').focus();await p.locator('#authBtn').scrollIntoViewIfNeeded();
   const rect=await p.locator('#authBtn').boundingBox();assert(rect.y>=0&&rect.y+rect.height<=430);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.screenshot({path:path.join(out,`final-${engine}-${width}-short.png`),fullPage:true});
  });
  await p.close();
 }}finally{await browser.close()}
}
const report={passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results};fs.writeFileSync(path.join(out,'visual-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
