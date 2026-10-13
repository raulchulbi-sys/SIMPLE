import * as C from './contract.mjs';
import {generate} from './provider.mjs';
const URL=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const projects=new Set(['https://dmqjexigdnfzobarhnib.supabase.co','https://yvguatdqncadkwewlepe.supabase.co']);
const allowed=new Set(URL==='https://dmqjexigdnfzobarhnib.supabase.co'?['http://127.0.0.1:4262','http://localhost:4262','http://127.0.0.1:4263','http://localhost:4263']:['https://raulchulbi-sys.github.io']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',auth=req.headers.get('authorization')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.has(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'};
 const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
 if(!projects.has(URL))return reply({error:'configuration_error'},403);
 if(origin&&!allowed.has(origin))return reply({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const rpc=async(name:string,body:unknown,service=false)=>{const r=await fetch(URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service?SERVICE:ANON,Authorization:service?'Bearer '+SERVICE:auth,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const v=await r.json();if(!r.ok)throw Error(/^premium_[a-z_]+$/.test(v.message||'')?v.message:'premium_initial_request_failed');return v;};
 try{
  const id=await fetch(URL+'/auth/v1/user',{headers:{apikey:ANON,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!id.ok)return reply({error:'not_authenticated'},401);const user=await id.json();
  const raw=await req.text();if(raw.length>1024)return reply({error:'invalid_request'},400);let body;try{body=JSON.parse(raw);}catch{return reply({error:'invalid_request'},400);}
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='intake_id,key'||![body.intake_id,body.key].every(x=>typeof x==='string'&&uuid.test(x)))return reply({error:'invalid_request'},400);
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return reply({error:'configuration_error'},503);
  const op=await rpc('premium_initial_reserve',{p_intake:body.intake_id,p_key:body.key});if(op.state!=='reserved')return reply({operation:op});
  const ctx=await rpc('premium_initial_backend_context',{p_user:user.id,p_operation:op.id},true);
  const gate=C.safetyGate(ctx);if(gate)return reply({error:gate},400);
  const inputBound=new TextEncoder().encode(JSON.stringify(C.requestBody(ctx))).length+2048;
  const claim=await rpc('premium_initial_claim',{p_user:user.id,p_operation:op.id,p_input_bound:inputBound,p_mode:'openai'},true);if(!claim.claimed)return reply({operation:op},202);
  const result=await generate(claim.context,{key});
  const final=await rpc('premium_initial_finish',{p_user:user.id,p_operation:op.id,p_proposal:result.proposal,p_error:result.error,p_receipt:{...result.receipt,dispatch_id:op.id},p_quality:result.quality,p_latency_ms:result.latency_ms},true);
  return reply({operation:final});
 }catch(e){const m=e instanceof Error?e.message:'';return reply({error:/^premium_[a-z_]+$/.test(m)?m:'premium_initial_request_failed'},/budget|allowance/.test(m)?429:400);}
});
