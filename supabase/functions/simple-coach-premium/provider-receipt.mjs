// Closed provider metadata only; never persist response text, headers or credentials.
export function providerReceipt(p){
 const scalar=v=>typeof v==='number'||typeof v==='string'&&v.length<=80?v:null;
 return {source:'openai_response',response_id:typeof p?.id==='string'&&/^resp_[A-Za-z0-9_-]{1,150}$/.test(p.id)?p.id:null,
  model:typeof p?.model==='string'&&p.model.length<=100?p.model:null,
  service_tier:typeof p?.service_tier==='string'&&p.service_tier.length<=30?p.service_tier:null,
  input_tokens:scalar(p?.usage?.input_tokens),output_tokens:scalar(p?.usage?.output_tokens),cached_input_tokens:scalar(p?.usage?.input_tokens_details?.cached_tokens??0)};
}
