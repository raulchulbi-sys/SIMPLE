// Two offline regression cases for native Auth return URL userinfo rejection.
// No private config, browser, backend, account or provider is needed.
// Usage: node tests/cloudflare/auth-return-native-unit.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const results = [];
const originalFetch = global.fetch;
let networkCalls = 0;
global.fetch = () => { networkCalls++; throw new Error('Offline unit forbids network'); };
try {
  const { validateReturnLocation } = require('./auth-return-native.cjs');
  const config = { appUrl: 'https://synthetic-return-only.example.invalid/' };
  for (const [name, userinfo] of [
    ['username-rejected', 'synthetic-user'],
    ['username-password-rejected', 'synthetic-user:synthetic-password'],
  ]) {
    try {
      assert.throws(
        () => validateReturnLocation('https://' + userinfo + '@synthetic-return-only.example.invalid/#error=access_denied&error_code=otp_expired', config, ''),
        error => error.safeCode === 'CREDENTIALLED_RETURN_REJECTED',
      );
      assert.equal(networkCalls, 0, 'No network request allowed');
      results.push({ name, pass: true });
    } catch (_) { results.push({ name, pass: false, failure: 'USERINFO_REJECTION_OR_OFFLINE_GUARD_FAILED' }); }
  }
} finally { global.fetch = originalFetch; }
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = {
  kind: 'offline synthetic URL userinfo guards; no main runner, browser or network',
  passed: results.filter(row => row.pass).length,
  failed: results.filter(row => !row.pass).length,
  networkCalls,
  sourceSha256: hashFile(path.join(__dirname, 'auth-return-native.cjs')),
  unitSourceSha256: hashFile(__filename),
  results,
};
const out = path.join(__dirname, 'results');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'auth-return-native-unit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.failed || networkCalls) process.exitCode = 1;
