'use strict';
// Reviewed local-only suites. No credentials, package installation or remote API.
const {spawn,spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
async function withServer(file,env,suites){
 const server=spawn(process.execPath,[file],{cwd:root,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('local_preview_timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('error',e=>{clearTimeout(timer);reject(e);});server.once('exit',()=>{clearTimeout(timer);reject(Error('local_preview_exited'));});});
  for(const suite of suites){const r=spawnSync(process.execPath,[suite],{cwd:root,env:{...process.env,...env},windowsHide:true,stdio:'inherit',timeout:240000});if(r.status!==0||r.error)throw Error('Local regression failed: '+suite);}
 }finally{server.kill();}
}
(async()=>{
 await withServer('tests/client-routine/preview.cjs',{SIMPLE_PREVIEW_PORT:'4280',SIMPLE_PREVIEW_URL:'http://127.0.0.1:4280/'},['tests/client-routine/browser.cjs']);
 await withServer('tests/coach-flow/preview-offline.cjs',{COACH_PORT:'4266'},['tests/coach-flow/recovery.cjs','tests/coach-flow/journey.cjs']);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
