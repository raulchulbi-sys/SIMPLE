const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a',out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const suites=['test-concurrency','test-session-drafts','26-test-duration','test-training-flash','test-ux-robustness','23-test-features-browser','test-duration-entry'];
const results=[];
for(const name of suites){const r=spawnSync(process.execPath,['-r',path.join(__dirname,'../session-edit/regression-hook.cjs'),legacy+'/work/'+name+'.cjs'],{encoding:'utf8',timeout:240000,windowsHide:true});results.push({name,status:r.status,output:r.stdout,error:r.stderr});console.log(name,r.status,(r.stdout||'').slice(-1600),(r.stderr||'').slice(-1500));fs.writeFileSync(path.join(out,'regressions.json'),JSON.stringify(results,null,2));}
if(results.some(r=>r.status!==0))process.exitCode=1;
