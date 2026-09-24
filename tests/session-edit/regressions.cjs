const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
const files=['26-test-duration','test-concurrency','test-navigation-history','history-tests','test-session-drafts','test','test-ux-robustness','23-test-features-browser','test-trainer-structure','26-test-unified-editor','test-duration-entry','test-training-modes','test-training-flash','26-phase2-browser','26-phase3-browser','26-browser-tests'];
const suites=[];fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
for(const name of files){
 // The explicit exercise aliases supersede five name-based negative assertions.
 // The versioned contract adds equivalent negatives for unconfirmed UUIDs.
 const script=name==='history-tests'?path.join(__dirname,'../exercise-alias/history-contract.cjs'):legacy+'/work/'+name+'.cjs';
 const r=spawnSync(process.execPath,['-r',path.join(__dirname,'regression-hook.cjs'),script],{encoding:'utf8',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:legacy+'/work/pw-browsers'},timeout:240000});suites.push({name,script,status:r.status,output:r.stdout,error:r.stderr});console.log(name,r.status,(r.stdout||'').slice(-1100));fs.writeFileSync(path.join(__dirname,'results/regression-run.json'),JSON.stringify(suites,null,2));
}if(suites.some(s=>s.status!==0))process.exitCode=1;
