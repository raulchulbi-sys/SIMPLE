// Loopback-only fixture server. No outbound network, Stripe SDK or real JWT is used.
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../..');
function start(){
 const artifact={output:root,sha256:'local-synthetic-no-deployment'},state={owner:'00000000-0000-4000-8000-000000001a01',status:'none',plan:null,paid:false,cancel:false,generation:false,calls:[],error:null,delay:0,portalFail:false};
 const payload=()=>({environment:'STRIPE_TEST',state:state.status,plan:state.paid?state.plan:null,accessActive:state.paid,monthlyCents:state.paid?(state.plan==='basic'?499:1299):null,currency:'eur',paidUntil:state.paid?'2070-12-01T16:41:13Z':null,nextBillingAt:state.paid&&!state.cancel?'2070-12-01T16:41:13Z':null,cancelAtPeriodEnd:state.cancel,portalAvailable:state.paid||['payment_failed','expired'].includes(state.status),canCheckout:state.status==='none'||state.status==='expired',aiQuotaChanged:false});
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4276');res.setHeader('Cache-Control','no-store');
  const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/__auth')return json({data:{user:state.owner?{id:state.owner,email:'synthetic@example.invalid'}:null},error:state.owner?null:{message:'invalid'}});
  if(url.pathname==='/__login'){state.owner='00000000-0000-4000-8000-000000001a01';return json({data:{user:{id:state.owner}},error:null});}
  if(url.pathname==='/__invoke'&&req.method==='POST'){
   let raw='';for await(const part of req){raw+=part;if(raw.length>1024)return json({error:{message:'size'}},400);}const body=JSON.parse(raw);state.calls.push(body);
   const snapshot=payload();if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
   if(state.error)return json({error:{message:state.error}});
   if(!state.owner)return json({error:{message:'auth_required'}});
   if(body.action==='status')return json({data:snapshot,error:null});
   if(body.action==='capabilities')return json({data:{basicActive:state.paid&&state.plan==='basic',basicGenerationEnabled:state.paid&&state.plan==='basic'&&state.generation,premiumEnabled:false,quotasChanged:false,humanReviewRequired:true},error:null});
   if(body.action==='checkout'){state.status='open';state.plan=body.plan;return json({data:{url:'https://checkout.stripe.com/c/pay/cs_test_SYNTHETIC_BROWSER'},error:null});}
   if(body.action==='portal')return json(state.portalFail?{error:{message:'portal unavailable'}}:{data:{url:'https://billing.stripe.com/p/session/SYNTHETIC_BROWSER'},error:null});
   if(body.action==='reconcile'){if(state.status==='reconciling'){state.status='active';state.paid=true;state.plan='basic';}return json({data:{verified:true},error:null});}
   return json({error:{message:'unsupported'}});
  }
  if(url.pathname==='/assets/commercial-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.SimpleAppRuntime={billingTest:true,supabaseUrl:"https://dmqjexigdnfzobarhnib.supabase.co",supabasePublicKey:"SYNTHETIC_LOCAL_ONLY"};');}
  if(req.method!=='GET')return json({error:'method'},405);
  if(url.pathname==='/billing-sdk.js'||url.pathname==='/app-sdk.js'){
   res.setHeader('Content-Type','application/javascript');
   const app=url.pathname==='/app-sdk.js';const prior=app?['tests/interior/mock-sdk.js','tests/coach/demo-sdk.js','tests/coach-v2/preview-sdk.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'):'';
   return res.end(prior+`\n(()=>{const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url)==='https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/settings'?Promise.resolve(new Response(JSON.stringify({external:{google:false},disable_signup:false}))):originalFetch(url,options);const get=u=>fetch(u).then(r=>r.json()),callbacks=[];const client=${app?'demoClient':'{auth:{}}'};
    client.auth.getUser=()=>get('/__auth');client.auth.onAuthStateChange=cb=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){const i=callbacks.indexOf(cb);if(i>=0)callbacks.splice(i,1);}}}};};window.syntheticAuthChanged=()=>callbacks.forEach(cb=>cb('SIGNED_OUT',null));
    client.auth.signInWithPassword=async()=>{const r=await get('/__login');return r;};
    const invoke=body=>fetch('/__invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
    client.functions={invoke:async(name,{body})=>{if(name!=='billing-test')throw Error('Synthetic provider forbidden');return invoke(body);}};
    const priorRpc=client.rpc;client.rpc=async(name,args)=>{if(name==='billing_test_capabilities')return invoke({action:'capabilities'});const r=await priorRpc(name,args);if(name==='get_my_coach_access'){const s=(await invoke({action:'status'})).data;const c=(await invoke({action:'capabilities'})).data;r.data={...r.data,commercial:true,paidBasic:s?.accessActive&&s?.plan==='basic',can_generate:!!r.data?.can_generate&&c?.basicGenerationEnabled};}return r;};
    window.supabase={createClient:()=>client};})();`);
  }
  if(url.pathname==='/seed.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(root,'tests/coach-v2/preview-seed.js')));}
  let name=url.pathname==='/'||url.pathname==='/demo'?'index.html':url.pathname.slice(1);
  if(!['index.html','billing-test.html'].includes(name)&&!/^assets\/[a-zA-Z0-9._-]+$/.test(name)){res.writeHead(404);return res.end();}
  const file=path.join(root,name==='billing-test.html'?'staging/subscription/return.html':name);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}let data=fs.readFileSync(file);
  if(name.endsWith('.html')){const app=name==='index.html';data=Buffer.from(data.toString().replace('<head>','<head><script src="/assets/commercial-config.js"></script>').replace('const SUPABASE_URL="https://yvguatdqncadkwewlepe.supabase.co"','const SUPABASE_URL="https://dmqjexigdnfzobarhnib.supabase.co"').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0',app?'/app-sdk.js':'/billing-sdk.js').replace('</body>',app?'<script src="/seed.js"></script></body>':'</body>'));}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(name)]||'application/octet-stream');res.end(data);
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4276,'127.0.0.1',()=>resolve({server,state,artifact}));});
}
if(require.main===module)start().then(()=>console.log('Synthetic preview on 127.0.0.1:4276; no external services.'));
module.exports={start};
