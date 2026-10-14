// Executes the current Auth/OAuth handlers in an isolated VM. No network or real accounts.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const authSource = fs.readFileSync(path.join(root, 'assets/auth.js'), 'utf8');
const oauthSource = fs.readFileSync(path.join(root, 'assets/oauth.js'), 'utf8');
const results = [];
const bases = [
  'https://raulchulbi-sys.github.io/SIMPLE/',
  'https://cloudflare-auth-test.example.invalid/', // Test fixture; not a deployed Pages URL.
  'http://127.0.0.1:4262/',
];
function fresh(base) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', hidden: false, disabled: false,
      className: '', style: {}, dataset: {}, reportValidity: () => true,
      setAttribute() {}, removeAttribute() {}, focus() {},
      querySelector: () => ({ disabled: false }), querySelectorAll: () => [],
    });
    return elements.get(id);
  }
  const calls = [];
  const context = vm.createContext({
    APP_URL: base,
    SIMPLE_AUTH_CALLBACK: Object.freeze({ access: false, recovery: false, error: false }),
    performance: { now: () => 0 }, URLSearchParams,
    location: new URL(base + '?reset=1#type=recovery&access_token=synthetic-only'),
    history: { replaceState: (...args) => calls.push({ kind: 'replaceState', url: args[2] }) },
    document: { title: 'SIMPLE', querySelector: () => ({ style: {} }), querySelectorAll: () => [] },
    window: { addEventListener() {} }, localStorage: { removeItem() {} },
    console: { error() {} }, setTimeout, clearTimeout,
    $: element, user: null, profile: null, mode: 'signup',
    openM: id => calls.push({ kind: 'modal', id }), closeM() {},
    db: { auth: {
      signUp: async input => { calls.push({ kind: 'signup', input }); return { data: { session: null }, error: null }; },
      signInWithOAuth: async input => { calls.push({ kind: 'oauth', input }); return { data: { url: 'https://accounts.google.com/fixture' }, error: null }; },
      resetPasswordForEmail: async (email, input) => { calls.push({ kind: 'recover', email, input }); return { error: null }; },
    } },
  });
  // Omit only bootstrap wiring; all functions under test are original product source.
  vm.runInContext(authSource.slice(0, authSource.indexOf("$('authForm').addEventListener")), context);
  vm.runInContext(oauthSource, context);
  vm.runInContext(`
    setAuthScreen = screen => { simpleAuth.screen=screen; $('auth').dataset.screen=screen; };
    setAuthBusy = busy => { simpleAuth.busy=busy; };
    resetPasswordVisibility = () => {};
    msg = text => { $('authMsg').textContent=text; };
    simpleAuth.screen='signup'; simpleAuth.role='client';
    simpleOAuth.available.add('google');
  `, context);
  element('email').value = 'synthetic-only@example.invalid';
  element('password').value = 'Synthetic-Only-9264!';
  return { context, calls, element, run: code => vm.runInContext(code, context) };
}
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
}
(async () => {
  for (const base of bases) {
    for (const role of ['client', 'trainer']) await check(`${base} signup ${role} retains explicit return and role`, async () => {
      const t = fresh(base);
      t.run(`simpleAuth.role=${JSON.stringify(role)}`);
      await t.run('authSubmit()');
      const signup = t.calls.find(c => c.kind === 'signup');
      assert.equal(signup.input.options.emailRedirectTo, base);
      assert.equal(signup.input.options.data.simple_role, role);
      assert.equal(t.run('simpleAuth.screen'), 'confirmation');
      assert.equal(t.run('profile'), null);
    });
    await check(`${base} Google uses explicit return and creates no profile`, async () => {
      const t = fresh(base);
      await t.run("beginOAuth('google')");
      const oauth = t.calls.find(c => c.kind === 'oauth');
      assert.equal(oauth.input.provider, 'google');
      assert.equal(oauth.input.options.redirectTo, base);
      assert.equal(t.run('profile'), null);
      assert.equal(t.run('simpleAuth.role'), 'client');
    });
    await check(`${base} recovery preserves query and accepted feedback`, async () => {
      const t = fresh(base);
      t.run("simpleAuth.screen='login'; simpleAuth.failed=true");
      await t.run('requestPasswordReset()');
      const recovery = t.calls.find(c => c.kind === 'recover');
      assert.equal(recovery.input.redirectTo, base + '?reset=1');
      assert.equal(recovery.email, 'synthetic-only@example.invalid');
      assert.equal(t.run('simpleAuth.screen'), 'recovery-sent');
      assert.equal(t.run('simpleAuth.resetEpoch'), null);
      assert.equal(t.run('simpleAuth.busy'), false);
    });
    await check(`${base} recovery errors retain login and do not claim mail delivery`, async () => {
      const t = fresh(base);
      t.run("simpleAuth.screen='login'; simpleAuth.failed=true; db.auth.resetPasswordForEmail=async()=>({error:{status:429}})");
      await t.run('requestPasswordReset()');
      assert.equal(t.run('simpleAuth.screen'), 'login');
      assert.match(t.element('authMsg').textContent, /límite de solicitudes/);
    });
    await check(`${base} callback cleanup keeps same origin and base path`, async () => {
      const t = fresh(base);
      t.run('openPasswordReset()');
      assert.equal(t.calls.find(c => c.kind === 'replaceState').url, base);
      assert.equal(t.run('simpleAuth.recovery'), true);
      assert.equal(t.calls.find(c => c.kind === 'modal').id, 'resetModal');
    });
  }
  const report = { kind: 'product handlers in VM; no provider, mail or backend', passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results/auth-contract.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.failed ? report : { kind: report.kind, passed: report.passed, failed: 0 }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
