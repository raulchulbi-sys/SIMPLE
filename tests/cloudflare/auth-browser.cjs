// Actual frontend + generated runtime + real pinned SDK, with every HTTP request intercepted.
// Synthetic origins/accounts only. No real OAuth, SMTP, Supabase write or OpenAI request.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const artifact = path.resolve(process.env.SIMPLE_AUTH_ARTIFACT || root);
const { createRuntimeConfig } = require(path.join(root, 'scripts/hosting-runtime.cjs'));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= 'C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
let playwright;
try { playwright = require(process.env.SIMPLE_PLAYWRIGHT_MODULE || 'playwright'); }
catch (_) { playwright = require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const sdk = fs.readFileSync(process.env.SIMPLE_AUTH_SDK || path.join(root, 'tests/cloudflare/private/supabase-2.115.0.js'));
assert.equal(crypto.createHash('sha256').update(sdk).digest('hex'), '0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7', 'Pinned real SDK required');
const sites = [
  { name: 'GitHub production base', target: 'production', env: { SIMPLE_APP_URL: 'https://raulchulbi-sys.github.io/SIMPLE/', SIMPLE_HOSTING_PROVIDER: 'github' } },
  { name: 'Cloudflare preview root (synthetic fixture; not a deployment)', target: 'preview', env: { SIMPLE_PAGES_PROJECT: 'synthetic-fixture-only', CF_PAGES_URL: 'https://synthetic-fixture-only.pages.dev', SIMPLE_APP_URL: 'https://synthetic-fixture-only.pages.dev/', CF_PAGES_BRANCH: 'codex/cloudflare-migration' } },
  { name: 'Local staging root', target: 'local', env: { SIMPLE_APP_URL: 'http://127.0.0.1:4280/' } },
];
const scenarios = ['signup-client', 'signup-trainer', 'oauth-existing-client', 'oauth-existing-trainer', 'recovery-valid', 'recovery-expired', 'recovery-request'];
const engines = (process.env.SIMPLE_AUTH_ENGINES || 'chromium,webkit').split(',');
const widths = (process.env.SIMPLE_AUTH_WIDTHS || '320,1280').split(',').map(Number);
const results = [];
const uid = '00000000-0000-4000-8000-000000000753';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const out = path.join(__dirname, 'results');
fs.mkdirSync(out, { recursive: true });
function write() {
  const report = {
    kind: 'actual frontend and generated exact-origin runtime, real SDK 2.115.0 + intercepted HTTP; no real provider, mail or remote data',
    artifact, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(artifact, 'index.html'))).digest('hex'),
    passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results,
  };
  fs.writeFileSync(path.join(out, 'auth-browser.json'), JSON.stringify(report, null, 2));
  return report;
}
async function runCase(browser, engine, width, site, scenario) {
  const runtime = createRuntimeConfig(site), config = runtime.config, base = config.appUrl;
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const calls = [], errors = [], blocked = [], missing = [];
  const control = { recoveryStatus: 200 };
  const account = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'synthetic-auth-only@example.invalid', app_metadata: { provider: scenario.startsWith('oauth') ? 'google' : 'email' }, user_metadata: { simple_role: 'trainer' }, identities: [] };
  const profile = { id: uid, name: 'Synthetic existing account', role: scenario.endsWith('trainer') ? 'trainer' : 'client' };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: uid, exp, iat: exp - 3600, role: 'authenticated', aud: 'authenticated' }, 'synthetic-http-fixture-signature'].map(v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')).join('.');
  const session = { access_token: token, refresh_token: 'synthetic-http-only-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: account };
  const callbackHash = '#' + new URLSearchParams({ access_token: token, refresh_token: session.refresh_token, expires_in: '3600', token_type: 'bearer', ...(scenario === 'recovery-valid' ? { type: 'recovery' } : {}) });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    try {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (url.origin === config.appOrigin) {
      assert.equal(method, 'GET', 'Frontend resource method');
      if (!url.pathname.startsWith(config.basePath)) { missing.push(url.pathname); return route.fulfill({ status: 404 }); }
      const relative = url.pathname.slice(config.basePath.length) || 'index.html';
      if (relative === 'assets/runtime-config.js') return route.fulfill({ body: runtime.javascript, contentType: 'application/javascript' });
      const file = path.resolve(artifact, relative);
      if (!file.startsWith(artifact + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { missing.push(relative); return route.fulfill({ status: 404 }); }
      return route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
    }
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@2.115.0')) return route.fulfill({ body: sdk, contentType: 'application/javascript' });
    if (url.origin !== config.supabaseUrl) { blocked.push({ hostname: url.hostname, method }); return route.abort(); }
    calls.push({ path: url.pathname, method, query: url.search, body: request.postDataJSON() });
    const cors = { 'Access-Control-Allow-Origin': config.appOrigin, 'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-retry-count', Vary: 'Origin' };
    const reply = (body, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/settings') return reply({ external: { google: true, apple: false, facebook: false } });
    if (url.pathname === '/auth/v1/signup') return reply(account);
    if (url.pathname === '/auth/v1/token') return reply({ code: 'invalid_credentials', msg: 'Synthetic invalid login' }, 400);
    if (url.pathname === '/auth/v1/recover') return reply(control.recoveryStatus === 200 ? {} : { code: 'unexpected_failure', msg: 'Synthetic delivery failure' }, control.recoveryStatus);
    if (url.pathname === '/auth/v1/user') return reply(account);
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/authorize') {
      assert.equal(url.searchParams.get('provider'), 'google');
      assert.equal(url.searchParams.get('redirect_to'), base);
      return route.fulfill({ contentType: 'text/html', body: '<script>location.replace(' + JSON.stringify(base + callbackHash) + ')</script>' });
    }
    if (url.pathname === '/rest/v1/profiles') {
      assert.equal(method, 'GET', 'Existing profiles must never be rewritten');
      assert.equal(url.searchParams.get('id'), 'eq.' + uid);
      return reply(profile);
    }
    if (url.pathname.startsWith('/rest/')) { assert(url.pathname.includes('/rpc/') ? method === 'POST' : ['GET', 'HEAD'].includes(method)); return reply([]); }
    blocked.push({ path: url.pathname, method });
    return route.abort();
    } catch (error) { errors.push('HTTP fixture contract: ' + error.message); return route.abort(); }
  });
  const idle = () => page.waitForFunction(() => typeof simpleAuth !== 'undefined' && !simpleAuth.busy);
  async function failedLogin() {
    await page.locator('#password').fill('Synthetic-Wrong-Only-927!');
    await page.locator('#authBtn').click(); await idle();
  }
  try {
    if (scenario === 'recovery-expired') {
      await page.addInitScript(({ session, ref }) => localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(session)), { session, ref: new URL(config.supabaseUrl).hostname.split('.')[0] });
      await page.goto(base + '?reset=1#error=access_denied&error_code=otp_expired&error_description=Synthetic+expired');
      await idle();
      assert.equal(await page.locator('#resetModal').isVisible(), false);
      assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'login');
      assert.match(await page.locator('#authMsg').innerText(), /caducado/);
      assert.equal(calls.filter(c => c.method === 'PUT' || c.path.startsWith('/rest/')).length, 0);
      assert.equal(page.url(), base);
    } else if (scenario === 'recovery-valid') {
      await page.goto(base + '?reset=1' + callbackHash);
      await page.locator('#resetModal.show').waitFor(); await idle();
      assert.equal(page.url(), base);
      assert.equal(await page.locator('#app').isVisible(), false);
      await page.locator('#newPassword').fill('short'); await page.locator('#newPassword2').fill('short');
      await page.evaluate(() => updatePassword());
      assert.match(await page.locator('#resetMsg').innerText(), /6 caracteres/);
      await page.locator('#newPassword').fill('Synthetic-New-Only-927!'); await page.locator('#newPassword2').fill('Synthetic-Different');
      await page.evaluate(() => updatePassword());
      assert.match(await page.locator('#resetMsg').innerText(), /no coinciden/);
      assert.equal(calls.filter(c => c.method === 'PUT').length, 0);
      await page.locator('#newPassword2').fill('Synthetic-New-Only-927!');
      await page.evaluate(() => Promise.all([updatePassword(), updatePassword()])); await idle();
      assert.equal(calls.filter(c => c.path === '/auth/v1/user' && c.method === 'PUT').length, 1);
      assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'login');
      assert.match(await page.locator('#authMsg').innerText(), /Contraseña actualizada/);
      assert.equal(await page.locator('#resetModal').isVisible(), false);
      await page.reload(); await idle();
      assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'welcome');
    } else {
      await page.goto(base); await idle();
      if (scenario.startsWith('signup')) {
        const role = scenario.endsWith('trainer') ? 'trainer' : 'client';
        await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
        await page.getByRole('button', { name: role === 'trainer' ? /^Entrenador/ : /^Atleta/ }).click();
        await page.locator('#email').fill(account.email); await page.locator('#password').fill('Synthetic-Signup-Only-927!');
        await page.locator('#authBtn').click(); await idle();
        const call = calls.find(c => c.path === '/auth/v1/signup');
        assert(call); assert.equal(new URLSearchParams(call.query).get('redirect_to'), base);
        assert.equal(call.body.data.simple_role, role);
        assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'confirmation');
        assert.equal(calls.filter(c => c.path === '/rest/v1/profiles').length, 0);
      } else {
        await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
        if (scenario.startsWith('oauth')) {
          await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click();
          await page.waitForFunction(() => window.__simpleStarted === true);
          assert.equal(await page.evaluate(() => profile.role), profile.role);
          assert.equal(await page.evaluate(() => user.id), uid);
          assert.equal(new URL(page.url()).origin, config.appOrigin);
          assert.equal(new URL(page.url()).pathname, config.basePath);
          assert.equal(new URL(page.url()).hash, '');
          assert.equal(await page.getByRole('button', { name: 'Continuar con Apple', exact: true }).count(), 0);
          assert.equal(await page.getByRole('button', { name: 'Continuar con Facebook', exact: true }).count(), 0);
          await page.waitForLoadState('networkidle');
          await page.reload(); await page.waitForFunction(() => window.__simpleStarted === true);
          assert.equal(await page.evaluate(() => profile.role), profile.role);
          await page.waitForLoadState('networkidle');
          await page.evaluate(() => authLogout()); await idle();
          assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'welcome');
          assert.equal(await page.evaluate(() => user), null);
        } else {
          await page.locator('#email').fill(account.email); await failedLogin();
          await page.locator('#forgotBtn').click(); await idle();
          const recovery = calls.find(c => c.path === '/auth/v1/recover');
          assert.equal(new URLSearchParams(recovery.query).get('redirect_to'), base + '?reset=1');
          assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'recovery-sent');
          assert.match(await page.locator('#authRecoverySentCopy').innerText(), /Si existe una cuenta/);
          assert.equal(await page.locator('#authRecoverySent h1').innerText(), 'Revisa tu correo');
          await page.getByRole('button', { name: 'Volver a iniciar sesión', exact: true }).click();
          await failedLogin(); control.recoveryStatus = 500;
          await page.locator('#forgotBtn').click(); await idle();
          assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'login');
          assert.match(await page.locator('#authMsg').innerText(), /No se pudo solicitar/);
          assert.equal(calls.filter(c => c.path === '/auth/v1/recover').length, 2);
        }
      }
    }
    assert.equal(await page.evaluate(() => Object.isFrozen(window.SimpleAppRuntime)), true);
    assert.equal(await page.evaluate(() => window.SimpleAppRuntime.supabaseUrl), config.supabaseUrl);
    assert.equal(await page.evaluate(() => window.SimpleAppRuntime.environment), config.environment);
    assert.deepEqual(errors, []); assert.deepEqual(missing, []); assert.deepEqual(blocked, []);
    assert.equal(calls.filter(c => c.path === '/rest/v1/profiles' && c.method !== 'GET').length, 0);
    results.push({ engine, width, site: site.name, environment: config.environment, scenario, pass: true });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({ screen: typeof simpleAuth === 'undefined' ? null : simpleAuth.screen, busy: typeof simpleAuth === 'undefined' ? null : simpleAuth.busy, started: !!window.__simpleStarted, userPresent: typeof user !== 'undefined' && !!user, callback: typeof SIMPLE_AUTH_CALLBACK === 'undefined' ? null : SIMPLE_AUTH_CALLBACK })).catch(() => null);
    results.push({ engine, width, site: site.name, environment: config.environment, scenario, pass: false, error: error.stack, diagnostic, errors, missing, blocked });
    console.error(JSON.stringify(results.at(-1)));
  } finally { await context.close(); write(); }
}
(async () => {
  for (const engine of engines) {
    const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.SIMPLE_CHROMIUM_CHANNEL || 'msedge' } : {}) });
    try { for (const width of widths) for (const site of sites) for (const scenario of scenarios.filter(s => !process.env.SIMPLE_AUTH_CASE || s.includes(process.env.SIMPLE_AUTH_CASE))) await runCase(browser, engine, width, site, scenario); }
    finally { await browser.close(); }
  }
  const report = write();
  console.log(JSON.stringify({ kind: report.kind, passed: report.passed, failed: report.failed, report: path.join(out, 'auth-browser.json') }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
