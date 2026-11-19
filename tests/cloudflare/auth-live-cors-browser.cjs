// Live staging gateway CORS from synthetic browser pages, using an invalid JWT only.
// No real login, Auth token, business payload, OpenAI, or data write can occur.
// --config public-runtime.json tests its declared stable/build HTTPS origins using deployed 404 documents.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { validateCorsOrigins } = require('./auth-probe.cjs');
const root = path.resolve(__dirname, '../..');
const backend = require(path.join(root, 'config/public-backends.json')).staging;
assert.equal(backend.projectId, 'dmqjexigdnfzobarhnib');
assert.equal(backend.url, 'https://dmqjexigdnfzobarhnib.supabase.co');
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--config'), 'Usage: node tests/cloudflare/auth-live-cors-browser.cjs [--config public-runtime.json]');
const remoteConfig = args.length ? JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')) : null;
const remoteOrigins = remoteConfig ? validateCorsOrigins(remoteConfig) : null;
if (remoteConfig) {
  assert(remoteConfig.supabaseUrl === backend.url && remoteConfig.supabasePublicKey === backend.publicKey, 'The HTTPS test must use the reviewed staging backend/public key');
  assert(!remoteConfig.environment || remoteConfig.environment === 'staging', 'Production runtime rejected');
  assert(!remoteConfig.target || remoteConfig.target === 'preview', 'Only the staging preview runtime is accepted');
  assert(remoteOrigins.every(origin => new URL(origin).protocol === 'https:'), 'HTTPS deployment origins required');
}
process.env.PLAYWRIGHT_BROWSERS_PATH ||= 'C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
let playwright;
try { playwright = require(process.env.SIMPLE_PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const functions = ['simple-coach-mock', 'simple-coach-premium', 'simple-coach-chat', 'simple-coach-initial-premium'];
const token = 'Bearer deliberately-invalid-readonly-migration-token';
const rows = [];
const out = path.join(__dirname, 'results');
fs.mkdirSync(out, { recursive: true });
function write() {
  const report = { kind: 'live staging CORS/gateway from ' + (remoteConfig ? 'deployed HTTPS documents' : 'synthetic browser documents') + '; invalid JWT and empty POST only; no business or provider dispatch', approvedOrigins: remoteOrigins || ['http://127.0.0.1:4280', 'http://localhost:4280'], passed: rows.filter(r => r.pass).length, failed: rows.filter(r => !r.pass).length, results: rows };
  fs.writeFileSync(path.join(out, 'auth-live-cors-browser.json'), JSON.stringify(report, null, 2));
  return report;
}
(async () => {
  const ownedServers = [];
  async function listen(port, host) {
    const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('<!doctype html><html><body>CORS test fixture only</body></html>'); });
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      ownedServers.push(server); return server;
    } catch (error) { if (port === 4280 && error.code === 'EADDRINUSE') return null; throw error; }
  }
  if (!remoteConfig) { await listen(4280, '127.0.0.1'); await listen(4280, '::1'); }
  const foreignServer = await listen(0, '127.0.0.1');
  const foreignOrigin = 'http://127.0.0.1:' + foreignServer.address().port;
  const origins = [...(remoteOrigins || ['http://127.0.0.1:4280', 'http://localhost:4280']), foreignOrigin];
  try {
  for (const engine of (process.env.SIMPLE_AUTH_ENGINES || 'chromium,webkit').split(',')) {
    const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.SIMPLE_CHROMIUM_CHANNEL || 'msedge' } : {}) });
    try { for (const origin of origins) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const calls = [], responses = [], forbidden = [];
      page.on('response', response => {
        const request = response.request(), url = new URL(response.url());
        if (url.origin === backend.url) responses.push({ path: url.pathname, method: request.method(), status: response.status() });
      });
      // No Playwright route interception at all: it can bypass Chromium CORS.
      // HTTPS mode uses the deployed static 404 document. It must remain on the requested origin.
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin === origin && request.method() === 'GET') return;
        const functionName = url.pathname.slice('/functions/v1/'.length);
        if (url.origin === backend.url && url.pathname.startsWith('/functions/v1/') && functions.includes(functionName)) {
          if (request.method() === 'OPTIONS') return;
          if (request.method() === 'POST' && request.headers().authorization === token && request.postData() === '{}') {
            calls.push({ name: functionName, method: 'POST' }); return;
          }
        }
        forbidden.push({ hostname: url.hostname, path: url.pathname, method: request.method() });
      });
      try {
        await page.goto(origin + '/404.html');
        assert(new URL(page.url()).origin === origin, 'Document redirected to another origin; configure legitimate preview access before testing CORS');
        for (const name of functions) {
          try {
            const result = await page.evaluate(async ({ url, key, token }) => {
              try {
                const response = await fetch(url, { method: 'POST', headers: { apikey: key, Authorization: token, 'Content-Type': 'application/json' }, body: '{}' });
                return { status: response.status, readable: true };
              } catch (error) { return { readable: false, errorName: error.name }; }
            }, { url: backend.url + '/functions/v1/' + name, key: backend.publicKey, token });
            if (origin === foreignOrigin) {
              assert.equal(result.readable, false, 'Foreign origin must fail browser CORS');
              assert.equal(result.errorName, 'TypeError');
              assert.equal(responses.filter(r => r.path.endsWith('/' + name) && r.method === 'POST').length, 0, 'Foreign preflight must prevent a POST response');
            } else {
              assert.equal(result.readable, true, 'Approved origin response must be readable in the browser');
              assert.equal(result.status, 401, 'Invalid JWT must remain rejected before business code');
              assert.equal(calls.filter(c => c.name === name).length, 1);
            }
            assert.deepEqual(forbidden, []);
            rows.push({ engine, origin, name, pass: true, ...result });
          } catch (error) { rows.push({ engine, origin, name, pass: false, error: error.message, forbidden }); }
          write();
        }
      } finally { await context.close(); }
    } } finally { await browser.close(); }
  }
  } finally { for (const server of ownedServers) await new Promise(resolve => server.close(resolve)); }
  const report = write();
  console.log(JSON.stringify({ kind: report.kind, passed: report.passed, failed: report.failed, failedCases: rows.filter(r => !r.pass) }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
