// Tests the actual downloaded staging source patch, without deploying or dispatching RPCs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { prepare, PROJECT, ORIGINS } = require('./auth-stage-cors.cjs');
const { prefixHandler, allowed } = require('./auth-cors.cjs');
const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, 'private/staging-edge-before.json'), 'utf8'));
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
}
(async () => {
  const plan = prepare({ projectId: PROJECT, snapshot });
  await check('Production target rejected before preparing any deployment', async () => assert.throws(() => prepare({ projectId: 'yvguatdqncadkwewlepe', snapshot }), /authorized staging/));
  await check('Changed source hash rejected before preparing any deployment', async () => {
    const changed = structuredClone(snapshot); changed[0].files[0].content += '\n// unexpected source change';
    assert.throws(() => prepare({ projectId: PROJECT, snapshot: changed }), /Source changed/);
  });
  await check('JWT weakening rejected before preparing any deployment', async () => {
    const changed = structuredClone(snapshot); changed[0].verify_jwt = false;
    assert.throws(() => prepare({ projectId: PROJECT, snapshot: changed }), /JWT verification/);
  });
  for (const deployment of plan.deployments) {
    const before = snapshot.find(f => f.name === deployment.name);
    const afterEntry = deployment.files.find(f => f.name === deployment.entrypoint_path);
    const handler = prefixHandler(afterEntry.content, 'https://' + PROJECT + '.supabase.co');
    for (const origin of ORIGINS) await check(deployment.name + ': new exact staging origin ' + origin, () => allowed(handler, origin));
    const metadata = plan.metadata.find(f => f.name === deployment.name);
    for (const origin of metadata.retainedOrigins) {
      const context = origin === 'https://raulchulbi-sys.github.io' ? 'https://yvguatdqncadkwewlepe.supabase.co' : 'https://' + PROJECT + '.supabase.co';
      await check(deployment.name + ': retained original origin ' + origin, () => allowed(prefixHandler(afterEntry.content, context), origin));
    }
    for (const method of ['OPTIONS', 'POST']) await check(deployment.name + ': foreign ' + method + ' rejected before business boundary', async () => {
      const response = await handler(new Request('https://edge-test.example.invalid/', { method, headers: { Origin: 'https://unapproved.example.invalid' } }));
      assert.equal(response.status, 403); assert.equal((await response.json()).error, 'origin_denied');
      assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
    });
    await check(deployment.name + ': all rollback files byte-exact and JWT stays enabled', async () => {
      const rollback = plan.rollback.find(f => f.name === deployment.name);
      assert.equal(deployment.project_id, PROJECT); assert.equal(rollback.project_id, PROJECT);
      assert.equal(deployment.verify_jwt, true); assert.equal(rollback.verify_jwt, true);
      assert.deepEqual(rollback.files, before.files);
      assert.equal(deployment.files.filter((f, i) => f.content !== before.files[i].content).length, 1);
      assert.equal(deployment.files.length, before.files.length);
    });
    await check(deployment.name + ': production guard or branch remains closed to added localhost', async () => {
      const productionHandler = prefixHandler(afterEntry.content, 'https://yvguatdqncadkwewlepe.supabase.co');
      const response = await productionHandler(new Request('https://edge-test.example.invalid/', { method: 'OPTIONS', headers: { Origin: ORIGINS[0] } }));
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, deployment.name === 'simple-coach-mock' ? 'origin_denied' : 'staging_only');
    });
  }
  const report = { kind: 'actual downloaded staging source with additive localhost patch in local VM; no deploy, JWT, RPC, OpenAI or data change', passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results/auth-stage-cors-test.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.failed ? report : { kind: report.kind, passed: report.passed, failed: 0 }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
