// One real STAGING request; session tokens only in runtime, never written or logged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'private/live-manifest.json'),'utf8'));
 const credentials=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../coach-premium-phase2/tests/premium-phase2/private/fixture.json'),'utf8'));
 assert.equal(credentials.ref,'dmqjexigdnfzobarhnib');assert.equal(manifest.user,'495fa022-d51b-4bdd-a2f8-e031409b69f5');
 const base='https://'+credentials.ref+'.supabase.co',key=credentials.key,actor=Object.values(credentials.users).find(u=>u.id===manifest.user);assert(actor);let token=null;
 async function req(route,body){const r=await fetch(base+route,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});let v;try{v=await r.json();}catch{throw Error('non_json_'+r.status);}if(!r.ok)throw Error('staging_request_'+r.status+'_'+(v.code||v.error||'rejected'));return v;}
 try{
  const auth=await req('/auth/v1/token?grant_type=password',{email:actor.email,password:actor.password});token=auth.access_token;assert.equal(auth.user.id,manifest.user);
  const result=await req('/functions/v1/simple-coach-chat',{key:crypto.randomUUID(),mesocycle_id:manifest.mesocycle,revision_id:manifest.revision,message:'Quiero revisar Dead bug y Bird dog porque los tengo excluidos en mi anamnesis. ¿Tiene sentido cambiarlos?'});
  fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/real-staging.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({state:result.message?.state,error:result.message?.error||result.error||null,turn:result.message?.id}));
 }finally{if(token){await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)}).catch(()=>{});token=null;}}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
