import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

// No provider/database calls; the manifest records sources observed previously.
globalThis.fetch = () => { throw new Error('Network forbidden in source checks'); };
const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8').replaceAll('\r\n', '\n');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const pr2 = p => execFileSync('git', ['show', '49ef741d5ba9fb58e38732fe7a031e7034d907dd:' + p], {encoding:'utf8'}).replaceAll('\r\n', '\n');
const manifest = JSON.parse(read('tests/coach-flow/observed-v36-source.json'));
const names = ['assets/coach-intake.js', 'assets/coach-programming-v4.js', 'assets/coach-programming-v5.js',
  ...['contract-v2.mjs','contract-v3.mjs','contract-v4.mjs','contract-v5.mjs','contract.mjs','index.ts','provider.mjs','staging-cost-guard.mjs'].map(n => 'supabase/functions/simple-coach-mock/' + n)];

test('exact eleven-file inventory and historical v36 provenance', () => {
  assert.deepEqual(manifest.files.map(x => x.file).sort(), names.sort());
  assert.equal(new Set(manifest.files.map(x=>x.file)).size, 11);
  assert.equal(manifest.version, 36); assert.equal(manifest.verifyJWT, true);
  assert.equal(manifest.bundleSHA256, '0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20');
  assert.match(manifest.provenance, /no new connected observation/);
});
for (const item of manifest.files) test('approved v36 LF body: ' + item.file, () => {
  assert.match(item.observedSHA256, /^[a-f0-9]{64}$/);
  assert.equal(hash(read(item.file)), item.repositoryLFHash);
  const exactObservedLF = read(item.file) + (item.file === 'supabase/functions/simple-coach-mock/contract-v5.mjs' ? '\n' : '');
  assert.equal(hash(exactObservedLF), item.lfSHA256);
});
const entry = read('supabase/functions/simple-coach-mock/index.ts');
const origins = s => s.match(/^const allowed=.*$/m)?.[0];
test('entrypoint retains every PR2 check; sole substantive delta is observed staging CORS', () => {
  const prior = pr2('supabase/functions/simple-coach-mock/index.ts');
  assert(origins(entry)); assert(origins(prior));
  assert.equal(entry.replace(origins(entry), ''), prior.replace(origins(prior), ''));
});
test('contract V5 retains PR2 and explicitly accounts for exactly one observed final LF', () => {
  const file = 'supabase/functions/simple-coach-mock/contract-v5.mjs';
  assert.equal(read(file), pr2(file));
  assert.equal(hash(read(file) + '\n'), manifest.files.find(x=>x.file===file).lfSHA256);
});
test('JWT remains mandatory in versioned configuration', () => {
  assert.match(read('supabase/config.toml'), /\[functions\.simple-coach-mock\]\s*verify_jwt\s*=\s*true/);
});
test('CORS keeps the exact observed origins; no wildcard or new production origin', () => {
  assert.equal(origins(entry), `const allowed=new Set(production?['https://raulchulbi-sys.github.io']:['http://127.0.0.1:4194','http://localhost:4194','http://127.0.0.1:4195','http://localhost:4195','http://127.0.0.1:4280','http://localhost:4280',"https://simple-staging-raulchulbi.pages.dev","https://4a8636ab.simple-staging-raulchulbi.pages.dev"]);`);
});
test('commercial SQL, configuration and workflow stay exact while adding the Coach source layer', () => {
  const commercial = '7b9d5709add382a47f35712c80d6744b09955ebd';
  const paths = execFileSync('git', ['diff','--name-only',commercial,'--','supabase', '.github'], {encoding:'utf8'}).trim().split('\n').filter(Boolean);
  assert(paths.every(p=>['index.ts','staging-cost-guard.mjs'].some(n=>p==='supabase/functions/simple-coach-mock/'+n)));
  assert.equal(read('supabase/config.toml'), execFileSync('git',['show',commercial+':supabase/config.toml'],{encoding:'utf8'}).replaceAll('\r\n','\n'));
});
