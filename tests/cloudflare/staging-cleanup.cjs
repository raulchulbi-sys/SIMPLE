'use strict';
// Coordinator recovery of exactly two task-created identities. No create/seed/API route.
const fs=require('node:fs'),assert=require('node:assert/strict');
const REF='dmqjexigdnfzobarhnib',URL='https://'+REF+'.supabase.co',REVIEWER='6b47ae02-6574-46db-acdb-f00925efdd74';
const KEY=require('../../config/public-backends.json').staging.publicKey,EDGE='/functions/v1/simple-cloudflare-hosting-qa';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function run({ids,reviewerFile,fetchImpl=fetch,readCredentials=file=>fs.readFileSync(file,'utf8')}={}){
 assert(Array.isArray(ids)&&ids.length===2&&new Set(ids).size===2&&ids.every(id=>UUID.test(id)&&id!==REVIEWER),'exact_fixture_ids_required');
 let loaded=JSON.parse(readCredentials(reviewerFile));assert.equal(loaded.ref,REF);assert.equal(loaded.users?.reviewer?.id,REVIEWER);
 let reviewer={email:loaded.users.reviewer.email,password:loaded.users.reviewer.password};loaded=null;
 assert.equal(typeof reviewer.email,'string');assert.equal(typeof reviewer.password,'string');
 let token=null,result=null;
 async function request(route,body,access){
  assert(['/auth/v1/token?grant_type=password','/auth/v1/logout?scope=local',EDGE].includes(route),'cleanup_route_denied');
  const r=await fetchImpl(URL+route,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  let data;try{data=await r.json();}catch{data=null;}return{ok:r.ok,status:r.status,data};
 }
 try{
  const login=await request('/auth/v1/token?grant_type=password',reviewer);
  assert(login.ok&&login.data?.user?.id===REVIEWER,'controlled_reviewer_login_failed');token=login.data.access_token;
  const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));assert.equal(claims.sub,REVIEWER);assert.equal(claims.role,'authenticated');assert.equal(claims.iss,URL+'/auth/v1');
  login.data.access_token=null;login.data.refresh_token=null;reviewer=null;
  const cleaned=await request(EDGE,{action:'cleanup',ids},token);
  if(!cleaned.ok)throw Error(/^[a-z_]+$/.test(cleaned.data?.error||'')?cleaned.data.error:'controlled_fixture_cleanup_failed');
  assert(Array.isArray(cleaned.data?.deleted)&&JSON.stringify([...cleaned.data.deleted].sort())===JSON.stringify([...ids].sort()),'cleanup_identity_mismatch');
  result={project:REF,deleted:[...ids],reviewer_local_logout:false,credentials_erased:true,tokens_persisted:false};
 }finally{
  try{if(token){const out=await request('/auth/v1/logout?scope=local',undefined,token),code=out.data?.error_code||out.data?.code;
   const ok=out.ok||out.status===401||(out.status===403&&['session_not_found','session_missing'].includes(code));
   if(result)result.reviewer_local_logout=ok;if(!ok){const error=Error('reviewer_local_logout_failed');error.deleted=result?.deleted||[];throw error;}
  }}finally{token=null;reviewer=null;}
 }
 return result;
}
module.exports={run};
if(require.main===module){const ids=process.argv.slice(2);run({ids,reviewerFile:process.env.SIMPLE_STAGE_REVIEWER_FILE})
 .then(result=>console.log(JSON.stringify(result)))
 .catch(error=>{console.error(JSON.stringify({error:/^[a-z_]+$/.test(error.message||'')?error.message:'controlled_cleanup_failed',...(Array.isArray(error.deleted)?{deleted:error.deleted}:{})}));process.exitCode=1;});}
