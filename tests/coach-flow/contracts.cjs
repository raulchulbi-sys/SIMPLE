const fs=require('fs'),assert=require('assert/strict'),cp=require('child_process'),path=require('path'),crypto=require('node:crypto');
const base='b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6',checks=[];
const commercial='7b9d5709add382a47f35712c80d6744b09955ebd',coach='94c06d4e90bdb4449fde41fd6e6675e4db9d7e47',hosting='d613ba9489e02900761395d62ca245df85327cf0';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const blob=(ref,p)=>cp.execFileSync('git',['show',ref+':'+p],{encoding:'utf8'}).replaceAll('\r\n','\n');
const same=p=>{const ref=p==='assets/auth.js'?hosting:p==='assets/theme.js'?commercial:base;assert.equal(read(p),blob(ref,p),p);checks.push(p+' matches its exact approved component');};
// The second local layer intentionally reconciles the evaluator and Edge with v36.
// Their stricter eleven-file hash checks live in edge-v36-reconciliation.test.mjs.
for(const p of ['assets/auth.js','assets/oauth.js','assets/settings.js','assets/theme.js','assets/coach-questionnaire.js','assets/coach-intake.js','assets/coach-programming-v4.js','assets/coach-prescription.js','assets/coach-reviewer.js','assets/coach-premium-app.js','assets/coach-premium-adapter.js','assets/coach-premium-analysis.js','assets/coach-premium-initial.js','assets/coach-premium-initial-adapter.js','assets/coach-premium-weekly.js','supabase/functions/simple-coach-mock/contract.mjs','supabase/functions/simple-coach-mock/provider.mjs'])same(p);
const delta=(from,to)=>cp.execFileSync('git',['diff','--name-only',from,...(to?[to]:[]),'--','assets','supabase','index.html'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
// Pinned approved components, not a snapshot of HEAD: an unexpected file/body fails.
const expected=new Map();for(const [from,to]of [[base,commercial],[base,coach],[commercial,hosting]])for(const p of delta(from,to))expected.set(p,to);
assert.deepEqual(delta(base).sort(),[...expected.keys()].sort());
// Two reproduced integration defects, reviewed as an explicit byte-pinned delta.
const integrationFixes={'assets/coach.js':'00f1edda86e420e1e6c7f94fef10f04c53513b28d2557992bbcc9590667f377f','assets/coach-premium-chat.js':'52aa54f238fa1e9cb0ae8d3c44f98d0ca4b228835f38363430c9bb63fc998c0d'};
// Reviewed Basic MVP delta: pin every changed subscription source, retaining all
// existing Coach/Premium and product-inventory checks. No generic bypass.
const basicMvpFixes={
  'assets/subscription.js':'e6009c6cc7246f8808ce55d0d28e66e2d70bf23a269ccf8382836c1429a32a35',
  'assets/subscription-app.js':'9ba3fb5e7e4864a0b8d7cae18d0eab185422f69df80c613df777d3dda77b0280',
  'assets/subscription-return.js':'d0e10e24b9977f31f2a277e77ed962177628cf4fb3493c9fb72f638199eaf999',
  'assets/subscription.css':'63574dcac581d2ef151650f9e3cc82d4fae2146544b23e723a872bf66d6b798d'
};
for(const [p,ref]of expected)if(p!=='index.html'){const hash=basicMvpFixes[p]||integrationFixes[p];if(hash)assert.equal(crypto.createHash('sha256').update(read(p)).digest('hex'),hash,p+' exact integration fix');else assert.equal(read(p),blob(ref,p),p+' approved component bytes');}
checks.push('exact commercial/Coach/hosting product union and approved source bodies');
const html=read('index.html'),old=blob(hosting,'index.html');assert.equal(html.replace('basic-commercial-gate-20261104','reviewer-privacy-20261018').replace('premium-chat-reload-20261104','premium-chat-v1').replace('assets/subscription.css?v=basic-mvp-20261105','assets/subscription.css').replace('assets/subscription.js?v=basic-mvp-20261105','assets/subscription.js').replace('assets/subscription-app.js?v=basic-mvp-20261105','assets/subscription-app.js'),old);checks.push('hosting/subscription HTML retained with only approved Coach and Basic cache references');
const source=fs.readFileSync('assets/coach.js','utf8');const recovery=source.slice(source.indexOf('function coachGenerationRecovery'),source.indexOf('function coachDeleteDraft'));
assert(!/\.invoke\(|coachCall\(|\.insert\(|\.update\(|\.upsert\(|localStorage|sessionStorage/.test(recovery));checks.push('reconciliation has no writes, provider dispatch or persistent storage');
assert(recovery.includes(".eq('user_id',owner).eq('intake_id',intake)")&&recovery.includes('op.user_id!==owner')&&recovery.includes('op.intake_id!==intake'));checks.push('exact owner and intake bound in query and response');
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/contracts.json'),JSON.stringify({passed:checks.length,total:checks.length,checks},null,2));console.log(checks.length+'/'+checks.length+' current-base compatibility assertions');
