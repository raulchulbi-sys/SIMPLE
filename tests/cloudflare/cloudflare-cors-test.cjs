'use strict';
// Actual captured LIVE staging prefixes in a local VM. Never invokes the business boundary.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PROJECT}=require('./cloudflare-cors.cjs'),{prefixHandler,allowed}=require('./auth-cors.cjs');
async function run(plan){
 assert.equal(plan.projectId,PROJECT);const results=[];
 const check=async(name,fn)=>{await fn();results.push({name,pass:true});};
 for(const deployment of plan.deployments){const metadata=plan.metadata.find(fn=>fn.name===deployment.name),before=plan.before.find(fn=>fn.name===deployment.name),source=deployment.files.find(file=>file.name===deployment.entrypoint_path).content;
  const staging=prefixHandler(source,'https://'+PROJECT+'.supabase.co');
  for(const origin of [...metadata.retainedOrigins,...plan.origins])await check(deployment.name+': staging preflight '+origin,()=>allowed(staging,origin));
  for(const method of ['OPTIONS','POST'])await check(deployment.name+': foreign '+method+' remains denied',async()=>{
   const response=await staging(new Request('https://unit.example.invalid/',{method,headers:{Origin:'https://unapproved.example.invalid'}}));assert.equal(response.status,403);assert.equal((await response.json()).error,'origin_denied');
  });
  await check(deployment.name+': exact rollback, unchanged companions and JWT',async()=>{
   const rollback=plan.rollback.find(fn=>fn.name===deployment.name);assert.deepEqual(rollback.files,before.files);assert.equal(deployment.verify_jwt,true);assert.equal(rollback.verify_jwt,true);
   for(const file of before.files.filter(file=>file.name!==deployment.entrypoint_path))assert.equal(deployment.files.find(candidate=>candidate.name===file.name).content,file.content);
  });
  for(const origin of plan.origins)await check(deployment.name+': production guard rejects staging Pages origin '+origin,async()=>{
   const response=await prefixHandler(source,'https://yvguatdqncadkwewlepe.supabase.co')(new Request('https://unit.example.invalid/',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(response.status,403);assert.equal((await response.json()).error,deployment.name==='simple-coach-mock'?'origin_denied':'staging_only');
  });
 }
 return{kind:'Captured LIVE staging source + exact Pages CORS additions in local VM only; no remote requests or provider',projectId:PROJECT,origins:plan.origins,passed:results.length,failed:0,results};
}
module.exports={run};
if(require.main===module){const args=process.argv.slice(2);assert(args.length===1,'Usage: node tests/cloudflare/cloudflare-cors-test.cjs private-plan.json');
 run(JSON.parse(fs.readFileSync(path.resolve(args[0]),'utf8'))).then(report=>{const out=path.join(__dirname,'results/cloudflare-https-cors-local.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:0,output:out}));}).catch(error=>{console.error('Local Cloudflare CORS verification failed: '+error.message);process.exitCode=1;});
}
