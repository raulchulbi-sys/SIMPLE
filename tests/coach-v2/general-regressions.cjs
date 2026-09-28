// Additional coverage only: main regressions.cjs already covers Auth, session lifecycle, codes and drafts.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),port='4261';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync('tests/progress-cycle/results',{recursive:true});
const server=cp.spawn(process.execPath,['tests/coach-v2/general-preview.cjs'],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,COACH_GENERAL_PORT:port}});
const results=[];
(async()=>{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',n=>reject(Error('preview exited '+n)));});
 try{
  for(const suite of (process.argv.includes('--polish-only')?['tests/polish/browser.cjs']:['tests/progress-cycle/interactions.cjs','tests/polish/browser.cjs'])){
   const result=cp.spawnSync(process.execPath,[suite],{cwd:root,encoding:'utf8',timeout:900000,env:{...process.env,SIMPLE_PREVIEW_URL:'http://127.0.0.1:'+port+'/',SIMPLE_PUBLIC_URL:'',POLISH_WIDTHS:'320,360,390,430,1280',SIMPLE_SKIP_SCREENSHOTS:'1'}});
   const source=suite.includes('interactions')?'tests/progress-cycle/results/interactions.json':'tests/polish/results/browser.json';
   const report=fs.existsSync(source)?JSON.parse(fs.readFileSync(source,'utf8')):null;
   results.push({suite,pass:result.status===0,status:result.status,passed:report?.passed,failed:report?.failed,output:result.stdout,error:result.stderr});
   fs.writeFileSync(path.join(out,process.argv.includes('--polish-only')?'polish-rerun.json':'general-regressions.json'),JSON.stringify(results,null,2));
   console.log(suite+': '+(result.status===0?'PASS':'FAIL')+' '+JSON.stringify({passed:report?.passed,failed:report?.failed}));
  }
 }finally{server.kill();}
 if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{server.kill();console.error(e.message);process.exitCode=1});
