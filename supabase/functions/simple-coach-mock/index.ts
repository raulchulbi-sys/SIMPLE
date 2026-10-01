// Name retained from 1A for compatibility. Closed pilot; all access checked server-side.
import {DEFAULT_MODEL,MODELS,safetyGate} from './contract.mjs';
import {generate} from './provider.mjs';
const URL=Deno.env.get('SUPABASE_URL')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL=Deno.env.get('COACH_OPENAI_MODEL')||DEFAULT_MODEL;
const production=URL==='https://yvguatdqncadkwewlepe.supabase.co';
const staging=URL==='https://dmqjexigdnfzobarhnib.supabase.co';
const allowed=new Set(production?['https://raulchulbi-sys.github.io']:['http://127.0.0.1:4194','http://localhost:4194','http://127.0.0.1:4195','http://localhost:4195']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.has(origin)?origin:'',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!production&&!staging)return reply({error:'environment_denied'},403);
 if(origin&&!allowed.has(origin))return reply({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const auth=req.headers.get('authorization')||'';
 let op:any,user:any,claimed=false;
 async function rpc(name:string,body:unknown,service=false){
  const r=await fetch(URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service?SERVICE:ANON,Authorization:service?'Bearer '+SERVICE:auth,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw Error(data.message||'coach_request_failed');return data;
 }
 const publicOp=(o:any)=>({id:o.id,state:o.state,error_code:o.error_code,proposal:o.proposal,prompt_version:o.prompt_version,routine_id:o.routine_id});
 try{
  const identity=await fetch(URL+'/auth/v1/user',{headers:{apikey:ANON,Authorization:auth},signal:AbortSignal.timeout(10000)});
  if(!identity.ok)return reply({error:'not_authenticated'},401);
  user=await identity.json();if(!user.id)return reply({error:'not_authenticated'},401);
  const raw=await req.text();if(raw.length>2048)return reply({error:'invalid_request'},400);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'invalid_request'},400);}
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='intake_id,key'||![body.intake_id,body.key].every(v=>typeof v==='string'&&uuid.test(v)))return reply({error:'invalid_request'},400);
  if(MODEL!==DEFAULT_MODEL||!Object.hasOwn(MODELS,MODEL))return reply({error:'coach_configuration_unavailable'},503);
  op=await rpc('reserve_basic_generation',{p_intake_id:body.intake_id,p_key:body.key});
  if(op.state!=='reserved')return reply({operation:publicOp(op)});
  const claim=await rpc('coach_backend_claim',{p_user:user.id,p_operation:op.id,p_model:MODEL},true);
  if(!claim.claimed)return reply({operation:publicOp(op)},202);
  claimed=true;
  const error=safetyGate(claim.context);
  const result=error?{proposal:null,error_code:error,latency_ms:0,attempts:[]}:
   await generate(claim.context,{key:Deno.env.get('OPENAI_API_KEY'),model:MODEL});
  op=await rpc('coach_backend_finish',{p_user:user.id,p_operation:op.id,p_proposal:result.proposal,p_error:result.error_code,p_latency_ms:result.latency_ms,p_attempts:result.attempts},true);
  // Only authenticated synthetic staging participants may inspect a rejected candidate.
  // Never persisted as an approvable proposal, never enabled on production.
  const diagnostic=staging&&/^coach-q5-[0-9a-f-]+@example\.invalid$/.test(user.email||'')&&'rejected_proposal' in result
   ?{proposal:result.rejected_proposal,quality:result.quality}:undefined;
  return reply({operation:publicOp(op),...(diagnostic?{diagnostic}:{})});
 }catch(e){
  // If finish is uncertain, let the reservation expire. Never overwrite its receipt with invented zero usage.
  const message=e instanceof Error?e.message:'';
  const safe=!claimed&&/^coach_[a-z_]+$/.test(message)?message:'coach_request_failed';
  return reply({error:safe},safe==='coach_rate_limit'?429:400);
 }
});
