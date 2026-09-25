const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.SIMPLE_PUBLIC_URL||'http://127.0.0.1:4187/',pub=!!process.env.SIMPLE_PUBLIC_URL,out=path.join(__dirname,'results'),rows=[],shots=[];fs.mkdirSync(out,{recursive:true});
const before=cp.execFileSync('git',['show','06736a4:index.html'],{encoding:'utf8',maxBuffer:2e6}),after=fs.readFileSync('index.html','utf8');assert.equal(after.replace(/\r\n/g,'\n'),before.replace(/\r\n/g,'\n'),'HTML and all behavior must remain unchanged');
(async()=>{for(const engine of ['chromium','webkit']){const b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
for(const width of (process.env.OCEAN_WIDTHS||'320,360,390,430,1280').split(',').map(Number))for(const role of ['client','trainer']){
const p=await b.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});p.setDefaultTimeout(7000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
if(pub)await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('supabase-js'))return r.fulfill({body:fs.readFileSync('tests/interior/mock-sdk.js'),contentType:'application/javascript'});if(u.origin===new URL(base).origin&&r.request().method()==='GET')return r.continue();return r.abort()});
await p.goto(base+'?role='+role+'&state=history');if(pub)await p.addScriptTag({content:fs.readFileSync('tests/interior/preview-seed.js','utf8')});await p.waitForFunction(()=>window.previewReady);
await p.evaluate(()=>{window.oceanDone=0;const old=db.rpc.bind(db);db.rpc=(n,a)=>n==='get_client_routine_cycle_progress'?Promise.resolve({data:[{total_days:mock.tables.routine_days.filter(d=>d.routine_id===a.p_routine_id).length,completed_days:Math.min(oceanDone,mock.tables.routine_days.filter(d=>d.routine_id===a.p_routine_id).length)}],error:null}):old(n,a);localStorage.setItem('ocean-test-draft','42.5');});
for(const done of [0,3,5]){
await p.evaluate(async({role,done})=>{oceanDone=done;if(role==='client'){view('shared');await renderShared();}else{view('mine');await renderMine();}}, {role,done});
const root=role==='client'?'#shared':'#mine',bar=p.locator(root+' .weekly-progress-bar').first();await bar.waitFor();await bar.scrollIntoViewIfNeeded();
let shape;
for(const theme of ['light','dark']){
await p.evaluate(t=>simpleTheme.set(t),theme);await p.waitForTimeout(100);
const actual=await bar.evaluate(e=>{const box=e.getBoundingClientRect();return {done:Number(e.getAttribute('aria-valuenow')),total:Number(e.getAttribute('aria-valuemax')),segments:[...e.children].map(s=>({done:s.classList.contains('is-done'),color:getComputedStyle(s).backgroundColor,shadow:getComputedStyle(s).boxShadow})),shape:[box.width,box.height,...[...e.children].flatMap(s=>{const r=s.getBoundingClientRect();return[r.width,r.height]})],page:document.documentElement.scrollWidth,width:innerWidth,draft:localStorage.getItem('ocean-test-draft'),success:getComputedStyle(document.documentElement).getPropertyValue('--simple-success-fill').trim(),chart:getComputedStyle(document.documentElement).getPropertyValue('--simple-chart').trim()};});
assert.equal(actual.done,done);assert.equal(actual.total,5);assert.equal(actual.segments.filter(s=>s.done).length,done);
for(const s of actual.segments){assert.equal(s.color,s.done?(theme==='light'?'rgb(47, 111, 137)':'rgb(113, 183, 209)'):(theme==='light'?'rgb(233, 229, 222)':'rgb(60, 67, 63)'));assert.equal(s.shadow,'none');}
assert(actual.page<=actual.width);assert.equal(actual.draft,'42.5');assert.equal(actual.success,theme==='light'?'#535d55':'#bbcbbd');assert.equal(actual.chart,theme==='light'?'#3f5748':'#c1d0c2');
if(shape)assert.deepEqual(actual.shape,shape);shape=actual.shape;
assert.match(await p.locator(root).innerText(),new RegExp(done+'/5 del ciclo actual'));
if(done===5)assert.match(await p.locator(root).innerText(),/Rutina finalizada/);
if(engine==='chromium'&&[390,1280].includes(width)&&done!==0){const name=(pub?'public-':'')+role+'-'+width+'-'+theme+'-'+done+'.png';await p.screenshot({path:path.join(out,name)});shots.push(name);}
}
rows.push({engine,width,role,done,pass:true});
}
if(role==='trainer'){await p.evaluate(async()=>{view('clients');await renderClients();});assert.match(await p.locator('#clients').innerText(),/5\/5 del ciclo actual/);assert.equal(await p.locator('#clients .weekly-progress-bar').count(),0,'Do not add a dashboard bar');await p.evaluate(()=>openClientProfile('00000000-0000-4000-8000-000000000002'));assert.match(await p.locator('#clientModalBody').innerText(),/5\/5 del ciclo actual/);assert.equal(await p.locator('#clientModal .weekly-progress-bar').count(),0,'Do not add a client-profile bar');}
assert.deepEqual(errors,[]);await p.close();
}}finally{await b.close();}}
fs.writeFileSync(path.join(out,(pub?'public-':'')+'browser.json'),JSON.stringify({passed:rows.length,failed:[],rows,shots},null,2));console.log(JSON.stringify({passed:rows.length,failed:[],shots:shots.length}));})().catch(e=>{console.error(e);process.exitCode=1});

