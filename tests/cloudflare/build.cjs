'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {build} = require('../../scripts/hosting-build.cjs');

const resultRoot = path.join(__dirname, 'results');
fs.mkdirSync(resultRoot, {recursive: true});
const project = 'dmqjexigdnfzobarhnib';
const runtime = (target = 'preview') => {
  const config = {
    target,
    environment: target === 'production' ? 'production' : 'staging',
    appUrl: target === 'local' ? 'http://127.0.0.1:4280/' : 'https://build-fixture.pages.dev/',
    appOrigin: target === 'local' ? 'http://127.0.0.1:4280' : 'https://build-fixture.pages.dev',
    basePath: '/',
    supabaseUrl: 'https://' + (target === 'production' ? 'yvguatdqncadkwewlepe' : project) + '.supabase.co',
    supabasePublicKey: 'sb_publishable_fixture_public_key'
  };
  return {config, javascript: 'window.SimpleAppRuntime=Object.freeze(' + JSON.stringify(config) + ');\n'};
};

function fixture(t) {
  const sourceRoot = fs.mkdtempSync(path.join(resultRoot, 'build-'));
  const write = (name, content) => {
    const file = path.join(sourceRoot, ...name.split('/'));
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, content);
  };
  const manifest = {
    schemaVersion: 1,
    entry: 'index.html',
    generated: ['assets/runtime-config.js'],
    files: ['index.html', 'assets/main.js', 'assets/screen.css', 'assets/nested.js', 'assets/picture.png'],
    externalResources: []
  };
  write('index.html', '<!doctype html><script src="assets/runtime-config.js"></script><link rel="stylesheet" href="assets/screen.css"><script src="assets/main.js"></script>');
  write('assets/main.js', "import './nested.js';\n");
  write('assets/nested.js', "const img=new Image();img.src='assets/picture.png';\n");
  write('assets/screen.css', "body{background-image:url('./picture.png')}\n");
  write('assets/picture.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  for (const name of ['_headers.template', '404.html', 'robots.txt']) {
    write('config/cloudflare/' + name, fs.readFileSync(path.resolve(__dirname, '../../config/cloudflare', name)));
  }
  const saveManifest = () => write('config/static-public-manifest.json', JSON.stringify(manifest));
  saveManifest();
  // The resolved target is created here, stays beneath results/, and is removed using Node only.
  t.after(() => {
    const resolved = path.resolve(sourceRoot);
    assert.equal(path.dirname(resolved), path.resolve(resultRoot));
    fs.rmSync(resolved, {recursive: true, force: true});
  });
  return {sourceRoot, write, manifest, saveManifest, run: (target = 'preview', config = runtime(target)) => build({sourceRoot, target, runtime: config})};
}

function outputFiles(root, relative = '') {
  return fs.readdirSync(path.join(root, relative)).flatMap(name => {
    const file = path.posix.join(relative, name);
    return fs.statSync(path.join(root, file)).isDirectory() ? outputFiles(root, file) : [file];
  }).sort();
}

test('recursive public dependencies are packaged and repository contaminants stay out', t => {
  const f = fixture(t);
  f.write('assets/unreferenced.js', 'not public');
  f.write('index_cliente_editor_final_v25.html', 'obsolete');
  f.write('.env', 'PRIVATE_DIAGNOSTIC=1');
  f.write('supabase/migrations/secret.sql', 'SELECT 1;');
  f.write('tests/private/session.json', '{"private":true}');
  const result = f.run();
  assert.deepEqual(outputFiles(result.output), [
    '404.html', '_headers', 'assets/main.js', 'assets/nested.js', 'assets/picture.png',
    'assets/runtime-config.js', 'assets/screen.css', 'index.html', 'robots.txt'
  ].sort());
  assert.equal(fs.readFileSync(path.join(result.output, 'assets/picture.png')).length, 4);
});

test('repeat builds remove stale output and produce the identical tree hash', t => {
  const f = fixture(t);
  const first = f.run();
  f.write('dist/leaked.sql', 'old diagnostic');
  f.write('dist/assets/old.js', 'old version');
  const second = f.run();
  assert.equal(second.treeSha256, first.treeSha256);
  assert.deepEqual(second.files, first.files);
  assert.equal(fs.existsSync(path.join(second.output, 'leaked.sql')), false);
  assert.equal(fs.existsSync(path.join(second.output, 'assets/old.js')), false);
});

