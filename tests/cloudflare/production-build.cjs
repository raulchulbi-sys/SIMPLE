'use strict';
// Offline packaging of the proposed production profile; no server, deployment or network.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {build} = require('../../scripts/hosting-build.cjs');
const {createRuntimeConfig} = require('../../scripts/hosting-runtime.cjs');
const root = path.resolve(__dirname, '../..');
const plan = require('../../config/cloudflare/production-plan.json');
const manifest = require('../../config/static-public-manifest.json');
const rows = [];
const test = (name, fn) => { fn(); rows.push({name, pass:true}); };
// This is OFFLINE application packaging. The live hostname currently serves only a placeholder.
// Real Pages supplies CF_PAGES_URL/CF_PAGES_BRANCH automatically; never set these manually there.
const env = {...plan.variablesPublic, CF_PAGES_BRANCH:plan.productionBranch, CF_PAGES_URL:plan.appUrlProposed};
const runtime = createRuntimeConfig({target:'production', env});
const first = build({sourceRoot:root, target:'production', runtime});
const second = build({sourceRoot:root, target:'production', runtime});
test('complete proposed production artifact reproducible with 36 allowlisted files', () => {
  assert.equal(first.treeSha256, second.treeSha256);
  assert.equal(first.files.length, 36);
  assert.equal(runtime.config.supabaseUrl, 'https://yvguatdqncadkwewlepe.supabase.co');
  assert.deepEqual(first.files.map(f=>f.path).sort(), [...manifest.files, ...manifest.generated, '_headers','404.html','robots.txt'].sort());
});
test('all existing application bytes preserved in production packaging', () => {
  for (const name of manifest.files) {
    const raw = fs.readFileSync(path.join(root,name));
    const expected = /\.(?:html|js|css|txt)$/.test(name) ? Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n')) : raw;
    assert.deepEqual(fs.readFileSync(path.join(first.output,name)), expected, name);
  }
  assert(!first.files.some(f=>/^(?:tests|docs|config|supabase|scripts|private|results)\//.test(f.path)));
});
test('proposed production runtime isolates staging origins and preserves callback URL', () => {
  const boot = url => {
    const window = {location:new URL(url)}, document = {addEventListener(){}};
    vm.runInNewContext(runtime.javascript,{window,document}); return window;
  };
  const callback = plan.appUrlProposed + '?reset=1#type=recovery';
  const window = boot(callback);
  assert.equal(window.SimpleAppRuntime.environment,'production');
  assert.equal(window.SimpleAppRuntime.appUrl,plan.appUrlProposed);
  assert.equal(window.location.href,callback);
  for (const url of ['https://simple-staging-raulchulbi.pages.dev/', 'https://4a8636ab.simple-staging-raulchulbi.pages.dev/', plan.preserveExistingAppUrl]) {
    assert.throws(()=>boot(url), /not approved/);
  }
});
test('production headers target only production backend and retain revalidation and private-file exclusion', () => {
  const headers = fs.readFileSync(path.join(first.output,'_headers'),'utf8');
  assert(headers.includes('https://yvguatdqncadkwewlepe.supabase.co'));
  assert(headers.includes('wss://yvguatdqncadkwewlepe.supabase.co'));
  assert(!headers.includes('dmqjexigdnfzobarhnib'));
  assert(headers.includes('Content-Security-Policy-Report-Only:'));
  assert(headers.includes('X-Frame-Options: DENY'));
  assert(headers.includes('Cache-Control: no-cache'));
  assert(headers.includes('Cache-Control: public, max-age=0, must-revalidate'));
  assert(!headers.includes('Access-Control-Allow-Origin: *'));
  assert(!first.files.some(f=>/\.(?:sql|md|toml|env)$/.test(f.path)));
});
const report = {kind:'offline application packaging only; live hostname serves placeholder, no network or application deployment', passed:rows.length, total:rows.length, treeSha256:first.treeSha256, results:rows};
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'results','production-build.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
