'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {manifest,sha,verify,checkSources,assemble}=require('../../scripts/staging-return.cjs');
test('approved four source assets and exact headers validate',()=>assert.equal(checkSources().length,4));
test('approved return HTML is the published byte sequence',()=>assert.equal(manifest.approved.find(f=>f.path==='billing-test.html').sha256,'c64775a86c7fd7f22fe7b2046fe29d1c05ab00e4a1c16bb3711d124e892046e0'));
test('35 original files unchanged, only headers extended',()=>assert.equal(manifest.base.filter(b=>manifest.approved.some(a=>a.path===b.path&&a.sha256===b.sha256&&a.bytes===b.bytes)).length,35));
test('unique paths and valid SHA-256/size',()=>{for(const list of [manifest.base,manifest.approved]){assert.equal(new Set(list.map(f=>f.path)).size,list.length);for(const f of list){assert.match(f.sha256,/^[0-9a-f]{64}$/);assert(Number.isSafeInteger(f.bytes)&&f.bytes>0);}}});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'simple-return-test-'));
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const original=Buffer.from('original\n');const fixture=[{path:'index.html',bytes:original.length,sha256:sha(original)}];
function setup(name){const d=path.join(dir,name);fs.mkdirSync(d);fs.writeFileSync(path.join(d,'index.html'),original);return d;}
test('inventory accepts exact bytes',()=>assert(verify(setup('valid'),fixture)));
test('inventory rejects added file',()=>{const d=setup('extra');fs.writeFileSync(path.join(d,'secret.txt'),'no secret');assert.throws(()=>verify(d,fixture),/Unexpected/);});
test('inventory rejects missing file',()=>{const d=setup('missing');fs.unlinkSync(path.join(d,'index.html'));assert.throws(()=>verify(d,fixture),/missing/);});
test('inventory rejects changed content of same size',()=>{const d=setup('changed');fs.writeFileSync(path.join(d,'index.html'),'changed!\n');assert.throws(()=>verify(d,fixture),/Hash mismatch/);});
test('inventory rejects path traversal',()=>assert.throws(()=>verify(setup('traversal'),[{...fixture[0],path:'../index.html'}]),/Unsafe/));
test('inventory rejects duplicate manifest names',()=>assert.throws(()=>verify(setup('duplicates'),[...fixture,...fixture]),/Unexpected/));
test('assembler fails closed on a different base without writing output',()=>{const d=setup('wrong-base'),out=path.join(dir,'no-output');assert.throws(()=>assemble(d,out),/Unexpected/);assert(!fs.existsSync(out));});
test('no deployment commands or provider clients',()=>{const text=fs.readFileSync(path.resolve(__dirname,'../../scripts/staging-return.cjs'),'utf8');assert(!/require\(['"](?:https?|child_process|.*sdk)/.test(text));assert(!/\bfetch\(|execFile|spawn\(/.test(text));});
