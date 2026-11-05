'use strict';
// Separate source directories and Node processes. Public input files only.
// Builds do not contact any service or publish anything.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),manifest=require('../../config/static-public-manifest.json');
const {RETURN_FILES}=require('../../scripts/hosting-commercial-build.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=path.join(__dirname,'results');fs.mkdirSync(results,{recursive:true});
const workspace=fs.mkdtempSync(path.join(results,'basic-hosting-'));
const names=[...new Set([...manifest.files,'assets/subscription-return.js','staging/subscription/return.html','config/static-public-manifest.json','config/public-backends.json','config/cloudflare/_headers.template','config/cloudflare/404.html','config/cloudflare/robots.txt','staging/return/manifest.json','staging/return/headers-append.txt',...RETURN_FILES.map(n=>'staging/return/source/'+n),'scripts/hosting-build.cjs','scripts/hosting-commercial-build.cjs','scripts/hosting-runtime.cjs','scripts/staging-return.cjs'])].sort();
const sources=names.map(name=>{const b=fs.readFileSync(path.join(root,name));return{path:name,bytes:b.length,sha256:sha(b)};});
const preview={SIMPLE_APP_URL:'https://simple-staging-raulchulbi.pages.dev/',SIMPLE_PAGES_PROJECT:'simple-staging-raulchulbi',CF_PAGES_BRANCH:'codex/cloudflare-migration',CF_PAGES_URL:'https://simple-staging-raulchulbi.pages.dev/'};
const github={SIMPLE_APP_URL:'https://raulchulbi-sys.github.io/SIMPLE/',SIMPLE_HOSTING_PROVIDER:'github'};
const checks=[],artifacts=[];
function check(name,condition){assert(condition,name);checks.push({name,pass:true});}
for(const [profile,target,env,basicValidation]of [['closed-staging','preview',preview,false],['basic-validation','preview',preview,true],['github-closed','production',github,false]]){
 const built=[];
 for(const suffix of ['A','B']){
  const dir=path.join(workspace,profile+'-'+suffix);fs.mkdirSync(dir);
  for(const record of sources){const dst=path.join(dir,record.path);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,record.path),dst);assert.equal(sha(fs.readFileSync(dst)),record.sha256,'Input changed during source snapshot');}
  const result=spawnSync(process.execPath,['scripts/hosting-commercial-build.cjs','--target',target,...(basicValidation?['--basic-validation']:[])],{cwd:dir,encoding:'utf8',shell:false,timeout:60000,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:process.env.TEMP,TMP:process.env.TMP,...env}});
  assert.equal(result.status,0,result.stderr);built.push(JSON.parse(result.stdout));
 }
 const[a,b]=built;check(profile+' independent roots and outputs',a.output!==b.output&&!a.output.startsWith(b.output+path.sep)&&!b.output.startsWith(a.output+path.sep));
 check(profile+' exact inventory and tree match',a.treeSha256===b.treeSha256&&JSON.stringify(a.files)===JSON.stringify(b.files));
 for(const file of a.files){assert.equal(sha(fs.readFileSync(path.join(a.output,file.path))),file.sha256);assert.equal(sha(fs.readFileSync(path.join(b.output,file.path))),file.sha256);}
 check(profile+' every output byte matches manifest',true);
 check(profile+' only intended commercial profile enabled',a.commercialEnabled===basicValidation&&a.readOnlyValidation===basicValidation&&a.files.length===(basicValidation?41:target==='production'?39:43));
 artifacts.push({profile,target,outputA:path.relative(root,a.output).replace(/\\/g,'/'),outputB:path.relative(root,b.output).replace(/\\/g,'/'),treeSha256:a.treeSha256,files:a.files,basicValidation,readOnlyValidation:a.readOnlyValidation,backend:a.backend});
}
check('source files remain unchanged after independent builds',sources.every(f=>sha(fs.readFileSync(path.join(root,f.path)))===f.sha256));
const report={schema:1,kind:'Basic MVP local-only reproducibility, three profiles with two independent source roots and processes each',sourceInputTreeSha256:sha(JSON.stringify(sources)),sources,passed:checks.length,failed:0,checks,artifacts};
fs.writeFileSync(path.join(results,'hosting-reproducibility.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'HOSTING-INVENTORY.json'),JSON.stringify({...report,artifacts:artifacts.map(({outputA,outputB,...r})=>r)},null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,failed:0,sourceInputTreeSha256:report.sourceInputTreeSha256,artifacts:artifacts.map(({files,...a})=>({...a,fileCount:files.length}))}));
