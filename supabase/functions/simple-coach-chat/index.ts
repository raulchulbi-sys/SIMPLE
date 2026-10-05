import * as Chat from './chat-contract.mjs';
const URL=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=new Set(['http://127.0.0.1:4245','http://localhost:4245','http://127.0.0.1:4251','http://localhost:4251']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',auth=req.headers.get('authorization')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
 if(URL!=='https://dmqjexigdnfzobarhnib.supabase.co')return reply({error:'staging_only'},403);
 if(origin&&!origins.has(origin))return reply({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 async function rpc(name:string,body:unknown,service=false){const r=await fetch(URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service?SERVICE:ANON,Authorization:service?'Bearer '+SERVICE:auth,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const v=await r.json();if(!r.ok)throw Error(/^premium_[a-z_]+$/.test(v.message||'')?v.message:'premium_chat_request_failed');return v;}
 let turn:any,user:any;
 try{
  const identity=await fetch(URL+'/auth/v1/user',{headers:{apikey:ANON,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!identity.ok)return reply({error:'not_authenticated'},401);user=await identity.json();
  if(Number(req.headers.get('content-length'))>18000)return reply({error:'invalid_request'},400);
  const reader=req.body?.getReader(),decoder=new TextDecoder();let raw='',bytes=0;
  if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>18000){await reader.cancel();return reply({error:'invalid_request'},400);}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}
  let b;try{b=JSON.parse(raw);}catch{return reply({error:'invalid_request'},400);}
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!b||Object.keys(b).sort().join(',')!=='key,mesocycle_id,message,revision_id'||![b.key,b.mesocycle_id,b.revision_id].every(x=>typeof x==='string'&&uuid.test(x)))return reply({error:'invalid_request'},400);
  const iq=Chat.inputQuality(b.message);if(!iq.ok)return reply({error:iq.error},400);
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return reply({error:'configuration_error'},503);
  turn=await rpc('premium_chat_reserve',{p_mesocycle:b.mesocycle_id,p_revision:b.revision_id,p_key:b.key,p_message:b.message});
  if(turn.state!=='reserved')return reply({message:turn},turn.state==='dispatched'?202:200);
  // Claim precedes provider dispatch. Only one caller can claim this persisted turn.
  // Bound includes the full JSON/schema/prompt in UTF-8 bytes plus conservative overhead.
  const claim=await rpc('premium_chat_claim',{p_user:user.id,p_id:turn.id,p_input_bound:1,p_mode:'prepare'},true);
  if(!claim.prepared)return reply({message:claim.message||turn},claim.message?.state==='dispatched'?202:200);
  const ctx=claim.provider,cq=Chat.contextQuality(ctx);
  if(!cq.ok){const no=await rpc('premium_chat_claim',{p_user:user.id,p_id:turn.id,p_input_bound:1,p_mode:'mock'},true);if(!no.claimed)return reply({message:no.message||turn},202);const failed=await rpc('premium_chat_finish',{p_user:user.id,p_id:turn.id,p_output:null,p_error:'invalid_chat_context',p_receipt:{model:Chat.MODEL,prompt_version:Chat.PROMPT_VERSION,provider_context_version:Chat.CONTEXT_VERSION,response_schema_version:Chat.SCHEMA_VERSION,timestamp:new Date().toISOString(),status:0,failure_category:'context',schema_path:null,schema_index:null,schema_error:'context',response_fingerprint:null,transport:'no_provider_dispatch'},p_warnings:[]},true);return reply({message:failed});}
  const bound=new TextEncoder().encode(JSON.stringify(Chat.requestBody(ctx,claim.output_tokens))).length+2048;
  const taken=await rpc('premium_chat_claim',{p_user:user.id,p_id:turn.id,p_input_bound:bound,p_mode:'openai'},true);if(!taken.claimed)return reply({message:taken.message||turn},taken.message?.state==='dispatched'?202:200);
  const result=await Chat.analyze(taken.provider,key,fetch,taken.output_tokens??Chat.MAX_OUTPUT);
  const final=await rpc('premium_chat_finish',{p_user:user.id,p_id:turn.id,p_output:result.output,p_error:result.error,p_receipt:result.receipt,p_warnings:result.quality?.warnings||[]},true);
  return reply({message:final});
 }catch(e){const code=e instanceof Error?e.message:'';return reply({error:/^premium_[a-z_]+$/.test(code)?code:'premium_chat_request_failed'},/budget|allowance|rate/.test(code)?429:400);}
});
