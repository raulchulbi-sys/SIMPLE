'use strict';
// Two independent source directories and two separate Node processes per target.
// Inputs are public allowlisted sources only; this never deploys or contacts APIs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),{RETURN_FILES}=require('../../scripts/hosting-commercial-build.cjs');
const manifest=require('../../config/static-public-manifest.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=path.join(__dirname,'results');fs.mkdirSync(results,{recursive:true});
const workspace=fs.mkdtempSync(path.join(results,'unified-reproducibility-20261104-'));
const checks=[];const check=(name,value)=>{assert(value,name);checks.push({name,pass:true});};
const inputNames=[...manifest.files,'config/static-public-manifest.json','config/public-backends.json','config/cloudflare/_headers.template','config/cloudflare/404.html','config/cloudflare/robots.txt','staging/return/manifest.json','staging/return/headers-append.txt',...RETURN_FILES.map(n=>'staging/return/source/'+n),'scripts/hosting-build.cjs','scripts/hosting-commercial-build.cjs','scripts/hosting-runtime.cjs','scripts/staging-return.cjs'].sort();
assert.equal(new Set(inputNames).size,inputNames.length);
const sourceFiles=inputNames.map(name=>{const bytes=fs.readFileSync(path.join(root,name));return {path:name,bytes:bytes.length,sha256:sha(bytes)};});
function copy(name){const to=path.join(workspace,name);fs.mkdirSync(to);for(const file of sourceFiles){const dst=path.join(to,file.path);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,file.path),dst);assert.equal(sha(fs.readFileSync(dst)),file.sha256);}return to;}
const previewEnv={SIMPLE_APP_URL:'https://simple-staging-raulchulbi.pages.dev/',SIMPLE_PAGES_PROJECT:'simple-staging-raulchulbi',CF_PAGES_BRANCH:'codex/cloudflare-migration',CF_PAGES_URL:'https://simple-staging-raulchulbi.pages.dev/'};
const productionEnv={SIMPLE_APP_URL:'https://simple-raulchulbi.pages.dev/',SIMPLE_PAGES_PROJECT:'simple-raulchulbi',CF_PAGES_BRANCH:'main',CF_PAGES_URL:'https://simple-raulchulbi.pages.dev/'};
const artifacts=[];let allSourceIdentical=true,allRootsIndependent=true;
for(const [target,variables]of [['preview',previewEnv],['production',productionEnv]]){
 const roots=['A','B'].map(n=>copy(target+'-'+n)),outputs=[];
 allRootsIndependent&&=fs.realpathSync(roots[0])!==fs.realpathSync(roots[1])&&!roots[0].startsWith(roots[1]+path.sep)&&!roots[1].startsWith(roots[0]+path.sep);
 for(const dir of roots){
  const actual=sourceFiles.map(f=>({path:f.path,bytes:fs.statSync(path.join(dir,f.path)).size,sha256:sha(fs.readFileSync(path.join(dir,f.path)))}));allSourceIdentical&&=JSON.stringify(actual)===JSON.stringify(sourceFiles);
  const execution=spawnSync(process.execPath,['scripts/hosting-commercial-build.cjs','--target',target],{cwd:dir,encoding:'utf8',shell:false,timeout:30000,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:process.env.TEMP,TMP:process.env.TMP,...variables}});
  assert.equal(execution.status,0,execution.stderr);outputs.push(JSON.parse(execution.stdout));
 }
 const [a,b]=outputs;
 check(target+' independent process outputs match exact inventories and tree SHA',a.treeSha256===b.treeSha256&&JSON.stringify(a.files)===JSON.stringify(b.files));
 const expected=[...manifest.files,...manifest.generated,'404.html','robots.txt','_headers',...(target==='preview'?RETURN_FILES:[])].sort();
 check(target+' derived inventory contains complete app Coach subscription and intended return only',JSON.stringify(a.files.map(f=>f.path))===JSON.stringify(expected)&&['assets/coach.js','assets/coach-programming-v5.js','assets/coach-premium-chat.js','assets/subscription.js','assets/auth.js'].every(n=>a.files.some(f=>f.path===n)));
 const runtime=fs.readFileSync(path.join(a.output,'assets/runtime-config.js'),'utf8'),routes=JSON.parse(runtime.match(/var routes=(\[.*\]);\n/)[1]);
 check(target+' default runtime is immutable and commercial flags remain closed',routes.length===1&&routes[0].target===target&&routes[0].billingTest!==true&&runtime.includes('Object.freeze(match)')&&a.commercialEnabled===false);
 artifacts.push({target,outputA:path.relative(root,a.output).replace(/\\/g,'/'),outputB:path.relative(root,b.output).replace(/\\/g,'/'),treeSha256:a.treeSha256,files:a.files,commercialEnabled:a.commercialEnabled,stagingReturnIncluded:a.stagingReturnIncluded});
}
check('all four independent source copies equal the unified working source inventory',allSourceIdentical);
check('independent builds share no source or output directory',allRootsIndependent);
const report={schema:1,kind:'local-only unified reproducibility; separate input directories and Node processes, no deployment',sourceInputTreeSha256:sha(JSON.stringify(sourceFiles)),sourceFiles,passed:checks.length,failed:0,checks,artifacts};
fs.writeFileSync(path.join(__dirname,'results/unified-builds-20261104.json'),JSON.stringify(report,null,2));
const publicReport={...report,artifacts:artifacts.map(({outputA,outputB,...rest})=>rest)};
fs.writeFileSync(path.join(root,'docs/commercial/UNIFIED-ARTIFACT-INVENTORY-20261104.json'),JSON.stringify(publicReport,null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,failed:0,sourceInputTreeSha256:report.sourceInputTreeSha256,artifacts:artifacts.map(({files,...rest})=>({...rest,fileCount:files.length}))}));
