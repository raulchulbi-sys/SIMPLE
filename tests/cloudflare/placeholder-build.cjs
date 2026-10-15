'use strict';
// Offline, isolated filesystem only. Never builds the application or calls a backend.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {buildPlaceholder}=require('../../scripts/hosting-build.cjs');
const {PAGES_PROJECTS}=require('../../scripts/hosting-runtime.cjs');
const root=path.resolve(__dirname,'../..');
assert(PAGES_PROJECTS&&PAGES_PROJECTS.production,'Reviewed Pages identities required before creating fixtures');
const project=PAGES_PROJECTS.production;
const results=path.join(__dirname,'results');
fs.mkdirSync(results,{recursive:true});
const sourceRoot=fs.mkdtempSync(path.join(results,'placeholder-fixture-'));
fs.mkdirSync(path.join(sourceRoot,'config/cloudflare'),{recursive:true});
fs.cpSync(path.join(root,'config/cloudflare/preparation'),path.join(sourceRoot,'config/cloudflare/preparation'),{recursive:true});
const env={SIMPLE_DEPLOY_TARGET:'placeholder',SIMPLE_PAGES_PROJECT:project,SIMPLE_APP_URL:`https://${project}.pages.dev/`,CF_PAGES_BRANCH:'codex/cloudflare-production-preparation',CF_PAGES_URL:`https://abcd1234.${project}.pages.dev/`};
const run=override=>buildPlaceholder({sourceRoot,env:{...env,...override}});
const rows=[];
const test=(name,fn)=>{fn();rows.push({name,pass:true});};
try{
  const first=run();
  test('exact five-file inert artifact; no application/runtime/SDK bundled',()=>assert.deepEqual(first.files.map(x=>x.path).sort(),['404.html','_headers','assets/preparation.css','index.html','robots.txt'].sort()));
  test('deterministic artifact removes leftover application files',()=>{fs.writeFileSync(path.join(sourceRoot,'dist/assets/runtime-config.js'),'discarded fixture');assert.equal(run().treeSha256,first.treeSha256);assert(!fs.existsSync(path.join(sourceRoot,'dist/assets/runtime-config.js')));});
  test('reject target and project swaps',()=>{for(const patch of [{SIMPLE_DEPLOY_TARGET:'production'},{SIMPLE_PAGES_PROJECT:PAGES_PROJECTS.preview},{SIMPLE_PAGES_PROJECT:'other-project'}])assert.throws(()=>run(patch));});
  test('only approved preparation branch builds placeholder',()=>{for(const branch of ['main','codex/cloudflare-migration','other'])assert.throws(()=>run({CF_PAGES_BRANCH:branch}));});
  test('stable URL exact; no auth query, userinfo or alternate host',()=>{for(const url of [`https://${project}.pages.dev/?reset=1`,`https://user@${project}.pages.dev/`,'https://attacker.invalid/'])assert.throws(()=>run({SIMPLE_APP_URL:url}));});
  test('deployment URL refuses cross-project, credentials, query and insecure protocol',()=>{for(const url of ['https://attacker.invalid/',`https://x.${PAGES_PROJECTS.preview}.pages.dev/`,`http://${project}.pages.dev/`,`https://user@${project}.pages.dev/`,`https://${project}.pages.dev/?x=1`])assert.throws(()=>run({CF_PAGES_URL:url}));});
  test('backend overrides rejected even though no runtime is generated',()=>{for(const key of ['SIMPLE_SUPABASE_URL','SIMPLE_SUPABASE_KEY'])assert.throws(()=>run({[key]:'non-secret-fixture'}));});
  const entry=path.join(sourceRoot,'config/cloudflare/preparation/index.html');
  const original=fs.readFileSync(entry,'utf8');
  test('active content and unexpected external resources rejected before replacing dist',()=>{for(const text of ['<script src="/x.js"></script>','<form></form>','<iframe></iframe>','<img src="https://example.com/x.png">','<div onclick="void 0"></div>']){fs.writeFileSync(entry,original+text);assert.throws(()=>run());assert.equal(fs.readFileSync(path.join(sourceRoot,'dist/index.html'),'utf8'),original); }fs.writeFileSync(entry,original);});
  test('enforced restrictive CSP and no-store headers required',()=>{const file=path.join(sourceRoot,'config/cloudflare/preparation/_headers'),saved=fs.readFileSync(file,'utf8');fs.writeFileSync(file,saved.replace('Content-Security-Policy:','Content-Security-Policy-Report-Only:'));assert.throws(()=>run());fs.writeFileSync(file,saved);});
  test('placeholder output contains no endpoints, script, forms or configuration',()=>{for(const file of run().files){const text=fs.readFileSync(path.join(sourceRoot,'dist',file.path),'utf8');assert(!/supabase|openai|<script|<form|runtime-config|service_role|sb_publishable_/i.test(text));}});
  const report={kind:'offline placeholder only; synthetic temporary files, no deployment/network/backend',passed:rows.length,total:rows.length,treeSha256:first.treeSha256,results:rows};
  fs.writeFileSync(path.join(results,'placeholder-build.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
  const resolved=fs.realpathSync(sourceRoot);
  assert(path.dirname(resolved)===fs.realpathSync(results)&&path.basename(resolved).startsWith('placeholder-fixture-'));
  fs.rmSync(resolved,{recursive:true,force:true});
}
