'use strict';
// Offline plan from freshly captured LIVE staging bundles. Never deploys or calls a service.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const PROJECT='dmqjexigdnfzobarhnib',PAGES_PROJECT='simple-staging-raulchulbi';
const MIN_VERSIONS=Object.freeze({'simple-coach-mock':30,'simple-coach-premium':14,'simple-coach-chat':14,'simple-coach-initial-premium':3});
const LOCAL_ORIGINS=Object.freeze(['http://127.0.0.1:4280','http://localhost:4280']);
const hash=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const entryLocation=value=>{assert(typeof value==='string','Entrypoint location required');return value.replace(/^file:\/\//,'');};

function verifiedOrigins({pagesProject,stableUrl,deploymentUrl}){
 assert.equal(pagesProject,PAGES_PROJECT,'Only the verified staging Pages project is accepted');
 const host=pagesProject+'.pages.dev',suffix='.'+host;
 const parse=raw=>{const u=new URL(raw);assert.equal(raw,u.href,'Canonical trailing-slash URL required');assert(u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/','Exact HTTPS root URL required');return u;};
 const stable=parse(stableUrl),deployment=parse(deploymentUrl);
 assert.equal(stable.hostname,host,'Stable URL belongs to another Pages project');
 assert(deployment.hostname.endsWith(suffix),'Deployment URL belongs to another Pages project');
 const label=deployment.hostname.slice(0,-suffix.length);
 assert(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),'Deployment must have exactly one DNS label');
 return {origins:[stable.origin,deployment.origin],deploymentLabel:label};
}

function literalOrigins(array){
 assert(array.startsWith('[')&&array.endsWith(']'),'Literal origin array required');
 const contents=array.slice(1,-1).trim(),parts=contents?contents.split(','):[];
 const origins=parts.map(part=>{const match=part.trim().match(/^(['"])(https?:\/\/[^'"\\\s]+)\1$/);assert(match,'Only static unescaped origin strings are accepted');const raw=match[2],u=new URL(raw);assert.equal(raw,u.origin,'Whitelist values must be exact origins');assert(!u.username&&!u.password&&!/[\*%]/.test(raw),'Unsafe existing origin');return raw;});
 assert(origins.length>0&&new Set(origins).size===origins.length,'Nonempty unique existing whitelist required');return origins;
}

function sourceSafe(file){
 assert(typeof file.name==='string'&&!file.name.includes('\\')&&!file.name.includes('%')&&!file.name.includes(':')&&!file.name.startsWith('/')&&!file.name.split('/').some(p=>!p||p==='.'||p==='..'),'Unsafe bundle path');
 assert(typeof file.content==='string','Text bundle source required');
 assert(!/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|sk_test_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/.test(file.content),'Secret-shaped source rejected');
 for(const token of file.content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{assert.fail('Unrecognized JWT in source');}assert(claims.role==='anon'&&!claims.session_id&&!claims.email&&!claims.sub,'Non-public JWT in source');}
}

function patchEntry(fn,origins){
 const entryName='supabase/functions/'+fn.name+'/index.ts',entry=fn.files.find(f=>f.name===entryName);assert(entry,'LIVE staging entrypoint required');
 const declarations=[...entry.content.matchAll(/^const\s+(allowed|origins)\s*=\s*new\s+Set\(([^;\r\n]+)\);/gm)];
 assert.equal(declarations.length,1,'Exactly one reviewed CORS whitelist declaration required');
 const declaration=declarations[0],line=declaration[0],expression=declaration[2];let array,productionOrigins=[];
 if(fn.name==='simple-coach-mock'){
  assert(entry.content.includes("const staging=URL==='https://"+PROJECT+".supabase.co'"),'Basic staging branch is missing');
  const branches=expression.match(/^production\s*\?\s*(\[[^\[\]\r\n]*\])\s*:\s*(\[[^\[\]\r\n]*\])$/);assert(branches,'Basic production/staging literal branches required');
  productionOrigins=literalOrigins(branches[1]);array=branches[2];
 }else{
  assert(entry.content.includes("if(URL!=='https://"+PROJECT+".supabase.co')"),'LIVE staging guard is missing');array=expression;assert(/^\[[^\[\]\r\n]*\]$/.test(array),'Direct staging origin array required');
 }
 const retainedOrigins=literalOrigins(array);for(const local of LOCAL_ORIGINS)assert(retainedOrigins.includes(local),'Existing 4280 staging scope must be retained');
 const addedOrigins=origins.filter(origin=>!retainedOrigins.includes(origin));
 const patchedArray=addedOrigins.length?array.slice(0,-1)+','+addedOrigins.map(origin=>JSON.stringify(origin)).join(',')+']':array;
 const start=line.lastIndexOf(array);assert(start>=0,'Literal array boundary missing');
 const patchedLine=line.slice(0,start)+patchedArray+line.slice(start+array.length);
 const content=entry.content.slice(0,declaration.index)+patchedLine+entry.content.slice(declaration.index+line.length);
 assert.equal(content.slice(0,declaration.index)+line+content.slice(declaration.index+patchedLine.length),entry.content,'Only the CORS array may change');
 assert.deepEqual(literalOrigins(patchedArray),[...retainedOrigins,...addedOrigins]);
 return {entryName,content,retainedOrigins,productionOrigins,addedOrigins,beforeSha256:hash(entry.content),afterSha256:hash(content)};
}

function prepare({projectId,pagesProject,stableUrl,deploymentUrl,snapshot,capturedAt}={}){
 assert.equal(projectId,PROJECT,'Only the authorized staging Supabase project is accepted');
 const {origins,deploymentLabel}=verifiedOrigins({pagesProject,stableUrl,deploymentUrl});
 assert(Array.isArray(snapshot)&&snapshot.length===4,'Complete four-function LIVE snapshot required');
 assert.equal(new Set(snapshot.map(fn=>fn.name)).size,4,'Duplicate functions rejected');
 if(capturedAt){const time=Date.parse(capturedAt);assert(Number.isFinite(time)&&time<=Date.now()+60000&&time>=Date.now()-30*60*1000,'Fresh snapshot capture required');}
 const deployments=[],rollback=[],metadata=[];
 for(const [name,minVersion] of Object.entries(MIN_VERSIONS)){
  const fn=snapshot.find(f=>f.name===name);assert(fn,'Missing LIVE staging function');assert.equal(fn.slug,name,'Function slug mismatch');
  assert.equal(fn.status,'ACTIVE','Active LIVE source required');assert.equal(fn.verify_jwt,true,'JWT verification must remain enabled');assert.equal(fn.import_map,false,'Import-map change requires separate review');
  assert(Number.isSafeInteger(fn.version)&&fn.version>=minVersion,'Stale pre-4280 snapshot rejected');
  const current=fn.metadata;assert(current&&current.name===name&&current.slug===name,'Fresh current metadata required');
  for(const key of ['id','version','verify_jwt','import_map','ezbr_sha256'])assert.equal(fn[key],current[key],'Current metadata differs from downloaded bundle');
  // list/get endpoints serialize the identical container location as file:// or /tmp.
  assert.equal(entryLocation(fn.entrypoint_path),entryLocation(current.entrypoint_path),'Current entrypoint differs from downloaded bundle');
  assert(fn.entrypoint_path.includes('user_fn_'+PROJECT+'_'),'Downloaded bundle belongs to another project');
  assert(Array.isArray(fn.files)&&fn.files.length>0&&new Set(fn.files.map(f=>f.name)).size===fn.files.length,'Complete unique LIVE bundle files required');fn.files.forEach(sourceSafe);
  const patch=patchEntry(fn,origins),files=fn.files.map(file=>({name:file.name,content:file.content}));
  const patched=files.map(file=>file.name===patch.entryName?{name:file.name,content:patch.content}:{...file});
  assert.equal(patched.filter((file,i)=>file.content!==files[i].content).length,patch.addedOrigins.length?1:0,'Unexpected bundle source change');
  const common={project_id:PROJECT,name,entrypoint_path:patch.entryName,verify_jwt:true};
  deployments.push({...common,files:patched});rollback.push({...common,files});
  metadata.push({name,beforeVersion:fn.version,verifyJwt:true,fileCount:files.length,changedFile:patch.addedOrigins.length?patch.entryName:null,
   beforeSha256:patch.beforeSha256,afterSha256:patch.afterSha256,retainedOrigins:patch.retainedOrigins,productionOrigins:patch.productionOrigins,addedOrigins:patch.addedOrigins,
   filesBefore:files.map(file=>({name:file.name,sha256:hash(file.content)})),filesAfter:patched.map(file=>({name:file.name,sha256:hash(file.content)}))});
 }
 return {projectId:PROJECT,pagesProject,stableUrl,deploymentUrl,deploymentLabel,capturedAt:capturedAt||null,origins,
  before:structuredClone(snapshot),snapshotSha256:hash(JSON.stringify(snapshot)),metadata,deployments,rollback};
}

if(require.main===module){try{
 const args=process.argv.slice(2),options={};assert(args.length===10,'Usage: --project dmq... --pages-project simple-staging-raulchulbi --stable URL --deployment URL --snapshot PATH');
 for(let i=0;i<args.length;i+=2){assert(['--project','--pages-project','--stable','--deployment','--snapshot'].includes(args[i])&&!Object.hasOwn(options,args[i]),'Unknown or duplicate option');options[args[i]]=args[i+1];}
 const file=path.resolve(options['--snapshot']),snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
 const plan=prepare({projectId:options['--project'],pagesProject:options['--pages-project'],stableUrl:options['--stable'],deploymentUrl:options['--deployment'],snapshot,capturedAt:fs.statSync(file).mtime.toISOString()});
 const directory=path.join(__dirname,'private');fs.mkdirSync(directory,{recursive:true});assert(!fs.lstatSync(directory).isSymbolicLink(),'Private output symlink rejected');
 const output=path.join(directory,'cloudflare-https-cors-plan-'+plan.deploymentLabel+'.json');fs.writeFileSync(output,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({projectId:PROJECT,output,origins:plan.origins,functions:plan.metadata.map(fn=>({name:fn.name,version:fn.beforeVersion,files:fn.fileCount,addedOrigins:fn.addedOrigins,changedFile:fn.changedFile,beforeSha256:fn.beforeSha256,afterSha256:fn.afterSha256})),snapshotSha256:plan.snapshotSha256},null,2));
 }catch(error){console.error('Cloudflare staging CORS plan rejected: '+error.message);process.exitCode=1;}}
module.exports={prepare,verifiedOrigins,PROJECT,PAGES_PROJECT};
