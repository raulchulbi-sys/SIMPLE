// Executes only the original Edge preflight/origin prefix, before RPC/business code.
// This is a local source test, not a live Supabase gateway or browser CORS test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const production = 'https://yvguatdqncadkwewlepe.supabase.co';
const staging = 'https://dmqjexigdnfzobarhnib.supabase.co';
const functions = ['simple-coach-mock', 'simple-coach-premium', 'simple-coach-chat', 'simple-coach-initial-premium'];
const results = [];
function prefixHandler(source, project) {
  const businessStart = source.search(/\basync function rpc\s*\(|\bconst rpc\s*=/);
  assert(businessStart > 0, 'Expected reviewed RPC boundary');
  const prefix = source.slice(0, businessStart)
    .replace(/^import\s+[^\n]+\n/gm, '')
    .replace(/(Deno\.env\.get\([^)]*\))!/g, '$1')
    .replace(/:Request\b|:any\b|:unknown\b/g, '');
  let handler;
  const context = vm.createContext({
    Deno: { env: { get: name => name === 'SUPABASE_URL' ? project : undefined }, serve: fn => { handler = fn; } },
    Response, console, DEFAULT_MODEL: 'synthetic-unreachable-model',
    fetch: () => { throw new Error('Network/business dispatch forbidden in preflight test'); },
  });
  // The sentinel makes reaching the business boundary a test failure, not an API call.
  vm.runInContext(prefix + "return new Response(null,{status:599});});", context);
  assert.equal(typeof handler, 'function');
  return handler;
}
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
}
async function allowed(handler, origin) {
  const response = await handler(new Request('https://edge-test.example.invalid/', {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info' },
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(response.headers.get('Access-Control-Allow-Methods').split(',').sort(), ['OPTIONS', 'POST']);
  assert.deepEqual(response.headers.get('Access-Control-Allow-Headers').split(',').sort(), ['apikey', 'authorization', 'content-type', 'x-client-info']);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
}
if (require.main === module) (async () => {
  for (const name of functions) {
    const source = fs.readFileSync(path.join(root, 'supabase/functions', name, 'index.ts'), 'utf8');
    const handler = prefixHandler(source, production);
    await check(`${name}: retained GitHub origin preflight`, () => allowed(handler, 'https://raulchulbi-sys.github.io'));
    for (const method of ['OPTIONS', 'POST']) await check(`${name}: foreign ${method} denied before any RPC`, async () => {
      const response = await handler(new Request('https://edge-test.example.invalid/', { method, headers: { Origin: 'https://unapproved.example.invalid' } }));
      assert.equal(response.status, 403);
      assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://unapproved.example.invalid');
      assert.equal((await response.json()).error, 'origin_denied');
    });
    await check(`${name}: allowed-origin unsupported method rejected`, async () => {
      const response = await handler(new Request('https://edge-test.example.invalid/', { method: 'GET', headers: { Origin: 'https://raulchulbi-sys.github.io' } }));
      assert.equal(response.status, 405);
      assert.equal((await response.json()).error, 'method_not_allowed');
    });
    if (process.env.SIMPLE_CF_CORS_EXPECT_ORIGIN) await check(`${name}: explicit controlled production origin preflight`, () => allowed(handler, process.env.SIMPLE_CF_CORS_EXPECT_ORIGIN));
    if (name === 'simple-coach-mock' || name === 'simple-coach-initial-premium') {
      const stagingHandler = prefixHandler(source, staging);
      const port = name === 'simple-coach-mock' ? 4194 : 4262;
      for (const host of ['127.0.0.1', 'localhost']) await check(`${name}: retained staging ${host} preflight`, () => allowed(stagingHandler, `http://${host}:${port}`));
    }
  }
  const report = { kind: 'local original Edge CORS prefix only; no live gateway/provider/backend', passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results/auth-cors.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.failed ? report : { kind: report.kind, passed: report.passed, failed: 0 }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { prefixHandler, allowed };
