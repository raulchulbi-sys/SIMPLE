import {DEFAULT_MODEL,requestBody} from './contract.mjs';
import {generate} from './provider.mjs';

// Server-owned constants. Not configurable by HTTP input, environment budgets or the athlete.
export const STAGING_URL='https://dmqjexigdnfzobarhnib.supabase.co';
export const LIMITS=Object.freeze({inputTokens:12000,outputTokens:5120,requestBytes:16384,countResponseBytes:8192,countTimeoutMs:10000});
const API='https://api.openai.com/v1/responses';
const bytes=s=>new TextEncoder().encode(s).length;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const fail=()=>{throw Error('basic_cost_guard_denied');};

export function prepareBoundedRequest(ctx,model){
 if(model!==DEFAULT_MODEL||ctx?.training?.schema_version!=='basic-intake-v2'||(ctx.prompt_version&&ctx.prompt_version!=='basic-initial-v5'))fail();
 const base=requestBody(ctx,model);
 return freezeProviderRequest(base);
}

// Kept separate to test byte/shape boundaries without altering the sports contract.
export function freezeProviderRequest(base){
 if(base.model!==DEFAULT_MODEL)fail();
 if(Object.keys(base).sort().join(',')!=='input,instructions,max_output_tokens,model,reasoning,store,text'||base.max_output_tokens!==LIMITS.outputTokens||base.store!==false||base.reasoning?.effort!=='low'||base.text?.format?.strict!==true)fail();
 const final={...base,service_tier:'default',truncation:'disabled'};
 const wire=JSON.stringify(final);
 if(bytes(wire)>LIMITS.requestBytes)fail();
 // Count API accepts the input-affecting fields, including structured-output schema.
 // store, service_tier and max_output_tokens are output/storage/billing controls, not input.
 const {model:m,instructions,input,reasoning,text,truncation}=JSON.parse(wire);
 return Object.freeze({wire,originalWire:JSON.stringify(base),countWire:JSON.stringify({model:m,instructions,input,reasoning,text,truncation})});
}

async function smallJSON(response,maxBytes=LIMITS.countResponseBytes){
 if(!response.body)fail();
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel().catch(()=>{});fail();}chunks.push(value);}}
 finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(all));
}

// One transport per successful database claim. The DB claim remains the cross-instance lock.
// fetcher injection exists only for offline tests; it is never an HTTP parameter.
export function createStagingCostTransport(ctx,{projectURL,model,key,fetcher=fetch}){
 if(projectURL!==STAGING_URL||typeof key!=='string'||!key.trim())fail();
 const request=prepareBoundedRequest(ctx,model);
 let used=false;
 const audit={version:1,count_attempts:0,generation_dispatches:0,input_tokens_counted:null,reason:'not_started',receipt:null};
 const send=async(url,options)=>{
  if(used)fail();used=true; // consume before any await; failed/ambiguous checks never unlock it
  if(url!==API||options?.method!=='POST'||options.body!==request.originalWire||options.signal?.aborted){audit.reason='request_mismatch';fail();}
  const headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),LIMITS.countTimeoutMs);
  const signal=options.signal?AbortSignal.any([options.signal,timeout.signal]):timeout.signal;
  try{
   audit.count_attempts++;
   const count=await fetcher(API+'/input_tokens',{method:'POST',headers,body:request.countWire,signal,redirect:'error'});
   if(!count.ok){await count.body?.cancel();audit.reason='count_rejected';fail();}
   const value=await smallJSON(count);
   if(signal.aborted)fail();
   if(value?.object!=='response.input_tokens'||!integer(value.input_tokens)||value.input_tokens===0){audit.reason='count_invalid';fail();}
   audit.input_tokens_counted=value.input_tokens;
   if(value.input_tokens>LIMITS.inputTokens){audit.reason='input_limit';fail();}
  }catch{if(audit.reason==='not_started')audit.reason='count_unavailable';fail();}
  finally{clearTimeout(timer);}
  if(options.signal?.aborted){audit.reason='cancelled_before_dispatch';fail();}
  audit.generation_dispatches++;audit.reason='dispatched';
  // Exact serialized body counted above; no reconstruction from mutable ctx after await.
  const response=await fetcher(API,{method:'POST',headers,body:request.wire,signal:options.signal,redirect:'error'});
  // Inspect only receipt metadata. Never change/clamp provider usage or replace response body.
  if(response.ok){
   try{
    const payload=await smallJSON(response.clone(),200000),usage=payload?.usage;
    audit.receipt={response_id:typeof payload.id==='string'&&/^resp_[a-zA-Z0-9_-]{1,150}$/.test(payload.id)?payload.id:null,
     request_id:/^req_[a-zA-Z0-9_-]{1,150}$/.test(response.headers.get('x-request-id')||'')?response.headers.get('x-request-id'):null,
     model:payload.model===DEFAULT_MODEL?DEFAULT_MODEL:'unexpected',tier:payload.service_tier==='default'?'default':'unexpected',
     input_tokens:integer(usage?.input_tokens)?usage.input_tokens:null,output_tokens:integer(usage?.output_tokens)?usage.output_tokens:null,
     cached_tokens:integer(usage?.input_tokens_details?.cached_tokens)?usage.input_tokens_details.cached_tokens:null};
    const r=audit.receipt;
    if(r.model!==DEFAULT_MODEL||r.tier!=='default'||r.input_tokens!==audit.input_tokens_counted||r.input_tokens>LIMITS.inputTokens||r.output_tokens===null||r.output_tokens>LIMITS.outputTokens||r.cached_tokens===null||r.cached_tokens>r.input_tokens)audit.reason='receipt_requires_reconciliation';
    else audit.reason='receipt_within_limits';
   }catch{audit.reason='receipt_requires_reconciliation';}
  }else audit.reason='generation_rejected';
  return response;
 };
 return {send,request,audit:()=>structuredClone(audit)};
}

export async function generateStaging(ctx,{projectURL,key,model,fetcher=fetch}){
 let transport;
 try{transport=createStagingCostTransport(ctx,{projectURL,key,model,fetcher});}
 catch{return {proposal:null,error_code:'configuration_error',latency_ms:0,attempts:[],cost_guard:{version:1,count_attempts:0,generation_dispatches:0,reason:'configuration_denied'}};}
 const result=await generate(ctx,{key,model,fetcher:transport.send});
 const audit=transport.audit();
 if(audit.reason==='receipt_requires_reconciliation'){
  result.proposal=null;result.error_code='invalid_output';
  // Preserve every reported token, even above the limit; this is not a capped accounting charge.
  if(result.attempts.length)result.attempts.at(-1).error_code='invalid_output';
 }
 return {...result,cost_guard:audit};
}
