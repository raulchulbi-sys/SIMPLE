// Configuration-only validation. No transport, browser, backend, mail or mock-provider execution.
const assert = require('node:assert/strict');
const { validateCorsOrigins } = require('./auth-probe.cjs');
const stable = 'https://configuration-unit-fixture.pages.dev';
const deployment = 'https://unit-fixture-only.configuration-unit-fixture.pages.dev'; // Synthetic unit value, never a claimed deployment.
const config = {
  appUrl: stable + '/',
  supabaseUrl: 'https://dmqjexigdnfzobarhnib.supabase.co',
  supabasePublicKey: 'sb_publishable_synthetic_configuration_unit_only',
  allowedOrigins: [stable, deployment],
};
let passed = 0;
function check(fn) { fn(); passed++; }
check(() => assert.deepEqual(validateCorsOrigins(config), [stable, deployment]));
check(() => { assert.deepEqual(validateCorsOrigins(config, [deployment]), [deployment]); assert.equal(config.appUrl, stable + '/'); });
check(() => assert(Object.isFrozen(validateCorsOrigins(config))));
check(() => assert.deepEqual(validateCorsOrigins({ ...config, allowedOrigins: [stable] }), [stable]));
for (const invalid of [
  'https://unit-fixture-only.other-project.pages.dev',
  'https://unit-fixture-only.configuration-unit-fixture.pages.dev.evil.invalid',
  'https://*.configuration-unit-fixture.pages.dev',
  deployment + '/', deployment + '/SIMPLE/', deployment + '?reset=1', deployment + '#callback',
  'https://user:secret-placeholder@unit-fixture-only.configuration-unit-fixture.pages.dev',
  deployment.replace('https:', 'http:'), deployment + ':8443',
]) check(() => assert.throws(() => validateCorsOrigins({ ...config, allowedOrigins: [stable, invalid] })));
check(() => assert.throws(() => validateCorsOrigins(config, ['https://another-build.configuration-unit-fixture.pages.dev']), /not declared/));
check(() => assert.throws(() => validateCorsOrigins({ ...config, allowedOrigins: [deployment] }), /Stable application/));
check(() => assert.throws(() => validateCorsOrigins({ ...config, allowedOrigins: [stable, stable] }), /Duplicate/));
check(() => assert.throws(() => validateCorsOrigins(config, []), /array required/));
check(() => assert.throws(() => validateCorsOrigins(config, stable), /array required/));
console.log(JSON.stringify({ kind: 'HTTPS stable/build origin configuration validation only; no network or provider', passed, failed: 0 }));
