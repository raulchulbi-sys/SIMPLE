'use strict';
// Offline review payload only. No network client, deploy command, Auth write or SQL.
// Reviewed against LIVE production and main c818e35 on 2026-10-15.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const PROJECT='yvguatdqncadkwewlepe',PAGES_PROJECT='simple-raulchulbi';
const GITHUB='https://raulchulbi-sys.github.io';
const BASELINE=Object.freeze({
 'simple-coach-mock':{version:3,files:10,ezbr:'909b3e8d353aa1a47fe2d390ff168ad62ac6f9f39ad088466426709b30a9bf09',source:'28a819e5747a3117f629a9f7fa1e5057fa3203f52b6e1d668772b1db172b2ff1'},
 'simple-coach-premium':{version:4,files:9,ezbr:'d52eb5394fa9a0d25d3a77b83097ec73ebd6ce7ba6d9409a80238e9c01581dc6',source:'4150d2d9ff6d6ff64ef96a32afaa23d815aa2f05b5a3ae5d757eb0842800a19c'},
 'simple-coach-chat':{version:5,files:11,ezbr:'3b2806991613d85e00af9dec201ea8e6a22775f5c72db4c15af173b0ea273859',source:'7177379a7144c35b3d3e4a37221a056ec4a0a190229ef7aae169fdc6477b8fe8'},
 'simple-coach-initial-premium':{version:1,files:11,ezbr:'0cadf4e489da91467e0cd12ea4ba842ec61cee49f153562e639a069ef8339fcd',source:'d917bf740d7b6ea56db4dd0ea759a915fa91ff31b0c69a3176f099ff8e99d7e9'}
});
const NAMES=Object.freeze(Object.keys(BASELINE));
const hash=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');
const sourceHash=files=>hash(JSON.stringify(files.map(({name,content})=>({name,content})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)));
const location=value=>{assert(typeof value==='string','Entrypoint required');return value.replace(/^file:\/\//,'');};

function verifiedOrigin({pagesProject,appUrl}={}){
 assert.equal(pagesProject,PAGES_PROJECT,'Only the reviewed production Pages project is accepted');
 const expected='https://'+pagesProject+'.pages.dev/';
 assert.equal(appUrl,expected,'Exact stable HTTPS root URL required; aliases and wildcards are not approved');
 const url=new URL(appUrl);assert.equal(url.href,appUrl,'Canonical application URL required');return url.origin;
}
function freshRead(liveRead){
 assert(liveRead&&liveRead.projectId===PROJECT,'Independent production LIVE metadata read required');
 const when=Date.parse(liveRead.capturedAt);
 assert(Number.isFinite(when)&&when<=Date.now()+60000&&when>=Date.now()-30*60*1000,'Fresh LIVE metadata read required (maximum 30 minutes)');
 assert(Array.isArray(liveRead.functions),'LIVE function metadata array required');
 for(const name of NAMES)assert.equal(liveRead.functions.filter(fn=>fn.name===name).length,1,'One LIVE metadata entry per function required');
}
function currentBundle(fn,liveRead){
 const current=liveRead.functions.find(item=>item.name===fn.name);assert(current,'Missing LIVE metadata');
 assert(typeof fn.id==='string'&&fn.id.length>0,'LIVE function identity required');
 assert(Number.isSafeInteger(fn.version)&&fn.version>0,'LIVE version required');assert(/^[a-f0-9]{64}$/.test(fn.ezbr_sha256||''),'LIVE bundle hash required');
 assert.equal(fn.status,'ACTIVE','Active source required');assert.equal(fn.slug,fn.name,'Function slug mismatch');
 assert.equal(fn.verify_jwt,true,'JWT verification must remain enabled');assert.equal(fn.import_map,false,'Import-map change needs separate review');
 for(const key of ['id','name','slug','status','version','verify_jwt','import_map','ezbr_sha256'])assert.equal(fn[key],current[key],'LIVE metadata differs from downloaded source: '+key);
 assert.equal(location(fn.entrypoint_path),location(current.entrypoint_path),'LIVE entrypoint changed');
 assert(location(fn.entrypoint_path).includes('/user_fn_'+PROJECT+'_'),'Bundle belongs to another project');
 assert(Array.isArray(fn.files)&&fn.files.length>0,'Complete source bundle required');
 assert.equal(new Set(fn.files.map(f=>f.name)).size,fn.files.length,'Duplicate bundle paths rejected');
 for(const file of fn.files){
  assert(typeof file.name==='string'&&!file.name.startsWith('/')&&!/[\\:%]/.test(file.name)&&!file.name.split('/').some(p=>!p||p==='.'||p==='..'),'Unsafe bundle path');
  assert(typeof file.content==='string','Text source required');
 }
}
function literalOrigins(array){
 assert(/^\[[^\[\]\r\n]*\]$/.test(array),'Static origin array required');
 const origins=array.slice(1,-1).split(',').map(part=>{const match=part.trim().match(/^(['"])(https?:\/\/[^'"\\\s]+)\1$/);assert(match,'Literal origin required');const value=match[2];assert.equal(new URL(value).origin,value,'Exact origin required');return value;});
 assert.equal(new Set(origins).size,origins.length,'Duplicate origin rejected');return origins;
}
function patchEntry(fn,origin){
 assert.equal(origin,'https://'+PAGES_PROJECT+'.pages.dev','Only the reviewed stable origin may be added');
 const entryName='supabase/functions/'+fn.name+'/index.ts',entry=fn.files.find(file=>file.name===entryName);assert(entry,'Reviewed entrypoint required');
 const matches=[...entry.content.matchAll(/^const\s+(allowed|origins)\s*=\s*new\s+Set\(([^;\r\n]+)\);/gm)];
 assert.equal(matches.length,1,'Exactly one reviewed CORS declaration required');
 const match=matches[0],line=match[0],expression=match[2];let array;
 if(fn.name==='simple-coach-mock'){
  assert(entry.content.includes("const production=URL==='https://"+PROJECT+".supabase.co'"),'Basic production guard missing');
  const branches=expression.match(/^production\s*\?\s*(\[[^\[\]\r\n]*\])\s*:\s*(\[[^\[\]\r\n]*\])$/);assert(branches,'Basic production/staging branches required');array=branches[1];
 }else if(fn.name==='simple-coach-initial-premium'){
  const branches=expression.match(/^URL==='https:\/\/dmqjexigdnfzobarhnib\.supabase\.co'\s*\?\s*(\[[^\[\]\r\n]*\])\s*:\s*(\[[^\[\]\r\n]*\])$/);assert(branches,'Initial staging/production branches required');array=branches[2];
 }else{
  assert(['simple-coach-premium','simple-coach-chat'].includes(fn.name),'Unexpected function');
  assert(entry.content.includes("if(URL!=='https://"+PROJECT+".supabase.co')"),'Production environment guard missing');array=expression;
 }
 const retainedOrigins=literalOrigins(array);assert.deepEqual(retainedOrigins,[GITHUB],'Production whitelist baseline changed');
 const patchedArray=array.slice(0,-1)+','+JSON.stringify(origin)+']',start=line.indexOf(array);
 assert(start>=0,'Array boundary missing');
 const patchedLine=line.slice(0,start)+patchedArray+line.slice(start+array.length);
 const content=entry.content.slice(0,match.index)+patchedLine+entry.content.slice(match.index+line.length);
 assert.equal(content.slice(0,match.index)+line+content.slice(match.index+patchedLine.length),entry.content,'Only the CORS array may change');
 return {entryName,content,retainedOrigins,addedOrigins:[origin],beforeSha256:hash(entry.content),afterSha256:hash(content)};
}
function safetyGate(safety,origin){
 // Receipts are review evidence, not a substitute for reading the real external state.
 const required=['originOwned','originProtected','stagingValidated','configBackupVerified','rollbackReviewed','mandatoryApprovalsSatisfied'];
 const checks=required.map(name=>{const proof=safety?.[name];let pass=proof?.verified===true&&typeof proof.evidence==='string'&&proof.evidence.trim().length>0;
  if(['originOwned','originProtected'].includes(name))pass=pass&&proof.origin===origin;
  if(name==='configBackupVerified')pass=pass&&/^[a-f0-9]{64}$/.test(proof?.sha256||'');
  return {name,pass:!!pass,evidence:pass?proof.evidence:null};
 });
 return {passed:checks.every(check=>check.pass),checks,blockingReasons:checks.filter(check=>!check.pass).map(check=>check.name)};
}
function prepare({projectId,pagesProject,appUrl,snapshot,liveRead,safety}={}){
 assert.equal(projectId,PROJECT,'Only the authorized production Supabase project is accepted');
 const origin=verifiedOrigin({pagesProject,appUrl});freshRead(liveRead);
 assert(Array.isArray(snapshot)&&snapshot.length===NAMES.length,'Complete four-function source snapshot required');
 assert.equal(new Set(snapshot.map(fn=>fn.name)).size,NAMES.length,'Duplicate functions rejected');
 const deployments=[],rollback=[],metadata=[];
 for(const name of NAMES){
  const fn=snapshot.find(item=>item.name===name),baseline=BASELINE[name];assert(fn,'Missing production source');currentBundle(fn,liveRead);
  assert.equal(fn.version,baseline.version,'Production version changed; review and pin a new baseline');
  assert.equal(fn.ezbr_sha256,baseline.ezbr,'Production bundle hash changed');assert.equal(fn.files.length,baseline.files,'Bundle file count changed');
  assert.equal(sourceHash(fn.files),baseline.source,'Reviewed LIVE source bytes changed');
  const patch=patchEntry(fn,origin),files=fn.files.map(({name,content})=>({name,content}));
  const patched=files.map(file=>file.name===patch.entryName?{name:file.name,content:patch.content}:{...file});
  assert.equal(patched.filter((file,i)=>file.content!==files[i].content).length,1,'Exactly one file may change');
  const common={project_id:PROJECT,name,entrypoint_path:patch.entryName,verify_jwt:true};
  deployments.push({...common,files:patched});rollback.push({...common,files});
  metadata.push({name,id:fn.id,beforeVersion:fn.version,beforeBundleSha256:fn.ezbr_sha256,verifyJwt:true,fileCount:files.length,
   changedFile:patch.entryName,beforeSha256:patch.beforeSha256,afterSha256:patch.afterSha256,retainedOrigins:patch.retainedOrigins,addedOrigins:patch.addedOrigins,
   beforeSourceSha256:sourceHash(files),afterSourceSha256:sourceHash(patched),filesBefore:files.map(file=>({name:file.name,sha256:hash(file.content)})),filesAfter:patched.map(file=>({name:file.name,sha256:hash(file.content)}))});
 }
 return {kind:'OFFLINE REVIEW ONLY — not an approval or deployment',reviewOnly:true,applyAllowed:false,projectId:PROJECT,pagesProject,appUrl,origin,
  liveVerifiedAt:liveRead.capturedAt,gate:safetyGate(safety,origin),snapshotSha256:hash(JSON.stringify(snapshot)),before:structuredClone(snapshot),metadata,deployments,rollback,
  rollbackInstruction:'Re-read LIVE after deployment and record actual applied versions. Restore exact originals only if version and all current source bytes still match this plan; otherwise rebase an origin-only rollback. Never overwrite later business changes.'};
}
function assertRollbackSafe({plan,currentSnapshot,liveRead,appliedVersions}={}){
 assert(plan?.reviewOnly===true&&plan.projectId===PROJECT,'Reviewed production plan required');freshRead(liveRead);
 assert.equal(verifiedOrigin({pagesProject:plan.pagesProject,appUrl:plan.appUrl}),plan.origin,'Plan origin changed');
 assert.deepEqual(plan.metadata.map(item=>item.name).sort(),[...NAMES].sort(),'Complete unique plan metadata required');
 assert.equal(plan.rollback.length,NAMES.length,'Complete original rollback payload required');assert.equal(plan.deployments.length,NAMES.length,'Complete reviewed payload required');
 assert(Array.isArray(currentSnapshot)&&currentSnapshot.length===NAMES.length,'Complete current rollback source required');
 assert.equal(new Set(currentSnapshot.map(fn=>fn.name)).size,NAMES.length,'Duplicate rollback sources rejected');
 for(const item of plan.metadata){
  const baseline=BASELINE[item.name],saved=plan.rollback.find(fn=>fn.name===item.name),deployment=plan.deployments.find(fn=>fn.name===item.name);
  assert(saved&&deployment,'Missing reviewed rollback payload');assert.equal(saved.verify_jwt,true,'Rollback JWT must remain enabled');assert.equal(deployment.verify_jwt,true,'Reviewed JWT must remain enabled');
  assert.equal(item.beforeVersion,baseline.version,'Rollback baseline version changed');assert.equal(sourceHash(saved.files),baseline.source,'Original rollback source changed');
  const patch=patchEntry({name:item.name,files:saved.files},plan.origin),expected=saved.files.map(file=>file.name===patch.entryName?{name:file.name,content:patch.content}:{...file});
  assert.equal(sourceHash(deployment.files),sourceHash(expected),'Reviewed deployment payload changed');assert.equal(item.afterSourceSha256,sourceHash(expected),'Reviewed source hash changed');
  const fn=currentSnapshot.find(current=>current.name===item.name);assert(fn,'Missing current rollback source');currentBundle(fn,liveRead);
  const applied=appliedVersions?.[item.name];assert(Number.isSafeInteger(applied)&&applied>item.beforeVersion,'Actual post-deployment version receipt required');
  assert.equal(fn.id,item.id,'Function identity changed');assert.equal(fn.version,applied,'Later publication detected; rebase rollback');
  assert.equal(sourceHash(fn.files),item.afterSourceSha256,'Current source differs from applied plan; rebase rollback');
 }
 return true;
}
module.exports={prepare,verifiedOrigin,patchEntry,assertRollbackSafe,sourceHash,PROJECT,PAGES_PROJECT,BASELINE};
if(require.main===module){try{
 const args=process.argv.slice(2),options={};assert(args.length===8||args.length===10,'Usage: --pages-project simple-raulchulbi --app-url URL --snapshot PRIVATE_JSON --live-read PRIVATE_JSON [--safety-evidence PRIVATE_JSON]');
 for(let i=0;i<args.length;i+=2){assert(['--pages-project','--app-url','--snapshot','--live-read','--safety-evidence'].includes(args[i])&&!Object.hasOwn(options,args[i]),'Unknown or duplicate option');options[args[i]]=args[i+1];}
 const read=file=>JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
 const snapshot=read(options['--snapshot']).filter(fn=>NAMES.includes(fn.name)),liveRead=read(options['--live-read']);
 const plan=prepare({projectId:PROJECT,pagesProject:options['--pages-project'],appUrl:options['--app-url'],snapshot,liveRead,safety:options['--safety-evidence']?read(options['--safety-evidence']):undefined});
 const directory=path.join(__dirname,'private');fs.mkdirSync(directory,{recursive:true});assert(!fs.lstatSync(directory).isSymbolicLink(),'Private output symlink rejected');
 const output=path.join(directory,'production-cors-plan-review.json');fs.writeFileSync(output,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,projectId:PROJECT,origin:plan.origin,reviewOnly:true,applyAllowed:false,gate:plan.gate,functions:plan.metadata.map(({name,beforeVersion,fileCount,changedFile})=>({name,beforeVersion,fileCount,changedFile}))},null,2));
}catch(error){console.error('Production CORS plan rejected: '+error.message);process.exitCode=1;}}
