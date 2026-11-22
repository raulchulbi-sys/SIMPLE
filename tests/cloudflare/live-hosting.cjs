'use strict';

// Real HTTPS delivery only. No server, route interception, SDK substitution,
// seed, credentials, form submission, API data access or backend writes.
// Required: --url STABLE --deployment-url EXACT_D --project NAME --commit SHA
// Optional: --output tests/cloudflare/results/live-hosting.json
// --resume an ignored prior report retries failures only and keeps unique counts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const BRANCH = 'codex/cloudflare-migration';
const STAGING = 'https://dmqjexigdnfzobarhnib.supabase.co';
const GITHUB = 'https://raulchulbi-sys.github.io/SIMPLE/';
const PRODUCTION = 'https://yvguatdqncadkwewlepe.supabase.co';
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0';
const PLAYWRIGHT = 'C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const BROWSERS = 'C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PRIVATE_PATHS = [
  '/supabase/migrations/example.sql', '/tests/cloudflare/private/session.json',
  '/.git/config', '/.env', '/docs/cloudflare-migration/README.md',
  '/config/public-backends.json', '/scripts/hosting-build.cjs',
  '/index_cliente_editor_final_v25.html', '/_headers', '/assets/not-allowed.js',
  '/%2e%2e%2fconfig/public-backends.json'
];
function git(...args) {
  return execFileSync('git', args, {cwd: root, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
}
function canonical(bytes, name) {
  if (!/\.(?:html|js|css|txt)$/.test(name)) return bytes;
  const output = [];
  for (let i = 0; i < bytes.length; i++) if (!(bytes[i] === 13 && bytes[i + 1] === 10)) output.push(bytes[i]);
  return Buffer.from(output);
}
function source(name) { return canonical(git('show', 'HEAD:' + name), name); }
function cleanError(error) {
  return String(error?.message || error).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[KEY]')
    .replace(/([?&#](?:code|access_token|refresh_token|token|apikey)=)[^\s&#"']+/gi, '$1[REDACTED]')
    .slice(0, 1600);
}
function safeUrl(value) {
  try { const u = new URL(value); return u.origin + u.pathname; } catch { return '[invalid URL]'; }
}
function parseArgs(argv = process.argv.slice(2), extra = []) {
  const allowed = new Set(['--url', '--deployment-url', '--project', '--commit', '--output', '--resume', ...extra]);
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert(allowed.has(argv[i]) && argv[i + 1] && !argv[i + 1].startsWith('--'), 'Explicit named CLI values required');
    assert(!Object.hasOwn(values, argv[i]), 'Duplicate CLI argument');
    values[argv[i]] = argv[i + 1];
  }
  for (const key of ['--url', '--deployment-url', '--project', '--commit']) assert(values[key], 'Missing ' + key);
  const project = values['--project'];
  assert(/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(project), 'Invalid explicit Pages project');
  assert(/^[a-f0-9]{7,40}$/i.test(values['--commit']), 'Expected deployment commit must be a Git SHA');
  const stable = new URL(values['--url']), deployment = new URL(values['--deployment-url']);
  for (const u of [stable, deployment]) assert(u.protocol === 'https:' && !u.port && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/', 'Clean HTTPS root URL required');
  assert.equal(stable.hostname, project + '.pages.dev', 'Stable URL must be this exact project root');
  const suffix = '.' + project + '.pages.dev';
  assert(deployment.hostname.endsWith(suffix), 'Deployment URL must belong to the same project');
  assert(/^[a-f0-9]{8,64}$/.test(deployment.hostname.slice(0, -suffix.length)), 'An exact deployment hash URL is required, not a branch alias');
  const head = git('rev-parse', 'HEAD').toString().trim(), tree = git('rev-parse', 'HEAD^{tree}').toString().trim();
  let expectedTree = null;
  try { expectedTree = git('rev-parse', '--verify', values['--commit'] + '^{tree}').toString().trim(); } catch { /* Remote commit may not be fetched. Content is still compared to HEAD. */ }
  if (expectedTree) assert.equal(expectedTree, tree, 'Expected commit and local HEAD trees differ');
  // Require the generator and its public configuration to be the reviewed HEAD.
  for (const file of ['scripts/hosting-runtime.cjs', 'config/public-backends.json'])
    assert(sha(canonical(fs.readFileSync(path.join(root, file)), file)) === sha(source(file)), 'Uncommitted runtime input: ' + file);
  const runtime = require('../../scripts/hosting-runtime.cjs').createRuntimeConfig({target: 'preview', env: {
    SIMPLE_APP_URL: stable.href, CF_PAGES_URL: deployment.href,
    SIMPLE_PAGES_PROJECT: project, CF_PAGES_BRANCH: BRANCH
  }});
  const manifest = JSON.parse(source('config/static-public-manifest.json').toString());
  assert(manifest.schemaVersion === 1 && manifest.entry === 'index.html' && Array.isArray(manifest.files), 'Unsupported manifest');
  const files = new Map();
  for (const name of manifest.files) {
    assert(name === 'index.html' || /^assets\/[a-zA-Z0-9_/-]+\.(?:js|css|png|webp)$/.test(name), 'Unsafe manifest file');
    assert(!files.has(name), 'Duplicate manifest file'); files.set(name, source(name));
  }
  files.set('assets/runtime-config.js', canonical(Buffer.from(runtime.javascript), 'assets/runtime-config.js'));
  for (const name of ['404.html', 'robots.txt']) files.set(name, source('config/cloudflare/' + name));
  return {stable: stable.href, deployment: deployment.href, project, expectedCommit: values['--commit'], head, tree,
    expectedCommitTreeVerified: Boolean(expectedTree), runtime, files, manifest,
    output: values['--output'] ? outputPath(values['--output']) : null,
    resume: values['--resume'] ? outputPath(values['--resume']) : null, values};
}
function outputPath(relative) {
  assert(!path.isAbsolute(relative), 'Output must be an explicit repository-relative ignored results path');
  const target = path.resolve(root, relative), results = path.join(__dirname, 'results');
  assert(target.startsWith(results + path.sep) && target.endsWith('.json'), 'Output must be tests/cloudflare/results/*.json');
  assert(git('check-ignore', '--', path.relative(root, target)).toString().trim(), 'Output must be Git-ignored');
  return target;
}
function writeReport(config, report) {
  if (!config.output) return;
  fs.mkdirSync(path.dirname(config.output), {recursive: true});
  fs.writeFileSync(config.output, JSON.stringify(report, null, 2) + '\n');
}
const HEADER_NAMES = ['content-type', 'cache-control', 'etag', 'last-modified', 'content-encoding', 'age', 'cf-cache-status', 'cf-ray', 'server', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'content-security-policy-report-only', 'content-security-policy', 'x-robots-tag'];
function headersSummary(headers) { return Object.fromEntries(HEADER_NAMES.map(name => [name, headers.get(name)])); }
function mime(name) {
  return ({html: ['text/html'], js: ['application/javascript', 'text/javascript'], css: ['text/css'], png: ['image/png'], webp: ['image/webp'], txt: ['text/plain']})[path.extname(name).slice(1)];
}
function checkMime(response, name) {
  assert(mime(name).includes((response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()), 'Wrong MIME: ' + name);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', 'Missing nosniff: ' + name);
}
function checkCache(response, type) {
  const c = (response.headers.get('cache-control') || '').toLowerCase();
  assert(!c.includes('immutable'), 'Mutable public file marked immutable');
  if (type === 'html') assert(/(?:^|,)\s*no-cache\s*(?:,|$)/.test(c), 'HTML must revalidate');
  if (type === 'asset') assert(/(?:^|,)\s*public\s*(?:,|$)/.test(c) && /max-age\s*=\s*0(?:,|$)/.test(c) && c.includes('must-revalidate'), 'Assets must revalidate');
}
async function request(config, value, options = {}) {
  const original = new URL(value), method = options.method || 'GET';
  assert(['GET', 'HEAD'].includes(method), 'Only GET and HEAD are permitted');
  let current = original, redirects = [];
  for (let n = 0; n < 6; n++) {
    assert([new URL(config.stable).origin, new URL(config.deployment).origin].includes(current.origin), 'Foreign redirect rejected before request');
    const started = performance.now(), response = await fetch(current, {...options, method, redirect: 'manual', signal: AbortSignal.timeout(30000)});
    const ttfbMs = performance.now() - started;
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); assert(location, 'Redirect without Location');
      const next = new URL(location, current); assert.equal(next.origin, original.origin, 'Redirect changed origin');
      assert.equal(next.search, original.search, 'Redirect discarded callback query');
      redirects.push({from: safeUrl(current), to: safeUrl(next), status: response.status});
      await response.body?.cancel(); current = next; continue;
    }
    const body = Buffer.from(await response.arrayBuffer());
    return {response, body, redirects, finalUrl: current.href, ttfbMs: Math.round(ttfbMs * 10) / 10, totalMs: Math.round((performance.now() - started) * 10) / 10};
  }
  throw Error('Too many redirects');
}
function observation(result) {
  return {status: result.response.status, url: safeUrl(result.finalUrl), bytes: result.body.length, sha256: sha(result.body),
    ttfbMs: result.ttfbMs, totalMs: result.totalMs, redirects: result.redirects, headers: headersSummary(result.response.headers)};
}
async function httpChecks(config, report) {
  const check = async (name, fn) => {
    const previous = report.http.findIndex(row => row.name === name);
    if (previous >= 0 && report.http[previous].pass) return;
    let row;
    try { const details = await fn(); row = {name, pass: true, details}; }
    catch (error) { row = {name, pass: false, error: cleanError(error)}; }
    if (previous >= 0) report.http[previous] = row; else report.http.push(row);
  };
  for (const [label, base] of [['stable', config.stable], ['deployment', config.deployment]]) {
    const captures = new Map();
    await check(label + ': published files match Git HEAD plus exact generated runtime', async () => {
      const rows = [];
      for (const [name, expected] of config.files) {
        const r = await request(config, new URL(name === 'index.html' ? './' : name, base));
        captures.set(name, r); rows.push({file: name, ...observation(r)});
        report.assetComparisons.push({origin: label, ...rows.at(-1)});
        assert.equal(r.response.status, 200, 'Public file not available: ' + name); checkMime(r.response, name);
        assert(sha(r.body) === sha(expected), 'Published bytes differ: ' + name);
      }
      return {files: rows.length};
    });
    await check(label + ': security and mutable-file cache policies', async () => {
      const r = captures.get('index.html') || await request(config, base), h = r.response.headers;
      assert.equal(h.get('x-frame-options'), 'DENY'); assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(h.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
      assert((h.get('x-robots-tag') || '').includes('noindex'), 'Preview must not be indexed');
      const csp = h.get('content-security-policy-report-only') || '';
      assert(csp.includes(STAGING) && csp.includes(STAGING.replace('https:', 'wss:')) && !csp.includes(PRODUCTION), 'Report-only policy must select staging only');
      assert.equal(h.get('content-security-policy'), null, 'This migration uses report-only CSP'); checkCache(r.response, 'html');
      for (const name of ['assets/runtime-config.js', 'assets/theme.css', 'robots.txt']) {
        const file = captures.get(name) || await request(config, new URL(name, base)); checkCache(file.response, 'asset');
      }
      return headersSummary(h);
    });
    await check(label + ': callback query and index alias keep HTML and query', async () => {
      // HTTP only: never navigate a browser with a fake code or recovery token.
      const rows = [];
      for (const route of ['?reset=1&code=hosting-readonly', 'index.html?reset=1&code=hosting-readonly']) {
        const r = await request(config, new URL(route, base));
        assert.equal(r.response.status, 200); assert(sha(r.body) === sha(config.files.get('index.html')), 'Callback HTML differs');
        assert.equal(new URL(r.finalUrl).search, '?reset=1&code=hosting-readonly'); rows.push(observation(r));
      }
      return rows;
    });
    for (const name of ['assets/runtime-config.js', 'assets/theme.css']) await check(label + ': real ETag revalidation ' + name, async () => {
      const a = captures.get(name) || await request(config, new URL(name, base)), etag = a.response.headers.get('etag');
      assert(etag, 'ETag missing'); const b = await request(config, new URL(name, base), {headers: {'If-None-Match': etag}});
      assert.equal(b.response.status, 304, 'Conditional request did not revalidate'); assert.equal(b.body.length, 0); return observation(b);
    });
    for (const route of PRIVATE_PATHS) await check(label + (route.startsWith('/%') ? ': encoded traversal is denied before the application' : ': private or missing path returns genuine 404 ' + route), async () => {
      const r = await request(config, new URL(route, base));
      if (route.startsWith('/%') && r.response.status === 400) {
        assert(!r.body.includes(Buffer.from('SimpleAppRuntime')) && !r.body.includes(Buffer.from('supabasePublicKey')), 'Edge rejection exposed runtime/data');
        return {...observation(r), rejection: 'Cloudflare rejected encoded traversal with 400 before static routing'};
      }
      assert.equal(r.response.status, 404, 'Private/missing URL was exposed or served app fallback');
      assert(sha(r.body) === sha(config.files.get('404.html')), '404 differs from reviewed custom page'); checkMime(r.response, '404.html');
      assert(!r.body.includes(Buffer.from('SimpleAppRuntime')), '404 must not bootstrap the application');
      // Pages applies path header rules to the requested path; do not borrow the
      // localhost server's forced no-store behavior as real hosting evidence.
      const row = observation(r); row.noStore = /no-store/i.test(r.response.headers.get('cache-control') || ''); return row;
    });
    await check(label + ': native HEAD has HTML headers and no body', async () => {
      const r = await request(config, base, {method: 'HEAD'}); assert.equal(r.response.status, 200); assert.equal(r.body.length, 0);
      checkMime(r.response, 'index.html'); checkCache(r.response, 'html'); return observation(r);
    });
  }
}
function playwright() { process.env.PLAYWRIGHT_BROWSERS_PATH ||= BROWSERS; return require(PLAYWRIGHT); }
function attachNetwork(context, {origins, backend, files}) {
  const requests = [], responses = [], failures = [], violations = [], tasks = [], pageErrors = [], consoleErrors = [];
  const permitted = req => {
    const u = new URL(req.url()), method = req.method();
    if (u.protocol !== 'https:' || !['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
    if (u.origin === backend) return ['GET', 'OPTIONS'].includes(method) && u.pathname === '/auth/v1/settings' && !u.search;
    if (origins.includes(u.origin)) return ['GET', 'HEAD'].includes(method) && (u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/SIMPLE/' || u.pathname === '/SIMPLE/index.html' || u.pathname === '/favicon.ico' || [...files.keys()].some(name => u.pathname === '/' + name || u.pathname === '/SIMPLE/' + name));
    if (u.origin === 'https://cdn.jsdelivr.net') return method === 'GET' && (u.href === SDK || u.href.startsWith(SDK + '/'));
    return method === 'GET' && u.href === 'https://media.tenor.com/uYAHiDSVAn4AAAA1/baldi-dance.webp';
  };
  context.on('request', req => {
    const row = {method: req.method(), url: safeUrl(req.url()), type: req.resourceType()}; requests.push(row);
    if (!permitted(req)) { violations.push(row); void context.close().catch(() => {}); }
  });
  context.on('response', response => tasks.push((async () => {
    const h = await response.allHeaders(); responses.push({url: safeUrl(response.url()), status: response.status(),
      headers: Object.fromEntries(HEADER_NAMES.filter(name => Object.hasOwn(h, name)).map(name => [name, h[name]]))});
  })().catch(error => failures.push({error: cleanError(error)}))));
  context.on('requestfailed', req => failures.push({method: req.method(), url: safeUrl(req.url()), error: cleanError(req.failure()?.errorText)}));
  context.on('page', page => {
    page.on('pageerror', error => pageErrors.push(cleanError(error)));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(cleanError(message.text())); });
  });
  return {requests, responses, failures, violations, pageErrors, consoleErrors, async finish() { await Promise.all(tasks); }};
}
async function welcome(page) {
  await page.waitForFunction(() => typeof simpleAuth !== 'undefined' && simpleAuth.screen === 'welcome' && !simpleAuth.busy, null, {timeout: 30000});
  await page.evaluate(async () => { if (typeof simpleOAuth !== 'undefined') await simpleOAuth.loading; });
  assert(await page.locator('#authWelcome').isVisible(), 'Welcome screen missing');
  assert(!await page.locator('#app').isVisible(), 'Sessionless context opened authenticated app');
}
async function verifyRuntime(page, config) {
  const actual = await page.evaluate(() => ({hash: null, config: window.SimpleAppRuntime,
    frozen: Object.isFrozen(window.SimpleAppRuntime) && Object.isFrozen(window.SimpleAppRuntime?.allowedOrigins),
    hostingError: Boolean(window.__SIMPLE_HOSTING_ERROR), sdkPresent: typeof window.supabase?.createClient === 'function',
    sessionKeys: Object.keys(localStorage).filter(key => /^sb-.*-auth-token$/.test(key))}));
  assert(actual.frozen && !actual.hostingError && actual.sdkPresent, 'Runtime/SDK did not boot correctly');
  assert(sha(Buffer.from(JSON.stringify(actual.config))) === sha(Buffer.from(JSON.stringify(config.runtime.config))), 'Runtime does not match exact deployment configuration');
  assert.equal(actual.sessionKeys.length, 0, 'Fresh context unexpectedly has a stored Auth session');
}
async function fit(page, selector) {
  const result = await page.locator(selector).evaluate(el => ({width: innerWidth, scroll: document.documentElement.scrollWidth,
    boxes: [el, ...el.querySelectorAll('button,input')].filter(x => x.getClientRects().length).map(x => { const b = x.getBoundingClientRect(); return {left: b.left, right: b.right}; })}));
  assert(result.scroll <= result.width + 1 && result.boxes.every(b => b.left >= -1 && b.right <= result.width + 1), 'Visible auth controls overflow viewport');
}
async function browserChecks(config, report) {
  const engines = playwright();
  for (const engine of ['chromium', 'webkit']) {
    const browser = await engines[engine].launch({headless: true, ...(engine === 'chromium' ? {channel: 'msedge'} : {})});
    try {
      for (const width of [320, 1280]) for (const theme of ['light', 'dark']) {
        const previous = report.browser.findIndex(row => row.engine === engine && row.width === width && row.theme === theme);
        if (previous >= 0 && report.browser[previous].pass) continue;
        const row = {engine, width, theme, pass: false, origins: []};
        if (previous >= 0) report.browser[previous] = row; else report.browser.push(row);
        const context = await browser.newContext({viewport: {width, height: 844}, reducedMotion: 'reduce', serviceWorkers: 'block'});
        const net = attachNetwork(context, {origins: [new URL(config.stable).origin, new URL(config.deployment).origin], backend: STAGING, files: config.files});
        const page = await context.newPage(); page.setDefaultTimeout(30000);
        try {
          for (const [label, base] of [['stable', config.stable], ['deployment', config.deployment]]) {
            await page.goto(base, {waitUntil: 'load'}); await welcome(page); await verifyRuntime(page, config);
            // The product's real preference API writes only this disposable
            // browser context. No SDK, auth state, data or UI is replaced.
            await page.evaluate(value => simpleTheme.set(value), theme); await page.reload({waitUntil: 'load'}); await welcome(page);
            assert.equal(await page.locator('html').getAttribute('data-theme'), theme); await fit(page, '#authWelcome');
            const shots = [];
            const capture = async view => {
              const image = await page.screenshot({animations: 'disabled', fullPage: true});
              const item = {view, pngSha256: sha(image), bytes: image.length};
              if (config.output) {
                const directory = path.join(path.dirname(config.output), path.basename(config.output, '.json') + '-screenshots');
                fs.mkdirSync(directory, {recursive: true}); const filename = `${label}-${engine}-${width}-${theme}-${view}.png`;
                fs.writeFileSync(path.join(directory, filename), image); item.file = path.relative(root, path.join(directory, filename)).replaceAll('\\', '/');
              }
              shots.push(item);
            };
            await capture('welcome'); await page.locator('#authWelcome').getByRole('button', {name: 'Iniciar sesión', exact: true}).click();
            assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'login'); await fit(page, '#authCredentials'); await capture('login');
            assert.equal(await page.locator('#email').inputValue(), ''); assert.equal(await page.locator('#password').inputValue(), '');
            await page.locator('#authCredentials .auth-back').click(); await page.locator('#authWelcome').getByRole('button', {name: 'Crear una cuenta', exact: true}).click();
            assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'role'); await fit(page, '#authRoles'); await capture('roles');
            await page.locator('#authRoles').getByRole('button', {name: /Atleta/}).click();
            assert.equal(await page.locator('#auth').getAttribute('data-screen'), 'signup'); await fit(page, '#authCredentials'); await capture('signup');
            await verifyRuntime(page, config); row.origins.push({label, url: base, screenshots: shots});
          }
          await net.finish(); assert.equal(net.violations.length, 0, 'Unexpected native network operation'); assert.equal(net.pageErrors.length, 0, 'JavaScript page error');
          assert(net.requests.some(r => r.url === STAGING + '/auth/v1/settings'), 'Real public Auth settings GET was not observed');
          assert(net.responses.some(r => r.url === STAGING + '/auth/v1/settings' && r.status === 200), 'Real public Auth settings GET did not return 200');
          const failedStatic = net.responses.filter(r => [new URL(config.stable).origin, new URL(config.deployment).origin, 'https://cdn.jsdelivr.net'].some(origin => r.url.startsWith(origin + '/')) && r.status >= 400 && !r.url.endsWith('/favicon.ico'));
          assert.equal(failedStatic.length, 0, 'Public static resource failed'); assert.equal(net.failures.length, 0, 'Native request failed'); row.pass = true;
        } catch (error) { row.error = cleanError(error); }
        finally { await net.finish(); row.network = {requests: net.requests, responses: net.responses, failures: net.failures, violations: net.violations, pageErrors: net.pageErrors, consoleErrors: net.consoleErrors}; await context.close().catch(() => {}); }
      }
    } finally { await browser.close(); }
  }
}
function identity(config) {
  return {stableUrl: config.stable, deploymentUrl: config.deployment, project: config.project, branch: BRANCH,
    expectedDeploymentCommit: config.expectedCommit, localSourceCommit: config.head, localSourceTree: config.tree,
    expectedCommitTreeVerifiedLocally: config.expectedCommitTreeVerified,
    commitProof: 'Deployment commit supplied from reviewed Pages metadata; HTTP checks prove content, not remote Git metadata.',
    expectedHtmlSha256: sha(config.files.get('index.html')), expectedRuntimeSha256: sha(config.files.get('assets/runtime-config.js'))};
}
async function main() {
  const config = parseArgs(); let report = {capturedAt: new Date().toISOString(), kind: 'Real HTTPS GET/HEAD and sessionless native Chromium/WebKit; no interception, mock, seed, login, OAuth, REST, Functions, AI or backend writes',
    identity: identity(config), http: [], browser: [], assetComparisons: []};
  if (config.resume) {
    const prior = JSON.parse(fs.readFileSync(config.resume, 'utf8'));
    assert(sha(Buffer.from(JSON.stringify(prior.identity))) === sha(Buffer.from(JSON.stringify(report.identity))), 'Resume identity differs; source/deployment results cannot be reused');
    assert(Array.isArray(prior.http) && Array.isArray(prior.browser) && Array.isArray(prior.assetComparisons), 'Unsupported resume report');
    report = {...prior, firstCapturedAt: prior.firstCapturedAt || prior.capturedAt, capturedAt: report.capturedAt};
    // Retain the initial diagnostic separately; only this corrected edge case
    // changes its name, since the real host rejects traversal earlier than local.
    for (const row of report.http) if (row.name.endsWith(': private or missing path returns genuine 404 /%2e%2e%2fconfig/public-backends.json'))
      row.name = row.name.split(':')[0] + ': encoded traversal is denied before the application';
  }
  await httpChecks(config, report);
  // Fail the public-delivery gate before opening application browsers.
  if (report.http.every(row => row.pass)) await browserChecks(config, report);
  const rows = [...report.http, ...report.browser]; report.counts = {http: report.http.length, browser: report.browser.length,
    passed: rows.filter(row => row.pass).length, failed: rows.filter(row => !row.pass).length, uniqueCases: rows.length,
    publicFileComparisons: report.assetComparisons.length, screenshotArtifacts: report.browser.reduce((n, row) => n + row.origins.reduce((s, origin) => s + origin.screenshots.length, 0), 0)};
  writeReport(config, report);
  console.log(JSON.stringify({identity: report.identity, counts: report.counts, browserSkipped: report.browser.length === 0,
    failures: rows.filter(row => !row.pass).map(row => ({name: row.name || `${row.engine}/${row.width}/${row.theme}`, error: row.error})),
    missing404NoStore: report.http.filter(row => row.pass && row.details?.noStore === false).map(row => row.name), output: config.output ? path.relative(root, config.output) : null}, null, 2));
  if (report.counts.failed || report.browser.length !== 8) process.exitCode = 1;
}
module.exports = {parseArgs, sha, safeUrl, cleanError, canonical, request, headersSummary, playwright, attachNetwork, welcome, verifyRuntime, identity, writeReport, STAGING, PRODUCTION, GITHUB};
if (require.main === module) main().catch(error => { console.error(cleanError(error)); process.exitCode = 1; });
