const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),results=[];
const baseline='a83a2ec',show=f=>cp.execFileSync('git',['show',baseline+':'+f],{encoding:'utf8',maxBuffer:5e6}).replaceAll('\r\n','\n');
let now=fs.readFileSync('index.html','utf8').replaceAll('\r\n','\n');
for(const line of ["  if(profile?.role==='trainer'&&typeof renderCoachReviewerEntry==='function')renderCoachReviewerEntry();\n","  if(isCurrent()&&typeof renderCoachReviewerEntry==='function')await renderCoachReviewerEntry();\n",'<script src="assets/coach-reviewer.js"></script>\n'])now=now.replace(line,'');
assert.equal(now,show('index.html'));results.push({name:'Entire existing HTML unchanged except restricted reviewer hooks',pass:true});
for(const f of ['assets/auth.js','assets/oauth.js','assets/theme.js','assets/settings.js','assets/reorder.js','supabase/functions/simple-coach-mock/contract.mjs','supabase/functions/simple-coach-mock/provider.mjs'])assert.equal(fs.readFileSync(f,'utf8').replaceAll('\r\n','\n'),show(f));
results.push({name:'Auth OAuth theme settings reorder prompt schema provider byte identical',pass:true});
const suites=['tests/onboarding/browser.cjs','tests/onboarding/recovery-feedback.cjs','tests/onboarding/recovery-sdk.cjs','tests/interior/oauth-sdk.cjs','tests/interior/google-button.cjs','tests/session-edit/contracts.cjs','tests/progress-cycle/contracts.cjs','tests/coach-ai/unit.mjs'];
const previous=fs.existsSync(path.join(__dirname,'results/regressions.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'results/regressions.json'))):[];
for(const file of suites){const prior=previous.find(r=>r.name===file&&r.pass);if(process.argv.includes('--failed-only')&&prior){results.push(prior);continue;}fs.mkdirSync(path.join(path.dirname(file),'results'),{recursive:true});const r=cp.spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8',timeout:300000,env:{...process.env,OAUTH_PROVIDER:'google'}});results.push({name:file,pass:r.status===0,output:r.stdout,error:r.stderr});fs.writeFileSync(path.join(__dirname,'results/regressions.json'),JSON.stringify(results,null,2));console.log(file,r.status,r.stdout.slice(-350));}
fs.writeFileSync(path.join(__dirname,'results/regressions.json'),JSON.stringify(results,null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
