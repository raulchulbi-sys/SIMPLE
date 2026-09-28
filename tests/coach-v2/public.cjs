// Public deployment smoke: anonymous browser, GET assets only. No account or workout changes.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),base='https://raulchulbi-sys.github.io/SIMPLE/';
const rows=[];const check=(name,pass)=>{assert(pass,name);rows.push({name,pass:true});};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 for(const file of ['index.html','assets/coach.js','assets/coach-reviewer.js','assets/coach.css']){
  const r=await fetch(base+file+'?v=pilot-supervised-v2',{cache:'no-store'});assert.equal(r.status,200);
  const content=Buffer.from(await r.arrayBuffer()),expected=cp.execFileSync('git',['show','HEAD:'+file],{cwd:root});
  check('public SHA256 matches committed '+file,hash(content)===hash(expected));
 }
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[],assets=[];page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/assets\/coach(?:-reviewer)?\.(?:js|css)/.test(r.url()))assets.push({url:r.url(),status:r.status()});});
   // Restrict to public GETs. Auth settings are read-only; no OAuth, email or account action is performed.
   await page.route('**/*',r=>r.request().method()==='GET'?r.continue():r.abort());
   await page.goto(base+'?v=pilot-supervised-v2');await page.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);
   check(engine+' '+width+' three Coach assets loaded',assets.length===3&&assets.every(x=>x.status===200));
   check(engine+' '+width+' anonymous no pilot/reviewer entry',await page.locator('#coachHome,#coachReviewerEntry').count()===0);
   await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('#password').waitFor();
   check(engine+' '+width+' existing email login visible',await page.locator('#email').isVisible());
   check(engine+' '+width+' no JavaScript errors',errors.length===0);
   check(engine+' '+width+' no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await page.screenshot({path:path.join(out,'public-'+engine+'-login.png')});
   await page.close();
  }}finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'public.json'),JSON.stringify({url:base,checks:rows.length,passed:rows.length,rows},null,2));console.log(JSON.stringify({passed:rows.length,url:base}));
})().catch(e=>{fs.writeFileSync(path.join(out,'public.json'),JSON.stringify({passed:rows.length,rows,error:e.message},null,2));console.error(e.message);process.exitCode=1;});
