const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'results'),results=[];
(async()=>{for(const engine of ['chromium','webkit']){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 try{for(const width of [320,390,430,1280])for(const role of ['client','trainer']){
 const p=await browser.newPage({viewport:{width,height:844}});p.setDefaultTimeout(5000);
 const test=async(name,fn)=>{try{await fn();results.push({engine,width,role,name,pass:true})}catch(e){results.push({engine,width,role,name,pass:false,error:e.message})}};
 const open=async()=>{if(role==='trainer'){await p.locator('#tMine').click();await p.locator('[data-open-routine]').first().click();await p.locator('#clientSessionList').waitFor()}else{await p.locator('#shared .routine .primary').click();await p.locator('.interior-session-list').waitFor()}};
 await p.goto('http://127.0.0.1:4182/?role='+role+'&state=long');await p.waitForFunction(()=>window.previewReady);await open();
 const sheet=role==='trainer'?'#editModal .sheet':'#trainModal .sheet',list=role==='trainer'?'#clientSessionList':'.interior-session-list';
 await test('Long session names stay fully readable with no horizontal overflow',async()=>{
 const state=await p.locator(sheet).evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,text:e.innerText}));
 assert(state.scroll<=state.width+1);assert(state.text.includes('Sesión de empuje con trabajo de hombro, pecho y tríceps — nombre completo'));
 const box=await p.locator(sheet).boundingBox();assert(box.x>=-.5&&box.x+box.width<=width+.5);
 });await p.screenshot({path:path.join(out,engine+'-'+width+'-'+role+'-long-sessions.png'),fullPage:true});
 await test('Keyboard focus visible in session list',async()=>{const target=p.locator(list+' button').first();await target.focus();await p.keyboard.press('Tab');assert.notEqual(await p.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none')});
 await test('Short viewport keeps final session action reachable by scrolling',async()=>{
 await p.setViewportSize({width,height:430});const target=p.locator(list+' button').last();await target.scrollIntoViewIfNeeded();const r=await target.boundingBox();assert(r.y>=0&&r.y+r.height<=430);assert.equal(await p.locator(sheet).evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 });
 await p.goto('http://127.0.0.1:4182/?role='+role);await p.waitForFunction(()=>window.previewReady);await p.evaluate(()=>{mock.tables.routine_days=[];mock.tables.routine_exercises=[]});await open();
 await test('Empty session list retains original empty message and navigation',async()=>{const text=await p.locator(sheet).innerText();assert.match(text,role==='trainer'?/No hay sesiones/:/todavía no tiene días/);assert(await p.locator(sheet).getByRole('button',{name:role==='trainer'?'← Mis rutinas':'Cerrar',exact:true}).isVisible())});
 await p.close();
 }}finally{await browser.close()}
}
const report={passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),results};fs.writeFileSync(path.join(out,'edge-cases.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed},null,2));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
