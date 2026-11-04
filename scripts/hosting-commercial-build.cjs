'use strict';
// Offline composition only. Never deploys, authenticates or invokes an API.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {build} = require('./hosting-build.cjs');
const {createRuntimeConfig} = require('./hosting-runtime.cjs');
const {verify} = require('./staging-return.cjs');
const ROOT = path.resolve(__dirname, '..');
const RETURN_FILES = Object.freeze(['billing-test.html', 'assets/billing-return.css', 'assets/billing-return.js', 'assets/billing-return-model.mjs']);
// The historical manifest remains immutable evidence of the old 36 -> 40 build.
// It pins only the return sources here, never the new main-application artifact.
const MANIFEST_SHA = '039183cac25aaee731c838fd4991c95f70f75c56a54d93e18239e9ab61440f2d';
const APPEND_SHA = '6539e11c40e0fa5b0271fcfb7182ddd7b14e58b7f6207baec5ec731cf51aca5f';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lf = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
function read(root, name) {
  const absolute = path.resolve(root, name);
  if (!absolute.startsWith(root + path.sep)) throw Error('Source escapes project');
  let current = root;
  for (const part of path.relative(root, absolute).split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Source symlink rejected');
  }
  if (!fs.lstatSync(absolute).isFile()) throw Error('Expected regular source');
  return fs.readFileSync(absolute);
}
function returnSources(sourceRoot) {
  if (fs.lstatSync(sourceRoot).isSymbolicLink()) throw Error('Source root symlink rejected');
  const root = fs.realpathSync(sourceRoot);
  const rawManifest = lf(read(root, 'staging/return/manifest.json'));
  if (sha(rawManifest) !== MANIFEST_SHA) throw Error('Unreviewed historical return manifest');
  const manifest = JSON.parse(rawManifest);
  const append = lf(read(root, 'staging/return/headers-append.txt'));
  if (sha(append) !== APPEND_SHA) throw Error('Unreviewed return headers');
  const records = manifest.approved.filter(row => RETURN_FILES.includes(row.path));
  if (records.length !== RETURN_FILES.length || new Set(records.map(row => row.path)).size !== RETURN_FILES.length) throw Error('Return inventory mismatch');
  const source = path.join(root, 'staging/return/source');
  verify(source, records);
  return {records, append, files: records.map(row => [row.path, read(root, 'staging/return/source/' + row.path)])};
}
function buildCommercial({sourceRoot = ROOT, target, env = {}, includeReturn = target !== 'production'} = {}) {
  if (!['local', 'preview', 'production'].includes(target) || typeof includeReturn !== 'boolean') throw Error('Explicit commercial build target required');
  if (target === 'production' && includeReturn) throw Error('TEST return cannot enter production artifact');
  const runtime = createRuntimeConfig({target, env});
  if (runtime.config.billingTest === true) throw Error('Commercial UI must remain closed');
  if (includeReturn && runtime.config.basePath !== '/') throw Error('TEST return requires root base path');
  // Validate all additional sources before the base builder replaces its bounded dist.
  const additions = includeReturn ? returnSources(sourceRoot) : null;
  if (additions) {
    const manifest = JSON.parse(read(fs.realpathSync(sourceRoot), 'config/static-public-manifest.json'));
    if (manifest.files.some(name => RETURN_FILES.includes(name))) throw Error('Return collides with application');
  }
  const base = build({sourceRoot, target, runtime});
  const files = new Map(base.files.map(row => [row.path, row]));
  if (additions) {
    for (const [name, bytes] of additions.files) {
      if (files.has(name)) throw Error('Return collides with application');
      const destination = path.join(base.output, name);
      fs.mkdirSync(path.dirname(destination), {recursive:true});
      fs.writeFileSync(destination, bytes, {flag:'wx', mode:0o644});
      fs.utimesSync(destination, 0, 0);
      files.set(name, {path:name, bytes:bytes.length, sha256:sha(bytes)});
    }
    const headers = path.join(base.output, '_headers');
    const bytes = Buffer.concat([fs.readFileSync(headers), additions.append]);
    fs.writeFileSync(headers, bytes);
    fs.utimesSync(headers, 0, 0);
    files.set('_headers', {path:'_headers', bytes:bytes.length, sha256:sha(bytes)});
  }
  const inventory = [...files.values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  verify(base.output, inventory);
  return {target, output:base.output, commercialEnabled:false, stagingReturnIncluded:includeReturn,
    backend:runtime.config.supabaseUrl, baseTreeSha256:base.treeSha256,
    files:inventory, treeSha256:sha(JSON.stringify(inventory))};
}
module.exports = {buildCommercial, returnSources, RETURN_FILES};
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--target') throw Error('Usage: node scripts/hosting-commercial-build.cjs --target local|preview|production');
    console.log(JSON.stringify(buildCommercial({target:args[1], env:process.env}), null, 2));
  } catch (error) { console.error('Commercial build rejected: ' + error.message); process.exitCode = 1; }
}
