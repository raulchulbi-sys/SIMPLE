const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),results=[];
const before=cp.execFileSync('git',['show','7cf24fa:index.html'],{encoding:'utf8',maxBuffer:4e6}),now=fs.readFileSync('index.html','utf8');
const normalized=now.replace('<link rel="stylesheet" href="assets/coach.css">\n','').replace("  if(typeof renderCoachHome==='function')await renderCoachHome(isCurrent);\n",'').replace('<script src="assets/coach.js"></script>\n','');
assert.equal(normalized.replaceAll('\r\n','\n'),before.replaceAll('\r\n','\n'));results.push({name:'Entire previous HTML logic unchanged except isolated Coach hook/assets',pass:true});
for(const file of ['auth.js','oauth.js','theme.js','settings.js','reorder.js'])assert.equal(fs.readFileSync('assets/'+file,'utf8').replaceAll('\r\n','\n'),cp.execFileSync('git',['show','7cf24fa:assets/'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'));results.push({name:'Existing Auth OAuth theme settings reorder byte identical',pass:true});
new vm.Script(fs.readFileSync('assets/coach.js','utf8'));results.push({name:'Coach JavaScript parses',pass:true});
for(const file of ['tests/onboarding/browser.cjs','tests/onboarding/recovery-feedback.cjs','tests/onboarding/recovery-sdk.cjs','tests/interior/oauth-sdk.cjs','tests/interior/google-button.cjs','tests/session-edit/contracts.cjs','tests/progress-cycle/contracts.cjs']){
if(process.env.COACH_SUITES&&!process.env.COACH_SUITES.split(',').includes(file))continue;fs.mkdirSync(path.join(path.dirname(file),'results'),{recursive:true});
const r=cp.spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8',timeout:300000,env:{...process.env,OAUTH_PROVIDER:'google'}});results.push({name:file,pass:r.status===0,exit:r.status,output:r.stdout,error:r.stderr});fs.writeFileSync(path.join(__dirname,'results/'+(process.env.COACH_SUITES?'regressions-retry':'regressions')+'.json'),JSON.stringify(results,null,2));console.log(file,r.status,r.stdout.slice(-300));}
if(results.some(r=>!r.pass))process.exitCode=1;
