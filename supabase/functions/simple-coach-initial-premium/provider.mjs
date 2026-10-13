import {MODEL,REVIEW_VERSION,requestBody,decodeOutput,reviewProposal,safetyGate} from './contract.mjs';
import {providerReceipt} from '../simple-coach-premium/provider-receipt.mjs';
// Dependency injection exists only for deterministic tests. HTTP input cannot choose a provider.
export async function generate(ctx,{key,fetcher=fetch,now=Date.now,timeoutMs=90000}={}){
 const start=now(),out=(error,proposal=null,receipt={transport:'no_provider_dispatch'},quality=null)=>({error,proposal,receipt,quality,latency_ms:Math.max(0,now()-start)});
 if(!key)return out('configuration_error');const gate=safetyGate(ctx);if(gate)return out(gate);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let response,payload;
 try{
  response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(requestBody(ctx)),signal:controller.signal});
  if(!response.ok){await response.body?.cancel();return out(response.status===429?'provider_rate_limit':'provider_rejected',null,{transport:'provider_http',status:response.status});}
  const raw=await response.text();if(raw.length>200000)throw Error('oversized');payload=JSON.parse(raw);
 }catch{return out(controller.signal.aborted?'provider_timeout':'provider_network',null,{transport:'ambiguous_provider_dispatch'});}finally{clearTimeout(timer);}
 const receipt={...providerReceipt(payload),status:200,review_version:REVIEW_VERSION};
 if(payload?.model!==MODEL||payload?.status!=='completed')return out('provider_incomplete',null,receipt);
 let proposal;
 try{
  if(!Array.isArray(payload.output)||payload.output.some(x=>!['reasoning','message'].includes(x?.type)))throw Error('invalid');
  const content=payload.output.filter(x=>x.type==='message').flatMap(x=>x.content||[]);
  if(content.length!==1||content[0].type!=='output_text')throw Error('invalid');
  proposal=decodeOutput(JSON.parse(content[0].text),ctx);
 }catch{return out('invalid_output',null,receipt);}
 try{const quality=reviewProposal(proposal,ctx);return quality.ok?out(null,proposal,receipt,quality):out('quality_rejected',null,receipt,quality);}
 catch{return out('quality_rejected',null,receipt,{ok:false,failures:['quality_contract_invalid'],warnings:[]});}
}
