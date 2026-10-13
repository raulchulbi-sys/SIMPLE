'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');let n=0;
const test=(name,f)=>{f();n++;};
(async()=>{
 const {providerReceipt:R}=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-premium/provider-receipt.mjs')));
 const A=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-premium/contract.mjs'))),C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-chat/chat-contract.mjs')));
 const p={id:'resp_test',model:A.MODEL,service_tier:'default',usage:{input_tokens:500,output_tokens:200,input_tokens_details:{cached_tokens:100}},output:[{text:'PRIVATE RESPONSE'}],secret:'PRIVATE KEY',headers:{authorization:'PRIVATE KEY'}};
 test('closed provenance without text or headers',()=>assert.deepEqual(R(p),{source:'openai_response',response_id:'resp_test',model:A.MODEL,service_tier:'default',input_tokens:500,output_tokens:200,cached_input_tokens:100}));
 test('missing usage stays unknown',()=>assert.equal(R({}).input_tokens,null));
 test('malformed response identity stays unknown',()=>assert.equal(R({...p,id:'not a response'}).response_id,null));
 test('cached input absent defaults zero',()=>assert.equal(R({...p,usage:{input_tokens:1,output_tokens:2}}).cached_input_tokens,0));
 test('invalid scalar retained for SQL rejection',()=>assert.equal(R({...p,usage:{input_tokens:'bad',output_tokens:1}}).input_tokens,'bad'));
 test('oversized scalar excluded',()=>assert.equal(R({...p,usage:{input_tokens:'1'.repeat(100),output_tokens:1}}).input_tokens,null));
 for(const [name,M,max]of [['analysis',A,1800],['chat',C,1000]]){
  test(name+' default tier and unchanged output limit',()=>{const q=M.requestBody({});assert.equal(q.service_tier,'default');assert.equal(q.max_output_tokens,max);assert.equal(q.store,false);assert.equal(q.tools,undefined);});
 }
 const result=await A.analyze({},'TEST_ONLY',async()=>new Response(JSON.stringify({...p,status:'incomplete'}),{status:200}));
 test('actual transport parsing retains response identity',()=>{assert.equal(result.receipt.response_id,p.id);assert.equal(result.receipt.service_tier,'default');assert.equal(result.error,'provider_incomplete');});
 const fail=await A.analyze({},'TEST_ONLY',async()=>new Response('{}',{status:429}));
 test('provider failure cannot assert metered spend',()=>{assert.equal(fail.receipt.input_tokens,null);assert.equal(fail.receipt.response_id,undefined);assert.equal(fail.error,'provider_rate_limit');});
 console.log(JSON.stringify({passed:n,total:n,real_provider_calls:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