test('LF and Windows CRLF checkouts produce the same public bytes without changing binaries or source', t => {
  const f = fixture(t);
  const texts = [...f.manifest.files.filter(name => /\.(?:html|js|css|txt)$/.test(name)),
    'config/cloudflare/_headers.template', 'config/cloudflare/404.html', 'config/cloudflare/robots.txt'];
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0xff]);
  f.write('assets/picture.png', binary);
  for (const name of texts) f.write(name, fs.readFileSync(path.join(f.sourceRoot, name), 'utf8').replace(/\r\n/g, '\n'));
  const lf = f.run();
  for (const name of texts) f.write(name, fs.readFileSync(path.join(f.sourceRoot, name), 'utf8').replace(/\n/g, '\r\n'));
  const crlfRuntime = runtime();crlfRuntime.javascript = crlfRuntime.javascript.replace(/\n/g, '\r\n');
  const crlf = f.run('preview', crlfRuntime);
  assert.deepEqual(crlf.files, lf.files);
  assert.equal(crlf.treeSha256, lf.treeSha256);
  assert.deepEqual(fs.readFileSync(path.join(crlf.output, 'assets/picture.png')), binary);
  assert(fs.readFileSync(path.join(f.sourceRoot, 'assets/main.js')).includes(Buffer.from('\r\n')), 'The source checkout must remain untouched');
  for (const file of crlf.files.filter(file => /\.(?:html|js|css|txt)$/.test(file.path) || file.path === '_headers')) {
    assert.equal(fs.readFileSync(path.join(crlf.output, file.path)).includes(Buffer.from('\r\n')), false, file.path);
  }
});

test('a missing referenced file fails before cleaning the prior valid output', t => {
  const f = fixture(t);
  const result = f.run();
  const oldIndex = fs.readFileSync(path.join(result.output, 'index.html'));
  fs.unlinkSync(path.join(f.sourceRoot, 'assets/picture.png'));
  assert.throws(() => f.run(), /ENOENT/);
  assert.deepEqual(fs.readFileSync(path.join(result.output, 'index.html')), oldIndex);
});

test('a new reference requires explicit review in the allowlist', t => {
  const f = fixture(t);
  f.write('assets/new.js', 'const safe=1;');
  f.write('assets/main.js', "import './nested.js';import './new.js';");
  assert.throws(() => f.run(), /non-allowlisted dependency/);
});

test('unreferenced allowed files fail instead of silently exposing assets', t => {
  const f = fixture(t);
  f.manifest.files.push('assets/orphan.js');
  f.write('assets/orphan.js', 'const safe=1;');
  f.saveManifest();
  assert.throws(() => f.run(), /Unreferenced allowlist/);
});

test('internal scripts, SQL, old HTML and traversal cannot enter the allowlist', t => {
  const f = fixture(t);
  for (const injected of ['tests/private/session.js', 'assets/results/report.js', 'supabase/migration.sql', 'index_old.html', 'assets/../secret.js', '../outside.js', 'assets\\bad.js']) {
    f.manifest.files.push(injected);
    f.saveManifest();
    assert.throws(() => f.run(), /path|file rejected/);
    f.manifest.files.pop();
  }
});

test('malicious dependency references fail rather than widening the public tree', t => {
  const f = fixture(t);
  for (const injected of ['../private/token.js', '/tests/fixture.js', 'assets/%2e%2e/token.js', 'https://attacker.invalid/payload.js', 'javascript:alert(1)']) {
    f.write('index.html', '<script src="assets/runtime-config.js"></script><script src="' + injected + '"></script>');
    assert.throws(() => f.run(), /Unsafe|Non-public|Unreviewed|Unsupported/);
  }
});

test('dynamic asset construction requires an explicit scanner review', t => {
  const f = fixture(t);
  f.write('assets/main.js', "import './nested.js';const path=`assets/${name}.js`;\n");
  assert.throws(() => f.run(), /dynamic resource/);
});

