'use strict';
// Real Back/Forward traversal, no route interception. GET-only loopback server.
// Unlike the lifecycle unit test, a PASS requires trusted pageshow.persisted.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {sdk,runtime,people}=require('./readonly-premium-browser.cjs');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
// WebKit 26.5 on this Windows runner reloads instead of restoring BFCache.
// Keep --probe-webkit as a strict diagnostic (requires persisted; never fakes PASS).
// Its lifecycle simulation remains in readonly-premium-browser.cjs.
const probeWebkit=process.argv.includes('--probe-webkit');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),rows=[];const read=n=>fs.readFileSync(path.join(root,n),'utf8');let origin;
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end();}const p=new URL(req.url,origin).pathname;
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; object-src 'none'");
 if(p==='/away'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Away</title><p>Public local fixture</p>');}
 if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(read('index.html').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/sdk.js').replace('<head>','<head><script>window.pageInstance=crypto.randomUUID();window.historyRestores=[];window.noteSDKCall=()=>{};addEventListener("pageshow",e=>historyRestores.push({persisted:e.persisted,trusted:e.isTrusted}));</script>'));}
 if(p==='/sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(sdk+"\nwindow.fetch=async u=>{if(String(u)==='https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/settings')return new Response(JSON.stringify({external:{google:false,apple:false}}));throw Error('No external fetch in fixture');};");}
 if(p==='/assets/runtime-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('Object.defineProperty(window,"SimpleAppRuntime",{value:Object.freeze('+JSON.stringify({...runtime,appOrigin:origin,appUrl:origin+'/'})+')});');}
 if(!/^\/assets\/[a-zA-Z0-9._-]+$/.test(p)){res.writeHead(404);return res.end();}const file=path.join(root,p.slice(1));if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':'image/svg+xml');res.end(fs.readFileSync(file));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 try{for(const[engine,type]of(probeWebkit?[['webkit',webkit]]:[['chromium',chromium]])){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'msedge',ignoreDefaultArgs:['--disable-back-forward-cache']}:{})});
 try{for(const width of[390,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await ctx.newPage();p.setDefaultTimeout(10000);const external=[];p.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(new URL(r.url()).origin);});
 await p.goto(origin);await p.waitForFunction(()=>typeof simpleAuth!=='undefined'&&!simpleAuth.busy);await p.evaluate(()=>localStorage.setItem('readonly-synthetic-actor','mock'));await p.reload();await p.waitForFunction(id=>profile?.id===id,people.mock.id);await p.evaluate(()=>renderShared());
 const before=await p.evaluate(()=>({instance:pageInstance,calls:readonlySDKCalls}));assert.equal(before.calls.filter(x=>x.name==='premium_initial_my_state').length,0);
 await p.goto(origin+'/away');await p.goBack({waitUntil:'commit'});await p.waitForFunction(()=>historyRestores.some(x=>x.persisted&&x.trusted));
 assert.equal(await p.evaluate(()=>pageInstance),before.instance,'must restore original document, not reload');await p.evaluate(()=>renderShared());
 const after=await p.evaluate(()=>({calls:readonlySDKCalls,lifecycle:historyRestores,flag:SimpleAppRuntime.billingValidationReadOnly}));assert(after.flag);assert.equal(after.calls.filter(x=>x.name==='premium_initial_my_state').length,0);assert(after.calls.filter(x=>x.name==='get_my_coach_access').length>before.calls.filter(x=>x.name==='get_my_coach_access').length);assert.deepEqual(external,[]);
 rows.push({engine,width,version:browser.version(),realBFCache:true,trustedPersistedPageShow:true,sameDocument:true,initialInvocations:0,basicReadsContinue:true,pass:true});await ctx.close();
 }}finally{await browser.close();}}
 const report={passed:rows.length,failed:0,notVerified:probeWebkit?[]:['WebKit real BFCache 390','WebKit real BFCache 1280'],rows};
 fs.writeFileSync(path.join(out,probeWebkit?'readonly-bfcache-webkit.json':'readonly-bfcache.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'readonly-bfcache-failure.json'),JSON.stringify({message:e.message,rows},null,2));console.error(e);process.exitCode=1;});
