// Native staging-only invalid-token return checks. No routes, sessions, forms or provider flows.
// Usage: node tests/cloudflare/auth-return-native.cjs --config tests/cloudflare/private/auth-probe-cloudflare-runtime.json
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { validate, validateCorsOrigins } = require('./auth-probe.cjs');

const root = path.resolve(__dirname, '../..');
const stableUrl = 'https://simple-staging-raulchulbi.pages.dev/';
const backend = require(path.join(root, 'config/public-backends.json')).staging;
const args = process.argv.slice(2);
const rows = [];
const returns = new Map();
const out = path.join(__dirname, 'results');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function requireCheck(condition, code) {
  if (!condition) { const error = new Error(code); error.safeCode = code; throw error; }
}
function safeFailure(error) { return error.safeCode || (error.name === 'TimeoutError' ? 'TIMEOUT' : 'NATIVE_CHECK_FAILED'); }
function validateReturnLocation(rawLocation, config, suffix) {
  requireCheck(!!rawLocation, 'VERIFY_LOCATION_REQUIRED');
  const destination = new URL(rawLocation);
  requireCheck(!destination.username && !destination.password, 'CREDENTIALLED_RETURN_REJECTED');
  const application = new URL(config.appUrl);
  requireCheck(destination.protocol === application.protocol && destination.port === application.port && destination.origin === application.origin && destination.pathname === application.pathname, 'STABLE_RETURN_REQUIRED');
  requireCheck(destination.searchParams.get('reset') === (suffix ? '1' : null), 'RESET_QUERY_NOT_RETAINED');
  const fragment = new URLSearchParams(destination.hash.slice(1));
  for (const key of ['access_token', 'refresh_token', 'id_token', 'token', 'token_hash', 'code']) {
    requireCheck(!fragment.has(key) && !destination.searchParams.has(key), 'UNEXPECTED_CREDENTIAL_RETURN');
  }
  requireCheck(fragment.has('error') || destination.searchParams.has('error'), 'INVALID_TOKEN_ERROR_REQUIRED');
  const errorCode = fragment.get('error_code') || destination.searchParams.get('error_code');
  if (errorCode) requireCheck(/^[a-z0-9_]{1,80}$/i.test(errorCode), 'UNEXPECTED_ERROR_CODE');
  return { destination, errorCode };
}
function write() {
  const report = {
    kind: 'native staging invalid recovery token redirects and sessionless browser error returns; no interception, mail, account, refresh, provider, data write or OpenAI',
    runId, project: 'dmqjexigdnfzobarhnib', stableOriginSha256: sha256(new URL(stableUrl).origin),
    passed: rows.filter(row => row.pass).length, failed: rows.filter(row => !row.pass).length,
    results: rows,
  };
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'auth-return-native.json'), JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  assert(args.length === 2 && args[0] === '--config', 'Usage: node tests/cloudflare/auth-return-native.cjs --config public-runtime.json');
  const config = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
  validate(config);
  const origins = validateCorsOrigins(config);
  assert.equal(backend.projectId, 'dmqjexigdnfzobarhnib', 'Reviewed staging project required');
  assert.equal(config.supabaseUrl, 'https://dmqjexigdnfzobarhnib.supabase.co', 'Only staging backend allowed');
  assert.equal(config.supabaseUrl, backend.url, 'Reviewed staging backend required');
  assert(config.supabasePublicKey === backend.publicKey, 'Reviewed public key required');
  assert(config.target === 'preview' && config.environment === 'staging', 'Staging preview runtime required');
  assert.equal(config.appUrl, stableUrl, 'Verified stable staging URL required');
  assert.equal(config.appOrigin, new URL(stableUrl).origin, 'Stable origin must match APP_URL');
  assert(origins.length === 2 && origins.includes(config.appOrigin), 'Explicit stable/build origin pair required');
  assert(origins.every(origin => new URL(origin).protocol === 'https:'), 'HTTPS origins required');
  const buildOrigin = origins.find(origin => origin !== config.appOrigin);
  assert(/^[a-z0-9-]+\.simple-staging-raulchulbi\.pages\.dev$/.test(new URL(buildOrigin).hostname), 'Build origin must belong to the verified staging project');

  for (const [variant, suffix] of [['base', ''], ['reset', '?reset=1']]) {
    const row = { case: 'verify-' + variant, pass: false };
    try {
      const url = new URL('/auth/v1/verify', config.supabaseUrl);
      url.search = new URLSearchParams({ type: 'recovery', token: 'cloudflare-migration-deliberately-invalid-readonly-token', redirect_to: config.appUrl + suffix }).toString();
      const response = await fetch(url, { redirect: 'manual', headers: { apikey: config.supabasePublicKey }, signal: AbortSignal.timeout(15000) });
      row.status = response.status;
      requireCheck([302, 303].includes(response.status), 'VERIFY_ERROR_REDIRECT_REQUIRED');
      const rawLocation = response.headers.get('Location');
      const { destination, errorCode } = validateReturnLocation(rawLocation, config, suffix);
      row.locationSha256 = sha256(rawLocation);
      if (errorCode) row.errorCode = errorCode;
      returns.set(variant, destination.href);
      row.pass = true;
    } catch (error) { row.failure = safeFailure(error); }
    rows.push(row); write();
  }

  process.env.PLAYWRIGHT_BROWSERS_PATH ||= 'C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
  let playwright;
  try { playwright = require(process.env.SIMPLE_PLAYWRIGHT_MODULE || 'playwright'); }
  catch (_) { playwright = require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  for (const engine of ['chromium', 'webkit']) {
    let browser;
    try { browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.SIMPLE_CHROMIUM_CHANNEL || 'msedge' } : {}) }); }
    catch (_) {
      for (const variant of ['base', 'reset']) rows.push({ case: engine + '-' + variant, pass: false, failure: 'BROWSER_LAUNCH_FAILED' });
      write(); continue;
    }
    try {
      for (const variant of ['base', 'reset']) {
        const row = { case: engine + '-' + variant, pass: false };
        if (!returns.has(variant)) { row.failure = 'VERIFIED_LOCATION_UNAVAILABLE'; rows.push(row); write(); continue; }
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        const forbidden = [];
        let publicSettingsReads = 0;
        context.on('request', request => {
          const url = new URL(request.url());
          if (!['GET', 'HEAD'].includes(request.method())) forbidden.push('NON_READ_REQUEST');
          if (url.origin === backend.url && url.pathname === '/auth/v1/settings' && request.method() === 'GET') { publicSettingsReads++; return; }
          if (url.hostname.endsWith('.supabase.co') || url.hostname === 'supabase.co') forbidden.push('UNEXPECTED_BACKEND_REQUEST');
          if (url.hostname === 'openai.com' || url.hostname.endsWith('.openai.com')) forbidden.push('OPENAI_REQUEST');
          if (url.hostname === 'accounts.google.com' || url.hostname === 'appleid.apple.com' || url.hostname.endsWith('.facebook.com')) forbidden.push('PROVIDER_REQUEST');
        });
        try {
          const response = await page.goto(returns.get(variant), { waitUntil: 'domcontentloaded', timeout: 30000 });
          row.status = response?.status();
          requireCheck(row.status === 200, 'STABLE_DOCUMENT_REQUIRED');
          await page.waitForFunction(() => typeof simpleAuth !== 'undefined' && !simpleAuth.busy && simpleAuth.screen === 'login', null, { timeout: 20000 });
          await page.waitForLoadState('networkidle', { timeout: 20000 });
          const state = await page.evaluate(() => ({
            screen: document.getElementById('auth')?.dataset.screen,
            message: document.getElementById('authMsg')?.textContent,
            started: !!window.__simpleStarted,
            hasUser: typeof user !== 'undefined' && !!user,
            recovery: typeof simpleAuth !== 'undefined' && simpleAuth.recovery,
            environment: window.SimpleAppRuntime?.environment,
            appUrl: window.SimpleAppRuntime?.appUrl,
            backend: window.SimpleAppRuntime?.supabaseUrl,
            emailEmpty: document.getElementById('email')?.value === '',
            passwordEmpty: document.getElementById('password')?.value === '',
            hasSessionStorage: Object.keys(localStorage).some(key => /^sb-.*-auth-token(?:$|-)/.test(key)),
          }));
          requireCheck(state.screen === 'login' && /enlace.*(?:válido|caducado)/i.test(state.message || ''), 'PRODUCT_ERROR_LOGIN_REQUIRED');
          requireCheck(!await page.locator('#resetModal').isVisible(), 'RESET_FORM_MUST_REMAIN_HIDDEN');
          requireCheck(!state.started && !state.hasUser && !state.recovery && !state.hasSessionStorage, 'SESSIONLESS_RETURN_REQUIRED');
          requireCheck(state.environment === 'staging' && state.backend === backend.url && state.appUrl === stableUrl, 'STAGING_RUNTIME_REQUIRED');
          requireCheck(page.url() === stableUrl, 'PRODUCT_MUST_CLEAN_RETURN_URL');
          requireCheck(state.emailEmpty && state.passwordEmpty, 'EMPTY_LOGIN_REQUIRED_FOR_CAPTURE');
          requireCheck(forbidden.length === 0, 'FORBIDDEN_REQUEST_OBSERVED');
          row.finalUrlSha256 = sha256(page.url());
          row.publicSettingsReads = publicSettingsReads;
          const screenshot = 'auth-return-native-' + runId + '-' + row.case + '.png';
          await page.screenshot({ path: path.join(out, screenshot), fullPage: true, animations: 'disabled' });
          row.screenshot = screenshot;
          row.screenshotSha256 = sha256(fs.readFileSync(path.join(out, screenshot)));
          row.pass = true;
        } catch (error) {
          row.failure = safeFailure(error);
          if (forbidden.length) row.requestFailures = [...new Set(forbidden)];
        } finally { await context.close(); }
        rows.push(row); write();
      }
    } finally { await browser.close(); }
  }
  const report = write();
  requireCheck(report.results.length === 6, 'EXACTLY_SIX_CASES_REQUIRED');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, cases: report.results.map(({ case: name, pass, status, locationSha256, finalUrlSha256, screenshotSha256, errorCode, failure }) => ({ case: name, pass, status, locationSha256, finalUrlSha256, screenshotSha256, errorCode, failure })) }));
  if (report.failed) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ failure: safeFailure(error) })); process.exitCode = 1; });
module.exports = { validateReturnLocation };
