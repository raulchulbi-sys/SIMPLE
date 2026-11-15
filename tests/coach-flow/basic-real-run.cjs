// One approved SDK dispatch; no provider credentials or service-role keys in this process.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'../..'),REF='dmqjexigdnfzobarhnib',BASE='https://'+REF+'.supabase.co';
const [dirArg,manifestPath,mode]=process.argv.slice(2),dir=path.resolve(dirArg);
assert(dir.startsWith(path.join(__dirname,'private')+path.sep));
const plan=JSON.parse(fs.readFileSync(path.join(dir,'plan.json'))),training=plan.training;
assert.equal(plan.project,REF);assert.equal(plan.maxCountCalls,1);assert.equal(plan.maxGenerations,1);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sdkBytes=fs.readFileSync(path.resolve(ROOT,'../google-auth/tests/onboarding/private/supabase-2.115.0.js'));
assert.equal(sha(sdkBytes),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7');
const sandbox={console:{log(){},warn(){},error(){}},fetch:()=>{throw Error('SDK fallback network blocked');},URL,Headers,Request,Response,AbortController,AbortSignal,setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,crypto:globalThis.crypto,WebSocket,Buffer};
vm.createContext(sandbox);vm.runInContext(sdkBytes.toString('utf8'),sandbox);
assert.equal(typeof sandbox.supabase.createClient,'function');
const receipt={run:plan.run,project:REF,startedAt:new Date().toISOString(),checks:[],counts:{},operation:null,intake:null,grant:null,edgeDispatched:false},clients={};
const save=()=>fs.writeFileSync(path.join(dir,'sdk-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const check=(name,pass)=>{receipt.checks.push({name,pass:!!pass});save();assert(pass,name);};
function fence(actor,url,options){
 const u=new URL(typeof url==='string'?url:url.url),method=options?.method||'GET';
 assert.equal(u.origin,BASE,'Fixed staging network boundary');
 const c=receipt.counts[actor],body=options?.body?JSON.parse(options.body):null;
 if(u.pathname==='/auth/v1/token')return method==='POST'&&u.searchParams.get('grant_type')==='password'&&++c.logins<=1;
 if(u.pathname==='/auth/v1/user')return method==='GET';
 if(u.pathname==='/auth/v1/logout')return method==='POST'&&u.searchParams.get('scope')==='local';
 if(method==='GET'&&u.pathname==='/rest/v1/profiles')return u.searchParams.get('id')==='eq.'+plan.actors[actor];
 if(method==='GET'&&u.pathname==='/rest/v1/context_grants')return actor==='mock'&&u.searchParams.get('user_id')==='eq.'+plan.actors.mock&&u.searchParams.get('scope')==='eq.training_intake';
 if(method==='GET'&&u.pathname==='/rest/v1/coach_operations')return receipt.operation?u.searchParams.get('id')==='eq.'+receipt.operation.id:actor==='mock'&&u.searchParams.get('user_id')==='eq.'+plan.actors.mock&&u.searchParams.get('idempotency_key')==='eq.'+plan.key;
 if(method==='POST'&&u.pathname==='/rest/v1/rpc/get_my_coach_access')return true;
 if(method==='POST'&&u.pathname==='/rest/v1/rpc/get_coach_review_queue')return actor==='reviewer';
 if(method==='POST'&&u.pathname==='/rest/v1/rpc/set_my_coach_context_permission')return actor==='mock'&&JSON.stringify(body)===JSON.stringify({p_scope:'training_intake',p_allow:true})&&++c.consents<=1;
 if(method==='POST'&&u.pathname==='/rest/v1/rpc/save_my_training_intake')return actor==='mock'&&JSON.stringify(body)===JSON.stringify({p_id:null,p_expected:null,p_training:training,p_submit:true})&&++c.intakes<=1;
 if(method==='POST'&&u.pathname==='/functions/v1/simple-coach-mock'){
  assert(actor==='mock'&&receipt.intake&&JSON.stringify(body)===JSON.stringify({intake_id:receipt.intake.id,key:plan.key}));
  assert.equal(++c.edges,1,'No retry');
  const intent={run:plan.run,project:REF,intake:receipt.intake.id,key:plan.key,at:new Date().toISOString(),maximumCount:1,maximumGeneration:1};
  fs.writeFileSync(path.join(dir,'dispatch-intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});
  receipt.edgeDispatched=true;save();return true;
 }
 return false;
}
async function main(){
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs'),G=await import('../../supabase/functions/simple-coach-mock/staging-cost-guard.mjs');
 const prepared=G.prepareBoundedRequest({training},C.DEFAULT_MODEL);
 assert.equal(sha(prepared.wire),'919ab89f39d8178761401c0dfcf9ac1c6245dfcedf62f3cd48d55898d7f521df');
 assert.equal(Buffer.byteLength(prepared.wire),10467);
 if(mode==='--check'){console.log(JSON.stringify({offline:true,sdk:'2.115.0',requestBytes:10467,requestSha256:sha(prepared.wire),providerCalls:0}));return;}
 assert.equal(mode,'--run-once');
 assert(!fs.existsSync(path.join(dir,'sdk-receipt.json'))&&!fs.existsSync(path.join(dir,'dispatch-intent.json')),'Existing run must only be reconciled, never rerun');
 const activation=JSON.parse(fs.readFileSync(path.join(dir,'activation.json')));
 assert.equal(activation.run,plan.run);assert(Date.parse(activation.expires_at)>Date.now()+10*60000);
 assert(Date.parse(activation.expires_at)-Date.parse(activation.activated_at)<=3600000);
 const credentials=JSON.parse(fs.readFileSync(manifestPath,'utf8'));assert.equal(credentials.ref,REF);
 save();
 try{
  for(const actor of Object.keys(plan.actors)){
   const u=credentials.users[actor];assert(u.id===plan.actors[actor]&&u.email.endsWith('@example.invalid'));
   receipt.counts[actor]={logins:0,consents:0,intakes:0,edges:0};
   const guarded=async(url,options={})=>{
    assert(fence(actor,url,options),'Request outside approved trial');
    const isEdge=new URL(url).pathname.startsWith('/functions/');
    const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(isEdge?135000:20000)]):AbortSignal.timeout(isEdge?135000:20000);
    return fetch(url,{...options,signal,redirect:'error'});
   };
   const db=sandbox.supabase.createClient(BASE,credentials.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:guarded}});
   clients[actor]=db;
   const login=await db.auth.signInWithPassword({email:u.email,password:u.password});delete u.password;
   check(actor+' existing synthetic login',!login.error&&login.data.user?.id===u.id);
   const identity=await db.auth.getUser();check(actor+' server verifies identity',!identity.error&&identity.data.user?.id===u.id);
   const profile=await db.from('profiles').select('id,role').eq('id',u.id).single();
   check(actor+' role preserved',!profile.error&&profile.data.role===(['mock','real'].includes(actor)?'client':'trainer'));
  }
  const owner=clients.mock,cap=await owner.rpc('get_my_coach_access');
  check('one authorized generation available',!cap.error&&cap.data.authorized===true&&cap.data.can_generate===true&&Number(cap.data.consumed_generations)===0);
  const queue=await clients.reviewer.rpc('get_coach_review_queue');
  check('reviewer queue initially empty',!queue.error&&Array.isArray(queue.data)&&queue.data.length===0);
  const g=await owner.rpc('set_my_coach_context_permission',{p_scope:'training_intake',p_allow:true});
  check('synthetic consent registered',!g.error&&g.data===true);
  const grants=await owner.from('context_grants').select('*').eq('user_id',plan.actors.mock).eq('scope','training_intake').eq('notice_version','pilot-supervised-v2').is('revoked_at',null);
  assert(!grants.error&&grants.data.length===1);receipt.grant=grants.data[0];save();
  const intake=await owner.rpc('save_my_training_intake',{p_id:null,p_expected:null,p_training:training,p_submit:true});
  assert(!intake.error,'Synthetic intake save failed');receipt.intake=intake.data;save();
  check('exact submitted Basic v2 intake',receipt.intake.user_id===plan.actors.mock&&receipt.intake.state==='submitted'&&JSON.stringify(Object.keys(receipt.intake.training).sort())===JSON.stringify(Object.keys(training).sort()));
  const started=Date.now();
  const response=await owner.functions.invoke('simple-coach-mock',{body:{intake_id:receipt.intake.id,key:plan.key}});
  receipt.roundtrip_ms=Date.now()-started;
  receipt.edgeResponse=response.data;receipt.edgeError=response.error?{name:response.error.name,status:response.error.context?.status||null}:null;
  if(response.error?.context instanceof Response){try{receipt.edgeError.body=await response.error.context.json();}catch{}}
  save();
  // One readback after dispatch, even on an uncertain response. Never invoke Edge again.
  const ops=await owner.from('coach_operations').select('*').eq('user_id',plan.actors.mock).eq('idempotency_key',plan.key);
  assert(!ops.error,'Operation recovery read failed');assert(ops.data.length<=1,'Duplicate operation');
  receipt.operation=ops.data[0]||null;save();
  if(!receipt.operation){receipt.unresolved='No operation visible after dispatch';return;}
  const op=receipt.operation;
  check('single exact owner/intake/key operation',op.user_id===plan.actors.mock&&op.intake_id===receipt.intake.id&&op.idempotency_key===plan.key);
  check('no routine or retry created',op.routine_id===null&&op.retry_source===null&&op.retry_authorized_at===null);
  for(const actor of ['real','trainer','reviewer']){
   const denied=await clients[actor].from('coach_operations').select('id').eq('id',op.id);
   check(actor+' private operation denied',!!denied.error||denied.data.length===0);
  }
  if(op.proposal){
   receipt.validation=C.reviewProposal(op.proposal,{training});
   check('successful proposal remains pending human review',op.state==='pending_review'&&op.review_required===true);
   const projection=await clients.reviewer.rpc('get_coach_review_queue');
   check('reviewer sees only this synthetic operation',!projection.error&&projection.data.length===1&&projection.data[0].operation.id===op.id&&!projection.data[0].health);
   receipt.reviewerProjection={operation:projection.data[0].operation,training:projection.data[0].training};
  }else receipt.validation={ok:false,failures:[op.error_code||op.state]};
  const final=await owner.rpc('get_my_coach_access');
  check('attempt consumed without granting retries',!final.error&&final.data.can_generate===false&&Number(final.data.consumed_generations)===1);
  receipt.finalAccess=final.data;receipt.completed=true;save();
 }catch(e){receipt.failure=String(e.message).slice(0,250);save();process.exitCode=1;}
 finally{
  receipt.signouts={};
  for(const [actor,db]of Object.entries(clients)){try{const r=await db.auth.signOut({scope:'local'});receipt.signouts[actor]=!r.error;}catch{receipt.signouts[actor]=false;}}
  receipt.finishedAt=new Date().toISOString();save();
 }
 console.log(JSON.stringify({checks:receipt.checks.length,passed:receipt.checks.filter(x=>x.pass).length,state:receipt.operation?.state,error:receipt.operation?.error_code,edgeDispatched:receipt.edgeDispatched,failure:receipt.failure,signouts:receipt.signouts}));
}
main().catch(e=>{console.error('Runner STOP: '+e.message);process.exitCode=1;});
