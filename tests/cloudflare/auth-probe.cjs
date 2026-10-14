// Optional live read-only check. It never follows redirects, sends mail, or uses a valid session.
// --invalid-auth additionally checks GET and empty POST with an invalid JWT; the gateway must reject both.
// Usage: node tests/cloudflare/auth-probe.cjs --config path/to/public-runtime.json
// The JSON contains appUrl, supabaseUrl, supabasePublicKey; do not pass secrets.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const projects = new Set(['https://dmqjexigdnfzobarhnib.supabase.co', 'https://yvguatdqncadkwewlepe.supabase.co']);
function validate(config) {
  assert(config && projects.has(config.supabaseUrl), 'Known Supabase project required');
  const app = new URL(config.appUrl);
  assert(!app.username && !app.password && !app.search && !app.hash && config.appUrl.endsWith('/'), 'Exact application base required');
  assert(app.protocol === 'https:' || (app.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(app.hostname)), 'HTTPS or loopback URL required');
  assert(!app.hostname.endsWith('.invalid') && !/[*?\\]/.test(config.appUrl), 'Actual verified application URL required');
  const key = config.supabasePublicKey;
  assert(typeof key === 'string' && key.length > 0 && !key.startsWith('sb_secret_'), 'Public key required');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    const parts = key.split('.');
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw new Error('Invalid public key'); }
    assert(parts.length === 3 && payload.role === 'anon' && payload.ref === new URL(config.supabaseUrl).hostname.split('.')[0], 'Only matching public anon keys accepted');
  }
  return app;
}
function validateCorsOrigins(config, selected) {
  const app = validate(config);
  const declared = config.allowedOrigins || config.corsOrigins || [app.origin];
  const origins = selected === undefined ? declared : selected;
  assert(Array.isArray(declared) && declared.length > 0 && declared.length <= 2, 'One stable/build origin pair required');
  assert(Array.isArray(origins) && origins.length > 0 && origins.length <= 2, 'Explicit CORS origin array required');
  assert.equal(new Set(declared).size, declared.length, 'Duplicate declared origins rejected');
  assert.equal(new Set(origins).size, origins.length, 'Duplicate CORS origins rejected');
  const projectHost = app.hostname.endsWith('.pages.dev') ? app.hostname.split('.').slice(-3).join('.') : null;
  for (const raw of new Set([...declared, ...origins])) {
    const origin = new URL(raw);
    assert(raw === origin.origin, 'CORS values must be exact origins, without path/query/fragment/trailing slash');
    assert(!origin.username && !origin.password && !/[*?\\]/.test(raw), 'Unsafe CORS origin');
    assert(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)), 'HTTPS or loopback CORS origin required');
    if (projectHost) {
      const suffix = '.' + projectHost;
      assert(origin.protocol === 'https:' && !origin.port && (origin.hostname === projectHost || (origin.hostname.endsWith(suffix) && /^[a-z0-9-]+$/.test(origin.hostname.slice(0, -suffix.length)))), 'CORS origin belongs to another Pages project');
    }
    assert(declared.includes(raw), 'CORS origin was not declared by this runtime/build');
  }
  assert(declared.includes(app.origin), 'Stable application origin must remain declared');
  return Object.freeze([...origins]);
}
async function probe(config, transport = fetch, { invalidAuth = false, corsOrigins } = {}) {
  const app = validate(config), origins = validateCorsOrigins(config, corsOrigins), results = [];
  async function check(name, operation) {
    try { const evidence = await operation(); results.push({ name, pass: true, ...evidence }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  }
  const request = (url, options = {}) => transport(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  for (const suffix of ['', '?reset=1']) await check('Invalid recovery token retains exact approved destination ' + (suffix || '(base)'), async () => {
    const url = new URL('/auth/v1/verify', config.supabaseUrl);
    url.search = new URLSearchParams({ type: 'recovery', token: 'cloudflare-migration-deliberately-invalid-readonly-token', redirect_to: config.appUrl + suffix }).toString();
    const response = await request(url, { headers: { apikey: config.supabasePublicKey } });
    assert([302, 303].includes(response.status), 'Expected verification error redirect');
    const destination = new URL(response.headers.get('Location'));
    assert.equal(destination.origin, app.origin, 'Redirect fell back to another origin');
    assert.equal(destination.pathname, app.pathname, 'Redirect base path changed');
    assert.equal(destination.searchParams.get('reset'), suffix ? '1' : null, 'Recovery query was discarded');
    assert(!destination.hash.includes('access_token=') && !destination.hash.includes('refresh_token='), 'Invalid token unexpectedly returned credentials');
    assert(destination.hash.includes('error=') || destination.searchParams.has('error'), 'Expected invalid-token error');
    return { status: response.status, origin: destination.origin, basePath: destination.pathname, recoveryQueryRetained: !!suffix };
  });
  await check('Foreign auth redirect is rejected', async () => {
    const url = new URL('/auth/v1/verify', config.supabaseUrl);
    url.search = new URLSearchParams({ type: 'recovery', token: 'cloudflare-migration-deliberately-invalid-readonly-token', redirect_to: 'https://unapproved-simple-test.example.invalid/' }).toString();
    const response = await request(url, { headers: { apikey: config.supabasePublicKey } });
    assert([302, 303].includes(response.status), 'Expected verification error redirect');
    const destination = new URL(response.headers.get('Location'));
    assert.notEqual(destination.hostname, 'unapproved-simple-test.example.invalid');
    return { status: response.status, foreignDestinationRejected: true };
  });
  await check('Public Auth settings readable', async () => {
    const response = await request(new URL('/auth/v1/settings', config.supabaseUrl), { headers: { apikey: config.supabasePublicKey, Origin: app.origin } });
    assert.equal(response.status, 200);
    const settings = await response.json();
    return { status: response.status, googleEnabled: settings.external?.google === true, emailEnabled: settings.external?.email === true };
  });
  for (const name of ['simple-coach-mock', 'simple-coach-premium', 'simple-coach-chat', 'simple-coach-initial-premium']) {
    for (const origin of origins) {
    await check(name + ': exact application-origin preflight [' + origin + ']', async () => {
      const response = await request(new URL('/functions/v1/' + name, config.supabaseUrl), {
        method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info' },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert((response.headers.get('Vary') || '').toLowerCase().split(',').map(h => h.trim()).includes('origin'), 'Response must vary by origin');
      const headers = (response.headers.get('Access-Control-Allow-Headers') || '').toLowerCase().split(',').map(h => h.trim());
      for (const header of ['authorization', 'apikey', 'content-type', 'x-client-info']) assert(headers.includes(header), 'Required request header denied: ' + header);
      assert((response.headers.get('Access-Control-Allow-Methods') || '').split(',').map(h => h.trim()).includes('POST'));
      return { status: response.status, origin };
    });
    if (invalidAuth) for (const method of ['GET', 'POST']) await check(name + ': invalid-session ' + method + ' remains rejected [' + origin + ']', async () => {
      const response = await request(new URL('/functions/v1/' + name, config.supabaseUrl), {
        method, headers: { Origin: origin, apikey: config.supabasePublicKey, Authorization: 'Bearer deliberately-invalid-readonly-migration-token', 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      });
      assert.equal(response.status, 401, 'Gateway must reject an invalid JWT before business dispatch');
      return { status: response.status, origin, invalidSessionRejected: true };
    });
    }
    await check(name + ': foreign preflight rejected', async () => {
      const response = await request(new URL('/functions/v1/' + name, config.supabaseUrl), {
        method: 'OPTIONS', headers: { Origin: 'https://unapproved-simple-test.example.invalid', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info' },
      });
      assert.equal(response.status, 403);
      const origin = response.headers.get('Access-Control-Allow-Origin');
      assert(origin !== '*' && origin !== 'https://unapproved-simple-test.example.invalid');
      return { status: response.status, foreignOriginRejected: true };
    });
  }
  return { kind: 'live invalid-token redirects, public settings and OPTIONS' + (invalidAuth ? ', plus GET/empty POST with invalid JWT' : ' only') + '; no mail, real login, data write, provider or redirect follow', project: new URL(config.supabaseUrl).hostname.split('.')[0], appOrigin: app.origin, corsOrigins: origins, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
}
if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  assert((args.length === 2 || (args.length === 3 && args[2] === '--invalid-auth')) && args[0] === '--config', 'Usage: node tests/cloudflare/auth-probe.cjs --config public-runtime.json [--invalid-auth]');
  const config = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
  const report = await probe(config, fetch, { invalidAuth: args[2] === '--invalid-auth' });
  const out = path.join(__dirname, 'results');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'auth-probe-' + report.project + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ kind: report.kind, project: report.project, appOrigin: report.appOrigin, corsOrigins: report.corsOrigins, passed: report.passed, failed: report.failed, results: report.results }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { probe, validate, validateCorsOrigins };
