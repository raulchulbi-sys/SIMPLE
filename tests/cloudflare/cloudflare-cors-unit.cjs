'use strict';
// Synthetic source/URLs only. No network or private fixture is needed for these tests.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {prepare,PROJECT,PAGES_PROJECT}=require('./cloudflare-cors.cjs');
const versions={'simple-coach-mock':30,'simple-coach-premium':14,'simple-coach-chat':14,'simple-coach-initial-premium':3};
function snapshot(){return Object.entries(versions).map(([name,version],i)=>{
 const metadata={id:'unit-'+i,slug:name,name,status:'ACTIVE',version,verify_jwt:true,import_map:false,entrypoint_path:'file:///tmp/user_fn_'+PROJECT+'_unit_'+version+'/source/supabase/functions/'+name+'/index.ts',ezbr_sha256:'a'.repeat(64)};
 const shared="['http://127.0.0.1:4194','http://localhost:4194','http://127.0.0.1:4280','http://localhost:4280']";
 const content=name==='simple-coach-mock'?"const staging=URL==='https://"+PROJECT+".supabase.co';\r\nconst allowed=new Set(production?['https://raulchulbi-sys.github.io']:"+shared+");\r\n// Business bytes must remain unchanged.\r\n":
  "const allowed=new Set("+shared+");\nfunction unchangedGuard(){if(URL!=='https://"+PROJECT+".supabase.co')return reply({error:'staging_only'},403);}\n// Business bytes must remain unchanged.\n";
 return {...metadata,metadata:{...metadata},files:[{name:'supabase/functions/'+name+'/index.ts',content},{name:'supabase/functions/'+name+'/contract.mjs',content:"export const contract='unchanged UTF-8 á';\r\n"}]};
});}
const defaults=()=>({projectId:PROJECT,pagesProject:PAGES_PROJECT,stableUrl:'https://'+PAGES_PROJECT+'.pages.dev/',deploymentUrl:'https://unit-only-deployment.'+PAGES_PROJECT+'.pages.dev/',snapshot:snapshot(),capturedAt:new Date().toISOString()});
function setFrom(entry,production){const match=entry.match(/^const\s+(allowed|origins)\s*=\s*new\s+Set\(([^;\r\n]+)\);/m);return vm.runInNewContext('const production='+Boolean(production)+';'+match[0]+'Array.from('+match[1]+')');}

