'use strict';

const fs = require('node:fs');
const path = require('node:path');
const BACKENDS = require('../config/public-backends.json');
const TARGETS = new Set(['local', 'preview', 'production']);
const GITHUB_APP = 'https://raulchulbi-sys.github.io/SIMPLE/';
// These are reviewed deployment identities, not values selected by build variables.
// The production name is proposed for reservation; this does not provision it.
const PAGES_PROJECTS = Object.freeze({preview:'simple-staging-raulchulbi',production:'simple-raulchulbi'});

function fail(message) { throw new Error('Hosting configuration: ' + message); }
function validateBackend(environment, backend) {
  const expected = environment === 'production' ? 'yvguatdqncadkwewlepe' : 'dmqjexigdnfzobarhnib';
  if (backend.projectId !== expected || backend.url !== 'https://' + expected + '.supabase.co') fail('unexpected backend project');
  const key = backend.publicKey;
  if (typeof key !== 'string' || !key || /sb_secret_|sk-proj-|service_role/.test(key)) fail('private or missing key');
  // Legacy anon keys remain public. Never accept session JWTs or service-role keys.
  if (key.startsWith('eyJ')) {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); }
    catch (_) { fail('invalid public key'); }
    if (key.split('.').length !== 3 || claims.role !== 'anon' || claims.ref !== expected || claims.sub || claims.session_id || claims.email) fail('key does not match public backend');
  } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) fail('unrecognised public key');
}
function parseAppUrl(raw, target, env) {
  let url;
  try { url = new URL(raw); } catch (_) { fail('SIMPLE_APP_URL must be an explicit absolute URL'); }
  if (url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/') || /%|\/\//.test(url.pathname)) fail('URL must have a clean trailing-slash base path');
  if (target === 'local') {
    if (env.CF_PAGES_URL || env.CF_PAGES_BRANCH || env.SIMPLE_PAGES_PROJECT) fail('local target cannot inherit Cloudflare deployment metadata');
    if (url.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(url.hostname) || !url.port || !['/','/SIMPLE/'].includes(url.pathname)) fail('local must use an explicit loopback HTTP port');
  } else if (url.href === GITHUB_APP && target === 'production' && env.SIMPLE_HOSTING_PROVIDER === 'github') {
    if (env.CF_PAGES_URL || env.CF_PAGES_BRANCH || env.SIMPLE_PAGES_PROJECT) fail('Cloudflare cannot build the GitHub target');
  } else {
    const project = env.SIMPLE_PAGES_PROJECT;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(project || '')) fail('verified SIMPLE_PAGES_PROJECT required');
    if (project !== PAGES_PROJECTS[target]) fail('Pages project is not approved for target ' + target);
    const host = project + '.pages.dev';
    const suffix = '.' + host;
    if (url.protocol !== 'https:' || url.port || url.pathname !== '/' || !(url.hostname === host || (url.hostname.endsWith(suffix) && /^[a-z0-9-]+$/.test(url.hostname.slice(0,-suffix.length))))) fail('URL is outside the verified Pages project');
    if (!env.CF_PAGES_URL) fail('CF_PAGES_URL required for a Cloudflare build');
    let generated;
    try { generated = new URL(env.CF_PAGES_URL); } catch (_) { fail('invalid CF_PAGES_URL'); }
    if (generated.protocol !== 'https:' || generated.port || generated.username || generated.password || generated.search || generated.hash || generated.pathname !== '/' || !(generated.hostname === host || (generated.hostname.endsWith(suffix) && /^[a-z0-9-]+$/.test(generated.hostname.slice(0,-suffix.length))))) fail('deployment URL must belong to the configured project exactly');
    if (target === 'production' && env.CF_PAGES_BRANCH !== 'main') fail('production backend restricted to main');
    if (target === 'preview' && env.CF_PAGES_BRANCH !== 'codex/cloudflare-migration') fail('preview branch is not approved');
  }
  return url;
}
function renderRuntime(configs) {
  return "/* Generated from reviewed public configuration; contains no secrets. */\n(function(w){'use strict';\n" +
    'var routes=' + JSON.stringify(configs) + ';\n' +
    "var match=routes.find(function(c){return c.allowedOrigins.indexOf(w.location.origin)!==-1&&(w.location.pathname===c.basePath||w.location.pathname===c.basePath+'index.html');});\n" +
    "if(!match){w.__SIMPLE_HOSTING_ERROR='La configuración de esta dirección no está habilitada.';document.addEventListener('DOMContentLoaded',function(){var p=document.createElement('p');p.setAttribute('role','alert');p.textContent=w.__SIMPLE_HOSTING_ERROR;document.body.replaceChildren(p);});throw new Error('SIMPLE hosting origin/base not approved');}\n" +
    "Object.freeze(match.allowedOrigins);Object.defineProperty(w,'SimpleAppRuntime',{value:Object.freeze(match),writable:false,configurable:false});\n})(window);\n";
}
function createRuntimeConfig({target, env = {}} = {}) {
  if (!TARGETS.has(target)) fail('explicit target local, preview or production required');
  if (env.SIMPLE_DEPLOY_TARGET && env.SIMPLE_DEPLOY_TARGET !== target) fail('conflicting target');
  const environment = target === 'production' ? 'production' : 'staging';
  const backend = BACKENDS[environment];
  validateBackend(environment, backend);
  if (env.SIMPLE_SUPABASE_URL && env.SIMPLE_SUPABASE_URL !== backend.url) fail('backend override rejected');
  if (env.SIMPLE_SUPABASE_KEY && env.SIMPLE_SUPABASE_KEY !== backend.publicKey) fail('key override rejected');
  const url = parseAppUrl(env.SIMPLE_APP_URL, target, env);
  // Only this build's exact deployment URL is also served. Auth always returns
  // to the explicit stable URL, so every build does not need a new Auth redirect.
  const allowedOrigins=Object.freeze([...new Set([url.origin,...(target!=='local'&&env.CF_PAGES_URL?[new URL(env.CF_PAGES_URL).origin]:[])])]);
  const config = Object.freeze({target,environment,appUrl:url.href,appOrigin:url.origin,basePath:url.pathname,allowedOrigins,supabaseUrl:backend.url,supabasePublicKey:backend.publicKey});
  return {config, javascript:renderRuntime([config])};
}
function createRepositoryRuntime() {
  const production = createRuntimeConfig({target:'production',env:{SIMPLE_APP_URL:GITHUB_APP,SIMPLE_HOSTING_PROVIDER:'github'}}).config;
  const local = ['127.0.0.1','localhost'].map(host => createRuntimeConfig({target:'local',env:{SIMPLE_APP_URL:'http://'+host+':4280/'}}).config);
  return renderRuntime([production,...local]);
}
module.exports = {createRuntimeConfig,createRepositoryRuntime,renderRuntime,validateBackend,PAGES_PROJECTS};
if (require.main === module) {
  if (process.argv.includes('--repository')) {
    fs.writeFileSync(path.join(__dirname,'../assets/runtime-config.js'),createRepositoryRuntime());
    console.log('Repository public runtime generated; GitHub production and loopback staging only.');
  } else {
    const result = createRuntimeConfig({target:process.env.SIMPLE_DEPLOY_TARGET,env:process.env});
    console.log(JSON.stringify({target:result.config.target,environment:result.config.environment,appOrigin:result.config.appOrigin,basePath:result.config.basePath}));
  }
}
