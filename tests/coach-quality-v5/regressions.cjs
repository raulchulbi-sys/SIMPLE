// Run original archived regressions against THIS candidate; all outputs stay in ignored results/.
const fs=require('fs'),vm=require('vm'),path=require('path');
const archive='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
const root=path.resolve(__dirname,'../..'),suite=process.argv[2];
if(!['test-training-modes.cjs','test-session-drafts.cjs','26-test-duration.cjs'].includes(suite))throw Error('Unknown suite');
const mapRead=p=>p==='outputs/index.html'?path.join(root,'index.html'):typeof p==='string'&&p.startsWith('work/')?path.join(archive,p):p;
const fakeFs={...fs,readFileSync:(p,...args)=>fs.readFileSync(mapRead(p),...args),writeFileSync:(p,...args)=>{if(typeof p!=='string'||!p.startsWith('outputs/'))throw Error('Output path denied');return fs.writeFileSync(path.join(__dirname,'results',path.basename(p)),...args);}};
const req=n=>n==='fs'?fakeFs:require(n);
let code=fs.readFileSync(path.join(archive,'work',suite),'utf8').replace("path.resolve('work/pw-browsers')",JSON.stringify(path.join(archive,'work/pw-browsers')));
if(suite==='26-test-duration.cjs')code=code.replace('c.document.querySelectorAll=()=>[];',"c.exerciseNoteKey=e=>e.id;c.persistExerciseNote=async()=>{};c.announceCycleChange=()=>{};c.$=()=>null;c.confirmEmptyWorkout=()=>true;c.showWorkoutSaveError=message=>c.toast(message);c.document.querySelectorAll=()=>[];");
vm.runInNewContext(code,{require:req,process:{...process,argv:['node',suite,path.join(root,'index.html')],env:process.env},console,setImmediate,setTimeout,clearTimeout,Buffer,URL},{filename:suite});