test('only exact verified stable and single-label deployment origins are accepted',()=>{
 for(const bad of ['https://foreign.pages.dev/','https://bad.extra.'+PAGES_PROJECT+'.pages.dev/','http://unit.'+PAGES_PROJECT+'.pages.dev/','https://unit.'+PAGES_PROJECT+'.pages.dev:8443/','https://user:pass@unit.'+PAGES_PROJECT+'.pages.dev/','https://unit.'+PAGES_PROJECT+'.pages.dev/nested/','https://unit.'+PAGES_PROJECT+'.pages.dev/?reset=1','https://*.'+PAGES_PROJECT+'.pages.dev/'])assert.throws(()=>prepare({...defaults(),deploymentUrl:bad}));
 assert.throws(()=>prepare({...defaults(),stableUrl:'https://other-staging.pages.dev/'}));assert.throws(()=>prepare({...defaults(),pagesProject:'unverified-project'}));
});
test('Supabase production and a bundle from another project are rejected',()=>{
 assert.throws(()=>prepare({...defaults(),projectId:'yvguatdqncadkwewlepe'}),/authorized staging/);
 const options=defaults();options.snapshot[0].entrypoint_path=options.snapshot[0].metadata.entrypoint_path.replace(PROJECT,'yvguatdqncadkwewlepe');options.snapshot[0].metadata.entrypoint_path=options.snapshot[0].entrypoint_path;assert.throws(()=>prepare(options),/another project/);
});
test('JWT weakening, stale versions and inconsistent fresh metadata fail',()=>{
 const jwt=defaults();jwt.snapshot[0].verify_jwt=false;assert.throws(()=>prepare(jwt),/JWT verification/);
 const stale=defaults();stale.snapshot[0].version--;stale.snapshot[0].metadata.version--;assert.throws(()=>prepare(stale),/Stale/);
 const mismatch=defaults();mismatch.snapshot[0].metadata.version++;assert.throws(()=>prepare(mismatch),/metadata differs/);
 const old=defaults();old.capturedAt=new Date(Date.now()-31*60*1000).toISOString();assert.throws(()=>prepare(old),/Fresh snapshot/);
});
test('list/get file URI serialization may differ while the exact location stays identical',()=>{
 const options=defaults();for(const fn of options.snapshot)fn.entrypoint_path=fn.entrypoint_path.replace(/^file:\/\//,'');assert.equal(prepare(options).deployments.length,4);
 const wrong=defaults();wrong.snapshot[0].metadata.entrypoint_path+='.other';assert.throws(()=>prepare(wrong),/entrypoint differs/);
});
test('all four complete bundles, unrelated source bytes and rollback remain exact',()=>{
 const options=defaults(),before=JSON.stringify(options.snapshot),plan=prepare(options);
 assert.equal(JSON.stringify(options.snapshot),before);assert.equal(plan.deployments.length,4);assert.equal(plan.rollback.length,4);assert.equal(JSON.stringify(plan.before),before);
 for(const deployment of plan.deployments){const original=options.snapshot.find(fn=>fn.name===deployment.name),rollback=plan.rollback.find(fn=>fn.name===deployment.name);
  assert.deepEqual(rollback.files,original.files);assert.equal(deployment.verify_jwt,true);assert.equal(rollback.verify_jwt,true);
  assert.equal(deployment.files.filter((file,i)=>file.content!==original.files[i].content).length,1);assert.equal(deployment.files[1].content,original.files[1].content);
 }
});
test('new origins enter only the staging branch and all previous origins stay accepted',()=>{
 const plan=prepare(defaults());for(const deployment of plan.deployments){const source=deployment.files.find(file=>file.name===deployment.entrypoint_path).content,stage=setFrom(source,false);
  for(const origin of [...plan.origins,'http://127.0.0.1:4194','http://localhost:4194','http://127.0.0.1:4280','http://localhost:4280'])assert.equal(stage.includes(origin),true);
  assert.equal(stage.includes('https://unapproved.pages.dev'),false);
  if(deployment.name==='simple-coach-mock'){const prod=setFrom(source,true);assert.equal(prod.length,1);assert.equal(prod[0],'https://raulchulbi-sys.github.io');for(const origin of plan.origins)assert.equal(prod.includes(origin),false);}
 }
});
test('already-present exact origins are deduplicated without touching other bytes',()=>{
 const options=defaults(),first=prepare(options);for(const fn of options.snapshot)fn.files=first.deployments.find(deployment=>deployment.name===fn.name).files;
 const second=prepare(options);for(const metadata of second.metadata){assert.equal(metadata.addedOrigins.length,0);assert.equal(metadata.changedFile,null);assert.equal(metadata.beforeSha256,metadata.afterSha256);}
});
test('missing 4280 scope or a dynamic wildcard whitelist requires review',()=>{
 for(const change of [source=>source.replace("'http://127.0.0.1:4280',",''),source=>source.replace("'http://127.0.0.1:4194'","'https://*.pages.dev'")]){const options=defaults();options.snapshot[0].files[0].content=change(options.snapshot[0].files[0].content);assert.throws(()=>prepare(options));}
});
test('traversal paths, secret-shaped source and duplicate files are rejected before plan',()=>{
 for(const mutate of [fn=>{fn.files[1].name='../internal.mjs';},fn=>{fn.files[1].content='sb_secret_unit_private_value_12345';},fn=>{fn.files.push({...fn.files[1]});}]){const options=defaults();mutate(options.snapshot[0]);assert.throws(()=>prepare(options));}
});
