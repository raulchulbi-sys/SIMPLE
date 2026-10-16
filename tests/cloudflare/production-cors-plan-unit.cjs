'use strict';
// Local CORS prefixes only; the existing VM helper cannot cross the RPC boundary.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {prepare,verifiedOrigin,patchEntry,safetyGate,assertRollbackSafe,PROJECT,PAGES_PROJECT,BASELINE}=require('./production-cors-plan.cjs');
const {prefixHandler,allowed}=require('./auth-cors.cjs');
const root=path.resolve(__dirname,'../..'),origin='https://'+PAGES_PROJECT+'.pages.dev',appUrl=origin+'/';
const names=Object.keys(BASELINE),github='https://raulchulbi-sys.github.io',production='https://'+PROJECT+'.supabase.co',staging='https://dmqjexigdnfzobarhnib.supabase.co';
test('only the exact stable production origin is accepted',()=>{
 assert.equal(verifiedOrigin({pagesProject:PAGES_PROJECT,appUrl}),origin);
 for(const url of [origin,origin+'/other',origin+'/?reset=1',origin+'/#token',origin+':443/',origin.replace('https:','http:')+'/',origin.replace(PAGES_PROJECT,'simple-staging-raulchulbi')+'/',origin.replace(PAGES_PROJECT,'build.'+PAGES_PROJECT)+'/',origin.replace(PAGES_PROJECT,'*.'+PAGES_PROJECT)+'/',origin.replace('https://','https://user@')+'/'])assert.throws(()=>verifiedOrigin({pagesProject:PAGES_PROJECT,appUrl:url}),/Exact stable/);
 assert.throws(()=>verifiedOrigin({pagesProject:'another-project',appUrl}),/reviewed production/);
});
for(const name of names)test(name+': CORS addition retains GitHub, rejects foreign origins and preserves staging guards',async()=>{
 const file='supabase/functions/'+name+'/index.ts',source=fs.readFileSync(path.join(root,file),'utf8'),patch=patchEntry({name,files:[{name:file,content:source}]},origin);
 const handler=prefixHandler(patch.content,production);await allowed(handler,github);await allowed(handler,origin);
 for(const method of ['OPTIONS','POST']){
  const response=await handler(new Request('https://local.example.invalid/',{method,headers:{Origin:'https://foreign.example.invalid'}}));
  assert.equal(response.status,403);assert.equal((await response.json()).error,'origin_denied');
 }
 const originalLines=source.split('\n'),patchedLines=patch.content.split('\n');
 assert.equal(originalLines.filter((line,i)=>line!==patchedLines[i]).length,1);
 const repeated=patchEntry({name,files:[{name:file,content:patch.content}]},origin);
 assert.equal(repeated.content,patch.content,'Applying the same exact-origin patch twice must be a byte-identical no-op');
 assert.deepEqual(repeated.addedOrigins,[]);assert.deepEqual(repeated.retainedOrigins,[github,origin]);
 const stage=prefixHandler(patch.content,staging);
 if(['simple-coach-mock','simple-coach-initial-premium'].includes(name)){
  const port=name==='simple-coach-mock'?4194:4262;await allowed(stage,'http://127.0.0.1:'+port);
 }
 const denied=await stage(new Request('https://local.example.invalid/',{method:'OPTIONS',headers:{Origin:origin}}));
 assert.equal(denied.status,403);assert.equal((await denied.json()).error,['simple-coach-mock','simple-coach-initial-premium'].includes(name)?'origin_denied':'staging_only');
});
test('changed production whitelist and unexpected functions are refused',()=>{
 const name='simple-coach-premium',file='supabase/functions/'+name+'/index.ts',source=fs.readFileSync(path.join(root,file),'utf8');
 assert.throws(()=>patchEntry({name,files:[{name:file,content:source.replace(github,'https://elsewhere.example.invalid')}]},origin),/whitelist baseline/);
 assert.throws(()=>patchEntry({name,files:[{name:file,content:source}]},'https://other.pages.dev'),/reviewed stable/);
 assert.throws(()=>patchEntry({name:'unexpected',files:[{name:'supabase/functions/unexpected/index.ts',content:source}]},origin),/Unexpected function/);
});
test('public frontend security replaces Access without granting deployment authorization',()=>{
 const blocked=safetyGate(undefined,origin);assert.equal(blocked.passed,false);
 const names=blocked.checks.map(check=>check.name);
 assert(names.includes('publicFrontendSecurityValidated'));assert(!names.includes('originProtected'));
 const receipt=Object.fromEntries(names.map(name=>[name,{verified:true,evidence:'Synthetic offline receipt only',origin,sha256:'a'.repeat(64)}]));
 const pending=structuredClone(receipt);pending.publicFrontendSecurityValidated.verified=false;
 assert.deepEqual(safetyGate(pending,origin).blockingReasons,['publicFrontendSecurityValidated']);
 const legacy=structuredClone(receipt);delete legacy.publicFrontendSecurityValidated;legacy.originProtected={verified:true,evidence:'Legacy Access receipt',origin};
 assert.deepEqual(safetyGate(legacy,origin).blockingReasons,['publicFrontendSecurityValidated']);
 const other=structuredClone(receipt);other.publicFrontendSecurityValidated.origin='https://foreign.example.invalid';
 assert.equal(safetyGate(other,origin).passed,false);
 const unapproved=structuredClone(receipt);unapproved.mandatoryApprovalsSatisfied.verified=false;
 assert.deepEqual(safetyGate(unapproved,origin).blockingReasons,['mandatoryApprovalsSatisfied']);
 assert.equal(safetyGate(receipt,origin).passed,true,'Synthetic gate evaluation is not deployment approval');
});
const freshPrivateFile=path.join(__dirname,'private/public-auth-cors-production-before-20261016.json');
const privateFile=fs.existsSync(freshPrivateFile)?freshPrivateFile:path.join(__dirname,'private/production-edge-before.json');
// Full exact-source tests use the existing ignored LIVE capture, never a public bundle copy.
test('captured production source: fail-closed readiness, exact rollback and drift guards',{skip:!fs.existsSync(privateFile)},()=>{
 const snapshot=JSON.parse(fs.readFileSync(privateFile,'utf8')).filter(fn=>names.includes(fn.name));
 const liveRead={projectId:PROJECT,capturedAt:new Date().toISOString(),functions:snapshot.map(({files,...fn})=>fn)};
 // Fixture metadata tests serialization/guards; this test does not claim a new LIVE read.
 const defaults=()=>({projectId:PROJECT,pagesProject:PAGES_PROJECT,appUrl,snapshot:structuredClone(snapshot),liveRead:structuredClone(liveRead)});
 const plan=prepare(defaults());assert.equal(plan.reviewOnly,true);assert.equal(plan.applyAllowed,false);assert.equal(plan.gate.passed,false);assert.equal(plan.gate.blockingReasons.length,6);
 assert.equal(plan.deployments.length,4);assert.equal(plan.metadata.reduce((sum,item)=>sum+item.fileCount,0),41);
 for(const original of snapshot){
  const before=plan.rollback.find(fn=>fn.name===original.name),after=plan.deployments.find(fn=>fn.name===original.name);
  assert.deepEqual(before.files,original.files);assert.equal(before.verify_jwt,true);assert.equal(after.verify_jwt,true);
  assert.equal(after.files.filter((file,i)=>file.content!==original.files[i].content).length,1);
 }
 for(const mutate of [
  value=>value.projectId='dmqjexigdnfzobarhnib',
  value=>value.liveRead.capturedAt=new Date(Date.now()-31*60*1000).toISOString(),
  value=>value.liveRead.functions[0].version++,
  value=>{value.snapshot[0].version++;value.liveRead.functions[0].version++;},
  value=>{value.snapshot[0].verify_jwt=false;value.liveRead.functions[0].verify_jwt=false;},
  value=>value.snapshot[0].files[1].content+='\n// unexpected business change',
  value=>value.snapshot.push(value.snapshot[0]),
 ]){const input=defaults();mutate(input);assert.throws(()=>prepare(input));}
 const onlyBooleans=defaults();onlyBooleans.safety=Object.fromEntries(plan.gate.checks.map(item=>[item.name,{verified:true}]));assert.equal(prepare(onlyBooleans).gate.passed,false);
 const securityOther=defaults();securityOther.safety={publicFrontendSecurityValidated:{verified:true,evidence:'security receipt',origin:'https://other.pages.dev'}};assert.equal(prepare(securityOther).gate.checks.find(item=>item.name==='publicFrontendSecurityValidated').pass,false);
 const syntheticReady=defaults();syntheticReady.safety=Object.fromEntries(plan.gate.checks.map(item=>[item.name,{verified:true,evidence:'Synthetic offline receipt only',origin,sha256:'a'.repeat(64)}]));
 const stillReviewOnly=prepare(syntheticReady);assert.equal(stillReviewOnly.gate.passed,true);assert.equal(stillReviewOnly.reviewOnly,true);assert.equal(stillReviewOnly.applyAllowed,false);
 const after=snapshot.map(fn=>({...structuredClone(fn),version:fn.version+1,ezbr_sha256:'b'.repeat(64),files:plan.deployments.find(item=>item.name===fn.name).files}));
 const afterRead={...liveRead,functions:after.map(({files,...fn})=>fn)},appliedVersions=Object.fromEntries(after.map(fn=>[fn.name,fn.version]));
 assert.equal(assertRollbackSafe({plan,currentSnapshot:after,liveRead:afterRead,appliedVersions}),true);
 assert.throws(()=>assertRollbackSafe({plan,currentSnapshot:after,liveRead:afterRead}),/version receipt/);
 const later=structuredClone(after);later[0].version++;const laterRead={...afterRead,functions:later.map(({files,...fn})=>fn)};
 assert.throws(()=>assertRollbackSafe({plan,currentSnapshot:later,liveRead:laterRead,appliedVersions}),/Later publication/);
 const edited=structuredClone(after);edited[0].files[1].content+='\n// later business change';
 assert.throws(()=>assertRollbackSafe({plan,currentSnapshot:edited,liveRead:afterRead,appliedVersions}),/rebase rollback/);
 const tampered=structuredClone(plan);tampered.rollback[0].files[1].content+='\n// changed backup';
 assert.throws(()=>assertRollbackSafe({plan:tampered,currentSnapshot:after,liveRead:afterRead,appliedVersions}),/rollback source changed/);
});
