// Archived fixed-commit assertions are executed unchanged against baseline AND candidate.
// Reports comparability rather than weakening old assertions to accommodate later approved releases.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const baseline='df9ac7d',tests=['tests/interior/contracts.cjs','tests/polish/contracts.cjs'];
const gitRead=f=>cp.execFileSync('git',['show',baseline+':'+f],{maxBuffer:8e6});
function run(file,asBaseline){
 let report;
 const readFile=(f,opt)=>{const out=asBaseline?gitRead(String(f).replaceAll('\\','/')):fs.readFileSync(f);return opt?out.toString(typeof opt==='string'?opt:opt.encoding):out};
 const fakeFs={...fs,readFileSync:readFile,mkdirSync(){},writeFileSync(_f,value){report=JSON.parse(value)}};
 const localProcess={...process,exitCode:0};
 const script=new vm.Script(gitRead(file).toString(),{filename:file});
 script.runInNewContext({require:n=>n==='fs'?fakeFs:require(n),process:localProcess,console:{log(){},error(){}},__dirname:path.resolve(path.dirname(file))});
 if(!report)throw Error('No report from '+file);
 return {passed:report.passed,failed:(report.failed||[]).map(r=>({name:r.name,error:r.error.split('\n')[0]}))};
}
const comparisons=tests.map(file=>{
 const before=run(file,true),after=run(file,false);
 assert.deepEqual(after.failed.map(r=>r.name),before.failed.map(r=>r.name),'Candidate adds an archived-contract failure: '+file);
 return {file,baseline:before,candidate:after,sameFailureSet:true};
});
const files=['index.html','assets/auth.js','assets/oauth.js','assets/theme.js','assets/theme.css','assets/settings.js','assets/settings.css','assets/interior.css','assets/auth.css','assets/reorder.js'];
for(const file of files)assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),gitRead(file).toString().replace(/\r\n/g,'\n'),'Non-Coach source changed: '+file);
fs.mkdirSync('tests/coach-v2/results',{recursive:true});
fs.writeFileSync('tests/coach-v2/results/legacy-contract-audit.json',JSON.stringify({baseline,comparisons,unchangedFiles:files},null,2));
console.log(JSON.stringify({comparisons,unchangedFiles:files.length},null,2));
