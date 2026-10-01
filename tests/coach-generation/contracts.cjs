// Protected behavior must remain byte-identical to the published baseline.
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),path=require('path');
const rows=[],base='c68b5c3f1ecad4eb54587f92fb49848852a352a0';const old=f=>cp.execFileSync('git',['show',base+':'+f],{maxBuffer:2e6}).toString().replaceAll('\r\n','\n');const read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
function check(n,f){f();rows.push(n);}
const files=['assets/oauth.js','assets/auth.js','assets/theme.js','assets/coach-intake.js','assets/coach-questionnaire.js','assets/coach-prescription.js','assets/coach-reviewer.js','assets/coach-programming-v4.js','assets/coach-programming-v5.js','supabase/functions/simple-coach-mock/index.ts','supabase/functions/simple-coach-mock/provider.mjs','supabase/functions/simple-coach-mock/contract-v5.mjs'];
for(const f of files)if(fs.existsSync(f))check(f+' preserves published behavior',()=>assert.equal(read(f),old(f)));
check('index only changes Coach cache version',()=>assert.equal(read('index.html').replace('coach.js?v=basic-generations-v1','coach.js?v=basic-initial-v5'),old('index.html')));
const functionText=(src,n)=>{const start=src.search(new RegExp('(?:async )?function '+n+'\\('));assert(start>=0);let end=src.slice(start+1).search(/\n(?:async )?function /);return src.slice(start,end<0?src.length:start+1+end);};
for(const n of ['renderCoachHome','openCoachRoutine','coachRevisionHints','coachReadRoutineHints','coachSave','coachPollOperation','coachRenderOperation','coachRenderProposal','coachAccept','coachFeedback'])check(n+' unchanged',()=>assert.equal(functionText(read('assets/coach.js'),n),functionText(old('assets/coach.js'),n)));
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/contracts.json'),JSON.stringify({passed:rows.length,total:rows.length,rows},null,2));console.log(rows.length+'/'+rows.length+' protected contracts');
