'use strict';
// Local assembler only: no network, credentials, deploy command or environment switching.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(__dirname,'../staging/return');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function safe(name){if(!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(name)||name.split('/').some(p=>p==='.'||p==='..'))throw Error('Unsafe path');return name;}
function read(root,name){safe(name);let p=root;for(const part of name.split('/')){p=path.join(p,part);if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink rejected');}if(!fs.statSync(p).isFile())throw Error('Regular file required');return fs.readFileSync(p);}
function inventory(root,prefix=''){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>{if(e.isSymbolicLink())throw Error('Symlink rejected');const n=prefix+e.name;safe(n);return e.isDirectory()?inventory(path.join(root,e.name),n+'/'):[n];}).sort();}
function verify(root,expected){root=path.resolve(root);if(fs.lstatSync(root).isSymbolicLink())throw Error('Symlink root rejected');const names=expected.map(f=>safe(f.path)).sort();if(new Set(names).size!==names.length||JSON.stringify(inventory(root))!==JSON.stringify(names))throw Error('Unexpected or missing files');for(const f of expected){const b=read(root,f.path);if(b.length!==f.bytes||sha(b)!==f.sha256)throw Error('Hash mismatch: '+f.path);}return true;}
function checkSources(){
 if(manifest.environment!=='staging'||manifest.backend!=='dmqjexigdnfzobarhnib'||manifest.base.length!==36||manifest.approved.length!==40)throw Error('Manifest scope');
 const original=read(source,'headers-base.txt'),append=read(source,'headers-append.txt');
 if(sha(original)!==manifest.base.find(f=>f.path==='_headers').sha256||sha(Buffer.concat([original,append]))!==manifest.approved.find(f=>f.path==='_headers').sha256)throw Error('Headers hash');
 const routes=append.toString().split(/\r?\n/).filter(l=>l.startsWith('/'));
 if(JSON.stringify(routes)!==JSON.stringify(['/billing-test.html','/assets/billing-return.js','/assets/billing-return-model.mjs','/billing-test']))throw Error('Headers scope');
 for(const route of ['/billing-test.html','/billing-test']){const section=append.toString().split(route+'\n').at(-1).split(/\n\//)[0];if(!section.includes('! Referrer-Policy')||!section.includes('Referrer-Policy: no-referrer')||!section.includes('Cache-Control: no-store')||!section.includes("default-src 'none'"))throw Error('Return security headers');}
 const additions=manifest.approved.filter(f=>!manifest.base.some(b=>b.path===f.path));verify(path.join(source,'source'),additions);
 return additions;
}
function assemble(base,out){
 const additions=checkSources();verify(base,manifest.base);base=fs.realpathSync(base);out=path.resolve(out);
 if(fs.existsSync(out))throw Error('Output must not exist; no overwrite');
 if(out.startsWith(base+path.sep)||base.startsWith(out+path.sep))throw Error('Overlapping directories');
 // Resolve the existing ancestor before writing: no output through symlinks/junctions.
 let parent=path.dirname(out);while(!fs.existsSync(parent))parent=path.dirname(parent);
 if(fs.realpathSync(parent)!==parent)throw Error('Output ancestor alias');
 const files=new Map(manifest.base.map(f=>[f.path,read(base,f.path)]));
 files.set('_headers',Buffer.concat([files.get('_headers'),read(source,'headers-append.txt')]));
 for(const f of additions)files.set(f.path,read(path.join(source,'source'),f.path));
 for(const f of manifest.approved){const b=files.get(f.path);if(!b||b.length!==f.bytes||sha(b)!==f.sha256)throw Error('Candidate mismatch');}
 fs.mkdirSync(out,{recursive:true});for(const [n,b]of files){const dest=path.join(out,n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});}verify(out,manifest.approved);
 return {files:files.size,preserved:35,htmlSHA256:manifest.approved.find(f=>f.path==='billing-test.html').sha256};
}
if(require.main===module){const [mode,...args]=process.argv.slice(2);try{
 if(mode==='assemble'&&args.length===2)console.log(assemble(...args));
 else if(mode==='verify'&&args.length===1){checkSources();verify(args[0],manifest.approved);console.log('40 approved files verified; local only');}
 else if(mode==='verify-rollback'&&args.length===1){verify(args[0],manifest.base);console.log('36 original files verified; nothing deployed');}
 else throw Error('Usage: staging-return.cjs assemble BASE NEW_OUTPUT | verify OUTPUT | verify-rollback BASE');
 }catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={manifest,sha,verify,checkSources,assemble};
