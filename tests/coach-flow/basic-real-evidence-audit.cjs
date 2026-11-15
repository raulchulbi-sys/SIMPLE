// Read-only audit of the preserved 2026-10-28 real trial. Never calls any service.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const dir=path.resolve(__dirname,'private/basic-real-20261028');
const names=fs.readdirSync(dir).filter(n=>fs.statSync(path.join(dir,n)).isFile());
const hash=n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex');
const before=Object.fromEntries(names.map(n=>[n,hash(n)]));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const b=read('baseline.json'),f=read('final-db.json'),r=read('reconciled.json'),s=read('sdk-receipt.json'),p=read('plan.json'),a=read('provider-receipt.json');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch{console.error('FAIL '+name+' (private details suppressed)');process.exitCode=1;}}
check('matching staging identity and trial references',()=>{
 assert.equal(b.project,'dmqjexigdnfzobarhnib');assert.equal(b.verifiedProjectName,'SIMPLE Security Test');
 assert.equal(r.project,b.project);assert.equal(p.project,b.project);assert.equal(r.run,p.run);
 assert.equal(r.operation.user_id,p.actors.mock);assert.equal(r.operation.intake_id,r.intake.id);
 assert.equal(r.operation.idempotency_key,p.key);assert.deepEqual(r.operation.grant_ids,[r.grant.id]);
 assert.deepEqual(r.intake.training,p.training);
});
check('one counted request and one successful provider dispatch',()=>{
 assert.equal(a.count_attempts,1);assert.equal(a.generation_dispatches,1);
 assert.equal(r.operation.provider_attempts.length,1);assert.equal(r.operation.provider_attempts[0].status,200);
 assert.equal(Object.values(r.counts).reduce((n,x)=>n+x.edges,0),1);
 assert.equal(a.reason,'receipt_within_limits');assert.equal(a.receipt.tier,'default');
 assert.equal(a.receipt.model,'gpt-5.4-2026-03-05');assert.equal(r.operation.prompt_version,'basic-initial-v5');
});
check('provider usage and calculated token cost agree',()=>{
 assert.equal(a.input_tokens_counted,2454);assert.equal(a.receipt.input_tokens,2454);assert.equal(a.receipt.output_tokens,2050);
 assert.equal(a.receipt.cached_tokens,0);assert.equal(r.operation.input_tokens,2454);assert.equal(r.operation.output_tokens,2050);
 assert.equal((2454*2.5+2050*15)/1e6,0.036885);assert.equal(r.calculatedTokenCostUSD,0.036885);
 assert.equal(r.operation.estimated_cost,0.036885);assert.deepEqual(r.providerReceipt,a);
});
check('24 preserved authenticated checks and four signouts',()=>{
 assert.equal(s.checks.length,24);assert(s.checks.every(x=>x.pass));assert(s.completed);
 assert.equal(Object.keys(s.signouts).length,4);assert(Object.values(s.signouts).every(Boolean));
});
check('proposal preserved, V5 passed, never approved or accepted',()=>{
 assert.deepEqual(s.operation.proposal,r.operation.proposal);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(r.operation.proposal)).digest('hex'),r.proposalSHA256);
 assert.equal(r.operation.state,'pending_review');assert.equal(r.operation.reviewed_at,null);
 assert.equal(r.operation.accepted_at,null);assert.equal(r.operation.routine_id,null);
 assert(r.validation.ok);assert.deepEqual(r.validation.failures,[]);assert.deepEqual(r.validation.warnings,[]);
 assert.equal(r.validation.totalSets,30);
});
check('27 baseline count/hash references restored',()=>{
 assert.equal(b.integrity.length,27);assert.deepEqual(f.integrity,b.integrity);
 for(const n of ['training_intakes','coach_operations'])assert.equal(f.integrity.find(x=>x.name===n).rows,0);
});
check('16 critical definitions, owners, ACLs and configuration restored',()=>{
 assert.equal(b.metadata.functions.length,16);assert.deepEqual(f.metadata,b.metadata);
 assert.deepEqual(f.metadata.pilot_config,{});assert.deepEqual(f.metadata.reviewer_config,{});
});
check('full recorded security fingerprints and stable actors restored',()=>{
 assert.deepEqual(read('security.json'),read('final-security.json'));
 assert.deepEqual(f.actors,b.actors);assert.deepEqual(f.read_rpcs,b.read_rpcs);
 assert.equal(f.health_rows,b.health_rows);assert.equal(f.feedback_rows,b.feedback_rows);
});
check('three exact cleanup targets and preserved private receipts',()=>{
 const sql=fs.readFileSync(path.join(dir,'cleanup.sql'),'utf8');
 for(const [table,row] of [['coach_operations',r.operation],['training_intakes',r.intake],['context_grants',r.grant]])
 assert(sql.includes("delete from public."+table+" where id='"+row.id+"'::uuid"));
 assert.equal((sql.match(/delete from public\./g)||[]).length,3);assert(r.reconciled);
});
check('all original evidence files remain byte-identical',()=>{
 assert.deepEqual(Object.fromEntries(names.map(n=>[n,hash(n)])),before);
});
console.log(JSON.stringify({offlineEvidenceChecks:10,passed,providerCalls:0,databaseCalls:0,originalEvidenceUnmodified:before&&passed===10}));
