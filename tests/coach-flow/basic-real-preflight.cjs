// Preparation only. No credentials, network, SDK sessions, SQL writes or activation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
globalThis.fetch=()=>{throw Error('Network forbidden in offline preparation');};
(async()=>{
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 const G=await import('../../supabase/functions/simple-coach-mock/staging-cost-guard.mjs');
 const I=globalThis.SimpleCoachIntakeV5;
 const training=JSON.parse(fs.readFileSync(path.join(__dirname,'basic-real-intake.json'),'utf8'));
 assert.deepEqual(I.basicErrors(training),[]);
 assert.equal(C.safetyGate({training}),null);
 const wire=G.prepareBoundedRequest({training},C.DEFAULT_MODEL).wire,body=JSON.parse(wire),context=JSON.parse(body.input[0].content);
 assert.equal(body.model,'gpt-5.4-2026-03-05');assert.equal(C.PROMPT_VERSION,'basic-initial-v5');
 assert.equal(body.max_output_tokens,5120);assert.equal(body.store,false);
 assert.equal(body.reasoning.effort,'low');assert.equal(body.text.format.strict,true);
 assert.deepEqual(context.session_days,['mon','wed','fri']);
 assert.deepEqual(context.training,training);
 assert(!body.tools&&!body.previous_response_id&&!body.conversation);
 assert(context.catalogue.every(e=>!training.excluded.includes(e[0])));
 const snapshotFile=path.join(__dirname,'private/basic-real-preparation-edge.json');
 const sources=fs.existsSync(snapshotFile)?JSON.parse(fs.readFileSync(snapshotFile,'utf8')):null;
 let comparisons=[];
 if(sources){
 assert.equal(sources.slug,'simple-coach-mock');assert.equal(sources.verify_jwt,true);
 comparisons=sources.files.map(f=>{const local=fs.readFileSync(path.join(root,f.name),'utf8').replaceAll('\r\n','\n'),remote=f.content.replaceAll('\r\n','\n');return {file:f.name,equal:local===remote,equalIgnoringTrailingWhitespace:local.trimEnd()===remote.trimEnd()};});
 // CORS entrypoint is managed separately by hosting. Never deploy the local entrypoint over staging.
 assert(comparisons.filter(x=>!x.file.endsWith('/index.ts')).every(x=>x.equalIgnoringTrailingWhitespace),'Deployed generator differs: stop preparation');
 const localEntry=require('node:child_process').execFileSync('git',['show','3183b36:supabase/functions/simple-coach-mock/index.ts'],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
 const remoteEntry=sources.files.find(f=>f.name.endsWith('/index.ts')).content.replaceAll('\r\n','\n');
 assert.equal(localEntry.replace(/^const allowed=.*$/m,''),remoteEntry.replace(/^const allowed=.*$/m,''),'Unexpected entrypoint change beyond known staging CORS origins');
 }
 const bytes=Buffer.byteLength(wire),proxyInput=bytes+4096;
 const report={preparationOnly:true,providerCalls:0,edgeCalls:0,credentialRead:false,model:body.model,prompt:C.PROMPT_VERSION,
   requestSha256:hash(wire),requestUtf8Bytes:bytes,catalogueExercises:context.catalogue.length,
   outputLimit:body.max_output_tokens,preparedInputTokenLimit:G.LIMITS.inputTokens,preparedRequestBytesLimit:G.LIMITS.requestBytes,existingDeployedInputTokenLimit:null,existingDollarLimit:null,
   byteProxyIncludingMargin:proxyInput,byteProxyCostUSD:(proxyInput*2.5+5120*15)/1e6,
   proxyIsNotProviderTokenCount:true,proposedCountedInputLimit:12000,proposedStandardTokenCostCeilingUSD:0.1068,
   ceilingRequiresDeploymentAndSuccessfulServerCountAndStandardPricing:true,edgeVersion:sources?.version??null,deploymentSnapshotChecked:!!sources,comparisons};
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'results/basic-real-preparation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
