require('../integration/legacy-browser.cjs');
const fs=require('fs'),path=require('path');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results',process.env.SIMPLE_BASELINE?'baseline-regressions':'regressions');
fs.mkdirSync(out,{recursive:true});
const read=fs.readFileSync,write=fs.writeFileSync,resolve=path.resolve;
// Archived unit harnesses extract individual functions. Include their new
// dependencies from the same HTML; browser suites still load the whole page.
const vm=require('vm'),run=vm.runInContext;
const source=read(process.env.SIMPLE_BASELINE||path.join(root,'index.html'),'utf8');
const helperStart=source.indexOf('function exerciseNoteKey('),helperEnd=source.indexOf('function workoutNotesKey(',helperStart);
const aliasStart=source.indexOf('function confirmedHistoricalExerciseIds('),aliasEnd=source.indexOf('function getPreviousExerciseSession(',aliasStart);
const helpers=(helperStart>=0?source.slice(helperStart,helperEnd):'')+'\n'+(aliasStart>=0?source.slice(aliasStart,aliasEnd):'');
const extract=require('../integration/function-source.cjs'),auth=read(path.join(root,'assets/auth.js'),'utf8');
vm.runInContext=function(code,...args){
 let dependencies=helpers;
 // The current frontend delegates date boundaries and save notifications to
 // shared helpers. Isolated historical harnesses must load those real helpers.
 for(const name of ['simpleCycleDateKey','announceCycleChange'])if(!code.includes('function '+name+'('))dependencies+='\n'+extract(source,name);
 if(code.includes('async function logout(){return authLogout();}')){
  // VM suites isolate application functions: supply the real extracted Auth
  // logout/reset and minimal UI doubles, retaining all concurrency assertions.
  const c=args[0];c.simpleAuth={epoch:0,busy:false};c.setAuthBusy=v=>{c.simpleAuth.busy=v};
  c.setAuthScreen=()=>{};c.resetPasswordVisibility=()=>{};c.msg=()=>{};
  c.document.querySelectorAll=()=>[];
  dependencies+='\n'+extract(auth,'authLogout')+'\n'+extract(auth,'resetAuthSession');
 }
 return run.call(this,dependencies+'\n'+code,...args);
};
path.resolve=function(...args){if(args.length===1&&args[0]==='work/pw-browsers')return legacy+'/work/pw-browsers';return resolve(...args)};
fs.readFileSync=function(p,...args){
 const name=typeof p==='string'?p.replaceAll('\\','/') : '';
 if(name==='outputs/index.html'||name==='outputs/26-release/index.html')p=process.env.SIMPLE_BASELINE||path.join(root,'index.html');
 else if(name==='C:/Users/raulc/OneDrive/Escritorio/index.html')p=path.join(root,'index_cliente_editor_final_v25.html');
 else if(name.startsWith('work/')||name.startsWith('outputs/'))p=legacy+'/'+name;
 let value=read.call(this,p,...args);
 if(name.endsWith('23-test-features-browser.cjs')&&typeof value==='string')value=value.replace("p.some(x=>x.session.id==='S')","p.some(x=>x.date.getTime()===simpleDateFromKey('2026-09-08').getTime())");
 if(name.endsWith('test-ux-robustness.cjs')&&typeof value==='string')value=value.replace('toast:s=>messages.push(s),','toast:s=>messages.push(s),$:()=>null,showWorkoutSaveError:s=>messages.push(s),confirm:()=>true,').replace("cut('function markWorkoutStarted(){'","cut('function workoutHasExecutionData(){','function showWorkoutSaveError')+cut('function markWorkoutStarted(){'");
 return value;
};
function outputPath(p){
 if(typeof p!=='string')return p;
 const normalized=p.replaceAll('\\','/'),relative=normalized.startsWith(root.replaceAll('\\','/')+'/')?normalized.slice(root.length+1):normalized;
 return relative.startsWith('outputs/')||relative.startsWith('work/')?path.join(out,path.basename(p)):p;
}
fs.writeFileSync=function(p,...args){return write.call(this,outputPath(p),...args)};
const writeAsync=fs.promises.writeFile;
fs.promises.writeFile=function(p,...args){return writeAsync.call(this,outputPath(p),...args)};
