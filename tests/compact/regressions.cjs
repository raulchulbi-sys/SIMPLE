// Focused existing suites: identity/history, concurrency, navigation, drafts and training/editor behavior.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
const names=['26-test-duration','test-concurrency','test-navigation-history','test-session-drafts','test-training-modes','26-test-unified-editor','history-tests','26-browser-tests'],results=[];
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
for(const name of names){const script=name==='history-tests'?path.join(__dirname,'../exercise-alias/history-contract.cjs'):legacy+'/work/'+name+'.cjs';const r=spawnSync(process.execPath,['-r',path.join(__dirname,'../session-edit/regression-hook.cjs'),script],{encoding:'utf8',timeout:240000});results.push({name,code:r.status,passed:Number(r.stdout.match(/"passed"\s*:\s*(\d+)/)?.[1]||0),output:r.stdout,error:r.stderr});fs.writeFileSync(path.join(__dirname,'results/regressions.json'),JSON.stringify(results,null,2));console.log(name,r.status,results.at(-1).passed);if(r.status!==0){process.exitCode=1;break}}
