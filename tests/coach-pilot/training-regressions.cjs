const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a',suites=[];
for(const name of ['26-test-duration','test-duration-entry','test-session-drafts','test-concurrency','test-navigation-history','test-training-modes','test-training-flash']){
 const r=spawnSync(process.execPath,['-r',path.resolve(__dirname,'../session-edit/regression-hook.cjs'),legacy+'/work/'+name+'.cjs'],{encoding:'utf8',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:legacy+'/work/pw-browsers'},timeout:240000});
 suites.push({name,status:r.status,output:r.stdout,error:r.stderr});console.log(name,r.status,(r.stdout||'').slice(-500));fs.writeFileSync(path.join(__dirname,'results/training-regressions.json'),JSON.stringify(suites,null,2));
}if(suites.some(s=>s.status!==0))process.exitCode=1;
