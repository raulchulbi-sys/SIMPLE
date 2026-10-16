'use strict';
// Offline orchestration only. No network client, credential IO, deployment or backend writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {validateBackend,PAGES_PROJECTS}=require('./hosting-runtime.cjs');
const ROOT=path.resolve(__dirname,'..');
const RESULTS=path.join(ROOT,'tests/cloudflare/results');
const PROJECT=PAGES_PROJECTS.production;
const APP='https://'+PROJECT+'.pages.dev/';
const ROLLBACK=Object.freeze({deploymentId:'170fea3b-05ea-426b-b482-af7749bd0218',sourceCommit:'8b2f526edae136b43970dd9770f5b74db575e7e6',treeSha256:'47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399'});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const canonical=(bytes,name)=>/\.(?:html|js|css|txt)$/.test(name)||name==='_headers'?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')):bytes;
const fail=message=>{throw Error('Release preparation: '+message);};
function git(...args){return execFileSync('git',args,{cwd:ROOT,encoding:null,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});}
function bounded(directory){
 const relative=path.relative(ROOT,path.resolve(directory));
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative))fail('workspace escapes repository');
 let current=ROOT;
 for(const part of relative.split(path.sep)){
  current=path.join(current,part);const stat=fs.lstatSync(current,{throwIfNoEntry:false});
  if(stat?.isSymbolicLink())fail('workspace symlink rejected');
 }
 return path.resolve(directory);
}
function inventory(directory,relative=''){
 return fs.readdirSync(path.join(directory,relative)).flatMap(name=>{
  const file=relative?relative+'/'+name:name,absolute=path.join(directory,file),stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink()||!stat.isFile()&&!stat.isDirectory())fail('nonregular output');
  return stat.isDirectory()?inventory(directory,file):[{path:file,bytes:stat.size,sha256:sha(fs.readFileSync(absolute))}];
 }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function scan(directory,expected){
 bounded(directory);
 const actual=inventory(directory),sorted=[...expected].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 if(JSON.stringify(actual)!==JSON.stringify(sorted))fail('artifact files, bytes or hashes changed');
 for(const item of actual){
  if(!['index.html','404.html','robots.txt','_headers'].includes(item.path)&&!/^assets\/[a-zA-Z0-9_/-]+\.(?:js|css|png|webp|jpg|jpeg|gif|svg|ico|avif|woff2?|ttf|otf)$/.test(item.path))fail('nonpublic artifact file');
  const text=fs.readFileSync(path.join(directory,item.path)).toString('utf8');
  if(/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|sk_test_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/.test(text))fail('secret-shaped artifact content');
  for(const jwt of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){
   let claims;try{claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));}catch{fail('invalid JWT in artifact');}
   if(claims.role!=='anon'||claims.sub||claims.email||claims.phone||claims.session_id)fail('private JWT in artifact');
  }
 }
 return {passed:true,files:actual.length,credentialsPersisted:false};
}
function identity({project=PROJECT,appUrl=APP,branch='main',target='production'}={}){
 if(project!==PROJECT||appUrl!==APP||branch!=='main'||target!=='production')fail('unapproved project, host, branch or environment');
 return {project,appUrl,branch,target,backendProject:'yvguatdqncadkwewlepe'};
}
function sourceInfo(sourceCommit,expectedSourceTree){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit||'')||!/^[a-f0-9]{40}$/.test(expectedSourceTree||''))fail('explicit full source SHA and expected Git tree required');
 const commit=git('rev-parse','--verify',sourceCommit+'^{commit}').toString().trim();
 const tree=git('rev-parse','--verify',sourceCommit+'^{tree}').toString().trim();
 if(commit!==sourceCommit||tree!==expectedSourceTree)fail('source commit/tree mismatch');
 return {sourceCommit:commit,sourceTree:tree};
}
function prepare(options={}){
 const selected=identity(options),source=sourceInfo(options.sourceCommit,options.expectedSourceTree);
 const read=name=>git('show',source.sourceCommit+':'+name);
 const manifest=JSON.parse(read('config/static-public-manifest.json'));
 const inputs=[...manifest.files,'config/static-public-manifest.json','config/public-backends.json','scripts/hosting-build.cjs','scripts/hosting-runtime.cjs','config/cloudflare/_headers.template','config/cloudflare/404.html','config/cloudflare/robots.txt',...['index.html','404.html','_headers','preparation.css','robots.txt'].map(name=>'config/cloudflare/preparation/'+name)];
 const blobs=new Map();
 for(const name of inputs){
  if(typeof name!=='string'||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..')||!/^[-A-Za-z0-9_/.]+$/.test(name))fail('unsafe committed input');
  const type=git('ls-tree',source.sourceCommit,'--',name).toString();
  if(!/^100644 blob [a-f0-9]{40}\t/.test(type))fail('source input must be a regular tracked blob');
  blobs.set(name,read(name));
 }
 const backend=JSON.parse(blobs.get('config/public-backends.json')).production;
 validateBackend('production',backend);
 const workspace=bounded(path.join(RESULTS,'public-release-'+source.sourceCommit));
 const ignored=execFileSync('git',['check-ignore','--no-index','--stdin'],{cwd:ROOT,input:path.relative(ROOT,workspace).replaceAll('\\','/')+'/source/dist/index.html\n',encoding:'utf8',stdio:['pipe','pipe','pipe']});
 if(!ignored.trim())fail('release workspace must be Git ignored');
 // Read and validate every committed input before touching the isolated workspace.
 for(const folder of ['source','rollback-source'])for(const [name,content]of blobs){
  const destination=bounded(path.join(workspace,folder,name));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,content);
 }
 const buildModule=require(path.join(workspace,'source/scripts/hosting-build.cjs'));
 const runtimeModule=require(path.join(workspace,'source/scripts/hosting-runtime.cjs'));
 const runtime=runtimeModule.createRuntimeConfig({target:'production',env:{SIMPLE_DEPLOY_TARGET:'production',SIMPLE_PAGES_PROJECT:PROJECT,SIMPLE_APP_URL:APP,CF_PAGES_BRANCH:'main',CF_PAGES_URL:APP}});
 if(runtime.config.supabaseUrl!==backend.url||runtime.config.supabasePublicKey!==backend.publicKey||runtime.config.allowedOrigins.length!==1||runtime.config.appUrl!==APP)fail('rendered runtime crosses approved environment');
 const first=buildModule.build({sourceRoot:path.join(workspace,'source'),target:'production',runtime});
 const second=buildModule.build({sourceRoot:path.join(workspace,'source'),target:'production',runtime});
 if(first.treeSha256!==second.treeSha256)fail('nonreproducible artifact');
 const expected=[...manifest.files,...manifest.generated,'_headers','404.html','robots.txt'].sort();
 if(JSON.stringify(first.files.map(f=>f.path).sort())!==JSON.stringify(expected))fail('artifact allowlist differs');
 for(const name of manifest.files)if(!fs.readFileSync(path.join(first.output,name)).equals(canonical(blobs.get(name),name)))fail('application source bytes changed');
 const headers=fs.readFileSync(path.join(first.output,'_headers'),'utf8');
 if(!headers.includes(backend.url)||headers.includes('dmqjexigdnfzobarhnib')||headers.includes('Access-Control-Allow-Origin: *'))fail('crossed headers');
 const securityScan=scan(first.output,first.files);
 const previous=buildModule.buildPlaceholder({sourceRoot:path.join(workspace,'rollback-source'),env:{SIMPLE_DEPLOY_TARGET:'placeholder',SIMPLE_PAGES_PROJECT:PROJECT,SIMPLE_APP_URL:APP,CF_PAGES_BRANCH:'codex/cloudflare-production-preparation',CF_PAGES_URL:APP}});
 if(previous.treeSha256!==ROLLBACK.treeSha256)fail('rollback placeholder differs from approved deployment');
 scan(previous.output,previous.files);
 const receipt={schemaVersion:1,mode:'OFFLINE_DRY_RUN',...selected,...source,artifactDirectory:first.output,artifactTreeSha256:first.treeSha256,files:first.files,securityScan,sourceFiles:[...blobs].map(([name,content])=>({path:name,sha256:sha(content)})),rollback:{...ROLLBACK,artifactDirectory:previous.output,files:previous.files},publicFrontendSecurityValidated:false,published:false,credentialsPersisted:false};
 const receiptPath=path.join(workspace,'release.json');fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
 return {receiptPath,...receipt};
}
function readReceipt(file){
 const resolved=bounded(file);
 if(!resolved.startsWith(path.join(RESULTS,'public-release-'))||path.basename(resolved)!=='release.json')fail('receipt outside release workspace');
 const receipt=JSON.parse(fs.readFileSync(resolved,'utf8'));
 return verifyReceipt(receipt,resolved);
}
function verifyReceipt(receipt,resolved){
 if(receipt.schemaVersion!==1||receipt.mode!=='OFFLINE_DRY_RUN'||receipt.published!==false)fail('unsupported receipt');
 identity(receipt);sourceInfo(receipt.sourceCommit,receipt.sourceTree);
 const workspace=path.join(RESULTS,'public-release-'+receipt.sourceCommit);
 if(resolved!==path.join(workspace,'release.json')||receipt.artifactDirectory!==path.join(workspace,'source/dist')||receipt.rollback.artifactDirectory!==path.join(workspace,'rollback-source/dist'))fail('receipt paths do not match source identity');
 // A receipt is not a substitute for committed source: validate its expected inventories again.
 const manifest=JSON.parse(git('show',receipt.sourceCommit+':config/static-public-manifest.json'));
 const sourceBackend=JSON.parse(git('show',receipt.sourceCommit+':config/public-backends.json')).production;
 validateBackend('production',sourceBackend);
 if(JSON.stringify(receipt.files.map(f=>f.path).sort())!==JSON.stringify([...manifest.files,...manifest.generated,'_headers','404.html','robots.txt'].sort()))fail('receipt allowlist changed');
 const runtime=require('./hosting-runtime.cjs').createRuntimeConfig({target:'production',env:{SIMPLE_DEPLOY_TARGET:'production',SIMPLE_PAGES_PROJECT:PROJECT,SIMPLE_APP_URL:APP,CF_PAGES_BRANCH:'main',CF_PAGES_URL:APP}});
 if(runtime.config.supabaseUrl!==sourceBackend.url||runtime.config.supabasePublicKey!==sourceBackend.publicKey)fail('committed backend differs from reviewed runtime');
 for(const name of manifest.files){const raw=canonical(git('show',receipt.sourceCommit+':'+name),name);const item=receipt.files.find(f=>f.path===name);if(item?.sha256!==sha(raw)||item.bytes!==raw.length)fail('receipt differs from committed application');}
 const generated=receipt.files.find(f=>f.path==='assets/runtime-config.js');
 if(generated?.sha256!==sha(Buffer.from(runtime.javascript)))fail('runtime differs from approved identity/key');
 const headerTemplate=git('show',receipt.sourceCommit+':config/cloudflare/_headers.template').toString();
 const headers=canonical(Buffer.from(headerTemplate.replaceAll('{{SUPABASE_ORIGIN}}',runtime.config.supabaseUrl).replaceAll('{{SUPABASE_WEBSOCKET}}',runtime.config.supabaseUrl.replace('https:','wss:'))),'_headers');
 for(const [name,raw]of [['_headers',headers],...['404.html','robots.txt'].map(name=>[name,canonical(git('show',receipt.sourceCommit+':config/cloudflare/'+name),name)])]){
  const item=receipt.files.find(f=>f.path===name);if(item?.sha256!==sha(raw)||item.bytes!==raw.length)fail('platform file differs from committed reviewed configuration');
 }
 if(receipt.artifactTreeSha256!==sha(JSON.stringify(receipt.files)))fail('artifact tree receipt changed');
 scan(receipt.artifactDirectory,receipt.files);
 if(receipt.rollback.treeSha256!==ROLLBACK.treeSha256||receipt.rollback.deploymentId!==ROLLBACK.deploymentId||receipt.rollback.sourceCommit!==ROLLBACK.sourceCommit||sha(JSON.stringify(receipt.rollback.files))!==ROLLBACK.treeSha256)fail('rollback receipt changed');
 scan(receipt.rollback.artifactDirectory,receipt.rollback.files);
 return receipt;
}
function validateSecurityReceipt(security,receipt){
 return security?.status==='PASS'&&security.sourceTree===receipt.sourceTree&&security.artifactTreeSha256===receipt.artifactTreeSha256&&Array.isArray(security.evidence)&&security.evidence.length>0;
}
function plan({receiptPath,securityReceiptPath,rollback=false}={}){
 const receipt=readReceipt(receiptPath);
 let security=null;
 if(securityReceiptPath){security=JSON.parse(fs.readFileSync(bounded(securityReceiptPath),'utf8'));}
 const passed=validateSecurityReceipt(security,receipt);
 return {mode:'OFFLINE_DRY_RUN',published:false,backendChanges:false,publicationPermitted:false,requiresExplicitFuturePublicationAuthorization:true,publicFrontendSecurityValidated:passed,readyForFutureReview:rollback||passed,blockers:rollback?['Rollback is simulated; a remote rollback requires incident authorization and a verified Cloudflare session']: [...(!passed?['PUBLIC FRONTEND SECURITY receipt missing, blocked or bound to another source/artifact']:[]),'Fresh main approval, Auth/CORS/Google readiness and explicit publication authorization remain required','No authorized Cloudflare API/CLI executor is configured by this helper'],stages:rollback?['STOP_AUTODEPLOY','RESTORE_APPROVED_PLACEHOLDER','CHECK_BYTES_HEADERS_AND_BACKEND_ABSENT','KEEP_GITHUB_AND_PREVIOUS_ORIGINS']:['PREPARE','VALIDATE_PUBLIC_SECURITY','REVIEW_EXACT_MAIN_AUTH_CORS_GOOGLE','DEPLOY_SIMULATED_ONLY','CHECK_WITH_EXISTING_LIVE_HOSTING','ROLLBACK_SIMULATED_ONLY'],project:PROJECT,branch:'main',appUrl:APP,sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,artifactTreeSha256:receipt.artifactTreeSha256,rollback:receipt.rollback,execute:false};
}
function main(){
 const [command,...args]=process.argv.slice(2),values={};
 if(!command){console.log(JSON.stringify({mode:'OFFLINE_DRY_RUN',published:false,commands:['prepare --source FULL_SHA --tree GIT_TREE','validate --receipt PATH [--security PATH]','plan --receipt PATH [--security PATH]','rollback --receipt PATH'],executeSupported:false}));return;}
 if(!['prepare','validate','plan','rollback'].includes(command))fail('only offline prepare, validate, plan or rollback supported');
 for(let i=0;i<args.length;i+=2){if(!['--source','--tree','--receipt','--security'].includes(args[i])||!args[i+1]||Object.hasOwn(values,args[i]))fail('unknown or repeated argument; execution and credential arguments forbidden');values[args[i]]=args[i+1];}
 const result=command==='prepare'?prepare({sourceCommit:values['--source'],expectedSourceTree:values['--tree']}):plan({receiptPath:values['--receipt'],securityReceiptPath:values['--security'],rollback:command==='rollback'});
 console.log(JSON.stringify(command==='prepare'?{mode:result.mode,receiptPath:result.receiptPath,artifactDirectory:result.artifactDirectory,artifactTreeSha256:result.artifactTreeSha256,sourceCommit:result.sourceCommit,sourceTree:result.sourceTree,published:false}:result,null,2));
}
module.exports={prepare,readReceipt,verifyReceipt,plan,scan,identity,sourceInfo,validateSecurityReceipt,ROLLBACK};
if(require.main===module)try{main();}catch(error){console.error('Offline release rejected: '+(error.message?.startsWith('Release preparation:')?error.message:'invalid input or bounded filesystem operation'));process.exitCode=1;}
