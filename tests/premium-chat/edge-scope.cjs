// Actual deployed staging gateway check. Requires explicit fixture/JWT authorization.
// No OpenAI call: the clear out-of-scope message must be rejected before reserve.
const assert = require('assert/strict');
const crypto = require('crypto');
const H = require('./live.cjs');
(async () => {
  assert.equal(H.fixture.ref, 'dmqjexigdnfzobarhnib');
  const item = H.fixture.cases.real;
  const before = await H.load(item);
  const response = await fetch('https://dmqjexigdnfzobarhnib.supabase.co/functions/v1/simple-coach-chat', {
    method: 'POST',
    headers: { apikey: H.credentials.key, Authorization: 'Bearer ' + H.sessions.mock.access_token,
      'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4245' },
    body: JSON.stringify({ key: crypto.randomUUID(), mesocycle_id: item.mesocycle,
      revision_id: item.revision, message: 'Me duele la rodilla al entrenar.' })
  });
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.equal(result.error, 'premium_chat_outside_scope');
  const after = await H.load(item);
  assert.equal(after.messages.length, before.messages.length);
  console.log('2/2 deployed gateway medical/no-persistence checks; no provider call');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
