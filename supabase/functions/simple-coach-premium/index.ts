import * as Series from './series-contract.mjs';
import * as Weekly from './weekly-contract.mjs';
const URL=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=new Set(['http://127.0.0.1:4233','http://localhost:4233','http://127.0.0.1:4241','http://localhost:4241','http://127.0.0.1:4251','http://localhost:4251']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',auth=req.headers.get('authorization')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.has(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
 if(URL!=='https://dmqjexigdnfzobarhnib.supabase.co')return reply({error:'staging_only'},403);
 if(origin&&!allowed.has(origin))return reply({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 async function rpc(name:string,body:unknown,service=false){const r=await fetch(URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service?SERVICE:ANON,Authorization:service?'Bearer '+SERVICE:auth,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const v=await r.json();if(!r.ok)throw Error(/^premium_[a-z_]+$/.test(v.message||'')?v.message:'premium_request_failed');return v;}
 const visible=(r:any)=>({id:r.id,kind:r.kind,state:r.state,facts:r.facts,interpretation:r.interpretation,patches:r.patches,analysis_trace:r.analysis_trace});
 try{
  const identity=await fetch(URL+'/auth/v1/user',{headers:{apikey:ANON,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!identity.ok)return reply({error:'not_authenticated'},401);const user=await identity.json();
  const raw=await req.text();if(raw.length>1024)return reply({error:'invalid_request'},400);let body;try{body=JSON.parse(raw);}catch{return reply({error:'invalid_request'},400);}
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const shape=body&&Object.keys(body).sort().join(','),requestedWeekly=shape==='key,mesocycle_id,mode'&&body.mode==='weekly';
  if(!body||!(shape==='key,mesocycle_id'||requestedWeekly)||![body.key,body.mesocycle_id].every(x=>typeof x==='string'&&uuid.test(x)))return reply({error:'invalid_request'},400);
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return reply({error:'configuration_error'},503);
  const r=await rpc(requestedWeekly?'premium_weekly_reserve_analysis':'premium_reserve_analysis',{p_mesocycle:body.mesocycle_id,p_key:body.key});if(r.state!=='analyzing')return reply({recommendation:visible(r)});
  const ctx=r.analysis_bundle.provider,actualWeekly=ctx?.schema_version===Weekly.PROVIDER_VERSION,contract=actualWeekly?Weekly:Series;
  // A malformed/minimization-failing weekly context must not consume a provider call.
  if(requestedWeekly&&!actualWeekly||actualWeekly&&!Weekly.contextQuality(ctx).ok){
   const claim=await rpc('premium_analysis_claim',{p_user:user.id,p_id:r.id,p_input_bound:100,p_mode:'mock'},true);if(!claim.claimed)return reply({recommendation:visible(r)},202);
   const final=await rpc('premium_analysis_finish',{p_user:user.id,p_id:r.id,p_output:null,p_error:'invalid_weekly_context',p_receipt:{transport:'no_provider_dispatch'},p_warnings:[]},true);
   return reply({recommendation:visible(final)});
  }
  const bytes=new TextEncoder().encode(JSON.stringify(contract.requestBody(ctx))).length;
  // UTF-8 bytes plus overhead is a conservative token upper bound, including schema.
  const claim=await rpc('premium_analysis_claim',{p_user:user.id,p_id:r.id,p_input_bound:bytes+2048,p_mode:'openai'},true);if(!claim.claimed)return reply({recommendation:visible(r)},202);
  const result=await contract.analyze(claim.provider,key,fetch);
  const final=await rpc('premium_analysis_finish',{p_user:user.id,p_id:r.id,p_output:result.output,p_error:result.error,p_receipt:result.receipt,p_warnings:result.quality?.warnings||[]},true);
  return reply({recommendation:visible(final)});
 }catch(e){const message=e instanceof Error?e.message:'';return reply({error:/^premium_[a-z_]+$/.test(message)?message:'premium_request_failed'},message==='premium_budget_exhausted'?429:400);}
});
