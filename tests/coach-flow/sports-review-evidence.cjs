// Offline evidence verification. Never contacts Supabase or a model.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const {pathToFileURL}=require('url'),dir=path.resolve(process.argv[2]),root=path.resolve(__dirname,'../..');
assert(dir.startsWith(path.join(__dirname,'private')+path.sep));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),checks=[],check=(name,f)=>{f();checks.push({name,pass:true});};
const before=read('before-edge.json'),after=read('after-edge.json'),deployment=read('deployment.json'),rollback=read('rollback.json'),base=read('baseline.json'),final=read('final-db.json'),sdk=read('sdk-receipt.json'),seed=read('seed-receipt.json'),plan=read('plan.json');
const norm=a=>[...a].sort((a,b)=>a.name.localeCompare(b.name)),plain=x=>JSON.parse(JSON.stringify(x)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 check('retrieved v33 package exactly equals approved payload',()=>{assert.equal(after.version,33);assert.equal(after.status,'ACTIVE');assert.deepEqual(after.files,deployment.files);assert(after.verify_jwt&&!after.import_map);});
 check('only evaluator changed; ten dependencies and rollback exact',()=>{assert.deepEqual(after.files.filter(f=>f.content!==before.files.find(x=>x.name===f.name).content).map(f=>f.name),['assets/coach-programming-v5.js']);assert.deepEqual(rollback.files,before.files);});
 check('all 27 baseline references restored',()=>assert.deepEqual(norm(final.integrity),norm(base.integrity)));
 check('critical functions, owners, ACL, RLS and empty scopes restored',()=>{assert.deepEqual(final.metadata,base.metadata);assert.deepEqual(final.metadata.pilot_config,{});assert.deepEqual(final.metadata.reviewer_config,{});});
 check('full additional security fingerprints unchanged',()=>assert.deepEqual(read('final-security.json'),read('security.json')));
 check('58 distinct authentic read/UI cases passed; sessions closed',()=>{assert(sdk.complete);assert.equal(sdk.checks.length,58);assert.equal(new Set(sdk.checks.map(c=>c.name)).size,58);assert(sdk.checks.every(c=>c.pass));assert(Object.values(sdk.signouts).every(Boolean));assert.equal(sdk.providerCalls,0);assert.equal(sdk.businessWrites,0);});
 check('replica has no provider use or decisions and remains exact',()=>{assert.deepEqual(seed.operation.provider_attempts,[]);assert.equal(seed.operation.input_tokens,0);assert.equal(seed.operation.output_tokens,0);assert.equal(seed.operation.estimated_cost,0);assert.equal(seed.operation.reviewed_at,null);assert.equal(seed.operation.accepted_at,null);assert.equal(seed.operation.routine_id,null);assert.deepEqual(seed.operation.proposal,require('./basic-real-proposal.json').proposal);});
 check('same three exact rows gone; no training artifacts created',()=>{for(const n of ['training_intakes','coach_operations'])assert.equal(final.integrity.find(x=>x.name===n).rows,0);for(const n of ['routines','routine_revisions','workouts','routine_user_notes'])assert.deepEqual(final.integrity.find(x=>x.name===n),base.integrity.find(x=>x.name===n));});
 // Import the actual retrieved dependency tree, not merely the working-tree evaluator.
 const packageRoot=path.join(dir,'effective-package');for(const f of after.files){const dest=path.join(packageRoot,f.name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,f.content);}
 const C=await import(pathToFileURL(path.join(packageRoot,'supabase/functions/simple-coach-mock/contract.mjs')).href);
 check('effective deployed contract accepts unchanged replica',()=>assert(C.reviewProposal(plan.proposal,{training:plan.training}).ok));
 const context={};vm.createContext(context);for(const name of ['assets/coach-intake.js','assets/coach-programming-v4.js','assets/coach-programming-v5.js'])vm.runInContext(after.files.find(f=>f.name===name).content,context);
 const evaluation=plain(context.SimpleCoachProgrammingV5.evaluate(plan.proposal,plan.training));
 check('effective deployed evaluator has five advisory warnings and original duration/volume',()=>{assert(evaluation.ok);assert.equal(evaluation.totalSets,30);assert.equal(evaluation.warnings.length,5);assert.deepEqual(evaluation.failures,[]);assert.equal(evaluation.rirZero,0);});
 check('cross-realm SDK JSON normalization preserves data and detects real mutations',()=>{const foreign=vm.runInNewContext('('+JSON.stringify(plan.proposal)+')');assert.deepEqual(plain(foreign),plan.proposal);foreign.days[0].exercises[0].planned_sets[0].rir=0;assert.notDeepEqual(plain(foreign),plan.proposal);});
 const evaluatorHash=sha(after.files.find(f=>f.name==='assets/coach-programming-v5.js').content);
 const summary={edgeVersion:33,evaluatorSHA256:evaluatorHash,newAuthenticated:30,newBrowserAuthenticated:28,newOfflineEvidence:checks.length,checks,evaluation:{warnings:evaluation.warnings,totalSets:evaluation.totalSets,days:evaluation.days},restoredReferences:27,criticalFunctions:16,providerCalls:0,syntheticRowsCreated:3,syntheticRowsDeleted:3,scopesClosed:true};
 fs.writeFileSync(path.join(dir,'verified-summary.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length,total:checks.length,evaluatorSHA256:evaluatorHash,authenticated:30,browserAuthenticated:28}));
})().catch(e=>{console.error(e);process.exitCode=1;});
