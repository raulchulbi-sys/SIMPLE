'use strict';

// Focused, sessionless smoke after production preparation hardened the shared
// runtime. Native HTTPS and two fresh browsers only; no build or backend writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {
  sha, canonical, request, headersSummary, playwright, attachNetwork,
  welcome, verifyRuntime, cleanError, STAGING, PRODUCTION
} = require('./live-hosting.cjs');
const root = path.resolve(__dirname, '../..');
const reviewedHead = '4fbb82b5a4ccf9e65fdcd7dfd74bb3bff5db5705';
// Historical local/remote commit IDs are evidence labels, not prerequisites for
// clones. Both HEAD and working inputs must still match these reviewed LF bytes.
const reviewedInputs = Object.freeze({
  'scripts/hosting-runtime.cjs':'84365fe2f6dc65f817413a4ba265a764cb50945f2ffad98bd53ce6fa10df0c4d',
  'config/public-backends.json':'1815520cbd2a97db1df29147f27c4e33b498c985653869b6869642f6ab371db9'
});
const normalizedInputHash = bytes => sha(canonical(bytes,'reviewed-input.txt'));
const stable = 'https://simple-staging-raulchulbi.pages.dev/';
const deployment = 'https://4eef94ba.simple-staging-raulchulbi.pages.dev/';
const deploymentId = '4eef94ba-b617-48b6-bf99-f1d6bb83a5ad';
const output = path.join(__dirname, 'results', 'staging-production-prep-smoke.json');
const git = (...args) => execFileSync('git', args, {cwd:root, stdio:['ignore','pipe','pipe']}).toString().trim();
const report = {
  capturedAt: new Date().toISOString(),
  kind:'Focused real staging HTTPS runtime and native sessionless Chromium/WebKit at 390px; no interception, login, OAuth, recovery, accounts, REST, Functions, AI or writes',
  identity:{stableUrl:stable, deploymentUrl:deployment, deploymentId,
    deploymentSourceCommitReported:'8b2f526',
    deploymentMetadataSource:'Coordinator supplied Cloudflare deployment metadata; this smoke proves runtime bytes, not remote Git metadata',
    reviewedLocalSourceCommit:reviewedHead},
  http:[], browser:[]
};

