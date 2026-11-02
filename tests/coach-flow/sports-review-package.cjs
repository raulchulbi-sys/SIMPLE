// Offline: package only the evaluator, preserving the exact retrieved staging bundle.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const dir=path.resolve(process.argv[2]),root=path.resolve(__dirname,'../..');
assert(dir.startsWith(path.join(__dirname,'private')+path.sep));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
const before=read('before-edge.json'),baseline=read('baseline.json');
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'private/basic-real-20261028/final-db.json')));
const refs=x=>[...x.integrity].sort((a,b)=>a.name.localeCompare(b.name));
assert.deepEqual(refs(baseline),refs(old),'27 historical references changed');
assert.deepEqual(baseline.metadata,old.metadata,'Critical definitions/security changed');
const prior=JSON.parse(fs.readFileSync(path.join(__dirname,'private/basic-real-20261028/edge.json')));
assert.equal(before.version,32);assert.equal(before.verify_jwt,true);assert.equal(before.import_map,false);
assert.deepEqual(before.files,prior.files,'Effective v32 sources drifted');
const target='assets/coach-programming-v5.js',files=structuredClone(before.files);
files.find(f=>f.name===target).content=fs.readFileSync(path.join(root,target),'utf8');
const changed=files.filter(f=>f.content!==before.files.find(b=>b.name===f.name).content).map(f=>f.name);
assert.deepEqual(changed,[target]);
const imports=[];
for(const f of files)for(const m of f.content.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
 const spec=m[1];if(!spec.startsWith('.'))continue;
 const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(f.name),spec));
 assert(files.some(x=>x.name===resolved),'Unresolved deployed import '+resolved);
 imports.push({from:f.name,to:resolved});
}
assert(imports.some(x=>x.from.endsWith('contract-v5.mjs')&&x.to===target));
const common={project_id:'dmqjexigdnfzobarhnib',name:before.name,entrypoint_path:'supabase/functions/simple-coach-mock/index.ts',verify_jwt:true};
const write=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write('deployment.json',{...common,files});write('rollback.json',{...common,files:before.files});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
write('package-summary.json',{changed,unchanged:10,imports,files:files.map(f=>({name:f.name,before:sha(before.files.find(b=>b.name===f.name).content),after:sha(f.content)}))});
console.log(JSON.stringify({historicalReferences:27,criticalDefinitions:baseline.metadata.functions.length,changed,unchanged:10,relativeImports:imports.length,rollbackPrepared:true}));
