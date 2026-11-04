'use strict';
// Filesystem/VM and loopback HTTP only. No connected services or real identities.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {once} = require('node:events');
const {spawnSync} = require('node:child_process');
const {buildCommercial, returnSources, RETURN_FILES} = require('../../scripts/hosting-commercial-build.cjs');
const {createRuntimeConfig} = require('../../scripts/hosting-runtime.cjs');
const {verify, manifest:historical} = require('../../scripts/staging-return.cjs');
const {serverFor} = require('../../scripts/hosting-preview.cjs');
const {references} = require('../../scripts/hosting-build.cjs');
const root = path.resolve(__dirname, '../..');
const results = path.join(__dirname, 'results');
fs.mkdirSync(results, {recursive:true});
const env = {
  preview:{SIMPLE_APP_URL:'https://simple-staging-raulchulbi.pages.dev/', SIMPLE_PAGES_PROJECT:'simple-staging-raulchulbi', CF_PAGES_BRANCH:'codex/cloudflare-migration', CF_PAGES_URL:'https://simple-staging-raulchulbi.pages.dev/'},
  production:{SIMPLE_APP_URL:'https://simple-raulchulbi.pages.dev/', SIMPLE_PAGES_PROJECT:'simple-raulchulbi', CF_PAGES_BRANCH:'main', CF_PAGES_URL:'https://simple-raulchulbi.pages.dev/'},
  local:{SIMPLE_APP_URL:'http://127.0.0.1:4280/'}
};
function fixture(t) {
  const sourceRoot = fs.mkdtempSync(path.join(results, 'commercial-'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/static-public-manifest.json')));
  const copy = name => {
    const out = path.join(sourceRoot, name);
    fs.mkdirSync(path.dirname(out), {recursive:true});
    fs.copyFileSync(path.join(root,name), out);
  };
  for (const name of [...manifest.files, 'config/static-public-manifest.json', 'config/cloudflare/_headers.template', 'config/cloudflare/404.html', 'config/cloudflare/robots.txt', 'staging/return/manifest.json', 'staging/return/headers-append.txt', ...RETURN_FILES.map(name=>'staging/return/source/'+name)]) copy(name);
  t.after(()=> {
    assert.equal(path.dirname(fs.realpathSync(sourceRoot)), fs.realpathSync(results));
    fs.rmSync(sourceRoot, {recursive:true,force:true});
  });
  return {sourceRoot, manifest, file:name=>path.join(sourceRoot,name),
    write:(name,bytes)=>fs.writeFileSync(path.join(sourceRoot,name),bytes),
    run:(target='preview', extra={})=>buildCommercial({sourceRoot,target,env:env[target],...extra})};
}
function boot(js,url) {
  const window={location:new URL(url)},document={addEventListener(){}};
  vm.runInNewContext(js,{window,document});return window;
}
test('one reproducible staging artifact contains exactly 43 allowlisted files', t=> {
  const f=fixture(t),a=f.run(),b=f.run();assert.equal(a.files.length,43);assert.deepEqual(a,b);
  assert.equal(a.commercialEnabled,false);assert.equal(a.stagingReturnIncluded,true);
  assert.equal(a.backend,'https://dmqjexigdnfzobarhnib.supabase.co');
});
test('all three subscription app resources retain their original bytes', t=> {
  const f=fixture(t),r=f.run();for(const name of ['assets/subscription.js','assets/subscription-app.js','assets/subscription.css']) {
    assert(r.files.some(row=>row.path===name));assert.equal(fs.readFileSync(path.join(r.output,name),'utf8'),fs.readFileSync(f.file(name),'utf8').replace(/\r\n/g,'\n'));
  }
});
test('working TEST return uses the four exact historical source hashes', t=> {
  const f=fixture(t),r=f.run();for(const row of returnSources(f.sourceRoot).records)assert.deepEqual(r.files.find(item=>item.path===row.path),row);
  const source=fs.readFileSync(path.join(r.output,'assets/billing-return.js'),'utf8');
  assert.match(source,/persistSession:false/);assert.match(source,/detectSessionInUrl:false/);assert.match(source,/action:'access'/);
  assert.doesNotMatch(source,/action:'(?:checkout|portal)'/);
});
test('return CSP is enforced, restrictive and no-referrer; main CSP remains report-only', t=> {
  const f=fixture(t),r=f.run(),h=fs.readFileSync(path.join(r.output,'_headers'),'utf8');
  assert.match(h,/Content-Security-Policy-Report-Only:/);
  for(const route of ['/billing-test.html','/billing-test']) {
    const section=h.split(route+'\n').at(-1).split(/\n\//)[0];
    assert.match(section,/! Referrer-Policy\n  Referrer-Policy: no-referrer/);
    assert.match(section,/Cache-Control: no-store/);assert.match(section,/Content-Security-Policy: default-src 'none'/);
    assert.doesNotMatch(section,/unsafe-inline|\*\.supabase/);
  }
});
test('production artifact has exactly 39 files and never carries TEST return', t=> {
  const f=fixture(t),r=f.run('production');assert.equal(r.files.length,39);assert.equal(r.stagingReturnIncluded,false);
  for(const name of RETURN_FILES)assert(!r.files.some(row=>row.path===name));
  assert(!fs.readFileSync(path.join(r.output,'_headers'),'utf8').includes('dmqjexigdnfzobarhnib'));
});
test('TEST return cannot be requested for production and leaves prior artifact intact', t=> {
  const f=fixture(t),r=f.run(),old=fs.readFileSync(path.join(r.output,'index.html'));
  assert.throws(()=>f.run('production',{includeReturn:true}),/cannot enter production/);
  assert.deepEqual(fs.readFileSync(path.join(r.output,'index.html')),old);
});
test('commercial activation remains absent in all runtime targets and query parameters', ()=> {
  for(const target of ['local','preview','production']) {
    const r=createRuntimeConfig({target,env:env[target]});
    const w=boot(r.javascript,r.config.appUrl+'?billingTest=true&plan=premium');
    assert.notEqual(w.SimpleAppRuntime.billingTest,true);assert(Object.isFrozen(w.SimpleAppRuntime));
  }
});
test('existing Pages build CLI uses the unified artifact without activating commerce', ()=> {
  const result=spawnSync(process.execPath,['scripts/hosting-build.cjs','--target','preview'],{cwd:root,env:{...process.env,...env.preview},encoding:'utf8',timeout:20000,shell:false});
  assert.equal(result.status,0,result.stderr);
  const artifact=JSON.parse(result.stdout);assert.equal(artifact.files.length,43);assert.equal(artifact.stagingReturnIncluded,true);assert.equal(artifact.commercialEnabled,false);
});
test('TEST return script fails closed outside its one approved HTTPS origin', t=> {
  const f=fixture(t),r=f.run();const source=fs.readFileSync(path.join(r.output,'assets/billing-return.js'),'utf8').split('// Remove')[0].replace(/^import[^\n]+\n/,'');
  for(const origin of ['http://127.0.0.1:4280','https://simple-raulchulbi.pages.dev','https://attacker.invalid'])assert.throws(()=>vm.runInNewContext(source,{location:{origin}}),/staging_only/);
  assert.doesNotThrow(()=>vm.runInNewContext(source,{location:{origin:env.preview.SIMPLE_APP_URL.slice(0,-1)}}));
});
test('historical 36/40-file artifact assertions are not silently repurposed', t=> {
  const f=fixture(t),r=f.run();assert.throws(()=>verify(r.output,historical.base),/Unexpected or missing files/);
  assert.throws(()=>verify(r.output,historical.approved),/Unexpected or missing files/);
});
test('modified historical manifest is rejected before output changes', t=> {
  const f=fixture(t),r=f.run(),old=fs.readFileSync(path.join(r.output,'_headers'));
  const file='staging/return/manifest.json';f.write(file,fs.readFileSync(f.file(file),'utf8').replace('40','41'));
  assert.throws(()=>f.run(),/historical return manifest/);assert.deepEqual(fs.readFileSync(path.join(r.output,'_headers')),old);
});
test('changed return CSP is rejected before output changes', t=> {
  const f=fixture(t),r=f.run(),old=fs.readFileSync(path.join(r.output,'_headers'));
  const file='staging/return/headers-append.txt';f.write(file,fs.readFileSync(f.file(file),'utf8').replace("default-src 'none'","default-src *"));
  assert.throws(()=>f.run(),/return headers/);assert.deepEqual(fs.readFileSync(path.join(r.output,'_headers')),old);
});
test('missing or extra return source fails the exact inventory', t=> {
  const f=fixture(t);f.write('staging/return/source/extra.html','not approved');assert.throws(()=>f.run(),/Unexpected or missing files/);
  fs.unlinkSync(f.file('staging/return/source/extra.html'));fs.unlinkSync(f.file('staging/return/source/billing-test.html'));
  assert.throws(()=>f.run(),/Unexpected or missing files/);
});
test('modified return source is rejected even if its path is approved', t=> {
  const f=fixture(t);f.write('staging/return/source/assets/billing-return.js','throw Error("changed")');assert.throws(()=>f.run(),/Hash mismatch/);
});
test('return/application filename collision fails before base build', t=> {
  const f=fixture(t);f.manifest.files.push('assets/billing-return.js');f.write('config/static-public-manifest.json',JSON.stringify(f.manifest));
  assert.throws(()=>f.run(),/collides with application/);assert(!fs.existsSync(f.file('dist')));
});
test('absolute TEST asset paths refuse a subdirectory app base', t=> {
  const f=fixture(t);assert.throws(()=>f.run('local',{env:{SIMPLE_APP_URL:'http://127.0.0.1:4280/SIMPLE/'}}),/root base path/);
});
test('SQL, private evidence and unconfigured alternate return stay outside the artifact', t=> {
  const f=fixture(t),r=f.run();assert(!r.files.some(row=>/^(?:supabase|tests|docs|config|scripts|staging)\//.test(row.path)));
  assert(!r.files.some(row=>/subscription-return|commercial-config|\.sql$|\.json$|\.md$/.test(row.path)));
  assert(!r.files.some(row=>row.path==='_redirects'||row.path==='_worker.js'));
});
test('a newly referenced unreviewed app asset is rejected', t=> {
  const f=fixture(t);f.write('assets/subscription-app.js','const x="assets/not-approved.js";');assert.throws(()=>f.run(),/non-allowlisted dependency/);
});
test('JS navigation URL constructor is not confused with a CSS resource', ()=> {
  assert.deepEqual([...references('const target=new URL(response?.url);', 'assets/subscription.js', new Set())],[]);
  assert.deepEqual([...references('const target=new\n URL(response?.url);', 'assets/subscription.js', new Set())],[]);
});
test('case-insensitive CSS resources and static module URL assets remain checked', ()=> {
  assert.deepEqual([...references('body{background:URL("./picture.png")}', 'assets/screen.css', new Set())],['assets/picture.png']);
  assert.deepEqual([...references('new URL("./picture.png", import.meta.url)', 'assets/main.js', new Set())],['assets/picture.png']);
  assert.deepEqual([...references('new URL("assets/picture.png", document.baseURI)', 'assets/main.js', new Set())],['assets/picture.png']);
  assert.throws(()=>references('new URL("../private/token.js", import.meta.url)', 'assets/main.js', new Set()),/Unsafe/);
  assert.throws(()=>references('body{background:URL("https://attacker.invalid/a.png")}', 'assets/screen.css', new Set()),/Unreviewed/);
});
test('secret-shaped content in newly included subscription resources is rejected', t=> {
  const f=fixture(t);f.write('assets/subscription-app.js','const x="sb_secret_fixture_not_a_real_secret";');assert.throws(()=>f.run(),/Secret-shaped/);
});
test('restricted Stripe keys and webhook signing secret shapes cannot enter the artifact', t=> {
  const f=fixture(t);for(const prefix of ['rk_'+'test_','rk_'+'live_','whsec'+'_']) {
    f.write('assets/subscription-app.js','const secret='+JSON.stringify(prefix+'SYNTHETIC_SENTINEL_NOT_A_REAL_SECRET')+';');
    assert.throws(()=>f.run(),/Secret-shaped/);
  }
});
test('local HTTP serves the exact return and module with security headers; internal paths stay denied', async t=> {
  const f=fixture(t),r=f.run('local'),server=serverFor(r.output);
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['/billing-test','/billing-test.html']) {
    const response=await fetch(base+route);assert.equal(response.status,200);
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
    assert.equal(await response.text(),fs.readFileSync(path.join(r.output,'billing-test.html'),'utf8'));
  }
  const module=await fetch(base+'/assets/billing-return-model.mjs');assert.match(module.headers.get('content-type'),/javascript/);assert.equal(module.headers.get('cache-control'),'no-store');
  for(const route of ['/supabase/coach-reviewer-scope.sql','/staging/return/manifest.json','/tests/private/fixture.json','/_headers'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+'/billing-test',{method:'POST'})).status,405);
});
