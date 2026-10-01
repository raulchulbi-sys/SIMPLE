import {MODELS,requestBody,reviewProposal,safetyGate,decodeOutput} from './contract.mjs';

// All dependency injection is server/test-side. No endpoint, model, key or retry option comes from HTTP input.
export async function generate(ctx,{key,model,fetcher=fetch,now=Date.now,timeoutMs=90000}){
 const started=now(),attempts=[];
 const outcome=(error_code,proposal=null)=>({proposal,error_code,latency_ms:Math.max(0,now()-started),attempts});
 if(!key||!Object.hasOwn(MODELS,model))return outcome('configuration_error');
 const blocked=safetyGate(ctx);if(blocked)return outcome(blocked);
 const body=JSON.stringify(requestBody(ctx,model));
 // One upstream dispatch per reserved operation. Only the reviewer's explicit retry can start another.
 {
  const controller=new AbortController(),remaining=timeoutMs-(now()-started);
  if(remaining<=0)return outcome('provider_timeout');
  const at=now(),timer=setTimeout(()=>controller.abort(),remaining);
  const a={status:0,latency_ms:0,input_tokens:null,output_tokens:null,cached_input_tokens:null,error_code:null};attempts.push(a);
  let r,payload,quota=false;
  try{
   r=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body,signal:controller.signal});
   a.status=r.status;
   // Never persist or expose raw error bodies; they can contain echoed input.
   if(r.ok){const raw=await r.text();if(raw.length>200000)throw Error('oversized');payload=JSON.parse(raw);}
   else if(r.status===429){
    // Inspect only the documented machine code to distinguish quota from a transient rate limit.
    // The error message and body are neither recorded nor returned.
    try{const problem=await r.json();quota=problem?.error?.code==='insufficient_quota';}catch{}
   }else await r.body?.cancel();
  }catch{
   a.latency_ms=Math.max(0,now()-at);a.error_code=controller.signal.aborted?'provider_timeout':r?.ok?'invalid_output':'provider_network';
   return outcome(a.error_code); // Ambiguous request outcome: do not automatically send again.
  }finally{clearTimeout(timer);}
  a.latency_ms=Math.max(0,now()-at);
  if(controller.signal.aborted||now()-started>=timeoutMs){a.error_code='provider_timeout';return outcome(a.error_code);}
  if(!r.ok){
   a.error_code=quota?'provider_rejected':r.status===429?'provider_rate_limit':r.status>=500?'provider_unavailable':'provider_rejected';
   if(quota)return outcome('configuration_error');
   return outcome(a.error_code);
  }
  const usage=payload?.usage,number=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000;
  if(usage&&number(usage.input_tokens)&&number(usage.output_tokens)){
   a.input_tokens=usage.input_tokens;a.output_tokens=usage.output_tokens;
   a.cached_input_tokens=number(usage.input_tokens_details?.cached_tokens)?usage.input_tokens_details.cached_tokens:0;
   if(a.cached_input_tokens>a.input_tokens)a.cached_input_tokens=0;
  }
  if(payload?.status!=='completed'){a.error_code='provider_incomplete';return outcome(a.error_code);}
  if(!Array.isArray(payload.output)||payload.output.some(x=>!x||typeof x!=='object'||!['message','reasoning'].includes(x.type))){a.error_code='invalid_output';return outcome(a.error_code);}
  const messages=payload.output.filter(x=>x.type==='message');
  if(messages.some(x=>!Array.isArray(x.content)||x.content.some(c=>!c||typeof c!=='object'))){a.error_code='invalid_output';return outcome(a.error_code);}
  const content=messages.flatMap(x=>x.content||[]);
  if(content.some(x=>x.type==='refusal')){a.error_code='provider_refusal';return outcome(a.error_code);}
  const texts=content.filter(x=>x.type==='output_text');
  if(texts.length!==1||content.length!==1){a.error_code='invalid_output';return outcome(a.error_code);}
  let proposal;try{proposal=decodeOutput(JSON.parse(texts[0].text),ctx);}catch{a.error_code='invalid_output';return outcome(a.error_code);}
  const review=reviewProposal(proposal,ctx);
  if(!review.ok){a.error_code=review.failures.includes('schema_invalid')?'invalid_output':'quality_rejected';return {...outcome(a.error_code),rejected_proposal:proposal,quality:review};}
  return outcome(null,proposal);
 }
 return outcome('provider_unavailable');
}
