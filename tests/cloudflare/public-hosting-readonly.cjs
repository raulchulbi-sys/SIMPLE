'use strict';
// Public GET-only release reconciliation. No browser session, API, email or deployment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),rows=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const github='https://raulchulbi-sys.github.io/SIMPLE/';
const stage='https://simple-staging-raulchulbi.pages.dev/';
const placeholder='https://simple-raulchulbi.pages.dev/';
const main=process.argv[2];assert(/^[a-f0-9]{40}$/.test(main||''),'Full verified main SHA required');
async function get(url){const u=new URL(url);assert([github,stage,placeholder].some(base=>u.href.startsWith(base)));const response=await fetch(u,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});return{status:response.status,headers:response.headers,bytes:Buffer.from(await response.arrayBuffer())};}
async function check(name,fn){try{rows.push({name,pass:true,...await fn()});}catch(error){rows.push({name,pass:false,error:error.name==='AssertionError'?'contract_assertion_failed':'network_or_response_failure'});}}
async function mainRun(){
 await check('GitHub Pages still serves verified main HTML',async()=>{const r=await get(github);assert.equal(r.status,200);const expected=execFileSync('git',['show',main+':index.html'],{cwd:root,maxBuffer:4*1024*1024});assert.equal(hash(r.bytes),hash(expected));return{sourceCommit:main,sha256:hash(r.bytes)};});
 await check('Cloudflare production still serves only the inert placeholder',async()=>{
  const files={'':'index.html','404':'404.html','assets/preparation.css':'preparation.css','robots.txt':'robots.txt'};
  const hashes=[];
  for(const[route,file]of Object.entries(files)){const r=await get(placeholder+route);assert.equal(r.status,200);const expected=Buffer.from(fs.readFileSync(path.join(root,'config/cloudflare/preparation',file),'utf8').replace(/\r\n/g,'\n'));assert.equal(hash(r.bytes),hash(expected));assert(r.headers.get('content-security-policy')?.includes("default-src 'none'"));assert(r.headers.get('cache-control')?.includes('no-store'));hashes.push({path:route||'/',sha256:hash(r.bytes)});}
  const missing=await get(placeholder+'assets/runtime-config.js');assert.equal(missing.status,404);assert(!missing.bytes.includes(Buffer.from('supabase')));return{files:hashes,runtimeAbsent:true};
 });
 await check('Cloudflare staging runtime contains staging only',async()=>{const r=await get(stage+'assets/runtime-config.js');assert.equal(r.status,200);const source=r.bytes.toString();assert(!source.includes('yvguatdqncadkwewlepe'));const match=source.match(/var routes=(\[[^\n]+\]);/);assert(match);const configs=JSON.parse(match[1]);assert.equal(configs.length,1);const c=configs[0];assert.equal(c.environment,'staging');assert.equal(c.supabaseUrl,'https://dmqjexigdnfzobarhnib.supabase.co');assert.equal(c.appUrl,stage);assert(c.allowedOrigins.includes(new URL(stage).origin));assert(c.allowedOrigins.every(origin=>origin===new URL(stage).origin||/^https:\/\/[a-f0-9]+\.simple-staging-raulchulbi\.pages\.dev$/.test(origin)));return{sha256:hash(r.bytes),appUrl:c.appUrl,environment:c.environment,allowedOrigins:c.allowedOrigins};});
 const report={kind:'Public GET-only hosting reconciliation, no sessions, Auth writes or backend API',capturedAt:new Date().toISOString(),rows,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,total:rows.length};
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/public-hosting-readonly.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
}
mainRun().catch(()=>{console.error('Read-only hosting reconciliation failed');process.exitCode=1;});
