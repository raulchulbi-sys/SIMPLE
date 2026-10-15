'use strict';
// Native public delivery only: no sessions, Auth, forms, SDK, routes or backend calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {sha,playwright,cleanError}=require('./live-hosting.cjs');
const {PAGES_PROJECTS}=require('../../scripts/hosting-runtime.cjs');
const root=path.resolve(__dirname,'../..'),args=process.argv.slice(2),values={};
for(let i=0;i<args.length;i+=2){assert(['--url','--deployment-url','--commit'].includes(args[i])&&args[i+1]);assert(!values[args[i]]);values[args[i]]=args[i+1];}
const stable=new URL(values['--url']),deployment=new URL(values['--deployment-url']);
assert.equal(stable.href,`https://${PAGES_PROJECTS.production}.pages.dev/`);
assert.equal(deployment.protocol,'https:');assert(!deployment.username&&!deployment.password&&!deployment.port&&!deployment.search&&!deployment.hash&&deployment.pathname==='/');
assert(new RegExp('^[a-f0-9]{8,64}\\.'+PAGES_PROJECTS.production+'\\.pages\\.dev$').test(deployment.hostname));
assert(/^[a-f0-9]{40}$/.test(values['--commit']||''));
const out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const fixtures={'index.html':'index.html','404.html':'404.html','assets/preparation.css':'preparation.css','robots.txt':'robots.txt'};
const bytes={};for(const [name,file] of Object.entries(fixtures))bytes[name]=Buffer.from(fs.readFileSync(path.join(root,'config/cloudflare/preparation',file),'utf8').replace(/\r\n/g,'\n'));
const rows=[];const report={kind:'native placeholder HTTPS only; no application/backend/login/OpenAI',sourceCommit:values['--commit'],stable:stable.href,deployment:deployment.href,rows};
async function test(name,fn){try{await fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:cleanError(e)});}}
async function get(url,method='GET'){assert(['GET','HEAD'].includes(method));const r=await fetch(url,{method,redirect:'manual',cache:'no-store'});const content=Buffer.from(await r.arrayBuffer());return {status:r.status,headers:Object.fromEntries(r.headers),content};}
function headers(h){assert(h['content-security-policy']?.includes("default-src 'none'; style-src 'self'"));assert(h['content-security-policy']?.includes("form-action 'none'; frame-ancestors 'none'"));assert.equal(h['x-frame-options'],'DENY');assert.equal(h['x-content-type-options'],'nosniff');assert.equal(h['referrer-policy'],'no-referrer');assert(h['cache-control']?.includes('no-store'));assert(!h['content-security-policy-report-only']);}
async function main(){
 for(const [label,base] of [['root',stable],['hash',deployment]]){
  await test(label+': exact public files and enforced headers',async()=>{for(const [name,content] of Object.entries(bytes)){const route=name==='index.html'?'/':name==='404.html'?'404':name;const r=await get(new URL(route,base));assert.equal(r.status,200);assert.equal(sha(r.content),sha(content));headers(r.headers);}});
  await test(label+': HEAD, query and HTTP upgrade stay inert',async()=>{const head=await get(base,'HEAD');assert.equal(head.status,200);assert.equal(head.content.length,0);headers(head.headers);const query=await get(new URL('?reset=1&code=hosting-readonly',base));assert.equal(query.status,200);assert.equal(sha(query.content),sha(bytes['index.html']));const insecure=new URL(base);insecure.protocol='http:';const upgrade=await get(insecure);assert([301,302,307,308].includes(upgrade.status));assert.equal(new URL(upgrade.headers.location,insecure).origin,base.origin);});
  await test(label+': internal paths have genuine inert 404',async()=>{for(const name of ['assets/runtime-config.js','.env','.git/config','scripts/hosting-build.cjs','supabase/migrations/example.sql','tests/cloudflare/private/session.json','_headers','unknown-page']){const r=await get(new URL(name,base));assert.equal(r.status,404,name);assert.equal(sha(r.content),sha(bytes['404.html']),name);headers(r.headers);}});
  await test(label+': encoded traversal denied',async()=>{const r=await get(new URL('/%2e%2e%2fconfig/public-backends.json',base));assert([400,404].includes(r.status));assert(!r.content.toString().includes('publicKey'));});
 }
 if(rows.some(r=>!r.pass))return;
 const engines=playwright();
 for(const engine of ['chromium','webkit']){
  const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{for(const width of [320,360,390,430,1280])for(const theme of ['light','dark'])await test(`${engine}/${width}/${theme}`,async()=>{
   const base=width===1280?deployment:stable;
   const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,serviceWorkers:'block'});
   const requests=[],errors=[];context.on('request',r=>{const u=new URL(r.url());requests.push({origin:u.origin,path:u.pathname,method:r.method()});});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(cleanError(e)));
   try{const response=await page.goto(base.href,{waitUntil:'load'});assert.equal(response.status(),200);assert.equal(await page.getByRole('heading',{name:'Alojamiento en preparación',exact:true}).count(),1);assert.equal(await page.locator('script,form,iframe').count(),0);assert.equal(errors.length,0);assert(requests.every(r=>r.origin===base.origin&&r.method==='GET'&&['/','/assets/preparation.css','/favicon.ico'].includes(r.path)));assert.equal(await page.evaluate(()=>window.innerWidth>=document.documentElement.scrollWidth),true);const link=page.getByRole('link',{name:'Acceder a SIMPLE',exact:true});await link.focus();assert.equal(await link.evaluate(el=>el===document.activeElement),true);await page.screenshot({path:path.join(out,`placeholder-${engine}-${width}-${theme}.png`),fullPage:true});}
   finally{await context.close();}
  });}finally{await browser.close();}
 }
}
main().catch(e=>rows.push({name:'harness',pass:false,error:cleanError(e)})).finally(()=>{report.passed=rows.filter(r=>r.pass).length;report.failed=rows.filter(r=>!r.pass).length;report.total=rows.length;fs.writeFileSync(path.join(out,'placeholder-live.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,total:report.total,failures:rows.filter(r=>!r.pass)},null,2));if(report.failed||rows.length!==28)process.exitCode=1;});
