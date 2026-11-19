// Builds an additive staging-only CORS payload and an exact-source rollback payload.
// This script never deploys, calls Supabase, or changes backend data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const PROJECT = 'dmqjexigdnfzobarhnib';
const ORIGINS = Object.freeze(['http://127.0.0.1:4280', 'http://localhost:4280']);
const BASELINE = require('./auth-stage-cors-baseline.json');
const hash = content => crypto.createHash('sha256').update(content, 'utf8').digest('hex');
function prepare({ projectId, snapshot } = {}) {
  assert.equal(projectId, PROJECT, 'Only the authorized staging project is accepted');
  assert.equal(BASELINE.projectId, PROJECT);
  assert(Array.isArray(snapshot) && snapshot.length === BASELINE.functions.length, 'Complete four-function snapshot required');
  assert.equal(new Set(snapshot.map(f => f.name)).size, snapshot.length, 'Duplicate functions rejected');
  const deployments = [], rollback = [], metadata = [];
  for (const expected of BASELINE.functions) {
    const fn = snapshot.find(f => f.name === expected.name);
    assert(fn, 'Missing function: ' + expected.name);
    assert.equal(fn.verify_jwt, true, 'JWT verification must remain enabled');
    assert.equal(fn.version, expected.version, 'Version changed; capture/review a new baseline before proceeding');
    assert(fn.entrypoint_path.includes('user_fn_' + PROJECT + '_'), 'Snapshot belongs to another project');
    assert.equal(fn.import_map, false, 'Unexpected import map requires separate review');
    assert.equal(fn.files.length, expected.files.length, 'Bundle file count changed');
    assert.equal(new Set(fn.files.map(f => f.name)).size, fn.files.length, 'Duplicate bundle paths rejected');
    for (const file of expected.files) {
      const actual = fn.files.find(f => f.name === file.name);
      assert(actual && typeof actual.content === 'string', 'Missing source: ' + file.name);
      assert.equal(hash(actual.content), file.sha256, 'Source changed: ' + file.name);
    }
    const entryName = 'supabase/functions/' + fn.name + '/index.ts';
    const entry = fn.files.find(f => f.name === entryName);
    assert(entry, 'Reviewed entrypoint required');
    const matches = [...entry.content.matchAll(/^const (allowed|origins)=new Set\([^\r\n]*\);/gm)];
    assert.equal(matches.length, 1, 'Exactly one reviewed whitelist declaration required');
    const line = matches[0][0];
    assert(line.endsWith(']);') && !line.includes('*'), 'Only explicit origin arrays may be changed');
    for (const origin of ORIGINS) assert(!line.includes(origin), 'Origin already present; do not duplicate or repeat this plan');
    const beforeOrigins = [...line.matchAll(/(['"])(https?:\/\/[^'"]+)\1/g)].map(m => m[2]);
    assert(beforeOrigins.length > 0, 'Existing origin list required');
    // Basic uses a production/staging ternary. The last literal array is its staging branch.
    const patchedLine = line.replace(/\]\);$/, ',' + ORIGINS.map(origin => "'" + origin + "'").join(',') + ']);');
    assert.notEqual(patchedLine, line);
    for (const origin of beforeOrigins) assert(patchedLine.includes("'" + origin + "'") || patchedLine.includes('"' + origin + '"'), 'Existing origin removed');
    if (fn.name !== 'simple-coach-mock') assert(entry.content.includes("if(URL!=='https://" + PROJECT + ".supabase.co')"), 'Staging guard must be preserved');
    else assert(entry.content.includes("const staging=URL==='https://" + PROJECT + ".supabase.co'"), 'Basic staging branch required');
    const content = entry.content.replace(line, patchedLine);
    assert.equal(content.replace(patchedLine, line), entry.content, 'Only the whitelist line may change');
    const common = { project_id: PROJECT, name: fn.name, entrypoint_path: entryName, verify_jwt: true };
    const originalFiles = fn.files.map(f => ({ name: f.name, content: f.content }));
    const patchedFiles = originalFiles.map(f => f.name === entryName ? { name: f.name, content } : { ...f });
    const changed = patchedFiles.filter((f, i) => f.content !== originalFiles[i].content);
    assert.equal(changed.length, 1, 'Exactly one entrypoint file may change');
    for (const file of originalFiles) assert.equal(hash(file.content), expected.files.find(f => f.name === file.name).sha256, 'Rollback must retain exact original bytes');
    deployments.push({ ...common, files: patchedFiles });
    rollback.push({ ...common, files: originalFiles });
    metadata.push({ name: fn.name, beforeVersion: fn.version, verifyJwt: true, fileCount: originalFiles.length, changedFile: entryName, beforeSha256: hash(entry.content), afterSha256: hash(content), retainedOrigins: beforeOrigins, addedOrigins: [...ORIGINS] });
  }
  return { projectId: PROJECT, origins: [...ORIGINS], metadata, deployments, rollback };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert(args.length === 4 && args[0] === '--project' && args[2] === '--snapshot', 'Usage: node tests/cloudflare/auth-stage-cors.cjs --project dmqjexigdnfzobarhnib --snapshot tests/cloudflare/private/staging-edge-before.json');
    const plan = prepare({ projectId: args[1], snapshot: JSON.parse(fs.readFileSync(path.resolve(args[3]), 'utf8')) });
    const output = path.join(__dirname, 'private/staging-local-cors-plan.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(plan, null, 2));
    console.log(JSON.stringify({ projectId: plan.projectId, output, metadata: plan.metadata }));
  } catch (error) { console.error('Staging CORS plan rejected: ' + error.message); process.exitCode = 1; }
}
module.exports = { prepare, PROJECT, ORIGINS };
