// Same functional expectations as archived polish test with the current browser metadata API mocked.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},meta={content:''},doc={documentElement:{dataset:{},style:{}},querySelector(){return meta}},win={addEventListener(name,fn){events[name]=fn},dispatchEvent(){}};
vm.runInNewContext(fs.readFileSync('assets/theme.js','utf8'),{window:win,document:doc,matchMedia(){throw Error('OS preference must not be read')},localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},CustomEvent:class{}});
assert.equal(doc.documentElement.dataset.theme,'light');
assert.equal(meta.content,'#f7f5f1');
win.simpleTheme.set('dark');assert.equal(doc.documentElement.dataset.theme,'dark');assert.equal(meta.content,'#202423');
win.simpleTheme.set('system');assert.equal(doc.documentElement.dataset.theme,'dark');
events.storage({key:'simple_theme_v1',newValue:'light'});assert.equal(doc.documentElement.dataset.theme,'light');
events.storage({key:'simple_theme_v1',newValue:'dark'});assert.equal(doc.documentElement.dataset.theme,'dark');
events.storage({key:'simple_theme_v1',newValue:'system'});assert.equal(win.simpleTheme.choice,'light');
events.storage({key:'simple_theme_v1',newValue:'invalid'});assert.equal(win.simpleTheme.choice,'light');
events.pageshow();assert.equal(meta.content,'#f7f5f1');
console.log(JSON.stringify({passed:1,failed:[],name:'Storage blocked, Light/Dark, system migration, storage events and pageshow synchronize theme metadata'}));
