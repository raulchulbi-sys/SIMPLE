'use strict';

// This packages reviewed public files; it does not deploy or mutate the backend.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROJECTS = Object.freeze({
  local: 'https://dmqjexigdnfzobarhnib.supabase.co',
  preview: 'https://dmqjexigdnfzobarhnib.supabase.co',
  production: 'https://yvguatdqncadkwewlepe.supabase.co'
});
const PUBLIC_ASSET = /^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:js|css|png|webp|jpg|jpeg|gif|svg|ico|avif|woff2?|ttf|otf)$/;
const TEXT_ASSET = /\.(?:html|js|css|txt)$/;
const GENERATED_FILE = 'assets/runtime-config.js';

function fail(message) { throw new Error(message); }

function canonicalPublicContent(content, name) {
  if (name !== '_headers' && !TEXT_ASSET.test(name)) return content;
  // Git stores LF text while Windows checkouts may use CRLF. Remove only the
  // CR byte of CRLF pairs; do not decode/re-encode or alter other bytes.
  let pairs = 0;
  for (let i = 0; i + 1 < content.length; i++) if (content[i] === 13 && content[i + 1] === 10) pairs++;
  if (!pairs) return content;
  const normalized = Buffer.allocUnsafe(content.length - pairs);
  let next = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === 13 && content[i + 1] === 10) continue;
    normalized[next++] = content[i];
  }
  return normalized;
}

function publicPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('%') ||
      value.includes('?') || value.includes('#') || value.includes(':') ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    fail('Invalid public path: ' + String(value));
  }
  if (value !== 'index.html' && !PUBLIC_ASSET.test(value)) fail('Non-public file rejected: ' + value);
  if (value.split('/').some(part => /^(?:private|results|tests|supabase|scripts|config|node_modules|docs)$/i.test(part))) {
    fail('Internal file rejected: ' + value);
  }
  return value;
}

function regularFile(root, relative) {
  const absolute = path.resolve(root, relative);
  const relation = path.relative(root, absolute);
  if (!relation || relation.startsWith('..' + path.sep) || path.isAbsolute(relation)) fail('Source escapes project');
  let current = root;
  for (const part of relation.split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail('Symlink rejected: ' + relative);
  }
  if (!fs.lstatSync(absolute).isFile()) fail('Expected regular file: ' + relative);
  if (!fs.realpathSync(absolute).startsWith(root + path.sep)) fail('Source escapes real project');
  return fs.readFileSync(absolute);
}

function rejectSecrets(text, name) {
  if (/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|sk_test_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/.test(text)) {
    fail('Secret-shaped value rejected in ' + name);
  }
  for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role !== 'anon' || Object.keys(payload).some(key => /email|phone|session_id/i.test(key))) {
        fail('Non-public JWT rejected in ' + name);
      }
    } catch (error) {
      if (error.message.startsWith('Non-public JWT')) throw error;
      fail('Unrecognised JWT rejected in ' + name);
    }
  }
}

