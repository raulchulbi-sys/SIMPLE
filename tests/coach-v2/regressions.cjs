const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/';
const suites=[
'tests/onboarding/browser.cjs','tests/onboarding/recovery-feedback.cjs','tests/onboarding/recovery-sdk.cjs',
'tests/interior/oauth-sdk.cjs','tests/interior/google-button.cjs',
'tests/session-edit/contracts.cjs','tests/progress-cycle/contracts.cjs',
'tests/interior/contracts.cjs','tests/polish/contracts.cjs'];
const archived=['26-test-duration','test-duration-entry','test-session-drafts','test-concurrency','test-navigation-history','test-training-modes','test-training-flash','23-test-features-browser'];
const results=[];
for(const s of suites)fs.mkdirSync(path.join(root,path.dirname(s),'results'),{recursive:true});
for(const entry of [...suites.map(s=>({name:s,args:[s]})),...archived.map(s=>({name:s,args:['-r',path.join(root,'tests/session-edit/regression-hook.cjs'),legacy+s+'.cjs']}))]){
 const previousPath=path.join(out,'regressions.json'),previous=fs.existsSync(previousPath)?JSON.parse(fs.readFileSync(previousPath)):[];
 const prior=previous.find(x=>x.name===entry.name);
 if(process.argv.includes('--failed-only')&&prior?.pass){results.push(prior);continue;}
 const result=cp.spawnSync(process.execPath,entry.args,{cwd:root,encoding:'utf8',timeout:360000,env:{...process.env,OAUTH_PROVIDER:'google',PLAYWRIGHT_BROWSERS_PATH:legacy+'pw-browsers'}});
 results.push({name:entry.name,pass:result.status===0,status:result.status,output:result.stdout,error:result.stderr});
 fs.writeFileSync(path.join(out,'regressions.json'),JSON.stringify(results.concat(previous.filter(x=>!results.some(y=>y.name===x.name))),null,2));
 console.log(entry.name+': '+(result.status===0?'PASS':'FAIL')+'\n'+(result.stdout||'').slice(-300)+(result.status!==0?'\n'+(result.stderr||'').slice(-600):''));
}
if(results.some(x=>!x.pass))process.exitCode=1;
