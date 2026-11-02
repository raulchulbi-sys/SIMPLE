// Real unauthenticated HTTP reads. No JWT, fixture, Auth mutation or provider route.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const project='dmqjexigdnfzobarhnib',base='https://'+project+'.supabase.co';
const source=fs.readFileSync(path.join(__dirname,'../coach-pilot/preview.cjs'),'utf8');
const key=source.match(/const SUPABASE_KEY='(sb_publishable_[A-Za-z0-9_-]+)'/)?.[1];
assert(key&&source.includes(base),'Existing staging-only public client configuration required');
const checks=[];
(async()=>{
 for(const table of ['coach_operations','routine_revisions','coach_messages','routine_management','workouts']){
  const column=table==='routine_management'?'routine_id':'id';
  const r=await fetch(base+'/rest/v1/'+table+'?select='+column+'&limit=1',{headers:{apikey:key},signal:AbortSignal.timeout(15000)});
  const data=await r.json();const pass=[401,403].includes(r.status)||r.status===200&&Array.isArray(data)&&data.length===0;
  checks.push({name:'anon cannot read '+table,status:r.status,pass});assert(pass,'Anonymous row exposure: '+table);
 }
 const r=await fetch(base+'/rest/v1/rpc/get_my_coach_access',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 const data=await r.json();const pass=[401,403].includes(r.status)||r.status===200&&data?.authorized===false&&data?.can_generate!==true;
 checks.push({name:'anon cannot obtain Coach access',status:r.status,pass});assert(pass,'Anonymous Coach access');
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/staging-anon.json'),JSON.stringify({project,readOnly:true,realJWT:false,passed:checks.length,total:checks.length,checks},null,2));console.log(checks.length+'/'+checks.length+' real staging anon read-only assertions');
})().catch(e=>{console.error(e.name==='AssertionError'?e.message:'Staging read unavailable: '+e.name);process.exitCode=1;});