function assetReference(raw, owner, externalResources, moduleRelative = false) {
  const value = raw.trim();
  if (!value || value.startsWith('#') || /^(?:data:|blob:)/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) {
    if (!externalResources.has(value)) fail('Unreviewed external resource in ' + owner + ': ' + value);
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:|^\/\//.test(value)) fail('Unsupported resource scheme in ' + owner);
  const pathname = value.split(/[?#]/)[0];
  if (pathname.includes('%') || pathname.includes('\\') || pathname.split('/').includes('..') || /[${}]/.test(pathname)) {
    fail('Unsafe or dynamic resource in ' + owner + ': ' + value);
  }
  // DOM/fetch paths use the document; CSS URLs and module imports use their owner file.
  const relative = pathname.replace(/^\.\//, '').replace(/^\//, '');
  const base = !pathname.startsWith('/') && (owner.endsWith('.css') || moduleRelative) ? path.posix.dirname(owner) : '';
  const resolved = path.posix.join(base, relative);
  return publicPath(resolved);
}

function references(text, owner, externalResources) {
  const found = new Set();
  const add = (value, moduleRelative = false) => { const ref = assetReference(value, owner, externalResources, moduleRelative); if (ref) found.add(ref); };
  const imports = [];
  // HTML includes literal tags produced by inline JS, including the celebration image.
  for (const tag of text.match(/<(?:script|link|img|source|video|audio|embed|object)\b[^>]*>/gi) || []) {
    for (const match of tag.matchAll(/\b(?:src|href|poster|data)\s*=\s*(["'])(.*?)\1/gi)) add(match[2]);
    if (/\bsrcset\s*=/i.test(tag)) fail('srcset requires an explicit scanner review in ' + owner);
  }
  for (const match of text.matchAll(/\burl\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gi)) add(match[2] || match[3]);
  for (const match of text.matchAll(/@import\s+(["'])(.*?)\1/gi)) add(match[2]);
  // Dynamic DOM asset assignments, imports, and assets used in JS/template strings.
  for (const match of text.matchAll(/\.(?:src|href|poster)\s*=\s*(["'`])([^"'`]*?)\1/g)) add(match[2]);
  for (const pattern of [/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?(["'])(.*?)\1/g, /\bimport\s*\(\s*(["'])(.*?)\1/g]) {
    for (const match of text.matchAll(pattern)) {
      if (!/^\.?\//.test(match[2]) && !/^https?:\/\//.test(match[2])) fail('Bare module import requires an explicit scanner review in ' + owner);
      add(match[2], true);
      imports.push([match.index, match.index + match[0].length]);
    }
  }
  for (const match of text.matchAll(/\bfetch\s*\(\s*(["'])(.*?)\1/g)) {
    // Literal API routes are network operations, not deployable source files.
    if (/(?:^|\/)assets\/|\.(?:js|css|png|webp|jpg|jpeg|gif|svg|ico|avif|woff2?|ttf|otf)(?:[?#]|$)/i.test(match[2])) add(match[2]);
  }
  if (!owner.endsWith('.css')) {
    for (const match of text.matchAll(/(["'`])((?:\.?\/?|\/)assets\/[^"'`\s]*)\1/g)) {
      if (!imports.some(([start, end]) => match.index >= start && match.index < end)) add(match[2]);
    }
  }
  return found;
}

function validateRuntime(runtime, target) {
  if (!Object.hasOwn(PROJECTS, target)) fail('Explicit target must be local, preview or production');
  if (!runtime || typeof runtime.javascript !== 'string' || !runtime.config) fail('Generated runtime configuration required');
  const config = runtime.config;
  if (config.target !== target || config.supabaseUrl !== PROJECTS[target] ||
      config.environment !== (target === 'production' ? 'production' : 'staging')) fail('Runtime backend does not match target');
  if (typeof config.supabasePublicKey !== 'string' || !config.supabasePublicKey) fail('Public Supabase key required');
  if (config.supabasePublicKey.startsWith('sb_secret_')) fail('Secret Supabase key rejected');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublicKey)) {
    const parts = config.supabasePublicKey.split('.');
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { fail('Invalid public Supabase key'); }
    if (parts.length !== 3 || payload.role !== 'anon' || payload.ref !== new URL(PROJECTS[target]).hostname.split('.')[0]) {
      fail('Public Supabase key does not match selected project');
    }
  }
  let appUrl;
  try { appUrl = new URL(config.appUrl); } catch { fail('Invalid app URL'); }
  if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash ||
      !config.appUrl.endsWith('/') || config.appOrigin !== appUrl.origin || config.basePath !== appUrl.pathname ||
      !['http:', 'https:'].includes(appUrl.protocol) ||
      (target === 'local' ? !['127.0.0.1', 'localhost', '[::1]'].includes(appUrl.hostname) : appUrl.protocol !== 'https:')) {
    fail('Unsafe app URL for target');
  }
  rejectSecrets(runtime.javascript, GENERATED_FILE);
  if (!runtime.javascript.includes(JSON.stringify(config.supabaseUrl)) || !runtime.javascript.includes(JSON.stringify(config.appUrl))) {
    fail('Rendered runtime does not contain selected public configuration');
  }
}

function outputRoot(sourceRoot) {
  if (fs.lstatSync(sourceRoot).isSymbolicLink()) fail('Source root symlink rejected');
  const root = fs.realpathSync(sourceRoot);
  const output = path.resolve(root, 'dist');
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') fail('Output must be project/dist');
  if (fs.lstatSync(output, {throwIfNoEntry: false})) {
    const visit = absolute => {
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) fail('Output symlink rejected');
      if (stat.isDirectory()) for (const child of fs.readdirSync(absolute)) visit(path.join(absolute, child));
    };
    visit(output);
    if (fs.realpathSync(output) !== output) fail('Output escapes resolved project');
  }
  return {root, output};
}

// This mode deliberately does not create a runtime or package application files.
// It is safe to expose while Access and the future production cutover are pending.
function buildPlaceholder({sourceRoot = path.resolve(__dirname, '..'), env = {}} = {}) {
  const {PAGES_PROJECTS} = require('./hosting-runtime.cjs');
  const project = PAGES_PROJECTS.production;
  if (env.SIMPLE_DEPLOY_TARGET !== 'placeholder' || env.SIMPLE_PAGES_PROJECT !== project ||
      env.SIMPLE_APP_URL !== 'https://' + project + '.pages.dev/' ||
      env.CF_PAGES_BRANCH !== 'codex/cloudflare-production-preparation') fail('Unapproved placeholder deployment identity');
  const deployment = new URL(env.CF_PAGES_URL || 'invalid');
  const host = project + '.pages.dev';
  const prefix = deployment.hostname.slice(0, -(host.length + 1));
  if (deployment.protocol !== 'https:' || deployment.username || deployment.password || deployment.port ||
      deployment.pathname !== '/' || deployment.search || deployment.hash ||
      !(deployment.hostname === host || (deployment.hostname.endsWith('.' + host) && /^[a-z0-9-]+$/.test(prefix)))) fail('Unapproved placeholder deployment URL');
  if (env.SIMPLE_SUPABASE_URL || env.SIMPLE_SUPABASE_KEY) fail('Placeholder must not receive backend overrides');
  const {root, output} = outputRoot(sourceRoot);
  const entries = [
    ['index.html','index.html'],['404.html','404.html'],
    ['preparation.css','assets/preparation.css'],['_headers','_headers'],['robots.txt','robots.txt']
  ];
  const bytes = entries.map(([source, destination]) => {
    const content = canonicalPublicContent(regularFile(root, 'config/cloudflare/preparation/' + source), destination);
    const text = content.toString('utf8');
    rejectSecrets(text, destination);
    if (/supabase|openai|\b(?:fetch|XMLHttpRequest|WebSocket)\b|<\s*(?:script|form|iframe|object|embed)\b|\bon\w+\s*=|http-equiv|@import|\burl\s*\(/i.test(text)) fail('Active or backend content in placeholder: ' + destination);
    if (/https?:\/\//i.test(text) && (destination !== 'index.html' || (text.match(/https?:\/\//gi)||[]).length !== 1 ||
        !text.includes('href="https://raulchulbi-sys.github.io/SIMPLE/"'))) fail('Unreviewed external content in placeholder');
    return [destination, content];
  });
  for (const name of ['index.html','404.html']) {
    const html = bytes.find(([file]) => file === name)[1].toString('utf8');
    if (JSON.stringify([...references(html, name, new Set())]) !== JSON.stringify(['assets/preparation.css'])) fail('Unexpected placeholder dependency');
    const anchors = html.match(/<a\b[^>]*>/gi) || [];
    const approved = name === 'index.html' ? '<a href="https://raulchulbi-sys.github.io/SIMPLE/" rel="noreferrer">' : '<a href="/">';
    if (JSON.stringify(anchors) !== JSON.stringify([approved])) fail('Unreviewed placeholder navigation');
  }
  const headers = bytes.find(([name]) => name === '_headers')[1].toString('utf8');
  const csp = headers.split(/\r?\n/).filter(line => /content-security-policy/i.test(line)).map(line => line.trim());
  if (JSON.stringify(csp) !== JSON.stringify(["Content-Security-Policy: default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"]) ||
      !headers.includes('Cache-Control: no-store')) fail('Placeholder security headers required');
  // Validate all inputs before cleaning; outputRoot has checked the bounded path and symlinks.
  fs.rmSync(output, {recursive:true, force:true});
  fs.mkdirSync(output);
  const files = [];
  for (const [name, content] of bytes.sort(([a],[b]) => a.localeCompare(b))) {
    const destination = path.join(output, name);
    fs.mkdirSync(path.dirname(destination), {recursive:true});
    fs.writeFileSync(destination, content, {mode:0o644});
    fs.utimesSync(destination, 0, 0);
    files.push({path:name,bytes:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex')});
  }
  return {target:'placeholder',backendInitialized:false,output,files,treeSha256:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex')};
}

function build({sourceRoot = path.resolve(__dirname, '..'), target, runtime} = {}) {
  validateRuntime(runtime, target);
  const {root, output} = outputRoot(sourceRoot);
  const manifest = JSON.parse(regularFile(root, 'config/static-public-manifest.json').toString('utf8'));
  if (manifest.schemaVersion !== 1 || manifest.entry !== 'index.html' || !Array.isArray(manifest.files) ||
      JSON.stringify(manifest.generated) !== JSON.stringify([GENERATED_FILE]) || !Array.isArray(manifest.externalResources)) {
    fail('Unsupported static public manifest');
  }
  const allowed = new Set(manifest.files.map(publicPath));
  if (allowed.size !== manifest.files.length || !allowed.has(manifest.entry) || allowed.has(GENERATED_FILE)) fail('Duplicate or invalid manifest file');
  for (const value of manifest.externalResources) {
    const resourceUrl = new URL(value);
    if (resourceUrl.protocol !== 'https:' || resourceUrl.username || resourceUrl.password || resourceUrl.hash) fail('Unsafe external resource');
  }
  const externalResources = new Set(manifest.externalResources);
  const bytes = new Map([[GENERATED_FILE, canonicalPublicContent(Buffer.from(runtime.javascript), GENERATED_FILE)]]);
  for (const name of [...allowed].sort()) {
    const content = canonicalPublicContent(regularFile(root, name), name);
    if (TEXT_ASSET.test(name)) rejectSecrets(content.toString('utf8'), name);
    bytes.set(name, content);
  }
  const reached = new Set();
  const visit = name => {
    if (reached.has(name)) return;
    if (!bytes.has(name)) fail('Missing or non-allowlisted dependency: ' + name);
    reached.add(name);
    if (TEXT_ASSET.test(name)) {
      for (const dependency of references(bytes.get(name).toString('utf8'), name, externalResources)) visit(dependency);
    }
  };
  visit(manifest.entry);
  if (!reached.has(GENERATED_FILE)) fail('index.html must load generated runtime configuration');
  const orphan = [...bytes.keys()].filter(name => !reached.has(name));
  if (orphan.length) fail('Unreferenced allowlist files: ' + orphan.sort().join(', '));

  const headerTemplate = regularFile(root, 'config/cloudflare/_headers.template').toString('utf8');
  const headers = headerTemplate.replaceAll('{{SUPABASE_ORIGIN}}', PROJECTS[target])
    .replaceAll('{{SUPABASE_WEBSOCKET}}', PROJECTS[target].replace('https:', 'wss:'));
  if (headers.includes('{{') || headers.split(/\r?\n/).some(line => line.length > 2000) || /\bimmutable\b/i.test(headers)) fail('Unsafe generated headers');
  bytes.set('_headers', canonicalPublicContent(Buffer.from(headers), '_headers'));
  bytes.set('404.html', canonicalPublicContent(regularFile(root, 'config/cloudflare/404.html'), '404.html'));
  bytes.set('robots.txt', canonicalPublicContent(regularFile(root, 'config/cloudflare/robots.txt'), 'robots.txt'));
  // Validate every byte before cleaning. A failed preflight leaves the previous output intact.
  for (const [name, content] of bytes) if (name === '_headers' || TEXT_ASSET.test(name)) rejectSecrets(content.toString('utf8'), name);
  fs.rmSync(output, {recursive: true, force: true});
  fs.mkdirSync(output);
  const files = [];
  for (const [name, content] of [...bytes].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const destination = path.join(output, ...name.split('/'));
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, content, {mode: 0o644});
    fs.utimesSync(destination, 0, 0);
    files.push({path: name, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex')});
  }
  return {target, output, files, treeSha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex')};
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--target') fail('Usage: node scripts/hosting-build.cjs --target local|preview|production|placeholder');
  const target = args[1];
  if (process.env.SIMPLE_DEPLOY_TARGET && process.env.SIMPLE_DEPLOY_TARGET !== target) fail('CLI and environment targets disagree');
  if (target === 'placeholder') {
    console.log(JSON.stringify(buildPlaceholder({env:process.env}), null, 2));
    return;
  }
  const runtimeGenerator = require('./hosting-runtime.cjs');
  const runtime = runtimeGenerator.createRuntimeConfig({target, env: process.env});
  const result = build({target, runtime});
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error('Build rejected: ' + error.message); process.exitCode = 1; }
}
module.exports = {build, buildPlaceholder, references, validateRuntime};