test('secret keys and authenticated JWTs in public code are rejected', t => {
  const f = fixture(t);
  for (const injected of ['sb_secret_fixture_123456789', '-----BEGIN PRIVATE KEY-----',
    'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({role: 'service_role', ref: project})).toString('base64url') + '.c2lnbmF0dXJl']) {
    f.write('assets/nested.js', "const image='assets/picture.png';const leaked=" + JSON.stringify(injected) + ';');
    assert.throws(() => f.run(), /Secret-shaped|Non-public JWT/);
  }
});

test('unknown targets and crossed preview/production backends fail', t => {
  const f = fixture(t);
  assert.throws(() => f.run('automatic', runtime('preview')), /Explicit target/);
  const crossed = runtime('preview');
  crossed.config.supabaseUrl = 'https://yvguatdqncadkwewlepe.supabase.co';
  assert.throws(() => f.run('preview', crossed), /backend does not match/);
  assert.throws(() => f.run('production', runtime('preview')), /backend does not match/);
});

test('public anon JWT must identify the selected project', t => {
  const f = fixture(t);
  const wrong = runtime();
  wrong.config.supabasePublicKey = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({role: 'anon', ref: 'yvguatdqncadkwewlepe'})).toString('base64url') + '.c2lnbmF0dXJl';
  assert.throws(() => f.run('preview', wrong), /does not match selected project/);
});

test('remote app origins require HTTPS and local origins require loopback', t => {
  const f = fixture(t);
  for (const [target, appUrl] of [['preview', 'http://build-fixture.pages.dev/'], ['production', 'https://user:pass@build-fixture.pages.dev/'], ['local', 'http://192.168.1.2/']]) {
    const wrong = runtime(target);
    wrong.config.appUrl = appUrl;
    assert.throws(() => f.run(target, wrong), /Unsafe app URL/);
  }
});

test('generated config must be referenced and agree with rendered bytes', t => {
  const f = fixture(t);
  const wrong = runtime();
  wrong.javascript = 'window.SimpleAppRuntime={};';
  assert.throws(() => f.run('preview', wrong), /Rendered runtime/);
  f.write('index.html', '<link href="assets/screen.css"><script src="assets/main.js"></script>');
  assert.throws(() => f.run(), /must load generated runtime/);
});

test('headers use only the selected Supabase target and revalidate mutable names', t => {
  const f = fixture(t);
  for (const target of ['local', 'preview', 'production']) {
    const result = f.run(target);
    const headers = fs.readFileSync(path.join(result.output, '_headers'), 'utf8');
    const selected = target === 'production' ? 'yvguatdqncadkwewlepe' : project;
    const other = target === 'production' ? project : 'yvguatdqncadkwewlepe';
    assert.match(headers, new RegExp('https://' + selected + '\\.supabase\\.co'));
    assert.match(headers, new RegExp('wss://' + selected + '\\.supabase\\.co'));
    assert.equal(headers.includes(other), false);
    assert.match(headers, /Content-Security-Policy-Report-Only:/);
    assert.doesNotMatch(headers, /\bContent-Security-Policy:/);
    assert.doesNotMatch(headers, /immutable|\*\.supabase\.co/);
    assert.match(headers, /\/\n  Cache-Control: no-cache/);
    assert.match(headers, /\/assets\/\*\n  Cache-Control: public, max-age=0, must-revalidate/);
  }
});

test('404 is a standalone page and no catch-all redirect or backend code is emitted', t => {
  const f = fixture(t);
  const result = f.run();
  const page = fs.readFileSync(path.join(result.output, '404.html'), 'utf8');
  assert.match(page, /Página no encontrada/);
  assert.doesNotMatch(page, /<script|supabase|index\.html/);
  assert.equal(fs.existsSync(path.join(result.output, '_redirects')), false);
  assert.equal(fs.existsSync(path.join(result.output, '_worker.js')), false);
});

test('junction inputs and a redirected dist never allow reads or deletion outside output', t => {
  const f = fixture(t);
  const outside = fs.mkdtempSync(path.join(resultRoot, 'outside-'));
  const marker = path.join(outside, 'preserve.txt');
  fs.writeFileSync(marker, 'keep');
  t.after(() => {
    assert.equal(path.dirname(path.resolve(outside)), path.resolve(resultRoot));
    fs.rmSync(outside, {recursive: true, force: true});
  });
  const junction = path.join(f.sourceRoot, 'dist');
  fs.symlinkSync(outside, junction, 'junction');
  assert.throws(() => f.run(), /Output symlink/);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'keep');
  fs.unlinkSync(junction);
  const assetJunction = path.join(f.sourceRoot, 'assets/linked');
  fs.symlinkSync(outside, assetJunction, 'junction');
  f.manifest.files.push('assets/linked/payload.js');
  fs.writeFileSync(path.join(outside, 'payload.js'), 'not public');
  f.saveManifest();
  assert.throws(() => f.run(), /Symlink rejected/);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'keep');
});
