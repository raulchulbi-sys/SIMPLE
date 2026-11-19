'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../assets/theme.js'), 'utf8');
const key = 'simple_theme_v1';
function storage(saved) {
  const data = new Map(saved == null ? [] : [[key, saved]]);
  return {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v),
    removeItem: k => data.delete(k), clear: () => data.clear()};
}
function boot(saved = 'dark', mode = 'normal') {
  const local = storage(saved), session = storage('dark'), listeners = new Map(), events = [];
  const root = {dataset: {}, style: {}}, metas = [];
  let blocked = mode === 'blocked';
  const context = {document: {documentElement: root, querySelector: () => metas[0],
    createElement: () => ({}), head: {append: meta => metas.push(meta)}},
    CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}},
    sessionStorage: session, addEventListener: (type, fn) => listeners.set(type, fn),
    dispatchEvent: event => events.push(event)};
  context.window = context;
  if (mode !== 'missing') Object.defineProperty(context, 'localStorage', {get() {
    if (blocked) throw Error('Storage blocked');
    return local;
  }});
  vm.runInNewContext(source, context, {filename: 'assets/theme.js', timeout: 1000});
  return {local, session, root, metas, events, api: context.simpleTheme,
    block: () => {blocked = true;}, send: event => listeners.get('storage')(event),
    pageshow: () => listeners.get('pageshow')()};
}
function theme(h, expected) {
  assert.equal(h.api.choice, expected);
  assert.equal(h.root.dataset.theme, expected);
  assert.equal(h.root.dataset.themeChoice, expected);
  assert.equal(h.root.style.colorScheme, expected);
  assert.equal(h.metas[0].content, expected === 'dark' ? '#202423' : '#f7f5f1');
  assert.equal(h.events.at(-1).detail.choice, expected);
  assert.equal(h.events.at(-1).detail.resolved, expected);
}
let passed = 0, failed = 0;
function test(name, body) {
  try {body(); passed++; console.log('PASS ' + name);}
  catch (error) {failed++; console.log('FAIL ' + name + ': ' + error.message);}
}
for (const eventKey of [key, null]) test('ignore sessionStorage ' + eventKey, () => {
  const h = boot(), count = h.events.length;
  if (eventKey === null) h.session.clear(); else h.session.setItem(key, 'light');
  h.send({storageArea: h.session, key: eventKey, newValue: eventKey === null ? null : 'light'});
  theme(h, 'dark'); assert.equal(h.local.getItem(key), 'dark'); assert.equal(h.events.length, count);
});
for (const operation of ['change', 'remove', 'clear']) test('accept localStorage ' + operation, () => {
  const h = boot(), count = h.events.length;
  if (operation === 'change') h.local.setItem(key, 'light');
  else if (operation === 'remove') h.local.removeItem(key); else h.local.clear();
  h.send({storageArea: h.local, key: operation === 'clear' ? null : key,
    newValue: operation === 'change' ? 'light' : null});
  theme(h, 'light'); assert.equal(h.events.length, count + 1);
  h.local.setItem(key, 'dark'); h.send({storageArea: h.local, key, newValue: 'dark'}); theme(h, 'dark');
});
test('ignore unrelated key and absent/null/foreign area', () => {
  const h = boot(), count = h.events.length;
  h.send({storageArea: h.local, key: 'other', newValue: 'light'});
  for (const area of [{}, {storageArea: null}, {storageArea: storage('dark')}])
    for (const eventKey of [key, null]) h.send({...area, key: eventKey, newValue: null});
  theme(h, 'dark'); assert.equal(h.events.length, count); assert.equal(h.local.getItem(key), 'dark');
});
test('initial defaults, migration, setter and pageshow stay compatible', () => {
  for (const saved of [null, 'invalid', 'system', 'light', 'dark']) {
    const h = boot(saved); theme(h, saved === 'dark' ? 'dark' : 'light');
    assert.equal(h.local.getItem(key), saved === 'system' ? 'light' : saved);
    h.local.setItem('other', 'keep'); h.api.set('dark'); theme(h, 'dark');
    assert.equal(h.local.getItem(key), 'dark'); assert.equal(h.local.getItem('other'), 'keep');
    const count = h.events.length; h.api.set('system'); theme(h, 'dark');
    assert.equal(h.events.length, count); assert.equal(h.local.getItem(key), 'dark');
    h.api.set('light'); theme(h, 'light'); assert.equal(h.local.getItem(key), 'light');
    h.pageshow(); theme(h, 'light'); assert.equal(h.metas.length, 1); assert.ok(Object.isFrozen(h.api));
  }
});
for (const mode of ['blocked', 'missing', 'later-blocked']) test('unavailable storage: ' + mode, () => {
  const h = boot('dark', mode); if (mode === 'later-blocked') h.block();
  theme(h, mode === 'later-blocked' ? 'dark' : 'light');
  h.api.set('dark'); theme(h, 'dark'); const count = h.events.length;
  for (const storageArea of [h.local, h.session, null])
    for (const eventKey of [key, null]) assert.doesNotThrow(() => h.send({storageArea, key: eventKey, newValue: null}));
  theme(h, 'dark'); assert.equal(h.events.length, count);
});
test('local legacy value still migrates', () => {
  const h = boot(); h.local.setItem(key, 'system');
  h.send({storageArea: h.local, key, newValue: 'system'});
  theme(h, 'light'); assert.equal(h.local.getItem(key), 'light');
});
console.log(`${passed} passed; ${failed} failed (Node/VM memory doubles only).`);
if (failed) process.exitCode = 1;
