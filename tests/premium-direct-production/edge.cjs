'use strict';
// Real release Edge source, all Auth/RPC/provider fetches intercepted in RAM.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{cases,ctx,wire}=require('./cases.cjs'),rows=[];
const staging='https://dmqjexigdnfzobarhnib.supabase.co',production='https://yvguatdqncadkwewlepe.supabase.co';
const intake='11111111-1111-4111-8111-111111111111',operation='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333',key='44444444-4444-4444-8444-444444444444',body={intake_id:intake,key};
const test=async(name,fn)=>{await fn();rows.push({name,pass:true});};
(async()=>{
 const C=await import('../../supabase/functions/simple-coach-initial-premium/contract.mjs'),P=await import('../../supabase/functions/simple-coach-initial-premium/provider.mjs');
 const original=fs.readFileSync('supabase/functions/simple-coach-initial-premium/index.ts','utf8'),source=original.replace(/^import .*;\r?\n/gm,'').replace(/!(?=[,;])/g,'').replace(/:(unknown|string)\b/g,'');
 async function gateway(target,options={}){
  const s={provider:0,auth:0,rpc:[],handler:null,escapes:[]},env={SUPABASE_URL:target,SUPABASE_ANON_KEY:'UNIT_ANON',SUPABASE_SERVICE_ROLE_KEY:'UNIT_SERVICE',OPENAI_API_KEY:options.noKey?undefined:'UNIT_PROVIDER'};
  const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  const fetcher=async(url,init={})=>{
   if(url===target+'/auth/v1/user'){s.auth++;assert.equal(init.headers.apikey,'UNIT_ANON');assert.equal(init.headers.Authorization,options.authorization??'Bearer UNIT_JWT');return options.authDenied?response({error:'denied'},401):response({id:user});}
   if(url.startsWith(target+'/rest/v1/rpc/')){
    const name=url.split('/').pop(),p=JSON.parse(init.body);s.rpc.push({name,p,authorization:init.headers.Authorization,apikey:init.headers.apikey});
    if(name==='premium_initial_reserve')return options.initialOff?response({message:'premium_initial_not_authorized'},400):response({id:operation,state:options.state||'reserved'});
    if(name==='premium_initial_backend_context')return response(options.invalidContext?{}:ctx(cases.A));
    if(name==='premium_initial_claim')return options.budgetError?response({message:'premium_initial_budget_exhausted'},400):response({claimed:options.claimed!==false,context:ctx(cases.A)});
    if(name==='premium_initial_finish'){if(options.finishError)throw Error('UNIT_TRANSPORT_FAILURE');return response({id:operation,state:p.p_error?'failed':'pending_review',receipt:p.p_receipt});}
    throw Error('Unexpected RPC '+name);
   }
   if(url==='https://api.openai.com/v1/responses'){
    s.provider++;if(options.providerStatus)return response({error:{message:'PRIVATE_RESPONSE_SENTINEL'}},options.providerStatus);
    return response({id:'resp_unit_initial_edge',model:C.MODEL,service_tier:'default',status:'completed',usage:{input_tokens:200,output_tokens:600,input_tokens_details:{cached_tokens:0}},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(wire(cases.A))}]}]});
   }
   s.escapes.push(url);throw Error('Network escape denied');
  };
  vm.runInNewContext(source,{C,generate:(context,opts)=>P.generate(context,{...opts,fetcher}),Deno:{env:{get:n=>env[n]},serve:f=>s.handler=f},fetch:fetcher,TextEncoder,AbortSignal,Response,Error},{filename:'simple-coach-initial-premium/index.ts'});
  const headers={authorization:options.authorization??'Bearer UNIT_JWT'};if(options.origin!==null)headers.origin=options.origin||(target===production?'https://raulchulbi-sys.github.io':'http://127.0.0.1:4262');
  const method=options.method||'POST',request=new Request(target+'/functions/v1/simple-coach-initial-premium',{method,headers,body:['OPTIONS','GET'].includes(method)?undefined:options.raw??JSON.stringify(options.body||body)});
  const r=await s.handler(request);assert.equal(s.escapes.length,0,'every fetch matched exact intercepted project base');return {...s,status:r.status,data:r.status===204?null:await r.json(),cors:r.headers.get('Access-Control-Allow-Origin')};
 }
 for(const target of ['https://production.invalid',staging+'/',production+'/',staging.replace('https:','http:')])await test('unknown/malformed project denied before Auth '+target,async()=>{const r=await gateway(target);assert.equal(r.status,403);assert.equal(r.auth,0);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
 for(const [label,target,origins]of [['stage',staging,['http://127.0.0.1:4262','http://localhost:4262','http://127.0.0.1:4263','http://localhost:4263']],['prod',production,['https://raulchulbi-sys.github.io']]]){
  for(const origin of origins)await test(label+' CORS accepts exact '+origin,async()=>{const r=await gateway(target,{origin,method:'OPTIONS'});assert.equal(r.status,204);assert.equal(r.cors,origin);assert.equal(r.auth,0);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
  for(const origin of ['https://untrusted.invalid','https://raulchulbi-sys.github.io.evil.invalid','https://raulchulbi-sys.github.io/SIMPLE/','http://127.0.0.1:4264',...(label==='prod'?['http://127.0.0.1:4262','http://localhost:4263']:['https://raulchulbi-sys.github.io'])])await test(label+' CORS rejects '+origin,async()=>{const r=await gateway(target,{origin});assert.equal(r.status,403);assert.equal(r.auth,0);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
  await test(label+' OPTIONS has no authenticated mutation',async()=>{const r=await gateway(target,{method:'OPTIONS'});assert.equal(r.status,204);assert.equal(r.auth,0);assert.equal(r.rpc.length,0);});
  await test(label+' method guard has no Auth/RPC/provider',async()=>{const r=await gateway(target,{method:'GET'});assert.equal(r.status,405);assert.equal(r.auth,0);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
  for(const authorization of ['Bearer UNIT_INVALID','Bearer UNIT_EXPIRED',''])await test(label+' rejected/missing Auth JWT '+(authorization||'empty'),async()=>{const r=await gateway(target,{authDenied:true,authorization});assert.equal(r.status,401);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
  for(const [name,b]of [['foreign actor',{...body,user_id:user}],['provider selection',{...body,model:'other'}],['invalid UUID',{...body,key:'bad'}],['array',[body]]])await test(label+' HTTP rejects '+name,async()=>{const r=await gateway(target,{body:b});assert.equal(r.status,400);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
  await test(label+' malformed/oversized JSON zero dispatch',async()=>{for(const raw of ['{','x'.repeat(1025)]){const r=await gateway(target,{raw});assert.equal(r.status,400);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);}});
  await test(label+' missing server provider key cannot reserve',async()=>{const r=await gateway(target,{noKey:true});assert.equal(r.status,503);assert.equal(r.rpc.length,0);assert.equal(r.provider,0);});
  await test(label+' initial OFF at reserve rejects with zero provider',async()=>{const r=await gateway(target,{initialOff:true});assert.equal(r.status,400);assert.equal(r.data.error,'premium_initial_not_authorized');assert.equal(r.auth,1);assert.equal(r.rpc.length,1);assert.equal(r.rpc[0].name,'premium_initial_reserve');assert.equal(r.provider,0);});
  await test(label+' pending operation without new dispatch',async()=>{const r=await gateway(target,{state:'pending_review'});assert.equal(r.status,200);assert.equal(r.rpc.length,1);assert.equal(r.provider,0);});
  await test(label+' atomic duplicate claim zero provider',async()=>{const r=await gateway(target,{claimed:false});assert.equal(r.status,202);assert.equal(r.provider,0);assert(!r.rpc.some(x=>x.name==='premium_initial_finish'));});
  await test(label+' invalid intake before claim/provider',async()=>{const r=await gateway(target,{invalidContext:true});assert.equal(r.status,400);assert.equal(r.provider,0);assert(!r.rpc.some(x=>x.name==='premium_initial_claim'));});
  await test(label+' budget rejection zero provider',async()=>{const r=await gateway(target,{budgetError:true});assert.equal(r.status,429);assert.equal(r.data.error,'premium_initial_budget_exhausted');assert.equal(r.provider,0);});
  await test(label+' exact Auth owner/reserve JWT/service boundary',async()=>{const r=await gateway(target);assert.equal(r.status,200);assert.equal(r.provider,1);assert.equal(r.data.operation.state,'pending_review');const reserve=r.rpc[0],claim=r.rpc.find(x=>x.name==='premium_initial_claim'),finish=r.rpc.find(x=>x.name==='premium_initial_finish');assert.equal(reserve.authorization,'Bearer UNIT_JWT');assert.equal(reserve.apikey,'UNIT_ANON');assert.deepEqual(reserve.p,{p_intake:intake,p_key:key});assert.equal(claim.p.p_user,user);assert.equal(claim.p.p_mode,'openai');assert.equal(claim.p.p_input_bound,new TextEncoder().encode(JSON.stringify(C.requestBody(ctx(cases.A)))).length+2048);assert.equal(finish.p.p_user,user);assert.equal(finish.p.p_receipt.dispatch_id,operation);assert.equal(finish.p.p_receipt.input_tokens,200);assert(r.rpc.slice(1).every(x=>x.authorization==='Bearer UNIT_SERVICE'&&x.apikey==='UNIT_SERVICE'));});
  await test(label+' provider429 once no raw body leak',async()=>{const r=await gateway(target,{providerStatus:429});assert.equal(r.provider,1);assert.equal(r.data.operation.state,'failed');const finish=r.rpc.find(x=>x.name==='premium_initial_finish');assert.equal(finish.p.p_error,'provider_rate_limit');assert.equal(finish.p.p_receipt.status,429);assert(!JSON.stringify(r).includes('PRIVATE_RESPONSE_SENTINEL'));});
  await test(label+' finish failure never retries provider',async()=>{const r=await gateway(target,{finishError:true});assert.equal(r.status,400);assert.equal(r.provider,1);assert.equal(r.rpc.filter(x=>x.name==='premium_initial_finish').length,1);assert(!JSON.stringify(r.data).includes('UNIT_TRANSPORT_FAILURE'));});
  await test(label+' absent Origin remains authenticated and OFF denies dispatch',async()=>{const r=await gateway(target,{origin:null,initialOff:true});assert.equal(r.status,400);assert.equal(r.auth,1);assert.equal(r.provider,0);});
 }
 fs.mkdirSync(__dirname+'/results',{recursive:true});fs.writeFileSync(__dirname+'/results/edge.json',JSON.stringify({total:rows.length,passed:rows.length,rows,network:'Every fetch intercepted locally; no credentials, real Auth, RPC or provider requests',external_requests:0},null,2));console.log(rows.length+'/'+rows.length+' release Edge checks; zero external traffic.');
})().catch(e=>{console.error(e);process.exitCode=1;});
