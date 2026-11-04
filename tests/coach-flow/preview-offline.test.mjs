import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

// Only the test-owned loopback listener is reachable through this harness.
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:4273';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
let server;
before(async()=>{
 server=spawn(process.execPath,['tests/coach-flow/preview-offline.cjs'],{cwd:root,env:{...process.env,COACH_PORT:'4273'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Preview timeout')),10_000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('error',e=>{clearTimeout(t);reject(e);});server.once('exit',()=>{clearTimeout(t);reject(Error('Preview exited'));});});
});
after(()=>server?.kill());
const get=(path,options)=>fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(3000),...options});

test('unified page is unchanged except explicit mock SDK and seed',async()=>{
 const r=await get('/demo');assert.equal(r.status,200);
 const expected=read('index.html').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0','/demo-sdk.js').replace('</body>','<script src="/demo-seed.js"></script></body>');
 assert.equal(await r.text(),expected);
});
test('preview denies browser network connections and form submission via CSP',async()=>{
 const r=await get('/demo'),csp=r.headers.get('content-security-policy');
 assert.match(csp,/connect-src 'none'/);assert.match(csp,/form-action 'none'/);assert.match(csp,/object-src 'none'/);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('runtime uses only a synthetic key, stays immutable and does not enable billing',async()=>{
 const r=await get('/assets/runtime-config.js'),context={window:{}};vm.runInNewContext(await r.text(),context);
 const runtime=context.window.SimpleAppRuntime;assert.equal(runtime.supabasePublicKey,'SYNTHETIC_NOT_A_KEY');assert.equal(runtime.billingTest,false);assert.equal(runtime.appOrigin,base);assert.equal(runtime.appUrl,base+'/demo');assert(Object.isFrozen(runtime));
 const d=Object.getOwnPropertyDescriptor(context.window,'SimpleAppRuntime');assert.equal(d.writable,false);assert.equal(d.configurable,false);
});
test('SDK route consists exclusively of the existing local mock implementations',async()=>{
 const r=await get('/demo-sdk.js');assert.equal(await r.text(),['tests/interior/mock-sdk.js','tests/coach/demo-sdk.js','tests/coach-pilot/preview-sdk.js'].map(read).join('\n'));
});
test('no real Auth surface, private evidence or repository metadata is exposed',async()=>{
 for(const p of ['/','/sdk.js','/AGENTS.md','/.git/config','/tests/coach-flow/results/contracts.json'])assert.equal((await get(p)).status,404,p);
});
test('mutation methods fail before serving the page or SDK',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await get('/demo',{method})).status,405,method);
});
test('asset traversal and encoded repository paths do not expose files',async()=>{
 for(const p of ['/assets/%2e%2e/AGENTS.md','/assets/%2e%2e%2fAGENTS.md','/assets/..%5cAGENTS.md'])assert.equal((await get(p)).status,404,p);
});
