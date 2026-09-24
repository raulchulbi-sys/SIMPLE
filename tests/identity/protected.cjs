require('fs').mkdirSync(require('path').join(__dirname,'results'),{recursive:true});
const fs=require('fs'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto'),{execFileSync}=require('child_process');
const before=execFileSync('git',['show','b774d2508816967669591e14a9bd8dba36f978ba:index.html'],{encoding:'utf8',maxBuffer:4e6}),after=fs.readFileSync('index.html','utf8'),results=[];
function test(name,fn){try{fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message})}}
const extract=require('../integration/function-source.cjs');
test('Published baseline is exact',()=>assert.equal(crypto.createHash('sha256').update(before).digest('hex'),'2b1eb12298893de6d30a7c2f1f1d60ae1682ac018f0916578dad0c6bd292b6b9'));
test('Every inline script compiles',()=>{for(const s of after.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(s[1])});
// The interior redesign explicitly changes CSS. Identity/persistence function
// equality remains mandatory below; visual isolation has its own browser suite.
for(const name of ['loadHistory','showHistory','saveEditedWorkout','saveEditor','saveClientRoutineEditor','saveWorkoutRoutineEdits','saveWorkoutDraft','persistExerciseNote','getWeeklyRoutineProgressForUser','redeemShareCode','createShareCode','deleteWorkout','formatStipulatedRest','markWorkoutStarted'])test(name+' unchanged',()=>assert.equal(extract(after,name),extract(before,name)));
const report={sha256:crypto.createHash('sha256').update(after).digest('hex'),passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results};
fs.writeFileSync('tests/identity/results/protected.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed.length)process.exitCode=1;
