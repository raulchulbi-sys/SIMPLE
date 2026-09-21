const fs=require('fs'),path=require('path');
const legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results',process.env.SIMPLE_BASELINE?'baseline-regressions':'regressions');
fs.mkdirSync(out,{recursive:true});
const read=fs.readFileSync,write=fs.writeFileSync,resolve=path.resolve;
path.resolve=function(...args){if(args.length===1&&args[0]==='work/pw-browsers')return legacy+'/work/pw-browsers';return resolve(...args)};
fs.readFileSync=function(p,...args){
 const name=typeof p==='string'?p.replaceAll('\\','/') : '';
 if(name==='outputs/index.html'||name==='outputs/26-release/index.html')p=process.env.SIMPLE_BASELINE||path.join(root,'index.html');
 else if(name==='C:/Users/raulc/OneDrive/Escritorio/index.html')p=path.join(root,'index_cliente_editor_final_v25.html');
 else if(name.startsWith('work/')||name.startsWith('outputs/'))p=legacy+'/'+name;
 let value=read.call(this,p,...args);
 // The release retained name-based chart selectors. The archived test was
 // written for an unpublished UUID-selector candidate; exercise the actual contract.
 if(name.endsWith('23-test-features-browser.cjs')&&typeof value==='string')value=value.replaceAll("'id:E'","'Press'").replaceAll("'id:F'","'Remo'").replace("p.some(x=>x.session.id==='S')","p.some(x=>x.date.getTime()===simpleDateFromKey('2026-09-08').getTime())");
 if(name.endsWith('test-ux-robustness.cjs')&&typeof value==='string')value=value.replace('toast:s=>messages.push(s),','toast:s=>messages.push(s),$:()=>null,showWorkoutSaveError:s=>messages.push(s),confirm:()=>true,').replace("cut('function markWorkoutStarted(){'","cut('function workoutHasExecutionData(){','function showWorkoutSaveError')+cut('function markWorkoutStarted(){'");
 return value;
};
fs.writeFileSync=function(p,...args){if(typeof p==='string'&&p.replaceAll('\\','/').startsWith('outputs/'))p=path.join(out,path.basename(p));return write.call(this,p,...args)};
