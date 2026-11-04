'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');

// Closed execution list: audit dependencies/effects again before extending it.
const suites = [
  'tests/client-routine/unit.cjs',
  'tests/training-reset/unit.cjs',
  'tests/statistics-stage/unit.cjs',
  'tests/cycle-start/unit.cjs',
  'tests/staging-return/offline.cjs',
  'tests/theme-storage/unit.cjs',
  'tests/billing-test/contract.test.mjs',
  'tests/billing-test/reconciliation.test.mjs',
  'tests/billing-test/checkout-regression.test.mjs',
  'tests/commercial/backend.test.mjs',
  'tests/commercial/package.test.mjs',
  'tests/subscription/offline.cjs',
  'tests/commercial/basic-source-lock.test.mjs',
  'tests/premium-review-security/reconciliation.test.mjs',
];
const excludedDirectories = new Set(['private', 'results', 'node_modules', '.git']);

function syntaxFiles(directory) {
  return fs.readdirSync(path.join(root, directory), {withFileTypes: true})
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    .flatMap(entry => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && !excludedDirectories.has(entry.name)) return syntaxFiles(file);
      return entry.isFile() && /\.(?:js|mjs)$/.test(entry.name) ? [file] : [];
    });
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    timeout: 60_000,
  });
  if (result.error || result.signal || result.status !== 0) {
    console.error('Offline check failed:', args.join(' '));
    process.exit(1);
  }
}

const sources = [
  'scripts/ci-offline.cjs',
  'scripts/staging-return.cjs',
  ...syntaxFiles('assets'),
  ...syntaxFiles('supabase/functions'),
];
for (const file of sources) run(['--check', file]);
console.log(`${sources.length} JS/MJS syntax checks passed (no module execution).`);
for (const suite of suites) {
  console.log(`Running ${suite}`);
  run(suite.endsWith('.mjs') ? ['--experimental-vm-modules','--test','--test-concurrency=1',suite] : [suite]);
}
console.log(`${suites.length} audited offline suites passed; no real backend/provider validation.`);