async function main() {
  const head = git('rev-parse','HEAD');
  report.identity.observedLocalSourceCommit = head;
  report.identity.testSourceSha256LF = normalizedInputHash(fs.readFileSync(__filename));
  report.identity.reviewedRuntimeInputs = [];
  for (const [file,expectedSha256LF] of Object.entries(reviewedInputs)) {
    const committed = execFileSync('git',['show','HEAD:'+file],{cwd:root});
    const headSha256LF = normalizedInputHash(committed);
    const workingSha256LF = normalizedInputHash(fs.readFileSync(path.join(root,file)));
    report.identity.reviewedRuntimeInputs.push({file,expectedSha256LF,headSha256LF,workingSha256LF});
    assert.equal(headSha256LF,expectedSha256LF,'HEAD runtime input differs from reviewed bytes: '+file);
    assert.equal(workingSha256LF,expectedSha256LF,'Working runtime input differs from reviewed bytes: '+file);
  }
  assert(git('check-ignore','--',path.relative(root,output)), 'Report must remain Git-ignored');
  const {createRuntimeConfig} = require('../../scripts/hosting-runtime.cjs');
  const runtime = createRuntimeConfig({target:'preview',env:{
    SIMPLE_APP_URL:stable, CF_PAGES_URL:deployment,
    SIMPLE_PAGES_PROJECT:'simple-staging-raulchulbi', CF_PAGES_BRANCH:'codex/cloudflare-migration'
  }});
  assert.equal(runtime.config.supabaseUrl, STAGING);
  assert.equal(runtime.config.environment,'staging');
  const expected = canonical(Buffer.from(runtime.javascript),'assets/runtime-config.js');
  report.identity.expectedRuntimeSha256 = sha(expected);
  const config = {stable,deployment,runtime};
  for (const [label,base] of [['stable',stable],['deployment',deployment]]) {
    const row = {name:label+': served runtime equals reviewed generated staging runtime',pass:false};
    report.http.push(row);
    try {
      const result = await request(config,new URL('assets/runtime-config.js',base));
      row.details = {url:result.finalUrl,status:result.response.status,bytes:result.body.length,
        sha256:sha(result.body),headers:headersSummary(result.response.headers),redirects:result.redirects};
      assert.equal(result.response.status,200);
      assert.equal(sha(canonical(result.body,'assets/runtime-config.js')),sha(expected));
      assert.match(result.response.headers.get('content-type')||'',/(?:application|text)\/javascript/i);
      assert.equal(result.response.headers.get('x-content-type-options'),'nosniff');
      row.pass = true;
    } catch(error) { row.error = cleanError(error); }
  }
  assert(report.http.every(row=>row.pass),'Runtime delivery gate failed; browsers were not opened');
  const manifest = JSON.parse(git('show',head+':config/static-public-manifest.json'));
  const files = new Map([...manifest.files,...manifest.generated,'404.html','robots.txt'].map(name=>[name,null]));
  const engines = playwright();
  for (const engine of ['chromium','webkit']) {
    const row = {name:engine+': fresh staging welcome and settings GET at 390px',engine,width:390,pass:false};
    report.browser.push(row);
    let browser,context,net;
    try {
      browser = await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
      context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
      const initial = await context.storageState();
      assert.deepEqual(initial,{cookies:[],origins:[]},'Browser context is not initially empty');
      row.initialStorageEmpty = true;
      net = attachNetwork(context,{origins:[new URL(stable).origin,new URL(deployment).origin],backend:STAGING,files});
      const page = await context.newPage();
      await page.goto(stable,{waitUntil:'load'});
      await welcome(page);
      await verifyRuntime(page,config);
      await net.finish();
      const settings = net.responses.filter(r=>r.url===STAGING+'/auth/v1/settings');
      assert(settings.some(r=>r.status===200),'Native staging Auth settings GET did not return 200');
      assert(net.requests.some(r=>r.url===STAGING+'/auth/v1/settings'&&r.method==='GET'),'Native staging Auth settings GET missing');
      const forbidden = net.requests.filter(r=>{
        const u = new URL(r.url);
        return !['GET','HEAD','OPTIONS'].includes(r.method)||u.origin===PRODUCTION||
          u.hostname==='api.openai.com'||u.pathname.startsWith('/functions/v1/')||u.pathname.startsWith('/rest/v1/');
      });
      assert.equal(forbidden.length,0,'Prohibited production, AI, write, REST or Functions request');
      assert.equal(net.violations.length,0,'Unexpected native network operation');
      assert.equal(net.pageErrors.length,0,'Native page JavaScript error');
      assert.equal(net.failures.length,0,'Native network failure');
      assert.equal(net.responses.filter(r=>r.status>=400&&!r.url.endsWith('/favicon.ico')).length,0,'Unexpected HTTP error');
      row.finalUrl = page.url();
      assert.equal(row.finalUrl,stable,'Welcome navigation changed the expected stable URL');
      row.welcomeVisible = await page.locator('#authWelcome').isVisible();
      row.runtimeMatchesReviewedConfiguration = true;
      row.settingsStatus = settings.map(r=>r.status);
      row.forbiddenRequests = forbidden;
      row.pass = true;
    } catch(error) { row.error = cleanError(error); }
    finally {
      if(net) {
        await net.finish();
        row.network = {requests:net.requests,responses:net.responses,failures:net.failures,
          violations:net.violations,pageErrors:net.pageErrors,consoleErrors:net.consoleErrors};
      }
      await context?.close().catch(()=>{});
      await browser?.close().catch(()=>{});
    }
  }
}

main().catch(error=>{report.error=cleanError(error);}).finally(()=>{
  const rows = [...report.http,...report.browser];
  report.counts = {http:report.http.length,browser:report.browser.length,
    passed:rows.filter(row=>row.pass).length,failed:rows.filter(row=>!row.pass).length,total:rows.length};
  report.complete = !report.error&&report.http.length===2&&report.browser.length===2&&rows.every(row=>row.pass);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({complete:report.complete,identity:report.identity,counts:report.counts,
    failures:[...rows.filter(row=>!row.pass).map(row=>({name:row.name,error:row.error})),...(report.error?[{error:report.error}]:[])],
    output:path.relative(root,output)},null,2));
  if(!report.complete)process.exitCode=1;
});
