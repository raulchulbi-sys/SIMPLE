'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRuntimeConfig,createRepositoryRuntime,validateBackend} = require('../../scripts/hosting-runtime.cjs');
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const local=url=>createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:url}});
// Offline inputs only. The production identity is proposed, not evidence of provisioning.
const previewEnv={SIMPLE_APP_URL:'https://simple-staging-raulchulbi.pages.dev/',CF_PAGES_URL:'https://simple-staging-raulchulbi.pages.dev',SIMPLE_PAGES_PROJECT:'simple-staging-raulchulbi',CF_PAGES_BRANCH:'codex/cloudflare-migration'};
const productionEnv={SIMPLE_APP_URL:'https://simple-raulchulbi.pages.dev/',CF_PAGES_URL:'https://simple-raulchulbi.pages.dev',SIMPLE_PAGES_PROJECT:'simple-raulchulbi',CF_PAGES_BRANCH:'main'};
function boot(javascript,url){const u=new URL(url),document={addEventListener(){}};const window={location:u};vm.runInNewContext(javascript,{window,document});return window;}
test('local always staging',()=>assert.equal(local('http://127.0.0.1:4280/').config.supabaseUrl,'https://dmqjexigdnfzobarhnib.supabase.co'));
test('subdirectory base exact',()=>assert.equal(local('http://localhost:4280/SIMPLE/').config.basePath,'/SIMPLE/'));
test('compiled preview staging and frozen',()=>{const r=createRuntimeConfig({target:'preview',env:previewEnv});const w=boot(r.javascript,r.config.appUrl+'?reset=1#type=recovery');assert.equal(w.SimpleAppRuntime.environment,'staging');assert.ok(Object.isFrozen(w.SimpleAppRuntime));});
test('deployment-specific exact origin',()=>{const env={...previewEnv,SIMPLE_APP_URL:'https://abc123.simple-staging-raulchulbi.pages.dev/',CF_PAGES_URL:'https://abc123.simple-staging-raulchulbi.pages.dev'};assert.equal(createRuntimeConfig({target:'preview',env}).config.appOrigin,new URL(env.SIMPLE_APP_URL).origin);});
test('production restricted to main',()=>assert.throws(()=>createRuntimeConfig({target:'production',env:{...productionEnv,CF_PAGES_BRANCH:previewEnv.CF_PAGES_BRANCH}}),/restricted to main/));
test('reviewed offline production identity uses production only',()=>assert.equal(createRuntimeConfig({target:'production',env:productionEnv}).config.environment,'production'));
test('no default target or URL',()=>{assert.throws(()=>createRuntimeConfig(),/explicit target/);assert.throws(()=>local(undefined),/absolute URL/);});
test('local cannot inherit unvalidated Cloudflare aliases',()=>{for(const extra of [{CF_PAGES_URL:'https://unapproved.example.invalid/'},{CF_PAGES_BRANCH:'main'},{SIMPLE_PAGES_PROJECT:'synthetic-fixture-only'}])assert.throws(()=>createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:'http://127.0.0.1:4280/',...extra}}),/cannot inherit/);});
test('no backend override',()=>assert.throws(()=>createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:'http://127.0.0.1:4280/',SIMPLE_SUPABASE_URL:'https://yvguatdqncadkwewlepe.supabase.co'}}),/override/));
test('no key override',()=>assert.throws(()=>createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:'http://127.0.0.1:4280/',SIMPLE_SUPABASE_KEY:'sb_secret_forbidden'}}),/override/));
test('reject service role and session keys',()=>{const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const backend=require('../../config/public-backends.json').staging;for(const payload of [{role:'service_role',ref:backend.projectId},{role:'anon',ref:backend.projectId,email:'fixture@example.invalid'},{role:'anon',ref:'yvguatdqncadkwewlepe'}])assert.throws(()=>validateBackend('staging',{...backend,publicKey:'eyJ.'+encode(payload)+'.signature'}),/public backend|private/);});
test('reject URL credentials/query/hash',()=>{for(const u of ['http://user:pass@localhost:4280/','http://localhost:4280/?reset=1','http://localhost:4280/#code','http://localhost:4280/SIMPLE'])assert.throws(()=>local(u));});
test('reject nonloopback local',()=>{for(const u of ['http://0.0.0.0:4280/','https://localhost:4280/','http://localhost/','http://127.0.0.1:4280/nested/'])assert.throws(()=>local(u));});
test('reject unknown Pages host',()=>assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,SIMPLE_APP_URL:'https://other.pages.dev/',CF_PAGES_URL:'https://other.pages.dev'}}),/outside/));
test('reject host suffix spoof',()=>assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,SIMPLE_APP_URL:'https://simple-staging-raulchulbi.pages.dev.attacker.invalid/',CF_PAGES_URL:'https://simple-staging-raulchulbi.pages.dev.attacker.invalid'}}),/outside/));
test('reject unverified project/deployment',()=>{assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,SIMPLE_PAGES_PROJECT:''}}),/verified/);assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,CF_PAGES_URL:''}}),/required/);});
test('stable Auth URL plus this exact deployment alias',()=>{const r=createRuntimeConfig({target:'preview',env:{...previewEnv,CF_PAGES_URL:'https://abc.simple-staging-raulchulbi.pages.dev'}});assert.equal(boot(r.javascript,'https://abc.simple-staging-raulchulbi.pages.dev/').SimpleAppRuntime.appUrl,previewEnv.SIMPLE_APP_URL);assert.throws(()=>boot(r.javascript,'https://other.simple-staging-raulchulbi.pages.dev/'),/not approved/);});
test('reject deployment from another project',()=>assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,CF_PAGES_URL:'https://abc.other.pages.dev'}}),/belong/));
test('reject experimental preview branch',()=>assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,CF_PAGES_BRANCH:'unreviewed'}}),/not approved/));
test('reject conflicting build targets',()=>assert.throws(()=>createRuntimeConfig({target:'local',env:{SIMPLE_DEPLOY_TARGET:'production',SIMPLE_APP_URL:'http://localhost:4280/'}}),/conflicting/));
test('runtime fails closed on unknown origin and route',()=>{const r=local('http://localhost:4280/');for(const u of ['http://localhost:4281/','http://localhost:4280/SIMPLE/','https://attacker.invalid/'])assert.throws(()=>boot(r.javascript,u),/not approved/);});
test('callback query/hash preserved without token copying',()=>{const r=local('http://localhost:4280/');const w=boot(r.javascript,'http://localhost:4280/?reset=1#access_token=synthetic&refresh_token=synthetic');assert.equal(w.location.hash,'#access_token=synthetic&refresh_token=synthetic');assert.ok(!r.javascript.includes('access_token'));assert.ok(!Object.keys(w.SimpleAppRuntime).some(k=>/token|session/.test(k)));});
test('index.html alias supported',()=>assert.equal(boot(local('http://localhost:4280/').javascript,'http://localhost:4280/index.html').SimpleAppRuntime.basePath,'/'));
test('repository GitHub compatibility and loopback stage isolation',()=>{const js=createRepositoryRuntime();assert.equal(boot(js,'https://raulchulbi-sys.github.io/SIMPLE/').SimpleAppRuntime.environment,'production');assert.equal(boot(js,'http://127.0.0.1:4280/').SimpleAppRuntime.environment,'staging');assert.throws(()=>boot(js,'https://unreviewed.pages.dev/'),/not approved/);});
test('staging and production Pages identities cannot cross even with the correct target branch',()=>{
 for(const [target,source,CF_PAGES_BRANCH] of [['production',previewEnv,'main'],['preview',productionEnv,'codex/cloudflare-migration']]){
  assert.throws(()=>createRuntimeConfig({target,env:{...source,CF_PAGES_BRANCH}}),/Pages project is not approved for target/);
 }
});
test('matching project and URLs in environment cannot approve an unknown Pages identity',()=>{
 for(const [target,source] of [['preview',previewEnv],['production',productionEnv]]){
  assert.throws(()=>createRuntimeConfig({target,env:{...source,SIMPLE_PAGES_PROJECT:'synthetic-fixture-only',SIMPLE_APP_URL:'https://synthetic-fixture-only.pages.dev/',CF_PAGES_URL:'https://abc.synthetic-fixture-only.pages.dev/'}}),/Pages project is not approved for target/);
 }
});
test('a preparation branch cannot build the production frontend',()=>assert.throws(()=>createRuntimeConfig({target:'production',env:{...productionEnv,CF_PAGES_BRANCH:'codex/cloudflare-production-preparation'}}),/restricted to main/));
test('main cannot build the staging frontend',()=>assert.throws(()=>createRuntimeConfig({target:'preview',env:{...previewEnv,CF_PAGES_BRANCH:'main'}}),/preview branch is not approved/));
test('production runtime admits only its stable origin and this exact deployment alias',()=>{
 const r=createRuntimeConfig({target:'production',env:{...productionEnv,CF_PAGES_URL:'https://abc.simple-raulchulbi.pages.dev/'}});
 for(const url of [productionEnv.SIMPLE_APP_URL,'https://abc.simple-raulchulbi.pages.dev/'])assert.equal(boot(r.javascript,url).SimpleAppRuntime.appUrl,productionEnv.SIMPLE_APP_URL);
 for(const url of [previewEnv.SIMPLE_APP_URL,'https://abc.simple-staging-raulchulbi.pages.dev/','https://other.simple-raulchulbi.pages.dev/','https://raulchulbi-sys.github.io/SIMPLE/'])assert.throws(()=>boot(r.javascript,url),/not approved/);
});
test('Cloudflare metadata cannot enter through the GitHub production exception',()=>{
 const env={SIMPLE_APP_URL:'https://raulchulbi-sys.github.io/SIMPLE/',SIMPLE_HOSTING_PROVIDER:'github'};
 for(const extra of [{CF_PAGES_URL:productionEnv.CF_PAGES_URL},{CF_PAGES_BRANCH:'main'},{SIMPLE_PAGES_PROJECT:productionEnv.SIMPLE_PAGES_PROJECT}])assert.throws(()=>createRuntimeConfig({target:'production',env:{...env,...extra}}),/Cloudflare cannot build the GitHub target/);
});
test('repository runtime bytes remain unchanged by Pages identity validation',()=>{
 const existing=fs.readFileSync(path.resolve(__dirname,'../../assets/runtime-config.js'),'utf8').replace(/\r\n/g,'\n');
 assert.equal(createRepositoryRuntime(),existing);
});
console.log(JSON.stringify({suite:'runtime',passed,total:passed}));
