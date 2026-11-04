'use strict';

// Local-only orchestration of the audited PR #2 browser regressions.
// Every browser suite blocks requests outside loopback and supplies a mock SDK.
// No credentials, remote endpoints, installation or deployment operations.
const {spawn, spawnSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const selected = process.argv[2] || 'all';
if (!['all', 'shared'].includes(selected)) throw new Error('Expected all or shared');

function run(file) {
  const result = spawnSync(process.execPath, [file], {
    cwd: root, stdio: 'inherit', shell: false, windowsHide: true, timeout: 240_000,
  });
  if (result.error || result.signal || result.status !== 0) throw new Error('Failed: ' + file);
}

(async () => {
  if (selected === 'all') {
    run('tests/coach-flow/contracts.cjs');
    run('tests/coach-flow/reload-uncertain.cjs');
    run('tests/coach-flow/reload-context.cjs');
  }
  const server = spawn(process.execPath, ['tests/coach-pilot/preview.cjs'], {
    cwd: root, env: {...process.env, COACH_PORT: '4266'},
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview unavailable')), 10_000);
      server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', () => { clearTimeout(timer); reject(new Error('Preview exited')); });
    });
    for (const name of ['recovery', 'journey', 'premium-retry']) run('tests/coach-flow/' + name + '.cjs');
  } finally {
    server.kill();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
